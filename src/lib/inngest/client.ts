/**
 * Inngest client — single instance shared across all functions.
 * Environment variables (INNGEST_SIGNING_KEY, INNGEST_EVENT_KEY) are
 * automatically read by the Inngest SDK from process.env.
 */

import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'rag-knowledge-base',
  name: 'RAG Knowledge Base',
});

/**
 * Event type registry — all Inngest events in this project.
 * Adding a new event: extend this type and TypeScript will enforce it everywhere.
 */
export type InngestEvents = {
  'document/process': {
    data: {
      documentId: string;
      workspaceId: string;
      /** Supabase Storage path, e.g. "workspaces/{wId}/{docId}" */
      storagePath: string | null;
      sourceType: 'pdf' | 'docx' | 'txt' | 'md' | 'url';
      /** Only set when sourceType === 'url' */
      sourceUrl?: string;
    };
  };
  'response/evaluate': {
    data: {
      messageId: string;
      conversationId: string;
      query: string;
      response: string;
      contextChunkIds: string[];
    };
  };
};
