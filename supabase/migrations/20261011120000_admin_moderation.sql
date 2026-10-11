-- admin_moderation.sql
-- Admin moderation for reported players.
--
-- The accounts already carry `role`, `is_banned` and `banned_reason`, and a
-- `reports` table already exists (with admin RLS). This migration completes the
-- picture so an admin can:
--   * suspend a player for a fixed window, or ban them permanently,
--   * lift either action,
--   * resolve/dismiss the reports that led to the action,
--   * keep an audit trail of every moderation decision.
--
-- It also adds a defence-in-depth write guard: a blocked account cannot create
-- new games even if a client bypasses the UI. Kept idempotent so re-running is
-- a no-op.

-- 1) Suspension window on profiles. A live suspension is a non-null
--    suspended_until in the future; a past value means it lapsed.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

-- 2) Report resolution bookkeeping. `status` moves from 'pending' to
--    'resolved' (action taken) or 'dismissed' (no action).
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_by UUID,
  ADD COLUMN IF NOT EXISTS resolution TEXT,
  ADD COLUMN IF NOT EXISTS action TEXT;

UPDATE public.reports SET status = 'pending' WHERE status IS NULL;

-- 3) Moderation audit trail (who did what to whom).
CREATE TABLE IF NOT EXISTS public.moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  target_user_id UUID NOT NULL,
  action TEXT NOT NULL,            -- ban | suspend | unban | unsuspend | resolve | dismiss
  reason TEXT,
  until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS moderation_actions_target_idx
  ON public.moderation_actions(target_user_id);
CREATE INDEX IF NOT EXISTS moderation_actions_created_idx
  ON public.moderation_actions(created_at DESC);

ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;

-- 4) Helper: is the caller an admin? SECURITY DEFINER so policies can call it
--    without recursing through profiles RLS.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$function$;

-- 5) Helper: is this account currently blocked (banned, or suspended and the
--    window has not elapsed)?
CREATE OR REPLACE FUNCTION public.is_account_blocked(uid UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (
      SELECT is_banned
             OR (suspended_until IS NOT NULL AND suspended_until > now())
      FROM public.profiles
      WHERE user_id = uid
    ),
    false
  );
$function$;

-- 6) Audit table policies: admins read everything; an admin may only record
--    actions under their own id. (The server API writes with the service role,
--    which bypasses RLS.)
DROP POLICY IF EXISTS "Admins can view moderation actions" ON public.moderation_actions;
CREATE POLICY "Admins can view moderation actions" ON public.moderation_actions
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can record moderation actions" ON public.moderation_actions;
CREATE POLICY "Admins can record moderation actions" ON public.moderation_actions
  FOR INSERT WITH CHECK (public.is_admin() AND admin_id = auth.uid());

-- 7) Extend the protected-profile trigger to also guard the suspension fields.
--    Non-admins still cannot touch role / ban / suspension / vip status.
CREATE OR REPLACE FUNCTION public.prevent_non_admin_profile_protected_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role)
     OR (NEW.is_banned IS DISTINCT FROM OLD.is_banned)
     OR (NEW.banned_reason IS DISTINCT FROM OLD.banned_reason)
     OR (NEW.vip_status IS DISTINCT FROM OLD.vip_status)
     OR (NEW.suspended_until IS DISTINCT FROM OLD.suspended_until)
     OR (NEW.suspended_reason IS DISTINCT FROM OLD.suspended_reason) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Only admins can modify protected profile fields';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 8) Defence in depth: a blocked account cannot create games. Server-side
--    writers (imports, admin tooling, NexCode) run as the service role and are
--    never blocked.
CREATE OR REPLACE FUNCTION public.reject_blocked_game_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  jwt_role TEXT;
BEGIN
  BEGIN
    jwt_role := coalesce(current_setting('request.jwt.claims', TRUE)::jsonb ->> 'role', 'anon');
  EXCEPTION WHEN others THEN
    jwt_role := 'anon';
  END;

  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF public.is_account_blocked(NEW.user_id) THEN
    RAISE EXCEPTION 'Your account is suspended or banned and cannot create games.';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS games_reject_blocked_insert ON public.games;
CREATE TRIGGER games_reject_blocked_insert
  BEFORE INSERT ON public.games
  FOR EACH ROW EXECUTE FUNCTION public.reject_blocked_game_insert();

-- 9) Reports were readable and *updatable* by any authenticated user, which let
--    anyone read every report or flip a report's status. Only admins should
--    read/update them; players keep their ability to file a report.
DROP POLICY IF EXISTS "Authenticated users can read all reports" ON public.reports;
DROP POLICY IF EXISTS "Authenticated users can update reports" ON public.reports;

-- 10) Make sure the admin policies that we rely on exist (idempotent).
DROP POLICY IF EXISTS "Admins can view all reports" ON public.reports;
CREATE POLICY "Admins can view all reports" ON public.reports
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update reports" ON public.reports;
CREATE POLICY "Admins can update reports" ON public.reports
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
