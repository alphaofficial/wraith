# Wraith

A RAG (Retrieval-Augmented Generation) application for document Q&A that allows you to ingest PDF documents and ask questions about their content using AI.

## Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd wraith
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file with your OpenAI API key:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

4. **Start PostgreSQL with pgvector**
   ```bash
   docker-compose up -d
   ```

5. **Initialize the database**
   ```bash
   docker exec -i wraith-postgres-1 psql -U postgres -d wraith < init.sql
   ```

## Usage

### Development
```bash
npm run dev
```

### Build
```bash
npm run build
```

### Commands

**Ingest documents:**
```bash
npm run dev ingest
```
- Prompts you to enter a file or directory path
- Processes PDF files and adds them to the knowledge base

**Query documents:**
```bash
npm run dev query
```
- Start an interactive Q&A session
- Type 'exit' to quit


### Database Schema
```sql
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB,
  source VARCHAR(255),
  chunk_index INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Optimized indexes
CREATE INDEX documents_embedding_idx ON documents USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX documents_source_idx ON documents(source);
CREATE INDEX documents_created_at_idx ON documents(created_at);
```

### Upgrading Existing Databases
If you have an existing database with the old ivfflat index, upgrade it for better performance:
```bash
docker exec -i wraith-postgres-1 psql -U postgres -d wraith < migrate.sql
```