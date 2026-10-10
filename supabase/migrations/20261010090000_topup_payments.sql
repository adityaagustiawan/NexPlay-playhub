-- NexCoin purchase ledger. Written only by the Top Up webhook (service role).
-- Keyed on the Stripe session id for idempotency = never double-credit.

CREATE TABLE IF NOT EXISTS public.topup_payments (
  id TEXT PRIMARY KEY,             -- Stripe Checkout Session id
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coins INTEGER NOT NULL CHECK (coins > 0),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.topup_payments ENABLE ROW LEVEL SECURITY;

-- No client-facing policies: only the server (service role) reads/writes this.
-- RLS is enabled and no grants are given to anon/authenticated.