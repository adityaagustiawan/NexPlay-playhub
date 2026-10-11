-- Age verification + creator agreement for NEXCONSOLE.
--
-- Why: NexCoin top-ups are real-money purchases. Players under the age of
-- majority need an explicit parental-control acknowledgement, and we must
-- remember that a given *device* accepted the terms so a hard refresh (or
-- clearing localStorage) cannot roll the agreement back. Seniors (50+) get a
-- "did you fat-finger your birth year?" warning and, if they're genuine
-- creators, must accept the creator content policy before shipping games.
--
-- All rows are written by the server (service role) from /api/age-verify.
-- Browser clients may only read their own row.

-- ---------------------------------------------------------------------------
-- 1) Age verification, keyed on (user, device).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.age_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Stable fingerprint of the device (see src/lib/device.ts). Not a secret —
  -- it only needs to be reproducible on the same browser so the agreement
  -- "sticks" and cannot be bypassed by refreshing or clearing storage.
  device_hash TEXT NOT NULL CHECK (char_length(device_hash) BETWEEN 8 AND 200),
  declared_age INTEGER NOT NULL CHECK (declared_age >= 0 AND declared_age <= 130),
  -- 'minor' = 15-17, 'adult' = 18-49, 'senior' = 50+. Under-15 is rejected
  -- before a row is ever written.
  bracket TEXT NOT NULL CHECK (bracket IN ('minor', 'adult', 'senior')),
  captcha_passed BOOLEAN NOT NULL DEFAULT false,
  policy_accepted BOOLEAN NOT NULL DEFAULT false,
  -- Minors only: a parent/guardian explicitly approved use of top-ups.
  guardian_acknowledged BOOLEAN NOT NULL DEFAULT false,
  -- Minors only: the "a parent/guardian must supervise" note was shown and read.
  parental_control_notice BOOLEAN NOT NULL DEFAULT false,
  -- Seniors only: accepted the no-adult/harmful-content creator policy.
  dev_agreement_accepted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_hash)
);

CREATE INDEX IF NOT EXISTS age_verifications_user_id_idx
  ON public.age_verifications (user_id);

ALTER TABLE public.age_verifications ENABLE ROW LEVEL SECURITY;

-- Players can read their own verification (to render the "verified" state).
DROP POLICY IF EXISTS "Users can read their own age verification" ON public.age_verifications;
CREATE POLICY "Users can read their own age verification"
  ON public.age_verifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Writes are server-only. Revoke the table-level grants that Supabase gives
-- new tables by default so a browser client can never insert/update/delete.
REVOKE INSERT, UPDATE, DELETE ON public.age_verifications FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Creator content agreement (any creator can accept, independent of age).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.creator_agreements (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  policy_version TEXT NOT NULL,
  device_hash TEXT,
  declared_age INTEGER CHECK (declared_age IS NULL OR (declared_age >= 0 AND declared_age <= 130)),
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.creator_agreements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own creator agreement" ON public.creator_agreements;
CREATE POLICY "Users can read their own creator agreement"
  ON public.creator_agreements
  FOR SELECT
  USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.creator_agreements FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Device memory: the strongest bracket ever seen on a device.
--    This is what makes the agreement "stuck": clearing localStorage, a hard
--    refresh, or even registering a fresh account on the same device cannot
--    relax it back to adult.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.device_age_records (
  device_hash TEXT PRIMARY KEY CHECK (char_length(device_hash) BETWEEN 8 AND 200),
  bracket TEXT NOT NULL CHECK (bracket IN ('minor', 'adult', 'senior')),
  guardian_acknowledged BOOLEAN NOT NULL DEFAULT false,
  parental_control_notice BOOLEAN NOT NULL DEFAULT false,
  dev_agreement_accepted BOOLEAN NOT NULL DEFAULT false,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.device_age_records ENABLE ROW LEVEL SECURITY;

-- Server-only. No policies, and revoke the default table grants.
REVOKE ALL ON public.device_age_records FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) Reuse the shared updated_at trigger.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS update_age_verifications_updated_at ON public.age_verifications;
CREATE TRIGGER update_age_verifications_updated_at
  BEFORE UPDATE ON public.age_verifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_creator_agreements_updated_at ON public.creator_agreements;
CREATE TRIGGER update_creator_agreements_updated_at
  BEFORE UPDATE ON public.creator_agreements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
