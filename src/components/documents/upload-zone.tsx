'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { config } from '@/lib/config';
import type { Document } from '@/lib/types';

interface UploadZoneProps {
  workspaceId: string;
  /** Called optimistically with a temp document object before the API responds */
  onUploadStart: (doc: Document) => void;
  /** Called with the real document once the API responds */
  onUploadComplete: (doc: Document) => void;
  /** Called if the upload fails, with the temp document id to remove */
  onUploadError: (tempId: string) => void;
}

const ACCEPTED_TYPES = config.upload.allowedExtensions.map((ext) => `.${ext}`).join(',');
const MAX_SIZE_MB = config.upload.maxFileSizeMb;

export function UploadZone({
  workspaceId,
  onUploadStart,
  onUploadComplete,
  onUploadError,
}: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      const tempId = crypto.randomUUID();

      // Validate on client before hitting the server
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!config.upload.allowedExtensions.includes(ext as never)) {
        toast.error(`File type ".${ext}" is not supported. Use ${config.upload.allowedExtensions.join(', ')}.`);
        return;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        toast.error(`File is too large. Maximum size is ${MAX_SIZE_MB} MB.`);
        return;
      }

      // Optimistic update — show the document immediately with 'pending' status
      const optimisticDoc: Document = {
        id: tempId,
        workspace_id: workspaceId,
        uploaded_by: '',
        title: file.name.replace(/\.[^.]+$/, ''),
        source_type: ext as Document['source_type'],
        source_url: null,
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
      onUploadStart(optimisticDoc);
      setIsUploading(true);

      toast.loading(`Uploading "${file.name}"…`, { id: tempId });

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', file.name.replace(/\.[^.]+$/, ''));

        const res = await fetch(
          `/api/workspaces/${workspaceId}/documents`,
          { method: 'POST', body: formData }
        );

        if (!res.ok) {
          const { error } = await res.json() as { error: string };
          throw new Error(error || `Upload failed (${res.status})`);
        }

        const { document } = await res.json() as { document: Document };
        onUploadComplete(document);
        toast.success(
          `Processing "${file.name}"… this usually takes under a minute.`,
          { id: tempId }
        );
      } catch (err) {
        onUploadError(tempId);
        toast.error(
          `Failed to upload "${file.name}": ${err instanceof Error ? err.message : 'Unknown error'}`,
          { id: tempId }
        );
      } finally {
        setIsUploading(false);
      }
    },
    [workspaceId, onUploadStart, onUploadComplete, onUploadError]
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      // Upload each file sequentially to avoid flooding
      Array.from(files).forEach((file) => uploadFile(file));
    },
    [uploadFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload documents — drag and drop files here or click to browse"
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-colors cursor-pointer select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isDragOver
          ? 'border-primary bg-primary/5 shadow-[0_0_0_4px_rgba(var(--color-primary)/0.1)]'
          : 'border-border hover:border-primary/60 hover:bg-accent/20'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        multiple
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
        aria-hidden="true"
        tabIndex={-1}
      />

      <div className="flex flex-col items-center gap-3 pointer-events-none">
        {isUploading ? (
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
        ) : (
          <div
            className={cn(
              'rounded-full border-2 p-3 transition-colors',
              isDragOver ? 'border-primary text-primary' : 'border-border text-muted-foreground'
            )}
          >
            <Upload className="h-6 w-6" />
          </div>
        )}

        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            {isDragOver ? 'Drop to upload' : 'Drag files here, or click to browse'}
          </p>
          <p className="text-xs text-muted-foreground">
            Supports PDF, DOCX, TXT, and Markdown · Max {MAX_SIZE_MB} MB per file
          </p>
        </div>

        {/* File type icons */}
        <div className="flex items-center gap-2 mt-1">
          {(['pdf', 'docx', 'txt', 'md'] as const).map((ext) => (
            <div
              key={ext}
              className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground"
            >
              <FileText className="h-3 w-3" />
              {ext.toUpperCase()}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
