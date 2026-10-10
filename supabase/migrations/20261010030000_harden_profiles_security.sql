-- Harden profiles against client-side tampering.
-- Problem: the original migration let any signed-in user UPDATE their own row,
-- including the `coins` column → anyone could run
--   update profiles set coins = 9999999 where user_id = auth.uid()
-- from the browser console and mint free currency.

-- 1) Coins can never go negative
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_coins_non_negative CHECK (coins >= 0);

-- 2) Column-level privileges: clients may edit their profile fields, but not money.
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (display_name, avatar_url, bio, updated_at) ON public.profiles TO authenticated;

-- Clients also must not insert a row pre-loaded with coins (signup trigger inserts
-- the default 0, which stays allowed).
REVOKE INSERT ON public.profiles FROM anon, authenticated;
GRANT INSERT (user_id, display_name, avatar_url, bio) ON public.profiles TO authenticated;

-- 3) Defence in depth: a trigger that rejects any coin change that does not come
--    from a trusted (service_role / SQL) context. Server code on Vercel that uses
--    the service role key keeps working; browser clients cannot.
CREATE OR REPLACE FUNCTION public.reject_client_coin_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role TEXT;
BEGIN
  IF NEW.coins IS NOT DISTINCT FROM OLD.coins THEN
    RETURN NEW;
  END IF;

  BEGIN
    jwt_role := coalesce(current_setting('request.jwt.claims', TRUE)::jsonb ->> 'role', 'anon');
  EXCEPTION WHEN others THEN
    jwt_role := 'anon';
  END;

  IF jwt_role <> 'service_role' THEN
    RAISE EXCEPTION 'profiles.coins can only be changed by the server (service role)';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_reject_client_coin_change ON public.profiles;
CREATE TRIGGER profiles_reject_client_coin_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_client_coin_change();

-- 4) Never expose emails through profiles (defence in depth for the open SELECT policy).
--    profiles has no email column today; nothing to do here, but keep the
--    open SELECT policy limited to non-sensitive columns going forward.
