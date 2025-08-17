CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(384), -- Changed from 1536 to 384 for all-MiniLM-L6-v2
  metadata JSONB,
  source VARCHAR(255),
  chunk_index INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Drop existing index if it exists
DROP INDEX IF EXISTS documents_embedding_idx;

-- Create HNSW index for better performance on large datasets
CREATE INDEX documents_embedding_idx ON documents USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- Additional indexes for common queries
CREATE INDEX documents_source_idx ON documents(source);
CREATE INDEX documents_created_at_idx ON documents(created_at);