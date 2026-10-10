-- 0002_games_schema.sql
-- Games, player_progress, and scores tables with RLS-enabled policies.
-- Uniqueness is derived from (creator_id, game_key, released_at) —
-- the same game can be re-released as a new version without collision.

-- =============================================================================
-- 1. GAMES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.games (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_key     TEXT        NOT NULL UNIQUE,
  title        TEXT        NOT NULL,
  description  TEXT,
  gameplay     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  assets       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  version      INTEGER     NOT NULL DEFAULT 1,
  released_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.games.game_key IS
  'Unique key formatted as {slug}-{YYYYMMDD-HHMM} derived from released_at';

-- Enable RLS
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

-- Policies: anon can read published games; creator can CRUD their own
CREATE POLICY "Games are viewable by everyone"
  ON public.games FOR SELECT
  USING (true);

CREATE POLICY "Creators can insert their own games"
  ON public.games FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update their own games"
  ON public.games FOR UPDATE
  USING (auth.uid() = creator_id);

CREATE POLICY "Creators can delete their own games"
  ON public.games FOR DELETE
  USING (auth.uid() = creator_id);

-- =============================================================================
-- 2. PLAYER_PROGRESS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.player_progress (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id     UUID        NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  player_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (game_id, player_id)
);

-- Enable RLS
ALTER TABLE public.player_progress ENABLE ROW LEVEL SECURITY;

-- Policies: players can read/write only their own progress
CREATE POLICY "Players can view their own progress"
  ON public.player_progress FOR SELECT
  USING (auth.uid() = player_id);

CREATE POLICY "Players can insert their own progress"
  ON public.player_progress FOR INSERT
  WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Players can update their own progress"
  ON public.player_progress FOR UPDATE
  USING (auth.uid() = player_id);

-- =============================================================================
-- 3. SCORES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.scores (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id     UUID        NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  player_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score       INTEGER     NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

-- Policies: anon can read scores; authenticated players can insert their own
CREATE POLICY "Scores are viewable by everyone"
  ON public.scores FOR SELECT
  USING (true);

CREATE POLICY "Players can insert their own scores"
  ON public.scores FOR INSERT
  WITH CHECK (auth.uid() = player_id);

-- =============================================================================
-- INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_games_game_key      ON public.games (game_key);
CREATE INDEX IF NOT EXISTS idx_games_creator_id    ON public.games (creator_id);
CREATE INDEX IF NOT EXISTS idx_player_progress_game_id    ON public.player_progress (game_id);
CREATE INDEX IF NOT EXISTS idx_player_progress_player_id ON public.player_progress (player_id);
CREATE INDEX IF NOT EXISTS idx_scores_game_id      ON public.scores (game_id);
CREATE INDEX IF NOT EXISTS idx_scores_player_id    ON public.scores (player_id);

-- =============================================================================
-- UPDATED_AT TRIGGERS (reuses function from 0001 migration)
-- =============================================================================
DROP TRIGGER IF EXISTS update_games_updated_at ON public.games;
CREATE TRIGGER update_games_updated_at
  BEFORE UPDATE ON public.games
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_player_progress_updated_at ON public.player_progress;
CREATE TRIGGER update_player_progress_updated_at
  BEFORE UPDATE ON public.player_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- HELPER: generate_game_key()
-- =============================================================================
CREATE OR REPLACE FUNCTION public.generate_game_key(slug TEXT, released_at TIMESTAMPTZ)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT slug || '-' || to_char(released_at AT TIME ZONE 'UTC', 'YYYYMMDD-HH24MI');
$$;

-- =============================================================================
-- TEST INSERTS (uncomment and replace creator_id with a real auth.users row)
-- =============================================================================
/*
-- Insert a test game
INSERT INTO public.games (creator_id, game_key, title, description, gameplay, assets, version, released_at)
VALUES (
  '00000000-0000-0000-0000-000000000000',  -- replace with real user id
  'my-game-20261010-1200',
  'My Test Game',
  'A test game for development',
  '{"difficulty": "medium", "levels": 5}'::jsonb,
  '{"sprites": [], "sounds": []}'::jsonb,
  1,
  now()
);

-- Insert test player progress
INSERT INTO public.player_progress (game_id, player_id, data)
VALUES (
  (SELECT id FROM public.games WHERE game_key = 'my-game-20261010-1200'),
  '00000000-0000-0000-0000-000000000000',  -- replace with real user id
  '{"level": 3, "score": 1500}'::jsonb
);

-- Insert test score
INSERT INTO public.scores (game_id, player_id, score)
VALUES (
  (SELECT id FROM public.games WHERE game_key = 'my-game-20261010-1200'),
  '00000000-0000-0000-0000-000000000000',  -- replace with real user id
  1500
);
*/
