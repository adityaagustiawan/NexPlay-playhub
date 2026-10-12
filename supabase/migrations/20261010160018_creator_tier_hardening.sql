-- Harden the creator tier system (applied as version 20261010160018).
-- Pro is granted only server-side by the top-up webhook (service role) after any
-- completed top-up. Clients must not be able to self-grant Pro, and
-- creator_purchases is a server-written audit log.

-- 1) creator_purchases is written only by the server now.
DROP POLICY IF EXISTS "Users can insert own creator purchases" ON public.creator_purchases;

-- 2) Defence in depth: reject client-originated creator_tier changes.
--    (Column privileges already deny this; this guards against future drift.)
CREATE OR REPLACE FUNCTION public.reject_client_creator_tier_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role TEXT;
BEGIN
  IF NEW.creator_tier IS NOT DISTINCT FROM OLD.creator_tier THEN
    RETURN NEW;
  END IF;

  BEGIN
    jwt_role := coalesce(current_setting('request.jwt.claims', TRUE)::jsonb ->> 'role', 'anon');
  EXCEPTION WHEN others THEN
    jwt_role := 'anon';
  END;

  IF jwt_role <> 'service_role' THEN
    RAISE EXCEPTION 'profiles.creator_tier can only be changed by the server (service role)';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_reject_client_creator_tier_change ON public.profiles;
CREATE TRIGGER profiles_reject_client_creator_tier_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_client_creator_tier_change();
