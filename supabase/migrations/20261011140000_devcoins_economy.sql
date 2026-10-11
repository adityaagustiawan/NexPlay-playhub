-- devcoins_economy.sql
-- In-game item economy.
--
-- Creators define store items for their games and price them in NexCoins.
-- When a player buys one, the NexCoins leave the player's balance and the
-- creator is credited the same amount in DevCoins (1 NexCoin spent = 1 DevCoin
-- earned, no platform fee). DevCoins can be cashed out to real money at
--   50 DevCoins = $0.99   (1 DevCoin = 1.98 cents)
-- with a minimum cash-out of 200 DevCoins (~ $3.96). Payouts are *requests*
-- that an admin reviews and pays out off-platform (no Stripe Connect yet).
--
-- Every money mutation happens through the SECURITY DEFINER functions below,
-- which are executable by the service role only. Clients can never move coins
-- or DevCoins directly (same guarantee as the existing profiles.coins guard).

-- 1) DevCoin balance on profiles (separate from spendable NexCoins).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS devcoins INTEGER NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_devcoins_non_negative CHECK (devcoins >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) Creator-defined store items.
CREATE TABLE IF NOT EXISTS public.game_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price_coins INTEGER NOT NULL DEFAULT 0 CHECK (price_coins >= 0),
  emoji TEXT,
  category TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS game_items_game_idx ON public.game_items(game_id);
CREATE INDEX IF NOT EXISTS game_items_creator_idx ON public.game_items(creator_id);

ALTER TABLE public.game_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store items are viewable by everyone" ON public.game_items;
CREATE POLICY "Store items are viewable by everyone" ON public.game_items
  FOR SELECT USING (true);

-- A creator manages only items for games they own.
DROP POLICY IF EXISTS "Creators manage their own items" ON public.game_items;
CREATE POLICY "Creators manage their own items" ON public.game_items
  FOR ALL
  USING (auth.uid() = creator_id)
  WITH CHECK (
    auth.uid() = creator_id
    AND EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_id AND g.user_id = auth.uid())
  );

DROP TRIGGER IF EXISTS update_game_items_updated_at ON public.game_items;
CREATE TRIGGER update_game_items_updated_at
  BEFORE UPDATE ON public.game_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Purchase ledger (one row per sale). Written only by the RPC below.
CREATE TABLE IF NOT EXISTS public.item_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.game_items(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  price_coins INTEGER NOT NULL CHECK (price_coins >= 0),
  devcoins_credited INTEGER NOT NULL CHECK (devcoins_credited >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS item_purchases_item_idx ON public.item_purchases(item_id);
CREATE INDEX IF NOT EXISTS item_purchases_buyer_idx ON public.item_purchases(buyer_id);
CREATE INDEX IF NOT EXISTS item_purchases_creator_idx ON public.item_purchases(creator_id);

ALTER TABLE public.item_purchases ENABLE ROW LEVEL SECURITY;

-- Buyers and creators can read their own rows; admins can read everything.
DROP POLICY IF EXISTS "Purchases are viewable by buyer or creator" ON public.item_purchases;
CREATE POLICY "Purchases are viewable by buyer or creator" ON public.item_purchases
  FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = creator_id OR public.is_admin());

-- 4) DevCoin movement ledger (sales, payouts, refunds).
CREATE TABLE IF NOT EXISTS public.devcoin_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('sale', 'payout', 'payout_refund', 'adjustment')),
  balance_after INTEGER NOT NULL,
  note TEXT,
  ref_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS devcoin_ledger_user_idx ON public.devcoin_ledger(user_id, created_at DESC);

ALTER TABLE public.devcoin_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "DevCoin ledger is viewable by owner or admin" ON public.devcoin_ledger;
CREATE POLICY "DevCoin ledger is viewable by owner or admin" ON public.devcoin_ledger
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- 5) Cash-out requests.
CREATE TABLE IF NOT EXISTS public.devcoin_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  devcoins INTEGER NOT NULL CHECK (devcoins > 0),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'rejected')),
  method TEXT,
  note TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID
);

