-- Migration 001: Enable required PostgreSQL extensions
-- Must run before any table that uses these extension types.

create extension if not exists "uuid-ossp";   -- uuid_generate_v4()
create extension if not exists "vector";       -- pgvector: vector type + HNSW/IVFFlat indexes
create extension if not exists "pg_trgm";      -- trigram similarity (used for fuzzy search fallback)
