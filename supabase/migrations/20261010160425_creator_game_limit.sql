-- Enforce the free creator game limit server-side (applied as version 20261010160425).
-- Free tier: at most 3 games. Pro (granted by any completed top-up) and admins
-- are unlimited. Server-side / service-role writers (imports, tooling) are never
-- limited, so this only constrains browser clients.
CREATE OR REPLACE FUNCTION public.enforce_free_creator_game_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role TEXT;
  v_tier TEXT;
  v_role TEXT;
  v_count INTEGER;
BEGIN
  BEGIN
    jwt_role := coalesce(current_setting('request.jwt.claims', TRUE)::jsonb ->> 'role', 'anon');
  EXCEPTION WHEN others THEN
    jwt_role := 'anon';
  END;

  -- Server-side writers (imports, admin tooling) are never limited.
  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT creator_tier, role INTO v_tier, v_role
  FROM public.profiles WHERE user_id = NEW.user_id;

  IF v_role = 'admin' OR v_tier = 'pro' THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count FROM public.games WHERE user_id = NEW.user_id;
  IF v_count >= 3 THEN
    RAISE EXCEPTION 'Free tier is limited to 3 games. Top up any amount to unlock Pro.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS games_enforce_free_creator_limit ON public.games;
CREATE TRIGGER games_enforce_free_creator_limit
  BEFORE INSERT ON public.games
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_free_creator_game_limit();