CREATE INDEX IF NOT EXISTS devcoin_payouts_user_idx ON public.devcoin_payouts(user_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS devcoin_payouts_status_idx ON public.devcoin_payouts(status, requested_at DESC);

ALTER TABLE public.devcoin_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Payouts are viewable by owner or admin" ON public.devcoin_payouts;
CREATE POLICY "Payouts are viewable by owner or admin" ON public.devcoin_payouts
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admins can update payouts" ON public.devcoin_payouts;
CREATE POLICY "Admins can update payouts" ON public.devcoin_payouts
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 6) Buy an item: move NexCoins from buyer -> creator as DevCoins, atomically.
CREATE OR REPLACE FUNCTION public.purchase_game_item(p_item_id UUID, p_buyer UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.game_items;
  v_price INTEGER;
  v_buyer_coins INTEGER;
  v_creator_devcoins INTEGER;
  v_purchase_id UUID;
BEGIN
  SELECT * INTO v_item FROM public.game_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found'; END IF;
  IF NOT v_item.active THEN RAISE EXCEPTION 'This item is not for sale'; END IF;
  IF v_item.creator_id = p_buyer THEN RAISE EXCEPTION 'You cannot buy your own item'; END IF;
  IF public.is_account_blocked(p_buyer) THEN
    RAISE EXCEPTION 'Your account is suspended or banned';
  END IF;

  v_price := v_item.price_coins;

  -- Conditional debit: fails cleanly if the buyer cannot afford it.
  UPDATE public.profiles SET coins = coins - v_price
    WHERE user_id = p_buyer AND coins >= v_price
    RETURNING coins INTO v_buyer_coins;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not enough NexCoins'; END IF;

  UPDATE public.profiles SET devcoins = devcoins + v_price
    WHERE user_id = v_item.creator_id
    RETURNING devcoins INTO v_creator_devcoins;
  IF NOT FOUND THEN RAISE EXCEPTION 'Creator account not found'; END IF;

  INSERT INTO public.item_purchases
    (item_id, game_id, buyer_id, creator_id, price_coins, devcoins_credited)
    VALUES (v_item.id, v_item.game_id, p_buyer, v_item.creator_id, v_price, v_price)
    RETURNING id INTO v_purchase_id;

  INSERT INTO public.devcoin_ledger (user_id, amount, kind, balance_after, note, ref_id)
    VALUES (v_item.creator_id, v_price, 'sale', v_creator_devcoins, v_item.name, v_purchase_id);

  RETURN jsonb_build_object(
    'ok', true,
    'coins', v_buyer_coins,
    'price', v_price,
    'creatorDevcoins', v_creator_devcoins,
    'purchaseId', v_purchase_id
  );
END;
$$;

-- 7) Request a cash-out. Requires >= 200 DevCoins; holds the balance while the
--    request is pending (rejected requests refund it).
CREATE OR REPLACE FUNCTION public.request_devcoin_payout(p_user UUID, p_devcoins INTEGER, p_method TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min CONSTANT INTEGER := 200;   -- minimum cash-out, in DevCoins
  v_balance INTEGER;
  v_cents INTEGER;
  v_payout_id UUID;
BEGIN
  IF p_devcoins IS NULL OR p_devcoins < v_min THEN
    RAISE EXCEPTION 'You need at least % DevCoins to cash out', v_min;
  END IF;

  UPDATE public.profiles SET devcoins = devcoins - p_devcoins
    WHERE user_id = p_user AND devcoins >= p_devcoins
    RETURNING devcoins INTO v_balance;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not enough DevCoins'; END IF;

  -- 50 DevCoins = $0.99  =>  cents = floor(devcoins * 99 / 50)
  v_cents := (p_devcoins * 99) / 50;

  INSERT INTO public.devcoin_payouts (user_id, devcoins, amount_cents, method)
    VALUES (p_user, p_devcoins, v_cents, p_method)
    RETURNING id INTO v_payout_id;

  INSERT INTO public.devcoin_ledger (user_id, amount, kind, balance_after, note, ref_id)
    VALUES (p_user, -p_devcoins, 'payout', v_balance, 'Cash-out request', v_payout_id);

  RETURN jsonb_build_object('ok', true, 'devcoins', v_balance, 'amountCents', v_cents, 'payoutId', v_payout_id);
END;
$$;

-- 8) Admin resolves a payout: approve (mark paid) or reject (refund DevCoins).
CREATE OR REPLACE FUNCTION public.resolve_devcoin_payout(p_payout_id UUID, p_admin UUID, p_approve BOOLEAN, p_note TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payout public.devcoin_payouts;
  v_balance INTEGER;
BEGIN
  SELECT * INTO v_payout FROM public.devcoin_payouts WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payout not found'; END IF;
  IF v_payout.status <> 'pending' THEN RAISE EXCEPTION 'Payout already resolved'; END IF;

  IF p_approve THEN
    UPDATE public.devcoin_payouts
      SET status = 'paid', resolved_at = now(), resolved_by = p_admin, note = COALESCE(p_note, note)
      WHERE id = p_payout_id;
  ELSE
    UPDATE public.profiles SET devcoins = devcoins + v_payout.devcoins
      WHERE user_id = v_payout.user_id
      RETURNING devcoins INTO v_balance;
    INSERT INTO public.devcoin_ledger (user_id, amount, kind, balance_after, note, ref_id)
      VALUES (v_payout.user_id, v_payout.devcoins, 'payout_refund', v_balance,
              COALESCE(p_note, 'Cash-out rejected'), v_payout.id);
    UPDATE public.devcoin_payouts
      SET status = 'rejected', resolved_at = now(), resolved_by = p_admin, note = COALESCE(p_note, note)
      WHERE id = p_payout_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', CASE WHEN p_approve THEN 'paid' ELSE 'rejected' END);
END;
$$;

-- 9) Only the server (service role) may call the money RPCs.
REVOKE ALL ON FUNCTION public.purchase_game_item(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.request_devcoin_payout(UUID, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_devcoin_payout(UUID, UUID, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.purchase_game_item(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.request_devcoin_payout(UUID, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_devcoin_payout(UUID, UUID, BOOLEAN, TEXT) TO service_role;
