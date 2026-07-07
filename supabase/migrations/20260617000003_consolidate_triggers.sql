-- Fix: Remove duplicate sync_sanction_to_caisse trigger
-- Keep only create_caisse_operation_from_source which handles sanctions correctly

DROP TRIGGER IF EXISTS trg_sync_sanction_to_caisse ON public.reunions_sanctions;
DROP FUNCTION IF EXISTS public.sync_sanction_to_caisse();

-- Also remove the old update_caisse_operation_on_status_change trigger/function
-- which called create_caisse_operation_from_source outside trigger context
DROP TRIGGER IF EXISTS trg_update_caisse_status ON public.prets;
DROP FUNCTION IF EXISTS public.update_caisse_operation_on_status_change();

-- Consolidate 6 identical updated_at trigger functions into one
DROP FUNCTION IF EXISTS public.update_reunions_presences_updated_at();
DROP FUNCTION IF EXISTS public.update_reunions_sanctions_updated_at();
DROP FUNCTION IF EXISTS public.update_prets_config_updated_at();
DROP FUNCTION IF EXISTS public.update_cms_updated_at();
-- Keep handle_updated_at_column and update_updated_at_column, rename one to be the standard
-- Create a single unified function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;