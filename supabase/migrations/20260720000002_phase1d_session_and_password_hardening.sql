-- ============================================================
-- Migration : 20260720000002_phase1d_session_and_password_hardening.sql
-- Phase 1-d — Correctifs P0 résiduels sécurité (Tasks 10 → 12 du worklog)
--
-- Corrige les P0 résiduels identifiés par la Task 10 (frontend) :
--   P0 #5 — Contournement du forced password change via console
--           navigateur (`supabase.from('profiles').update({ must_change_password:
--           false }).eq('id', user.id)`). Le fix front-end (Task 10) n'était
--           qu'une mitigation UX, pas une barrière de sécurité côté DB.
--   P0 #6 — Désactivation utilisateur (`profiles.status='desactive'`) ne
--           révoque pas le JWT Supabase Auth : celui-ci reste valide jusqu'à
--           ~1h (refresh window). Le polling 5 min côté front (Task 10) n'est
--           pas étanche. Un trigger `AFTER UPDATE OF status` supprimera les
--           sessions `auth.sessions` actives pour forcer une re-authentification
--           immédiate.
--
-- BONUS P1 — `audit_logs` INSERT ouvert à tout authentifié (risque de
--           falsification) : création d'une RPC SECURITY DEFINER
--           `log_audit_event()` + resserrement de la policy INSERT aux admins.
--           Le front-end (`src/lib/logger.ts:120`) devra migrer vers la RPC.
--           NB : `cotisations_mensuelles_audit` est DÉJÀ durcie par la
--           migration `20260615170818_d0fc9220` (INSERT restreint à
--           `is_admin() OR has_permission('cotisations','update')` + trigger
--           `trg_cma_force_modifie_par` qui force `modifie_par = auth.uid()`)
--           — aucune action complémentaire nécessaire ici.
--
-- RÈGLES DE CONSTRUCTION :
--   - Idempotente : DROP FUNCTION/POLICY/TRIGGER IF EXISTS + CREATE OR REPLACE
--   - N'altère aucune migration existante (Supabase best practice : append-only)
--   - N'altère PAS `20260720000001_phase1_security_fixes.sql` (déjà livré).
--   - Toutes les fonctions SECURITY DEFINER portent `SET search_path` verrouillé.
--   - Utilise `public.has_role(auth.uid(), '<role>')` et `public.is_admin()`
--     pour les vérifications de rôle (mêmes helpers que la Task 9).
--   - Entièrement wrappée dans BEGIN; ... COMMIT;
--
-- CONVENTION DE NOMMAGE (cf. Task 9 + vérifications ci-dessous) :
--   - La table `public.profiles` n'a PAS de colonne `user_id`. Sa PK `id`
--     RÉFÉRENCE DIRECTEMENT `auth.users(id)` (cf. migration initiale
--     `20251031163552_eee4018e` + Task 9 worklog l.1428). On utilise donc
--     `auth.uid() = id` (et NON `user_id`) partout.
--   - Enum `profiles.status` : TEXT NOT NULL DEFAULT 'actif' CHECK IN
--     ('actif','desactive','supprime') (cf. `20260108184229_1ac35f4a` l.5-6).
--   - Rôles réels stockés dans `roles.name` : `administrateur`, `tresorier`,
--     `secretaire_general`, `responsable_sportif`, `censeur`,
--     `commissaire_comptes`, `super_admin`, `membre`, `membre_actif`
--     (cf. Task 9 worklog l.1425 + migrations `20251108200154` & `20260109101009`).
--
-- DÉPENDANCES FRONT-END À FAIRE MIGRER PAR L'AGENT UI (cf. Stage Summary) :
--   - `src/pages/FirstPasswordChange.tsx` l.141-147 : remplacer
--     `supabase.from('profiles').update({ password_changed: true,
--     must_change_password: false }).eq('id', user.id)` par
--     `supabase.rpc('clear_must_change_flag')` APRÈS `auth.updateUser({ password })`.
--   - `src/lib/logger.ts` l.117-129 : remplacer
--     `supabase.from('audit_logs').insert([...])` par
--     `supabase.rpc('log_audit_event', { p_action, p_table_name, ... })`.
-- ============================================================

