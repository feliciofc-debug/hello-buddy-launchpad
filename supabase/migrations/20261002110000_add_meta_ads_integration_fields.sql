ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS ad_account_id text,
  ADD COLUMN IF NOT EXISTS ad_account_name text,
  ADD COLUMN IF NOT EXISTS ad_account_currency text,
  ADD COLUMN IF NOT EXISTS ad_accounts jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_integrations_meta_ads_account
  ON public.integrations (user_id, ad_account_id)
  WHERE platform = 'meta_ads' AND is_active = true;
