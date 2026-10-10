CREATE TABLE IF NOT EXISTS admins (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS admins_email_lower_unique ON admins (LOWER(email));

CREATE TABLE IF NOT EXISTS sections (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(120) NOT NULL UNIQUE,
  parent_id BIGINT REFERENCES sections(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(120) NOT NULL UNIQUE,
  excerpt VARCHAR(500) NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'published')),
  section_id BIGINT REFERENCES sections(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS blog_posts_published_idx ON blog_posts (published_at DESC) WHERE status = 'published';
