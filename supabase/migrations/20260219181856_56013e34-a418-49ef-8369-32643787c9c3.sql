
-- Suppression de l'ancienne politique trop restrictive
DROP POLICY IF EXISTS "Public peut insérer des donations validées" ON public.donations;

-- Nouvelle politique corrigée autorisant FCFA, orange_money et mtn_money
CREATE POLICY "Public peut insérer des donations validées"
ON public.donations
FOR INSERT
TO public
WITH CHECK (
  payment_status = 'pending'
  AND amount > 0
  AND currency = ANY (ARRAY['EUR', 'USD', 'GBP', 'CAD', 'CHF', 'FCFA'])
  AND payment_method = ANY (ARRAY[
    'stripe', 'paypal', 'bank_transfer', 'helloasso',
    'orange_money', 'mtn_money'
  ])
);
