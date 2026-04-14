'use client';

/**
 * MessageBubble — renders a single chat message.
 *
 * For assistant messages, parses [N] citation markers from the text and
 * replaces them with CitationBadge components. Uses a simple regex split
 * to avoid full markdown parsing while still supporting basic formatting.
 *
 * User messages are rendered as plain text in a right-aligned bubble.
 */

import { Fragment } from 'react';
import { cn } from '@/lib/utils';
import { CitationBadge } from './citation-badge';
import type { MessageCitation } from '@/lib/types';
import type { RAGChatMessage } from '@/lib/hooks/use-chat';

interface MessageBubbleProps {
  message: RAGChatMessage;
  citations: MessageCitation[];
  isStreaming?: boolean;
}

/**
 * Splits text on [N] citation markers and returns an array of string
 * and citation-index segments.
 */
function parseCitationMarkers(text: string): Array<string | number> {
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((part) => {
    const match = part.match(/^\[(\d+)\]$/);
    return match ? parseInt(match[1]!, 10) : part;
  });
}

export function MessageBubble({ message, citations, isStreaming = false }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[70%] rounded-2xl rounded-br-sm bg-cyan-500/20 px-4 py-2.5 text-sm text-foreground ring-1 ring-cyan-500/20">
          {message.text}
        </div>
      </div>
    );
  }

  // Build a citation lookup map for fast [N] → MessageCitation resolution
  const citationMap = new Map(citations.map((c) => [c.index, c]));

  // Parse citation markers and render inline badges
  const segments = parseCitationMarkers(message.text);

  return (
    <div className="flex justify-start">
      <div
        className={cn(
          'max-w-[85%] rounded-2xl rounded-bl-sm bg-muted/40 px-4 py-3 text-sm text-foreground ring-1 ring-border',
          isStreaming && 'after:ml-0.5 after:animate-pulse after:content-["▋"]'
        )}
      >
        <p className="whitespace-pre-wrap leading-relaxed">
          {segments.map((segment, i) => {
            if (typeof segment === 'string') {
              return <Fragment key={i}>{segment}</Fragment>;
            }
            // Numeric segment = citation index
            const citation = citationMap.get(segment);
            if (!citation) return <Fragment key={i}>[{segment}]</Fragment>;
            return (
              <Fragment key={i}>
                {' '}
                <CitationBadge citation={citation} />
                {' '}
              </Fragment>
            );
          })}
        </p>
      </div>
    </div>
  );
}
