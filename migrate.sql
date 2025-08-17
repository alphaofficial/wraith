-- Migration script to upgrade existing database for local embeddings (384 dimensions)

-- Drop existing index and table to recreate with new dimensions
DROP INDEX IF EXISTS documents_embedding_idx;
DROP INDEX IF EXISTS documents_source_idx;
DROP INDEX IF EXISTS documents_created_at_idx;

-- Update embedding column to 384 dimensions (for all-MiniLM-L6-v2)
-- Note: This requires dropping and recreating the table since vector dimensions can't be altered
DROP TABLE IF EXISTS documents_backup;
CREATE TABLE documents_backup AS SELECT * FROM documents;

DROP TABLE documents;

CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(384), -- Changed from 1536 to 384
  metadata JSONB,
  source VARCHAR(255),
  chunk_index INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create optimized indexes
CREATE INDEX documents_embedding_idx ON documents USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS documents_source_idx ON documents(source);
CREATE INDEX IF NOT EXISTS documents_created_at_idx ON documents(created_at);

-- Note: Old data in documents_backup table would need re-embedding with new model
-- The backup table is kept for reference but data needs to be re-ingested

-- Update statistics for better query planning
ANALYZE documents;