'use client';

/**
 * SourceCitations — collapsible panel listing all cited sources.
 *
 * Shown below the assistant message when citations are available.
 * Each card shows: document title, source type badge, page number,
 * content excerpt, and an optional link for URL sources.
 */

import { ExternalLink, FileText, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { MessageCitation } from '@/lib/types';

interface SourceCitationsProps {
  citations: MessageCitation[];
}

const TYPE_COLORS: Record<string, string> = {
  pdf: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  docx: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  txt: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  md: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  url: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

export function SourceCitations({ citations }: SourceCitationsProps) {
  if (citations.length === 0) return null;

  return (
    <div className="mt-3 space-y-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {citations.length} source{citations.length !== 1 ? 's' : ''} cited
      </p>
      <div className="flex flex-col gap-2">
        {citations.map((citation) => {
          const Icon = citation.sourceType === 'url' ? Globe : FileText;
          return (
            <div
              key={citation.chunkId}
              className="rounded-lg border border-border bg-muted/20 p-2.5 text-xs"
            >
              <div className="mb-1.5 flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-cyan-500/20 text-[9px] font-bold text-cyan-400">
                    {citation.index}
                  </span>
                  <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium text-foreground">
                    {citation.documentTitle}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span
                    className={`inline-flex h-4 items-center rounded px-1 text-[9px] font-medium ${
                      TYPE_COLORS[citation.sourceType as string] ?? TYPE_COLORS.txt
                    }`}
                  >
                    {String(citation.sourceType).toUpperCase()}
                  </span>
                  {citation.pageNumber && (
                    <Badge variant="outline" className="h-4 px-1 text-[9px]">
                      p.{citation.pageNumber}
                    </Badge>
                  )}
                  {citation.sourceUrl && (
                    <a
                      href={citation.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Open source"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
              {citation.excerpt && (
                <p className="line-clamp-2 text-muted-foreground">{citation.excerpt}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
