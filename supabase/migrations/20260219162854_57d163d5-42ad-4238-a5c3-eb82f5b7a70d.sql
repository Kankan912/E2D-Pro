
-- Étape 1 : Modifier la contrainte sur payment_configs.provider
ALTER TABLE public.payment_configs
  DROP CONSTRAINT IF EXISTS payment_configs_provider_check;

ALTER TABLE public.payment_configs
  ADD CONSTRAINT payment_configs_provider_check
  CHECK (provider IN ('stripe', 'paypal', 'helloasso', 'bank_transfer', 'orange_money', 'mtn_money'));

-- Étape 2 : Modifier la contrainte sur donations.payment_method
ALTER TABLE public.donations
  DROP CONSTRAINT IF EXISTS donations_payment_method_check;

ALTER TABLE public.donations
  ADD CONSTRAINT donations_payment_method_check
  CHECK (payment_method IN ('stripe', 'paypal', 'helloasso', 'bank_transfer', 'orange_money', 'mtn_money'));
