-- Migration 003: HNSW vector index on chunks.embedding
-- Separate migration because HNSW creation is expensive and can time out
-- if bundled with table creation. Run after data is loaded for best performance.

-- HNSW index for approximate nearest-neighbor vector search
-- m=16: number of bi-directional links per node (higher = better recall, more memory)
-- ef_construction=64: search depth during build (higher = better recall, slower build)
create index chunks_embedding_hnsw_idx
  on chunks
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);
