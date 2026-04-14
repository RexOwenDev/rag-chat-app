'use client';

/**
 * ChatInterface — the full chat experience: message list + input.
 *
 * Accepts initialMessages and conversationId from the Server Component
 * (pre-fetched on load for SSR) then hands off to the useRAGChat hook
 * for client-side streaming.
 *
 * Empty state: shown when no documents are uploaded (noDocuments=true).
 */

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, BookOpen, Loader2 } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { useRAGChat } from '@/lib/hooks/use-chat';
import { MessageBubble } from './message-bubble';
import { SourceCitations } from './source-citations';
import { SuggestedQuestions } from './suggested-questions';
import { ChatInput } from './chat-input';
import type { RAGChatMessage } from '@/lib/hooks/use-chat';
import type { MessageCitation } from '@/lib/types';
import Link from 'next/link';

interface ChatInterfaceProps {
  workspaceId: string;
  conversationId?: string;
  initialMessages?: RAGChatMessage[];
  noDocuments?: boolean;
}

export function ChatInterface({
  workspaceId,
  conversationId: initialConversationId,
  initialMessages = [],
  noDocuments = false,
}: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, isLoading, error, citations, suggestedQuestions, sendMessage, stop } =
    useRAGChat({
      workspaceId,
      conversationId: initialConversationId,
      initialMessages,
    });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  function handleSubmit() {
    const text = inputValue.trim();
    if (!text || isLoading) return;
    setInputValue('');
    void sendMessage(text);
  }

  function handleSelectSuggestion(question: string) {
    // Guard: don't send if a response is already streaming.
    if (isLoading) return;
    setInputValue('');
    void sendMessage(question);
  }

  // ─── Empty state (no documents) ────────────────────────────────────────
  if (noDocuments) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <BookOpen className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">No documents yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload your first document to start asking questions.
          </p>
        </div>
        <Link
          href={`/workspaces/${workspaceId}/documents`}
          className={buttonVariants({ size: 'sm' })}
        >
          Upload Document
        </Link>
      </div>
    );
  }

  // ─── Initial empty chat ─────────────────────────────────────────────────
  const isEmpty = messages.length === 0 && !isLoading;

  // Citations belong to the last message only if it's an assistant message.
  const lastAssistantIsRecent =
    messages.length > 0 && messages[messages.length - 1]?.role === 'assistant';

  return (
    <div className="flex h-full flex-col">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4">
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center opacity-60">
            <BookOpen className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Ask a question to search your documents
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-4">
            {messages.map((message, i) => {
              const isLastAssistant =
                message.role === 'assistant' && i === messages.length - 1;
              const showCitations = isLastAssistant && citations.length > 0 && lastAssistantIsRecent;
              const showSuggestions =
                isLastAssistant && suggestedQuestions.length > 0 && !isLoading;

              // Determine the citations to show for this specific message
              const messageCitations: MessageCitation[] = showCitations ? citations : [];

              return (
                <div key={message.id}>
                  <MessageBubble
                    message={message}
                    citations={messageCitations}
                    isStreaming={isLoading && isLastAssistant}
                  />
                  {showCitations && <SourceCitations citations={citations} />}
                  {showSuggestions && (
                    <SuggestedQuestions
                      questions={suggestedQuestions}
                      onSelect={handleSelectSuggestion}
                    />
                  )}
                </div>
              );
            })}

            {/* Loading indicator when waiting for first token */}
            {isLoading && messages.at(-1)?.role === 'user' && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-muted/40 px-4 py-3 ring-1 ring-border">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Searching documents…</span>
                </div>
              </div>
            )}

            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error.message}
              </div>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-border bg-background p-4">
        <div className="mx-auto max-w-3xl">
          <ChatInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmit}
            onStop={stop}
            isLoading={isLoading}
          />
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
            Answers are grounded in your workspace documents. Always verify before acting.
          </p>
        </div>
      </div>
    </div>
  );
}
