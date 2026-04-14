'use client';

/**
 * MessageBubble — renders a single chat message.
 *
 * For assistant messages, parses [N] citation markers from the text and
 * replaces them with CitationBadge components. Uses a simple regex split
 * to avoid full markdown parsing while still supporting basic formatting.
 *
 * User messages are rendered as plain text in a right-aligned bubble.
 *
 * Eval score badges (faithfulness/relevance) appear below completed assistant
 * messages when async evaluation has run — scores arrive via conversation
 * history prefetch, not during the streaming phase.
 */

import { Fragment } from 'react';
import { cn } from '@/lib/utils';
import { CitationBadge } from './citation-badge';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { config } from '@/lib/config';
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

/** Returns Tailwind color classes for a 0–1 eval score */
function evalScoreClassName(score: number): string {
  if (score >= config.eval.faithfulnessThresholdGood) {
    return 'border-green-500/20 bg-green-500/10 text-green-400';
  }
  if (score >= config.eval.faithfulnessThresholdOk) {
    return 'border-yellow-500/20 bg-yellow-500/10 text-yellow-400';
  }
  return 'border-red-500/20 bg-red-500/10 text-red-400';
}

interface EvalScoreBadgeProps {
  label: string;
  score: number;
  tooltip: string;
}

function EvalScoreBadge({ label, score, tooltip }: EvalScoreBadgeProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge
            variant="outline"
            className={cn('cursor-default text-[10px]', evalScoreClassName(score))}
          >
            {label}: {(score * 100).toFixed(0)}%
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
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

  // Only show eval scores on completed (non-streaming) messages that have been evaluated
  const showScores =
    !isStreaming &&
    (message.faithfulnessScore != null || message.relevanceScore != null);

  return (
    <div className="flex flex-col items-start gap-1.5">
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

      {showScores && (
        <div className="flex gap-1.5 px-1">
          {message.faithfulnessScore != null && (
            <EvalScoreBadge
              label="Faithful"
              score={message.faithfulnessScore}
              tooltip="How well the answer is grounded in the retrieved documents"
            />
          )}
          {message.relevanceScore != null && (
            <EvalScoreBadge
              label="Relevant"
              score={message.relevanceScore}
              tooltip="How well the answer addresses the user's question"
            />
          )}
        </div>
      )}
    </div>
  );
}
