'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FileText } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UploadZone } from './upload-zone';
import { URLImportForm } from './url-import-form';
import { DocumentList } from './document-list';
import { createClient } from '@/lib/supabase/client';
import type { Document, WorkspaceRole } from '@/lib/types';

interface DocumentManagerProps {
  workspaceId: string;
  initialDocs: Document[];
  userRole: WorkspaceRole;
}

/** Upsert: replace matching doc by id, or prepend if not found. */
function upsertDoc(prev: Document[], incoming: Document): Document[] {
  const idx = prev.findIndex((d) => d.id === incoming.id);
  if (idx !== -1) {
    const next = [...prev];
    next[idx] = incoming;
    return next;
  }
  return [incoming, ...prev];
}

export function DocumentManager({
  workspaceId,
  initialDocs,
  userRole,
}: DocumentManagerProps) {
  const [docs, setDocs] = useState<Document[]>(initialDocs);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // ── Supabase Realtime ─────────────────────────────────────────────────────
  // Subscribes to all changes on the documents table filtered to this workspace.
  // INSERT: new doc arrives (from another session or as Realtime confirmation).
  // UPDATE: status changed (pending→processing→ready) or soft-deleted.
  // DELETE: hard delete (rare, backup for soft-delete edge cases).
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`documents:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const incoming = payload.new as unknown as Document;

            if (payload.eventType === 'UPDATE' && incoming.deleted_at) {
              // Soft-deleted: remove from the visible list
              setDocs((prev) => prev.filter((d) => d.id !== incoming.id));
            } else {
              setDocs((prev) => upsertDoc(prev, incoming));
            }
          } else if (payload.eventType === 'DELETE') {
            const removed = payload.old as { id: string };
            setDocs((prev) => prev.filter((d) => d.id !== removed.id));
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [workspaceId]);

  // ── Upload callbacks ──────────────────────────────────────────────────────
  const handleUploadStart = useCallback((optimisticDoc: Document) => {
    setDocs((prev) => [optimisticDoc, ...prev]);
  }, []);

  // Replaces the optimistic placeholder with the confirmed server document.
  // Matching strategy:
  //   - For files: match by title (filename sans extension) and source_type
  //   - For URLs: match by source_url (title may differ after extraction)
  // Optimistic docs are identified by uploaded_by === '' (set in UploadZone
  // and URLImportForm — real docs always have a non-empty user id).
  const handleUploadComplete = useCallback((realDoc: Document) => {
    setDocs((prev) => {
      const tempIdx = prev.findIndex((d) => {
        if (d.uploaded_by !== '') return false;
        if (d.source_type !== realDoc.source_type) return false;
        if (realDoc.source_type === 'url') {
          return d.source_url === realDoc.source_url;
        }
        return d.title === realDoc.title;
      });

      if (tempIdx !== -1) {
        const next = [...prev];
        next[tempIdx] = realDoc;
        return next;
      }
      // No matching temp doc (e.g. Realtime INSERT arrived first) — upsert
      return upsertDoc(prev, realDoc);
    });
  }, []);

  const handleUploadError = useCallback((tempId: string) => {
    setDocs((prev) => prev.filter((d) => d.id !== tempId));
  }, []);

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(
    async (documentId: string) => {
      setIsDeletingId(documentId);
      const doc = docs.find((d) => d.id === documentId);
      const label = doc?.title ?? 'Document';

      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/documents/${documentId}`,
          { method: 'DELETE' }
        );

        if (!res.ok) {
          const { error } = (await res.json()) as { error: string };
          throw new Error(error || `Delete failed (${res.status})`);
        }

        // Remove immediately from local state; Realtime UPDATE (deleted_at set)
        // will also fire and is handled idempotently by the subscription.
        setDocs((prev) => prev.filter((d) => d.id !== documentId));
        toast.success(`"${label}" has been deleted.`);
      } catch (err) {
        toast.error(
          `Failed to delete "${label}": ${
            err instanceof Error ? err.message : 'Unknown error'
          }`
        );
      } finally {
        setIsDeletingId(null);
      }
    },
    [workspaceId, docs]
  );

  // ── Derived counts ────────────────────────────────────────────────────────
  const visibleDocs = docs.filter((d) => !d.deleted_at);
  const totalChunks = visibleDocs
    .filter((d) => d.status === 'ready')
    .reduce((sum, d) => sum + d.chunk_count, 0);

  const canUpload = userRole === 'owner' || userRole === 'editor';

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Page header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">Documents</h1>
        <p className="text-sm text-muted-foreground">
          {visibleDocs.length === 0
            ? 'No documents yet — upload a file or import a URL to get started.'
            : `${visibleDocs.length} ${
                visibleDocs.length === 1 ? 'document' : 'documents'
              }${
                totalChunks > 0
                  ? ` · ${totalChunks.toLocaleString()} chunks indexed`
                  : ''
              }`}
        </p>
      </div>

      <Separator />

      {/* Upload / Import section — visible to owners and editors only */}
      {canUpload && (
        <Tabs defaultValue="upload">
          <TabsList>
            <TabsTrigger value="upload">Upload File</TabsTrigger>
            <TabsTrigger value="url">Import URL</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-3">
            <UploadZone
              workspaceId={workspaceId}
              onUploadStart={handleUploadStart}
              onUploadComplete={handleUploadComplete}
              onUploadError={handleUploadError}
            />
          </TabsContent>

          <TabsContent value="url" className="mt-3">
            <URLImportForm
              workspaceId={workspaceId}
              onImportStart={handleUploadStart}
              onImportComplete={handleUploadComplete}
              onImportError={handleUploadError}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* Empty state — shown when there are no documents */}
      {visibleDocs.length === 0 && !canUpload && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-12 text-center">
          <div className="rounded-full border-2 border-border p-3 text-muted-foreground">
            <FileText className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              No documents yet
            </p>
            <p className="text-xs text-muted-foreground">
              Ask an owner or editor to upload documents to this workspace.
            </p>
          </div>
        </div>
      )}

      {/* Document list */}
      {visibleDocs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            All documents
          </h2>
          <DocumentList
            docs={visibleDocs}
            isLoading={false}
            userRole={userRole}
            onDelete={handleDelete}
            isDeletingId={isDeletingId}
          />
        </div>
      )}

      {/* Viewer empty state — shown when viewer sees an empty workspace */}
      {visibleDocs.length === 0 && canUpload && (
        <p className="text-center text-xs text-muted-foreground">
          Documents you upload will appear here once processing is complete.
        </p>
      )}
    </div>
  );
}

