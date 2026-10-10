-- Save the progress of playing the game.
-- One row per (player, game). The row survives sign-out, hard refresh, and
-- clearing local storage because it lives against the account, and RLS makes
-- it readable/writable only by its owner.

create table if not exists public.game_progress (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  -- text (not uuid) so it works for both community games (uuid ids) and any
  -- built-in/static game ids the client already uses.
  game_id       text not null,
  game_title    text,
  game_image    text,
  -- Arbitrary game-defined save state (level data, inventory, checkpoints...).
  progress      jsonb not null default '{}'::jsonb,
  score         integer not null default 0,
  level         integer not null default 1,
  play_seconds  integer not null default 0,
  completed     boolean not null default false,
  last_played_at timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, game_id)
);

create index if not exists game_progress_user_recent_idx
  on public.game_progress (user_id, last_played_at desc);

-- Keep updated_at honest on every write.
drop trigger if exists update_game_progress_updated_at on public.game_progress;
create trigger update_game_progress_updated_at
  before update on public.game_progress
  for each row execute function public.update_updated_at_column();

alter table public.game_progress enable row level security;

-- Players can only ever touch their own progress row.
drop policy if exists "Users can read their own game progress" on public.game_progress;
create policy "Users can read their own game progress"
  on public.game_progress
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own game progress" on public.game_progress;
create policy "Users can insert their own game progress"
  on public.game_progress
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own game progress" on public.game_progress;
create policy "Users can update their own game progress"
  on public.game_progress
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own game progress" on public.game_progress;
create policy "Users can delete their own game progress"
  on public.game_progress
  for delete
  using (auth.uid() = user_id);