BEGIN;

-- ============================================================
-- P0 #5 — Hardening de `profiles.must_change_password`
-- ============================================================
-- Problème : la policy `profiles_self_update` (créée dans
-- `20260625000003_security_grants_fixes.sql:264-267`) autorisait
-- `WITH CHECK (auth.uid() = id)` sans aucune restriction de colonnes. Un
-- utilisateur authentifié pouvait donc, depuis la console navigateur,
-- exécuter `supabase.from('profiles').update({ must_change_password: false,
-- password_changed: true }).eq('id', user.id)` SANS passer par
-- `FirstPasswordChange.tsx` — c'est-à-dire SANS changer son mot de passe.
-- Le fix front-end (Task 10) n'était qu'une mitigation UX ; il faut
-- verrouiller côté DB.
--
-- Solution en 2 temps :
--   A) Créer une RPC SECURITY DEFINER `clear_must_change_flag()` qui sera le
--      SEUL moyen de basculer `must_change_password` à FALSE. Elle ne fait
--      l'UPDATE QUE si le flag est actuellement TRUE (anti-rejeu / anti-reset
--      d'un compte déjà OK) et positionne `password_changed = TRUE` dans le
--      même UPDATE (atomicité). Le front l'appellera APRÈS
--      `supabase.auth.updateUser({ password })` — si l'update Auth échoue,
--      le flag reste TRUE (safe-by-default).
--   B) Serrer le `WITH CHECK` de `profiles_self_update` pour INTERDIRE au
--      client d'écrire directement `must_change_password`, `password_changed`
--      ou `status`. La policy reste permissive pour les autres colonnes
--      (email, nom, prenom, telephone, etc.) — l'auto-édition de profil
--      normal continue de fonctionner.
--
-- Note IMPORTANTE sur la policy admin `profiles_tenant_admin_update`
-- (`20260625000003_security_grants_fixes.sql:285-300`) : elle est PRÉSERVÉE
-- TELLE QUELLE. C'est cette policy qui permet à un admin (via
-- `UtilisateursAdmin.tsx:436`) de basculer `status='desactive'` — et donc
-- de déclencher le trigger de P0 #6 ci-dessous. Les admins peuvent aussi
-- légitimement positionner `must_change_password=TRUE` (par ex. pour forcer
-- un reset) ; on ne touche pas à ce chemin.
-- ============================================================


