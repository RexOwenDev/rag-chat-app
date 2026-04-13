/**
 * Central config — all magic numbers live here.
 * Import from this file; never inline these values in source code.
 */
export const config = {
  rag: {
    chunkMaxTokens: 400,       // max tokens per semantic chunk
    chunkOverlap: 50,          // overlap tokens between adjacent chunks
    searchCandidates: 20,      // hybrid search returns top-N before rerank
    rerankTopN: 5,             // final results after Cohere reranking
    maxContextChars: 80_000,   // hard cap on prompt context (safety / injection guard)
    embeddingDimensions: 1536, // text-embedding-3-small output dimensions
  },
  upload: {
    maxFileSizeMb: 20,
    allowedMimeTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
    ] as const,
    allowedExtensions: ['pdf', 'docx', 'txt', 'md'] as const,
  },
  rateLimit: {
    chatPerUserPerMin: 20,
    chatPerIpPerMin: 100,
    uploadPerUserPer10Min: 10,
  },
  cache: {
    embeddingTtlSeconds: 60 * 60,        // 1 hour
    analyticsStaleSecs: 30,              // TanStack Query staleTime
  },
  pagination: {
    conversationsPerPage: 20,
    documentsPerPage: 50,
  },
  eval: {
    faithfulnessThresholdGood: 0.8,
    faithfulnessThresholdOk: 0.6,
  },
  softDelete: {
    purgeAfterDays: 30, // Inngest cron permanently deletes after this many days
  },
} as const;

export type AllowedMimeType = (typeof config.upload.allowedMimeTypes)[number];
export type AllowedExtension = (typeof config.upload.allowedExtensions)[number];
