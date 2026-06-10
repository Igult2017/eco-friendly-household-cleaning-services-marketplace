-- Blog system: posts and comments
DO $$ BEGIN CREATE TYPE blog_post_status AS ENUM ('draft', 'published'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS blog_posts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             VARCHAR(200) NOT NULL,
  title            VARCHAR(300) NOT NULL,
  excerpt          TEXT,
  content          TEXT NOT NULL DEFAULT '',
  cover_image_url  TEXT,
  author_id        TEXT NOT NULL REFERENCES users(id),
  status           blog_post_status NOT NULL DEFAULT 'draft',
  published_at     TIMESTAMPTZ,
  allow_comments   BOOLEAN NOT NULL DEFAULT TRUE,
  allow_sharing    BOOLEAN NOT NULL DEFAULT TRUE,
  category         VARCHAR(100),
  tags             JSONB DEFAULT '[]',
  read_time_minutes INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_slug_idx      ON blog_posts(slug);
CREATE        INDEX IF NOT EXISTS blog_posts_status_idx    ON blog_posts(status);
CREATE        INDEX IF NOT EXISTS blog_posts_author_idx    ON blog_posts(author_id);
CREATE        INDEX IF NOT EXISTS blog_posts_published_idx ON blog_posts(published_at);

CREATE TABLE IF NOT EXISTS blog_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id),
  body        TEXT NOT NULL,
  is_approved BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS blog_comments_post_idx ON blog_comments(post_id);
CREATE INDEX IF NOT EXISTS blog_comments_user_idx ON blog_comments(user_id);