-- ------------------------------------------------------------
-- P0 #5.A — RPC `clear_must_change_flag()`
-- ------------------------------------------------------------
-- Args : aucun (utilise `auth.uid()`).
-- Retour : BOOLEAN — TRUE si une ligne a été modifiée (i.e. le flag était
--          bien TRUE pour l'utilisateur courant), FALSE sinon.
-- Sécurité :
--   - SECURITY DEFINER → bypass RLS (nécessaire car la policy
--     `profiles_self_update` sera restreinte par P0 #5.B).
--   - `SET search_path = public` → anti-injection par hijack de schéma.
--   - Aucun paramètre utilisateur → pas d'élévation possible (l'UPDATE est
--     scoppée à `auth.uid() = id`).
--   - Garde `WHERE must_change_password = TRUE` → échoue silencieusement
--     (FOUND=FALSE) si le flag est déjà FALSE (anti-rejeu).
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.clear_must_change_flag()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.profiles
  SET must_change_password = FALSE,
      password_changed     = TRUE,
      updated_at           = now()
  WHERE id = v_user_id
    AND must_change_password = TRUE;

  RETURN FOUND;
END;
$$;

-- Revoke puis grant explicite : seul `authenticated` peut appeler cette RPC.
-- `anon` et `service_role` ne sont pas concernés (service_role bypass RLS
-- de toute façon et n'a pas besoin de cette RPC).
REVOKE ALL ON FUNCTION public.clear_must_change_flag() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_must_change_flag() TO authenticated;


-- ------------------------------------------------------------
-- P0 #5.B — Serrage du `WITH CHECK` de `profiles_self_update`
-- ------------------------------------------------------------
-- L'ancienne policy `profiles_self_update` (créée dans
-- `20260625000003_security_grants_fixes.sql:264-267`) est droppée puis
-- recréée avec un `WITH CHECK` qui :
--   - conserve `auth.uid() = id` (un utilisateur ne peut éditer QUE son
--     propre profil),
--   - interdit de basculer `must_change_password` à FALSE (uniquement
--     no-op TRUE→TRUE ou FALSE→TRUE autorisés — ce dernier est inoffensif),
--   - interdit toute modification de `password_changed`,
--   - interdit toute modification de `status` (un utilisateur ne peut
--     ni se désactiver ni se supprimer lui-même).
--
-- Les colonnes libres restent : `email`, `nom`, `prenom`, `telephone`,
-- `updated_at`, `last_login`, `association_id`, etc. L'auto-édition de
-- profil normal par l'utilisateur est préservée.
--
-- NB : la policy admin `profiles_tenant_admin_update` est INTACTE — les
-- admins peuvent toujours changer `status` (et déclencher le trigger P0 #6).
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;

CREATE POLICY "profiles_self_update"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- `must_change_password` : no-op ou FALSE→TRUE autorisés, TRUE→FALSE INTERDIT.
    AND (
      NEW.must_change_password = OLD.must_change_password
      OR NEW.must_change_password = TRUE
    )
    -- `password_changed` : aucune modification directe par l'utilisateur.
    AND NEW.password_changed = OLD.password_changed
    -- `status` : aucune modification directe par l'utilisateur
    -- (les admins passent par leur propre policy tenant_admin_update).
    AND NEW.status = OLD.status
  );


-- ============================================================
-- P0 #6 — Révocation immédiate des sessions à la désactivation
-- ============================================================
-- Problème : lorsque `profiles.status` passe à `'desactive'` ou `'supprime'`,
-- le JWT Supabase Auth de l'utilisateur reste valide jusqu'à ~1h (refresh
-- window). Le polling 5 min côté front (Task 10) laisse donc une fenêtre
-- d'environ 1h pendant laquelle l'utilisateur désactivé peut encore appeler
-- l'API Supabase Auth avec son token. Pour fermer cette fenêtre, on installe
-- un trigger `AFTER UPDATE OF status` qui supprime toutes les lignes de
-- `auth.sessions` pour cet utilisateur — la prochaine requête authentifiée
-- provoquera un 401 et forcera une re-authentification (qui échouera car le
-- `checkMemberStatus` front-end filtrera `status='desactive'`).
--
-- Notes techniques :
--   - `auth.sessions` est une table INTERNE Supabase, accessible uniquement
--     au rôle `postgres`. Une fonction SECURITY DEFINER possédée par
--     `postgres` (le rôle qui exécute les migrations) peut y faire DELETE.
--   - `SET search_path = public, auth` pour que la fonction puisse résoudre
--     à la fois `public.profiles` (via le trigger) et `auth.sessions`.
--   - La condition `OLD.status IS DISTINCT FROM NEW.status` gère les NULL
--     et évite de re-fire sur des UPDATE sans changement de status.
--   - `OLD.status NOT IN ('desactive', 'supprime')` garantit qu'on ne
--     re-supprime pas les sessions si l'utilisateur était déjà désactivé
--     (par ex. suite à un UPDATE sur une autre colonne).
--   - La désactivation de l'utilisateur est faite par un admin via
--     `profiles_tenant_admin_update` (`UtilisateursAdmin.tsx:436`) →
--     le trigger fire APRÈS l'UPDATE admin et supprime les sessions.
--   - La réactivation (`status` passe `'desactive' → 'actif'`) NE supprime
--     PAS les sessions (intentionnel : l'utilisateur reconnecté n'a pas
--     besoin de re-saisir son mot de passe, et le front a déjà sign-out au
--     moment de la désactivation).
-- ============================================================

CREATE OR REPLACE FUNCTION public.invalidate_user_sessions_on_desactivate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.status IN ('desactive', 'supprime')
     AND OLD.status NOT IN ('desactive', 'supprime') THEN
    -- Suppression de toutes les sessions actives pour cet utilisateur.
    -- `NEW.id` est la PK de `profiles` qui RÉFÉRENCE `auth.users(id)`
    -- (la table `profiles` n'a pas de colonne `user_id` — cf. Task 9).
    DELETE FROM auth.sessions WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Revoke de toute exécution directe : cette fonction n'est appelée QUE par
-- le trigger (les fonctions trigger n'ont pas besoin de GRANT EXECUTE).
REVOKE ALL ON FUNCTION public.invalidate_user_sessions_on_desactivate() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_invalidate_sessions_on_desactivate ON public.profiles;
CREATE TRIGGER trg_invalidate_sessions_on_desactivate
  AFTER UPDATE OF status ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.invalidate_user_sessions_on_desactivate();


-- ============================================================
-- BONUS P1 — `audit_logs` INSERT : fermer la falsification
-- ============================================================
-- Problème (Task 2 P1) : la policy `Authenticated users can insert audit logs`
-- (`20260123200205_bf804999:48-50`) autorise tout utilisateur authentifié à
-- insérer n'importe quelle ligne dans `audit_logs` — y compris en forgeant
-- `user_id` pour faire accuser un autre utilisateur. Risque réel : un membre
-- malveillant peut faire apparaître des actions qu'il n'a jamais commises
-- dans le journal d'audit (ou en faire disparaître en noyant le journal).
--
-- Solution :
--   A) Créer une RPC SECURITY DEFINER `log_audit_event()` qui sera le SEUL
--      canal d'INSERT pour les applications. Elle force `user_id = auth.uid()`
--      et horodate `created_at = now()` côté serveur → impossible de forger.
--   B) Serrer la policy INSERT pour n'autoriser QUE les admins (en pratique,
--      seul le service_role + la RPC y insèrent). Les INSERT directs du
--      front-end (`src/lib/logger.ts:120`) cesseront de fonctionner pour les
--      non-admins — c'est voulu. Le front doit migrer vers la RPC.
--
-- NB : `cotisations_mensuelles_audit` est DÉJÀ durcie (cf. header).
-- ============================================================


