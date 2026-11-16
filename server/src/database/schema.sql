-- BLIND WAR — Schéma PostgreSQL Officiel (§13, §14, §17, §18, §21.31)

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  username VARCHAR(32) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  avatar_badge VARCHAR(16) NOT NULL DEFAULT '♔',
  bio TEXT NOT NULL DEFAULT '',
  elo_rating INTEGER NOT NULL DEFAULT 200,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  games_played INTEGER NOT NULL DEFAULT 0,
  total_eliminations INTEGER NOT NULL DEFAULT 0,
  new_mechanics_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  display_name VARCHAR(32),
  avatar_image TEXT,
  profile_banner VARCHAR(32) NOT NULL DEFAULT 'classic',
  selected_title VARCHAR(32) NOT NULL DEFAULT 'recrue',
  selected_badge VARCHAR(32),
  preferences_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS new_mechanics_stats JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(32);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_image TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_banner VARCHAR(32) NOT NULL DEFAULT 'classic';
ALTER TABLE users ADD COLUMN IF NOT EXISTS selected_title VARCHAR(32) NOT NULL DEFAULT 'recrue';
ALTER TABLE users ADD COLUMN IF NOT EXISTS selected_badge VARCHAR(32);
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences_json JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS matches (
  id VARCHAR(64) PRIMARY KEY,
  mode VARCHAR(32) NOT NULL,
  red_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  black_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  red_username VARCHAR(32) NOT NULL,
  black_username VARCHAR(32) NOT NULL,
  winner VARCHAR(16),
  outcome_reason VARCHAR(32),
  red_elo_before INTEGER NOT NULL DEFAULT 200,
  black_elo_before INTEGER NOT NULL DEFAULT 200,
  red_elo_after INTEGER NOT NULL DEFAULT 200,
  black_elo_after INTEGER NOT NULL DEFAULT 200,
  turns_played INTEGER NOT NULL DEFAULT 1,
  ruleset_json JSONB NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS elo_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id VARCHAR(64) NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  elo_before INTEGER NOT NULL,
  elo_after INTEGER NOT NULL,
  delta INTEGER NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users(LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_elo_rating ON users(elo_rating DESC);
CREATE INDEX IF NOT EXISTS idx_matches_red_user ON matches(red_user_id);
CREATE INDEX IF NOT EXISTS idx_matches_black_user ON matches(black_user_id);
CREATE INDEX IF NOT EXISTS idx_elo_history_user ON elo_history(user_id, recorded_at DESC);
