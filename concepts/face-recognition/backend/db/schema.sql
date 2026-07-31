CREATE EXTENSION IF NOT EXISTS vector;

-- ── Migration ──
-- The depositor table started life as `employees` (this began as a department
-- face-recognition experiment) and is now `people`. Rename in place when an
-- older database is found; a no-op on a fresh one. Applied on backend startup,
-- so it must stay idempotent.
DO $$
BEGIN
    IF to_regclass('public.employees') IS NOT NULL
       AND to_regclass('public.people') IS NULL THEN
        ALTER TABLE employees RENAME TO people;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'people' AND column_name = 'employee_code') THEN
        ALTER TABLE people RENAME COLUMN employee_code TO code;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'face_embeddings' AND column_name = 'employee_id') THEN
        ALTER TABLE face_embeddings RENAME COLUMN employee_id TO person_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'weigh_sessions' AND column_name = 'employee_id') THEN
        ALTER TABLE weigh_sessions RENAME COLUMN employee_id TO person_id;
    END IF;
END $$;

-- ── Schema ──

CREATE TABLE IF NOT EXISTS people (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    department TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Depositor details the recycling station collects at registration. They hang
-- off the same row the face embeddings do, so one code identifies one person.
ALTER TABLE people ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS age TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS ward TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS citizen_id TEXT;

CREATE TABLE IF NOT EXISTS face_embeddings (
    id SERIAL PRIMARY KEY,
    person_id INT REFERENCES people(id) ON DELETE CASCADE,
    embedding vector(512),  -- insightface buffalo ArcFace output dimension
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS face_embeddings_hnsw
    ON face_embeddings USING hnsw (embedding vector_cosine_ops);

-- A finished visit. person_id NULL = anonymous: the weights still count
-- towards the station total, they're just not attributed to anyone.
CREATE TABLE IF NOT EXISTS weigh_sessions (
    id SERIAL PRIMARY KEY,
    person_id INT REFERENCES people(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS weigh_items (
    id SERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES weigh_sessions(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    weight_kg NUMERIC(10, 2) NOT NULL CHECK (weight_kg >= 0)
);

CREATE INDEX IF NOT EXISTS weigh_sessions_person
    ON weigh_sessions (person_id, created_at DESC);
CREATE INDEX IF NOT EXISTS weigh_items_session ON weigh_items (session_id);
