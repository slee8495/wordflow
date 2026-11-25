-- One-off: creates the films table (src/db/schema.ts `films`). Additive only.
CREATE TABLE IF NOT EXISTS films (
  id serial PRIMARY KEY,
  curriculum_item_id integer NOT NULL UNIQUE REFERENCES curriculum_items(id),
  lang varchar(8) NOT NULL DEFAULT 'ko',
  status varchar(16) NOT NULL,
  script jsonb NOT NULL,
  cues jsonb,
  video_url text,
  poster_url text,
  duration_sec real,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
