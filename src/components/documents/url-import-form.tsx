'use client';

import { useCallback, useState } from 'react';
import { Globe, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Document } from '@/lib/types';

interface URLImportFormProps {
  workspaceId: string;
  /** Called optimistically with a temp document object before the API responds */
  onImportStart: (doc: Document) => void;
  /** Called with the real document once the API responds */
  onImportComplete: (doc: Document) => void;
  /** Called if the import fails, with the temp document id to remove */
  onImportError: (tempId: string) => void;
}

function isValidHttpUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function URLImportForm({
  workspaceId,
  onImportStart,
  onImportComplete,
  onImportError,
}: URLImportFormProps) {
  const [url, setUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      const trimmed = url.trim();
      if (!trimmed) return;

      if (!isValidHttpUrl(trimmed)) {
        setValidationError('Please enter a valid HTTP or HTTPS URL.');
        return;
      }
      setValidationError(null);

      const tempId = crypto.randomUUID();
      const hostname = new URL(trimmed).hostname;

      // Optimistic placeholder — shown immediately in the document list
      const optimisticDoc: Document = {
        id: tempId,
        workspace_id: workspaceId,
        uploaded_by: '',
        title: hostname,
        source_type: 'url',
        source_url: trimmed,
        storage_path: null,
        status: 'pending',
        error_message: null,
        chunk_count: 0,
        page_count: null,
        version: 1,
        deleted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      onImportStart(optimisticDoc);
      setIsImporting(true);
      setUrl('');
      toast.loading(`Importing "${hostname}"…`, { id: tempId });

      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: trimmed }),
        });

        if (!res.ok) {
          const { error } = (await res.json()) as { error: string };
          throw new Error(error || `Import failed (${res.status})`);
        }

        const { document } = (await res.json()) as { document: Document };
        onImportComplete(document);
        toast.success(
          `Processing "${hostname}"… this usually takes under a minute.`,
          { id: tempId }
        );
      } catch (err) {
        onImportError(tempId);
        toast.error(
          `Failed to import "${hostname}": ${
            err instanceof Error ? err.message : 'Unknown error'
          }`,
          { id: tempId }
        );
      } finally {
        setIsImporting(false);
      }
    },
    [url, workspaceId, onImportStart, onImportComplete, onImportError]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="url-import-input">Web page URL</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Globe className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="url-import-input"
              type="url"
              placeholder="https://example.com/docs/page"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (validationError) setValidationError(null);
              }}
              disabled={isImporting}
              className="pl-8"
              aria-invalid={validationError ? true : undefined}
              aria-describedby={
                validationError ? 'url-import-error' : undefined
              }
            />
          </div>
          <Button type="submit" disabled={isImporting || !url.trim()}>
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importing…
              </>
            ) : (
              'Import'
            )}
          </Button>
        </div>

        {validationError && (
          <p id="url-import-error" className="text-xs text-destructive" role="alert">
            {validationError}
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Paste any public web page URL. The page content will be fetched,
        extracted, and chunked for semantic search.
      </p>
    </form>
  );
}
