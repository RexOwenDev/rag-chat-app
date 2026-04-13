-- Migration 006: hybrid_search() — BM25 (FTS) + vector cosine with Reciprocal Rank Fusion

create or replace function hybrid_search(
  p_workspace_id    uuid,
  p_query_text      text,
  p_query_embedding vector(1536),
  p_match_count     int default 20,
  p_rrf_k           int default 60
)
returns table (
  chunk_id        uuid,
  document_id     uuid,
  content         text,
  heading_context text,
  page_number     int,
  rrf_score       float
)
language sql stable
as $$
  with vector_results as (
    select
      c.id                              as chunk_id,
      row_number() over (
        order by c.embedding <=> p_query_embedding
      )                                 as rank
    from chunks c
    where c.workspace_id = p_workspace_id
      and c.embedding is not null
    order by c.embedding <=> p_query_embedding
    limit p_match_count * 2            -- cast wider net before RRF merge
  ),
  fts_results as (
    select
      c.id                              as chunk_id,
      row_number() over (
        order by ts_rank(c.fts, websearch_to_tsquery('english', p_query_text)) desc
      )                                 as rank
    from chunks c
    where c.workspace_id = p_workspace_id
      and c.fts @@ websearch_to_tsquery('english', p_query_text)
    order by ts_rank(c.fts, websearch_to_tsquery('english', p_query_text)) desc
    limit p_match_count * 2
  ),
  rrf as (
    select
      coalesce(v.chunk_id, f.chunk_id)               as chunk_id,
      coalesce(1.0 / (p_rrf_k + v.rank::float), 0) +
      coalesce(1.0 / (p_rrf_k + f.rank::float), 0)  as rrf_score
    from vector_results v
    full outer join fts_results f on v.chunk_id = f.chunk_id
  )
  select
    r.chunk_id,
    c.document_id,
    c.content,
    c.heading_context,
    c.page_number,
    r.rrf_score
  from rrf r
  join chunks c    on c.id = r.chunk_id
  join documents d on d.id = c.document_id
  where d.deleted_at is null          -- exclude soft-deleted documents
  order by r.rrf_score desc
  limit p_match_count;
$$;
