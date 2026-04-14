'use client';

/**
 * CitationBadge — inline [N] citation marker with a HoverCard popup.
 *
 * Rendered inside MessageBubble wherever [N] markers appear in the
 * assistant's response text. The HoverCard shows the source document
 * title, page number, and a content excerpt.
 */

import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { FileText, Globe } from 'lucide-react';
import type { MessageCitation } from '@/lib/types';

interface CitationBadgeProps {
  citation: MessageCitation;
}

export function CitationBadge({ citation }: CitationBadgeProps) {
  const Icon = citation.sourceType === 'url' ? Globe : FileText;

  return (
    <HoverCard>
      <HoverCardTrigger>
        <button
          type="button"
          className="inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded bg-cyan-500/20 text-[10px] font-bold text-cyan-400 ring-1 ring-cyan-500/40 transition-all hover:bg-cyan-500/30 hover:ring-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          aria-label={`Citation ${citation.index}: ${citation.documentTitle}`}
        >
          {citation.index}
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        className="w-80 p-0"
        sideOffset={6}
      >
        <div className="rounded-md border border-border bg-card p-3 shadow-lg">
          {/* Source header */}
          <div className="mb-2 flex items-start gap-2">
            <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" />
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-foreground">
                {citation.documentTitle}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {citation.pageNumber ? `Page ${citation.pageNumber}` : 'Source document'}
                {citation.sourceUrl && (
                  <>
                    {' · '}
                    <a
                      href={citation.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-foreground"
                    >
                      Open
                    </a>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Excerpt */}
          {citation.excerpt && (
            <blockquote className="mt-1 border-l-2 border-cyan-500/40 pl-2 text-xs text-muted-foreground line-clamp-4">
              {citation.excerpt}
            </blockquote>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
