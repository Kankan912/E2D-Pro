-- Migration: Ajout des colonnes pour la synchronisation E2D vers site_events
-- et création de la table notifications_logs

-- 1. Ajouter les colonnes match_id, match_type, auto_sync à site_events
ALTER TABLE public.site_events 
ADD COLUMN IF NOT EXISTS match_id UUID,
ADD COLUMN IF NOT EXISTS match_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS auto_sync BOOLEAN DEFAULT false;

-- 2. Index pour performances
CREATE INDEX IF NOT EXISTS idx_site_events_match_id ON public.site_events(match_id);
CREATE INDEX IF NOT EXISTS idx_site_events_auto_sync ON public.site_events(auto_sync) WHERE auto_sync = true;

-- 3. Créer la table notifications_logs pour le suivi des envois
CREATE TABLE IF NOT EXISTS public.notifications_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.notifications_templates(id) ON DELETE SET NULL,
  campagne_id UUID,
  destinataire_email TEXT NOT NULL,
  destinataire_id UUID REFERENCES public.membres(id) ON DELETE SET NULL,
  sujet TEXT,
  statut VARCHAR(20) DEFAULT 'pending' CHECK (statut IN ('pending', 'sent', 'failed', 'delivered', 'opened')),
  erreur TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour les logs
CREATE INDEX IF NOT EXISTS idx_notifications_logs_statut ON public.notifications_logs(statut);
CREATE INDEX IF NOT EXISTS idx_notifications_logs_destinataire ON public.notifications_logs(destinataire_email);
CREATE INDEX IF NOT EXISTS idx_notifications_logs_campagne ON public.notifications_logs(campagne_id);
CREATE INDEX IF NOT EXISTS idx_notifications_logs_created ON public.notifications_logs(created_at DESC);

-- RLS pour notifications_logs
ALTER TABLE public.notifications_logs ENABLE ROW LEVEL SECURITY;

-- Politique: les admins peuvent tout voir
CREATE POLICY "Admins can manage notifications_logs" ON public.notifications_logs
FOR ALL USING (public.is_admin());

-- Trigger pour updated_at
CREATE OR REPLACE TRIGGER update_notifications_logs_updated_at
  BEFORE UPDATE ON public.notifications_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.notifications_logs IS 'Journal des envois de notifications email';
COMMENT ON COLUMN public.site_events.match_id IS 'ID du match E2D synchronisé (si applicable)';
COMMENT ON COLUMN public.site_events.match_type IS 'Type de match (e2d, phoenix) pour tracking';
COMMENT ON COLUMN public.site_events.auto_sync IS 'Indique si l''événement est synchronisé automatiquement';