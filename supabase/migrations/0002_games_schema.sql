-- 0002_games_schema.sql — Applied to Supabase backend
-- Games, player_progress, scores tables with RLS + profiles role access

-- 1. GAMES TABLE (add missing columns)
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS game_key TEXT;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS gameplay JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS assets JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_games_game_key ON public.games(game_key) WHERE game_key IS NOT NULL;
COMMENT ON COLUMN public.games.game_key IS 'Unique key formatted as {slug}-{YYYYMMDD-HHMM} derived from released_at';

-- Enable RLS
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

-- Games policies
DROP POLICY IF EXISTS "Games are viewable by everyone" ON public.games;
CREATE POLICY "Games are viewable by everyone" ON public.games FOR SELECT USING (true);

DROP POLICY IF EXISTS "Creators can insert their own games" ON public.games;
CREATE POLICY "Creators can insert their own games" ON public.games FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Creators can update their own games" ON public.games;
CREATE POLICY "Creators can update their own games" ON public.games FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Creators can delete their own games" ON public.games;
CREATE POLICY "Creators can delete their own games" ON public.games FOR DELETE USING (auth.uid() = user_id);

-- 2. PLAYER_PROGRESS TABLE
CREATE TABLE IF NOT EXISTS public.player_progress (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id     UUID        NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  player_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (game_id, player_id)
);

ALTER TABLE public.player_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Players can view their own progress" ON public.player_progress;
CREATE POLICY "Players can view their own progress" ON public.player_progress FOR SELECT USING (auth.uid() = player_id);

DROP POLICY IF EXISTS "Players can insert their own progress" ON public.player_progress;
CREATE POLICY "Players can insert their own progress" ON public.player_progress FOR INSERT WITH CHECK (auth.uid() = player_id);

DROP POLICY IF EXISTS "Players can update their own progress" ON public.player_progress;
CREATE POLICY "Players can update their own progress" ON public.player_progress FOR UPDATE USING (auth.uid() = player_id);

-- 3. SCORES TABLE
CREATE TABLE IF NOT EXISTS public.scores (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id     UUID        NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  player_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score       INTEGER     NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Scores are viewable by everyone" ON public.scores;
CREATE POLICY "Scores are viewable by everyone" ON public.scores FOR SELECT USING (true);

DROP POLICY IF EXISTS "Players can insert their own scores" ON public.scores;
CREATE POLICY "Players can insert their own scores" ON public.scores FOR INSERT WITH CHECK (auth.uid() = player_id);

-- 4. PROFILES — ensure role is readable
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);

-- 5. INDEXES
CREATE INDEX IF NOT EXISTS idx_games_user_id ON public.games(user_id);
CREATE INDEX IF NOT EXISTS idx_player_progress_game_id ON public.player_progress(game_id);
CREATE INDEX IF NOT EXISTS idx_player_progress_player_id ON public.player_progress(player_id);
CREATE INDEX IF NOT EXISTS idx_scores_game_id ON public.scores(game_id);
CREATE INDEX IF NOT EXISTS idx_scores_player_id ON public.scores(player_id);

-- 6. UPDATED_AT TRIGGER for player_progress
DROP TRIGGER IF EXISTS update_player_progress_updated_at ON public.player_progress;
CREATE TRIGGER update_player_progress_updated_at
  BEFORE UPDATE ON public.player_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. HELPER FUNCTION
CREATE OR REPLACE FUNCTION public.generate_game_key(slug TEXT, released_at TIMESTAMPTZ)
RETURNS TEXT LANGUAGE SQL IMMUTABLE AS $$
  SELECT slug || '-' || to_char(released_at AT TIME ZONE 'UTC', 'YYYYMMDD-HH24MI');
$$;
