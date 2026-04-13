/**
 * Inngest function: process-document
 *
 * 4-step durable pipeline triggered whenever a document row is inserted
 * with status 'pending'. Each step is independently retried on failure.
 *
 * Steps:
 *   1. extract-text   — download from Storage (or fetch URL), extract plain text
 *   2. chunk-text     — semantic chunking (paragraph-aware, heading-context preserved)
 *   3. embed-chunks   — batch embed via OpenAI (100 per request, Redis-cached)
 *   4. insert-chunks  — bulk insert to Supabase + update document status
 *
 * Concurrency:     max 5 simultaneous document processing jobs
 * Retries per step: 3 (Inngest exponential backoff)
 * On failure:      sets document status → 'error', captures to Sentry
 */

import { inngest } from '../client';
import { getServiceClient } from '@/lib/supabase/service';
import { extractContent } from '@/lib/rag/extractors';
import { semanticChunk } from '@/lib/rag/chunker';
import { embedBatch } from '@/lib/rag/embedder';
import { DocumentProcessingError } from '@/lib/errors';
import * as Sentry from '@sentry/nextjs';

const CHUNK_INSERT_BATCH = 500;

export const processDocument = inngest.createFunction(
  {
    id: 'process-document',
    name: 'Process Document',
    concurrency: { limit: 5 },
    retries: 3,
    // Inngest v4: trigger moves inside options (2-arg createFunction)
    triggers: [{ event: 'document/process' }],
    onFailure: async ({ event, error }) => {
      // In Inngest v4 onFailure, event.data is the failure payload:
      //   { function_id, run_id, error: JsonError, event: original EventPayload }
      const { documentId } = event.data.event.data as { documentId: string };

      // Capture to Sentry with document context
      Sentry.captureException(error, {
        tags: { inngest_function: 'process-document' },
        extra: { documentId },
      });

      // Mark document as errored so the UI shows a red badge
      const supabase = getServiceClient();
      const errorUpdate = {
        status: 'error',
        error_message: error.message.slice(0, 500),
        updated_at: new Date().toISOString(),
      };
      // @ts-expect-error: Supabase DB types not yet generated — update values are correct
      await supabase.from('documents').update(errorUpdate).eq('id', documentId);
    },
  },
  async ({ event, step }) => {
    const { documentId, workspaceId, storagePath, sourceType, sourceUrl } =
      event.data;

    const supabase = getServiceClient();

    // ─────────────────────────────────────────────────────────────────────────
    // Step 1: Extract text
    // ─────────────────────────────────────────────────────────────────────────
    const { text, pageCount, resolvedTitle } = await step.run(
      'extract-text',
      async () => {
        // Transition to 'processing' so the UI shows the spinner badge
        // @ts-expect-error: Supabase DB types not yet generated — update values are correct
        await supabase.from('documents').update({ status: 'processing', updated_at: new Date().toISOString() }).eq('id', documentId);

        if (sourceType === 'url') {
          if (!sourceUrl) {
            throw new DocumentProcessingError(
              'sourceUrl is required for URL source type',
              documentId,
              'extract-text'
            );
          }
          const result = await extractContent({ sourceType: 'url', sourceUrl });
          return result;
        }

        // File-based: download from Supabase Storage
        if (!storagePath) {
          throw new DocumentProcessingError(
            'storagePath is required for file source types',
            documentId,
            'extract-text'
          );
        }

        const { data: fileData, error: downloadError } = await supabase.storage
          .from('documents')
          .download(storagePath);

        if (downloadError || !fileData) {
          throw new DocumentProcessingError(
            `Failed to download file from Storage: ${downloadError?.message ?? 'empty response'}`,
            documentId,
            'extract-text'
          );
        }

        const buffer = Buffer.from(await fileData.arrayBuffer());

        if (sourceType === 'pdf' || sourceType === 'docx' || sourceType === 'txt' || sourceType === 'md') {
          return extractContent({ sourceType, buffer });
        }

        throw new DocumentProcessingError(
          `Unexpected source type: ${sourceType}`,
          documentId,
          'extract-text'
        );
      }
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Step 2: Chunk text
    // ─────────────────────────────────────────────────────────────────────────
    const chunks = await step.run('chunk-text', async () => {
      return semanticChunk(text, null);
    });

    if (chunks.length === 0) {
      throw new DocumentProcessingError(
        'No chunks were generated from the extracted text',
        documentId,
        'chunk-text'
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Step 3: Embed chunks
    // ─────────────────────────────────────────────────────────────────────────
    const embeddings = await step.run('embed-chunks', async () => {
      return embedBatch(chunks.map((c) => c.content));
    });

    if (embeddings.length !== chunks.length) {
      throw new DocumentProcessingError(
        `Embedding count mismatch: expected ${chunks.length}, got ${embeddings.length}`,
        documentId,
        'embed-chunks'
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Step 4: Insert chunks and mark document ready
    // ─────────────────────────────────────────────────────────────────────────
    await step.run('insert-chunks', async () => {
      // Batch insert in groups of 500 (Supabase recommends ≤1000 per insert)
      for (let i = 0; i < chunks.length; i += CHUNK_INSERT_BATCH) {
        const batchChunks = chunks.slice(i, i + CHUNK_INSERT_BATCH);
        const batchEmbeddings = embeddings.slice(i, i + CHUNK_INSERT_BATCH);

        const rows = batchChunks.map((chunk, j) => ({
          document_id: documentId,
          workspace_id: workspaceId,
          content: chunk.content,
          heading_context: chunk.heading_context,
          page_number: chunk.page_number,
          chunk_index: chunk.chunk_index,
          token_count: chunk.token_count,
          // pgvector accepts a plain number[] — Supabase client serialises correctly
          embedding: batchEmbeddings[j],
        }));

        // @ts-expect-error: Supabase DB types not yet generated — insert values are correct
        const { error: insertError } = await supabase.from('chunks').insert(rows);
        if (insertError) {
          throw new DocumentProcessingError(
            `Chunk insert failed (batch starting at ${i}): ${insertError.message}`,
            documentId,
            'insert-chunks'
          );
        }
      }

      // Update document to 'ready' with final metadata
      const updatePayload: Record<string, unknown> = {
        status: 'ready',
        chunk_count: chunks.length,
        page_count: pageCount ?? null,
        updated_at: new Date().toISOString(),
      };

      // If we resolved a title from URL extraction, update it
      if (resolvedTitle) {
        updatePayload.title = resolvedTitle.slice(0, 255);
      }

      // @ts-expect-error: Supabase DB types not yet generated — update values are correct
      const { error: updateError } = await supabase.from('documents').update(updatePayload).eq('id', documentId);

      if (updateError) {
        throw new DocumentProcessingError(
          `Failed to mark document as ready: ${updateError.message}`,
          documentId,
          'insert-chunks'
        );
      }
    });

    return {
      documentId,
      chunkCount: chunks.length,
      pageCount: pageCount ?? null,
    };
  }
);
