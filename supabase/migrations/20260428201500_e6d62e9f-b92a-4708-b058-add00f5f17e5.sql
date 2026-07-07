
-- ============================================
-- RPC: Workflow configuration management
-- ============================================

CREATE OR REPLACE FUNCTION public.upsert_loan_validation_step(
  _id uuid,
  _role text,
  _label text,
  _ordre integer,
  _actif boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Réservé aux administrateurs';
  END IF;
  IF _role IS NULL OR length(trim(_role)) = 0 THEN
    RAISE EXCEPTION 'Le rôle est obligatoire';
  END IF;
  IF _label IS NULL OR length(trim(_label)) = 0 THEN
    RAISE EXCEPTION 'Le libellé est obligatoire';
  END IF;
  IF _ordre IS NULL OR _ordre <= 0 THEN
    RAISE EXCEPTION 'L''ordre doit être > 0';
  END IF;

  IF _id IS NULL THEN
    INSERT INTO public.loan_validation_config (role, label, ordre, actif)
    VALUES (lower(trim(_role)), trim(_label), _ordre, COALESCE(_actif, true))
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.loan_validation_config
       SET role = lower(trim(_role)),
           label = trim(_label),
           ordre = _ordre,
           actif = COALESCE(_actif, true)
     WHERE id = _id
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Étape introuvable';
    END IF;
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_loan_validation_step(_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Réservé aux administrateurs';
  END IF;
  DELETE FROM public.loan_validation_config WHERE id = _id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.reorder_loan_validation_steps(_ids uuid[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Réservé aux administrateurs';
  END IF;
  IF _ids IS NULL OR array_length(_ids, 1) IS NULL THEN
    RETURN true;
  END IF;

  FOR i IN 1..array_length(_ids, 1) LOOP
    UPDATE public.loan_validation_config
       SET ordre = i
     WHERE id = _ids[i];
  END LOOP;

  RETURN true;
END;
$$;

-- ============================================
-- Permissions: prets_requests
-- ============================================

DO $$
DECLARE
  r record;
  v_role_admin uuid;
  v_role_tresorier uuid;
  v_role_commissaire uuid;
  v_role_censeur uuid;
  v_role_secretaire uuid;
BEGIN
  SELECT id INTO v_role_admin FROM roles WHERE lower(name) = 'administrateur';
  SELECT id INTO v_role_tresorier FROM roles WHERE lower(name) = 'tresorier';
  SELECT id INTO v_role_commissaire FROM roles WHERE lower(name) = 'commissaire_comptes';
  SELECT id INTO v_role_censeur FROM roles WHERE lower(name) = 'censeur';
  SELECT id INTO v_role_secretaire FROM roles WHERE lower(name) = 'secretaire_general';

  -- create: tous les rôles internes
  FOR r IN SELECT id FROM roles LOOP
    INSERT INTO role_permissions (role_id, resource, permission, granted)
    VALUES (r.id, 'prets_requests', 'create', true)
    ON CONFLICT (role_id, resource, permission) DO UPDATE SET granted = true;
  END LOOP;

  -- validate
  FOREACH v_role_admin IN ARRAY ARRAY[
    v_role_admin, v_role_tresorier, v_role_commissaire, v_role_censeur, v_role_secretaire
  ] LOOP
    IF v_role_admin IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, resource, permission, granted)
      VALUES (v_role_admin, 'prets_requests', 'validate', true)
      ON CONFLICT (role_id, resource, permission) DO UPDATE SET granted = true;
    END IF;
  END LOOP;

  -- disburse: tresorier + admin
  SELECT id INTO v_role_admin FROM roles WHERE lower(name) = 'administrateur';
  IF v_role_admin IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, resource, permission, granted)
    VALUES (v_role_admin, 'prets_requests', 'disburse', true)
    ON CONFLICT (role_id, resource, permission) DO UPDATE SET granted = true;
    INSERT INTO role_permissions (role_id, resource, permission, granted)
    VALUES (v_role_admin, 'prets_requests', 'configure', true)
    ON CONFLICT (role_id, resource, permission) DO UPDATE SET granted = true;
  END IF;
  IF v_role_tresorier IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, resource, permission, granted)
    VALUES (v_role_tresorier, 'prets_requests', 'disburse', true)
    ON CONFLICT (role_id, resource, permission) DO UPDATE SET granted = true;
  END IF;
END $$;
