CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    employee_code TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    department TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS face_embeddings (
    id SERIAL PRIMARY KEY,
    employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
    embedding vector(512),  -- insightface buffalo ArcFace output dimension
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS face_embeddings_hnsw
    ON face_embeddings USING hnsw (embedding vector_cosine_ops);

-- Depositor details the recycling station collects at registration. They hang
-- off the same row the face embeddings do, so one code identifies one person.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS age TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS ward TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS citizen_id TEXT;

-- A finished visit. employee_id NULL = anonymous: the weights still count
-- towards the station total, they're just not attributed to anyone.
CREATE TABLE IF NOT EXISTS weigh_sessions (
    id SERIAL PRIMARY KEY,
    employee_id INT REFERENCES employees(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS weigh_items (
    id SERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES weigh_sessions(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    weight_kg NUMERIC(10, 2) NOT NULL CHECK (weight_kg >= 0)
);

CREATE INDEX IF NOT EXISTS weigh_sessions_employee
    ON weigh_sessions (employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS weigh_items_session ON weigh_items (session_id);
