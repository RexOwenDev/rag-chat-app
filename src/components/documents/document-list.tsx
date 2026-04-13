'use client';

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  Loader2,
  Trash2,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Document, WorkspaceRole } from '@/lib/types';

interface DocumentListProps {
  docs: Document[];
  isLoading: boolean;
  userRole: WorkspaceRole;
  onDelete: (id: string) => void;
  isDeletingId: string | null;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));
}

const SOURCE_COLORS: Record<string, string> = {
  pdf: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  docx: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  txt: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  md: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  url: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

function SourceTypeBadge({ type }: { type: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center rounded px-1.5 text-xs font-medium',
        SOURCE_COLORS[type] ?? SOURCE_COLORS.txt
      )}
    >
      {type.toUpperCase()}
    </span>
  );
}

function StatusBadge({ doc }: { doc: Document }) {
  if (doc.status === 'pending') {
    return (
      <Badge
        variant="outline"
        className="gap-1.5 border-border text-muted-foreground"
      >
        <Clock className="h-3 w-3" />
        Pending
      </Badge>
    );
  }

  if (doc.status === 'processing') {
    return (
      <Badge
        variant="outline"
        className="gap-1.5 border-blue-300 text-blue-500 dark:border-blue-700"
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        Processing
      </Badge>
    );
  }

  if (doc.status === 'ready') {
    return (
      <Badge
        variant="outline"
        className="gap-1.5 border-green-300 text-green-600 dark:border-green-700"
      >
        <CheckCircle2 className="h-3 w-3" />
        Ready
      </Badge>
    );
  }

  // error — wrap in tooltip to surface the error message
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex cursor-help" />}>
        <Badge
          variant="outline"
          className="pointer-events-none gap-1.5 border-destructive/30 text-destructive"
        >
          <AlertCircle className="h-3 w-3" />
          Error
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top">
        {doc.error_message ?? 'Processing failed. Please try re-uploading.'}
      </TooltipContent>
    </Tooltip>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0"
        >
          <Skeleton className="h-4 w-4 shrink-0 rounded" />
          <Skeleton className="h-4 flex-1 rounded" />
          <Skeleton className="h-5 w-10 shrink-0 rounded" />
          <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
          <Skeleton className="hidden h-4 w-20 shrink-0 rounded sm:block" />
          <Skeleton className="hidden h-4 w-24 shrink-0 rounded md:block" />
          <Skeleton className="h-7 w-7 shrink-0 rounded" />
        </div>
      ))}
    </>
  );
}

export function DocumentList({
  docs,
  isLoading,
  userRole,
  onDelete,
  isDeletingId,
}: DocumentListProps) {
  const canDelete = userRole === 'owner' || userRole === 'editor';

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-lg border border-border">
        <SkeletonRows />
      </div>
    );
  }

  if (docs.length === 0) {
    // Empty state handled by DocumentManager — list renders nothing
    return null;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {docs.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0 transition-colors hover:bg-muted/20"
        >
          {/* Source type icon */}
          {doc.source_type === 'url' ? (
            <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}

          {/* Title + optional external link */}
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <span
              className="truncate text-sm font-medium text-foreground"
              title={doc.title}
            >
              {doc.title}
            </span>
            {doc.source_url && (
              <a
                href={doc.source_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Open source URL"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {/* Source type badge */}
          <SourceTypeBadge type={doc.source_type} />

          {/* Status badge */}
          <div className="shrink-0">
            <StatusBadge doc={doc} />
          </div>

          {/* Chunk count (hidden on small screens) */}
          <span className="hidden w-20 shrink-0 text-right text-xs tabular-nums text-muted-foreground sm:block">
            {doc.status === 'ready'
              ? `${doc.chunk_count.toLocaleString()} chunks`
              : '—'}
          </span>

          {/* Upload date (hidden on small screens) */}
          <span className="hidden w-24 shrink-0 text-right text-xs text-muted-foreground md:block">
            {formatDate(doc.created_at)}
          </span>

          {/* Delete action */}
          <div className="shrink-0">
            {canDelete ? (
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      disabled={isDeletingId === doc.id}
                      aria-label={`Delete "${doc.title}"`}
                    />
                  }
                >
                  {isDeletingId === doc.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete document?</AlertDialogTitle>
                    <AlertDialogDescription>
                      &ldquo;{doc.title}&rdquo; will be removed from this workspace.
                      It will be permanently purged after 30 days.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={() => onDelete(doc.id)}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              /* Spacer keeps layout aligned for viewers */
              <div className="size-7" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
