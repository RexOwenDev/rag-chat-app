'use client';

/**
 * useRAGChat — custom streaming chat hook for the RAG knowledge base.
 *
 * Architecture:
 *   - Uses DefaultChatTransport (subclassed to expose protected processResponseStream)
 *     for SSE decoding: ReadableStream<Uint8Array> → ReadableStream<UIMessageChunk>
 *   - Uses readUIMessageStream to yield progressive UIMessage states as the
 *     assistant response streams in
 *   - Citation metadata arrives as a 'data-citations' part before the text stream
 *   - Suggested questions are parsed from trailing JSON appended to the response
 *
 * @ai-sdk/react is NOT installed — this hook implements the same contract manually.
 */

import { useCallback, useRef, useState } from 'react';
import {
  DefaultChatTransport,
  readUIMessageStream,
  isDataUIPart,
  isTextUIPart,
} from 'ai';
import type { UIMessage, UIMessageChunk } from 'ai';
import type { MessageCitation } from '@/lib/types';

// Subclass to expose the protected SSE decoder
class StreamDecoder extends DefaultChatTransport<UIMessage> {
  public decode(raw: ReadableStream<Uint8Array>): ReadableStream<UIMessageChunk> {
    return this.processResponseStream(raw);
  }
}

export interface RAGChatMessage {
  id: string;
  role: 'user' | 'assistant';
  /** Assembled text from all TextUIPart items in the parts array */
  text: string;
  /** Raw parts (for citations, reasoning, etc.) */
  parts: UIMessage['parts'];
}

interface UseRAGChatOptions {
  workspaceId: string;
  conversationId?: string;
  initialMessages?: RAGChatMessage[];
}

interface UseRAGChatReturn {
  messages: RAGChatMessage[];
  isLoading: boolean;
  error: Error | null;
  citations: MessageCitation[];
  suggestedQuestions: string[];
  conversationId: string | undefined;
  sendMessage: (text: string) => Promise<void>;
  stop: () => void;
}

/** Extracts concatenated text from UIMessage parts */
function getTextFromParts(parts: UIMessage['parts']): string {
  return parts
    .filter(isTextUIPart)
    .map((p) => p.text)
    .join('');
}

/** Parses the trailing suggested-questions JSON block Claude appends */
function parseSuggestedQuestions(text: string): string[] {
  const match = text.match(/\{"suggestedQuestions":\s*\[[\s\S]*?\]\}/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as { suggestedQuestions: string[] };
    return Array.isArray(parsed.suggestedQuestions) ? parsed.suggestedQuestions : [];
  } catch {
    return [];
  }
}

/** Strips the trailing suggested-questions JSON block from displayed text */
function stripSuggestedQuestions(text: string): string {
  return text.replace(/\s*\{"suggestedQuestions":\s*\[[\s\S]*?\]\}\s*$/, '').trim();
}

export function useRAGChat({
  workspaceId,
  conversationId: initialConversationId,
  initialMessages = [],
}: UseRAGChatOptions): UseRAGChatReturn {
  const [messages, setMessages] = useState<RAGChatMessage[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [citations, setCitations] = useState<MessageCitation[]>([]);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(
    initialConversationId
  );

  const abortRef = useRef<AbortController | null>(null);
  const decoderRef = useRef<StreamDecoder | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (isLoading) return;

      // Add user message optimistically
      const userMsg: RAGChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        text,
        parts: [{ type: 'text', text }],
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setError(null);
      setCitations([]);
      setSuggestedQuestions([]);

      abortRef.current = new AbortController();

      // Lazy-init the decoder (stable across calls — it's stateless)
      if (!decoderRef.current) {
        decoderRef.current = new StreamDecoder();
      }

      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/chat`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [
                // Send current message history as simple {role, content} pairs
                ...messages.map((m) => ({ role: m.role, content: m.text })),
                { role: 'user', content: text },
              ],
              conversationId,
            }),
            signal: abortRef.current.signal,
          }
        );

        if (!response.ok) {
          const body = await response.text().catch(() => 'Unknown error');
          throw new Error(`Chat API error (${response.status}): ${body.slice(0, 200)}`);
        }

        // Capture conversation ID from the response header (set when a new conversation is created)
        const responseConvId = response.headers.get('X-Conversation-Id');
        if (responseConvId && !conversationId) {
          setConversationId(responseConvId);
        }

        if (!response.body) throw new Error('Response has no body');

        // Decode the SSE wire format into UIMessageChunk stream
        const chunkStream = decoderRef.current!.decode(response.body);

        // Placeholder for the streaming assistant message
        const assistantId = crypto.randomUUID();
        let finalText = '';

        for await (const progressiveMsg of readUIMessageStream({ stream: chunkStream })) {
          // Extract citation data parts
          for (const part of progressiveMsg.parts) {
            if (isDataUIPart(part) && (part as { type: string }).type === 'data-citations') {
              setCitations((part as { data: MessageCitation[] }).data);
            }
          }

          // Update the streaming assistant message in state
          const rawText = getTextFromParts(progressiveMsg.parts);
          finalText = rawText;

          setMessages((prev) => {
            const withoutAssistant = prev.filter((m) => m.id !== assistantId);
            return [
              ...withoutAssistant,
              {
                id: assistantId,
                role: 'assistant',
                text: stripSuggestedQuestions(rawText),
                parts: progressiveMsg.parts,
              },
            ];
          });
        }

        // Parse suggested questions from the final complete text
        const questions = parseSuggestedQuestions(finalText);
        if (questions.length > 0) setSuggestedQuestions(questions);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // User cancelled — keep messages as-is
          return;
        }
        const displayError =
          err instanceof Error ? err : new Error('An unexpected error occurred');
        setError(displayError);
        // Remove the optimistic user message on hard failure
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading, workspaceId, conversationId]
  );

  return {
    messages,
    isLoading,
    error,
    citations,
    suggestedQuestions,
    conversationId,
    sendMessage,
    stop,
  };
}