-- ------------------------------------------------------------
-- BONUS.A — RPC `log_audit_event()`
-- ------------------------------------------------------------
-- Args : p_action (TEXT, NOT NULL), p_table_name (TEXT, NULLABLE),
--        p_record_id (UUID, NULLABLE), p_old_data (JSONB, NULLABLE),
--        p_new_data (JSONB, NULLABLE).
-- Retour : UUID — l'id de la ligne insérée.
-- Sécurité :
--   - SECURITY DEFINER → bypass RLS (nécessaire pour que la policy INSERT
--     restreinte ci-dessous ne bloque pas la RPC).
--   - `SET search_path = public` → anti-injection.
--   - `user_id` et `created_at` sont forcés côté serveur (jamais acceptés
--     du client) → impossible de forger l'attribution ou l'horodatage.
--   - `ip_address` et `user_agent` sont laissés NULL (récupérés
--     historiquement par les triggers / middlewares, hors scope ici).
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action     TEXT,
  p_table_name TEXT DEFAULT NULL,
  p_record_id  UUID DEFAULT NULL,
  p_old_data   JSONB DEFAULT NULL,
  p_new_data   JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_log_id  UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_action IS NULL OR btrim(p_action) = '' THEN
    RAISE EXCEPTION 'p_action requis';
  END IF;

  INSERT INTO public.audit_logs (
    action, table_name, record_id, user_id, old_data, new_data, created_at
  )
  VALUES (
    p_action, p_table_name, p_record_id, v_user_id, p_old_data, p_new_data, now()
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_audit_event(TEXT, TEXT, UUID, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_audit_event(TEXT, TEXT, UUID, JSONB, JSONB) TO authenticated;


-- ------------------------------------------------------------
-- BONUS.B — Serrage de la policy INSERT sur `audit_logs`
-- ------------------------------------------------------------
-- L'ancienne policy `Authenticated users can insert audit logs`
-- (`20260123200205_bf804999:48-50`) est droppée puis recréée en
-- admin/super_admin ONLY. Les INSERT directs du front-end non-admin
-- (`src/lib/logger.ts:120`) échoueront silencieusement (le try/catch du
-- logger les ignore déjà). Le front doit migrer vers `log_audit_event()`.
--
-- NB : la policy SELECT admin-only (`Admins can read audit logs`,
-- `20260505191935_f06f9987:22-26`) est conservée telle quelle.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;

CREATE POLICY "audit_logs_insert_admin_only" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.has_role(auth.uid(), 'super_admin')
  );


-- ============================================================
-- RÉCAPITULATIF — P0/P1 traités par cette migration
-- ============================================================
--   ✓ P0 #5 — Contournement du forced password change :
--             RPC `clear_must_change_flag()` (SECURITY DEFINER, bypass RLS,
--             scopée à auth.uid()=id, garde `WHERE must_change_password=TRUE`),
--             + policy `profiles_self_update` resserrée (interdit
--             `must_change_password`→FALSE, `password_changed` et `status`
--             en écriture directe côté client).
--   ✓ P0 #6 — Révocation des sessions à la désactivation :
--             trigger `AFTER UPDATE OF status ON profiles` qui DELETE
--             `auth.sessions` quand `status` passe à `'desactive'` ou
--             `'supprime'` (avec garde anti-re-fire). Forcer une
--             re-authentification immédiate côté Supabase Auth.
--   ✓ BONUS P1 — `audit_logs` INSERT :
--             RPC `log_audit_event()` (SECURITY DEFINER, force
--             `user_id=auth.uid()` + `created_at=now()` côté serveur),
--             + policy INSERT resserrée à admin/super_admin.
--
-- CHANGEMENTS FRONT-END REQUIS (à porter par l'agent UI) :
--   1. `src/pages/FirstPasswordChange.tsx` l.141-147 — remplacer l'UPDATE
--      direct `profiles.update({ password_changed: true,
--      must_change_password: false }).eq('id', user.id)` par
--      `await supabase.rpc('clear_must_change_flag')`. L'appel DOIT rester
--      APRÈS `supabase.auth.updateUser({ password })` (ordre déjà correct
--      côté Task 10). Vérifier le retour (FALSE = rien modifié, à logger).
--   2. `src/lib/logger.ts` l.117-129 — remplacer l'INSERT direct dans
--      `audit_logs` par `supabase.rpc('log_audit_event', {
--        p_action: String(auditLog.action || auditLog.message || 'unknown'),
--        p_table_name: String(auditLog.resource || ''),
--        p_record_id: null,
--        p_old_data: null,
--        p_new_data: JSON.parse(JSON.stringify(auditLog))
--      })`. La signature RPC renvoie l'UUID de la ligne créée.
--   3. Aucun changement requis dans `AuthContext.tsx` (le polling 5 min et
--      le sign-out forcé restent valables comme filet de sécurité).
--
-- P0/P1 NON TRAITÉS (hors périmètre Phase 1-d) :
--   - P0 #2-bis (Task 3 P0 #9) — `prets.date_debut` INEXISTANTE : non ajouté
--     ici (hors scope "session & password hardening"). Voir note Task 9.
--   - P0 #8 partie `audit_logs.association_id` manquant : non ajouté ici
--     (modification de schéma, à traiter dans une migration Phase 2 dédiée
--     au multi-tenant audit). La RPC `log_audit_event` ne renseigne pas
--     `association_id` (la colonne n'existe pas encore).
-- ============================================================

COMMIT;
