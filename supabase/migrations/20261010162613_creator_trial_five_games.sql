-- Free creator trial = 5 games (applied as version 20261010162613).
-- Supersedes the previous 3-game limit. Pro (granted by any completed top-up)
-- and admins are unlimited; service-role writers (imports, NexCode tooling)
-- are never limited.
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
  v_limit CONSTANT INTEGER := 5;
BEGIN
  BEGIN
    jwt_role := coalesce(current_setting('request.jwt.claims', TRUE)::jsonb ->> 'role', 'anon');
  EXCEPTION WHEN others THEN
    jwt_role := 'anon';
  END;

  -- Server-side writers (imports, admin tooling, NexCode) are never limited.
  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT creator_tier, role INTO v_tier, v_role
  FROM public.profiles WHERE user_id = NEW.user_id;

  IF v_role = 'admin' OR v_tier = 'pro' THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count FROM public.games WHERE user_id = NEW.user_id;
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Free trial is limited to % games. Top up any amount to unlock Pro Creator (unlimited).', v_limit;
  END IF;

  RETURN NEW;
END;
$$;
