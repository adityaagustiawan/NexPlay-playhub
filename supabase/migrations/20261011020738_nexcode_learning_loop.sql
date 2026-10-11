-- nexcode_learning_loop
-- Stores every NexCode generation so the engine can "learn from every game":
-- players rate results (worst .. best) and the highest-rated examples with
-- similar prompts are fed back into the generator as references (few-shot for
-- the LLM path). Generations are written by the server (service role); clients
-- may read their own rows and rate them via public.rate_generation().

create table if not exists public.nexcode_learning (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid references public.games(id) on delete set null,
  prompt text not null,
  config jsonb not null,
  mode text,
  theme text,
  difficulty text,
  rating smallint check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  rated_at timestamptz
);

create index if not exists nexcode_learning_rating_idx on public.nexcode_learning (rating desc nulls last, created_at desc);
create index if not exists nexcode_learning_mode_idx on public.nexcode_learning (mode);
create index if not exists nexcode_learning_user_idx on public.nexcode_learning (user_id);

alter table public.nexcode_learning enable row level security;

drop policy if exists "nexcode_learning_select_own" on public.nexcode_learning;
create policy "nexcode_learning_select_own" on public.nexcode_learning
  for select using (auth.uid() = user_id);

-- Rating is written through a SECURITY DEFINER function so owners can only
-- change the rating of their own generation, never the captured config/prompt.
create or replace function public.rate_generation(p_id uuid, p_rating smallint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_rating < 1 or p_rating > 5 then
    raise exception 'rating must be between 1 and 5';
  end if;
  update public.nexcode_learning
     set rating = p_rating, rated_at = now()
   where id = p_id and user_id = auth.uid();
  if not found then
    raise exception 'generation not found or not yours';
  end if;
end;
$$;

revoke all on function public.rate_generation(uuid, smallint) from public;
revoke all on function public.rate_generation(uuid, smallint) from anon;
grant execute on function public.rate_generation(uuid, smallint) to authenticated;
