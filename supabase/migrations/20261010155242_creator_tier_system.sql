-- Creator tier system: every player can be a creator, but the free tier is
-- limited (3 games). A one-time top-up (any package) unlocks Pro = unlimited.
-- This file mirrors the migration already applied to the live project as
-- version 20261010155242 ("creator_tier_system"); kept idempotent so re-running
-- is a no-op.

-- 1) Profiles gain the creator tier. Default is the limited free tier.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS creator_tier TEXT DEFAULT 'free';

-- Normalise any legacy NULLs to the free tier.
UPDATE public.profiles SET creator_tier = 'free' WHERE creator_tier IS NULL;

-- 2) Audit log for tier grants. Written by the server (service role) only.
CREATE TABLE IF NOT EXISTS public.creator_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'pro',
  amount_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_purchases_user_id_idx
  ON public.creator_purchases(user_id);

ALTER TABLE public.creator_purchases ENABLE ROW LEVEL SECURITY;

-- Owners may read their own purchase history.
DROP POLICY IF EXISTS "Users can view own creator purchases" ON public.creator_purchases;
CREATE POLICY "Users can view own creator purchases"
  ON public.creator_purchases
  FOR SELECT
  USING (auth.uid() = user_id);
