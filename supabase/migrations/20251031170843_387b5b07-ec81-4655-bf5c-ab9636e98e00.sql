-- Table de configuration des paiements (clés API, comptes)
CREATE TABLE IF NOT EXISTS public.payment_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'paypal', 'helloasso', 'bank_transfer')),
  is_active BOOLEAN NOT NULL DEFAULT false,
  config_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id),
  UNIQUE(provider)
);

-- Table des dons
CREATE TABLE IF NOT EXISTS public.donations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  donor_name TEXT NOT NULL,
  donor_email TEXT NOT NULL,
  donor_phone TEXT,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  payment_method TEXT NOT NULL CHECK (payment_method IN ('stripe', 'paypal', 'helloasso', 'bank_transfer')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurring_frequency TEXT CHECK (recurring_frequency IN ('monthly', 'yearly')),
  stripe_payment_id TEXT,
  stripe_customer_id TEXT,
  paypal_transaction_id TEXT,
  helloasso_payment_id TEXT,
  bank_transfer_reference TEXT,
  transaction_metadata JSONB DEFAULT '{}'::jsonb,
  donor_message TEXT,
  fiscal_receipt_sent BOOLEAN NOT NULL DEFAULT false,
  fiscal_receipt_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table des abonnements récurrents
CREATE TABLE IF NOT EXISTS public.recurring_donations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  donation_id UUID NOT NULL REFERENCES public.donations(id) ON DELETE CASCADE,
  donor_email TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  frequency TEXT NOT NULL CHECK (frequency IN ('monthly', 'yearly')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  next_payment_date DATE,
  stripe_subscription_id TEXT,
  paypal_subscription_id TEXT,
  total_payments INTEGER NOT NULL DEFAULT 0,
  last_payment_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table des adhésions
CREATE TABLE IF NOT EXISTS public.adhesions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  membre_id UUID REFERENCES public.membres(id) ON DELETE SET NULL,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  email TEXT NOT NULL,
  telephone TEXT NOT NULL,
  type_adhesion TEXT NOT NULL CHECK (type_adhesion IN ('e2d', 'phoenix', 'both')),
  montant_paye DECIMAL(10, 2) NOT NULL CHECK (montant_paye >= 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('stripe', 'paypal', 'helloasso', 'bank_transfer', 'pending')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed')),
  payment_id TEXT,
  message TEXT,
  processed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adhesions ENABLE ROW LEVEL SECURITY;

-- RLS Policies pour payment_configs (Admin uniquement)
CREATE POLICY "Admin peut tout faire sur payment_configs"
  ON public.payment_configs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies pour donations
CREATE POLICY "Public peut insérer des donations"
  ON public.donations
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admin et Trésorier peuvent lire donations"
  ON public.donations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'tresorier')
    )
  );

CREATE POLICY "Admin et Trésorier peuvent mettre à jour donations"
  ON public.donations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'tresorier')
    )
  );

-- RLS Policies pour recurring_donations
CREATE POLICY "Admin et Trésorier peuvent tout faire sur recurring_donations"
  ON public.recurring_donations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'tresorier')
    )
  );

-- RLS Policies pour adhesions
CREATE POLICY "Public peut insérer des adhesions"
  ON public.adhesions
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admin et Trésorier peuvent lire adhesions"
  ON public.adhesions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'tresorier')
    )
  );

CREATE POLICY "Admin et Trésorier peuvent mettre à jour adhesions"
  ON public.adhesions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'tresorier')
    )
  );

-- Indexes pour les recherches
CREATE INDEX idx_donations_donor_email ON public.donations(donor_email);
CREATE INDEX idx_donations_payment_status ON public.donations(payment_status);
CREATE INDEX idx_donations_created_at ON public.donations(created_at DESC);
CREATE INDEX idx_recurring_donations_status ON public.recurring_donations(status);
CREATE INDEX idx_recurring_donations_next_payment ON public.recurring_donations(next_payment_date);
CREATE INDEX idx_adhesions_email ON public.adhesions(email);
CREATE INDEX idx_adhesions_payment_status ON public.adhesions(payment_status);
CREATE INDEX idx_adhesions_processed ON public.adhesions(processed);

-- Trigger pour updated_at sur donations
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_donations_updated_at
  BEFORE UPDATE ON public.donations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_recurring_donations_updated_at
  BEFORE UPDATE ON public.recurring_donations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_adhesions_updated_at
  BEFORE UPDATE ON public.adhesions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payment_configs_updated_at
  BEFORE UPDATE ON public.payment_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();