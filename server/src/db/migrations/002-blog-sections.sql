CREATE TABLE IF NOT EXISTS blog_sections (
  id BIGSERIAL PRIMARY KEY,
  blog_post_id BIGINT NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  parent_id BIGINT,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT blog_sections_blog_id_unique UNIQUE (blog_post_id, id),
  CONSTRAINT blog_sections_parent_same_blog_fk
    FOREIGN KEY (blog_post_id, parent_id)
    REFERENCES blog_sections (blog_post_id, id)
    ON DELETE CASCADE,
  CONSTRAINT blog_sections_parent_not_self CHECK (parent_id IS NULL OR parent_id <> id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'blog_sections'::regclass AND conname = 'blog_sections_blog_id_unique'
  ) THEN
    ALTER TABLE blog_sections
      ADD CONSTRAINT blog_sections_blog_id_unique UNIQUE (blog_post_id, id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'blog_sections'::regclass AND conname = 'blog_sections_parent_same_blog_fk'
  ) THEN
    ALTER TABLE blog_sections
      ADD CONSTRAINT blog_sections_parent_same_blog_fk
      FOREIGN KEY (blog_post_id, parent_id)
      REFERENCES blog_sections (blog_post_id, id)
      ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'blog_sections'::regclass AND conname = 'blog_sections_parent_not_self'
  ) THEN
    ALTER TABLE blog_sections
      ADD CONSTRAINT blog_sections_parent_not_self
      CHECK (parent_id IS NULL OR parent_id <> id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS blog_sections_blog_order_idx
  ON blog_sections (blog_post_id, parent_id, sort_order, id);
