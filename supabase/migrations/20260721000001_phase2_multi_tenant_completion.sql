-- ============================================================
-- Migration : 20260721000001_phase2_multi_tenant_completion.sql
-- Phase 2-a — Achèvement du socle multi-tenant (Tasks 3 & 14 du worklog)
--
-- Corrige les P0 multi-tenant résiduels identifiés par la Task 3 :
--   P0 #7  — `aide_workflow_validations` et `aide_payment_items` référencent
--            `association_id` dans leurs policies RLS mais la COLONNE N'EXISTE
--            PAS → toute requête échoue : `column "association_id" does not
--            exist`. (Task 3 P0 #7)
--   P0 #8  — Aucun backfill des lignes existantes sur les 22 tables
--            multi-tenant migrées par `20260625000001` → après serrage RLS,
--            les lignes historiques (association_id IS NULL) deviennent
--            invisibles à tous les non-super_admin → perte de données
--            apparente (cotisations, épargnes, prêts, membres, etc.).
--            (Task 3 P0 #3)
--   P0 #9  — Bypass RLS critique `(association_id = get_current_association_id())
--            OR get_current_association_id() IS NULL` appliqué à 22 tables
--            + 4 tables Aides + associations + roles + user_roles + profiles.
--            Tout utilisateur authentifié sans `user_roles` (ou avec un rôle
--            sans `association_id`) obtient un accès cross-tenant total.
--            (Task 1 P0 #4, Task 2 P0 #4, Task 3 P0 #2)
--   P0 #10 — Tables tenant-scopées sans colonne `association_id` :
--            `prets_paiements`, `notifications*`, `match_*`, `phoenix_*`,
--            `sport_e2d_*`, `sport_phoenix_*`, `site_*`, `tontine_*`,
--            `audit_logs`, `cotisations_mensuelles_audit`,
--            `historique_connexion`, `aide_workflow_validations`,
--            `aide_payment_items`, `utilisateurs_actions_log`,
--            `security_scans`, `loan_requests`, `loan_request_validations`,
--            `pret_reconduction_validations`, etc. (Task 3 P1 #3 + Task 2
--            P1 #17)
--
-- Hardening complémentaire :
--   - `is_admin()` devient tenant-aware : un `administrateur` n'est admin QUE
--     dans son association ; `super_admin` reste cross-tenant. (Task 3 P1 #2 +
--     Task 3 l.608)
--   - RPC `log_audit_event()` (Task 12) peuple désormais `association_id`
--     côté serveur.
--   - `audit_logs` policy INSERT (Task 12) resserrée avec tenant check.
--
-- RÈGLES DE CONSTRUCTION :
--   - Idempotente : `DROP POLICY IF EXISTS` + `CREATE POLICY`, `ADD COLUMN
--     IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS IF NOT EXISTS`, DO blocks avec
--     `IF EXISTS (information_schema.tables)`.
--   - N'altère aucune migration existante (Supabase best practice : append-only).
--   - N'altère PAS `20260720000001_phase1_security_fixes.sql` ni
--     `20260720000002_phase1d_session_and_password_hardening.sql` (déjà livrés).
--   - Toutes les fonctions SECURITY DEFINER portent `SET search_path = public`.
--   - Utilise `public.has_role(auth.uid(), '<role>')` et `public.is_admin()`
--     pour les vérifications de rôle (mêmes helpers que Tasks 9 & 12).
--   - Entièrement wrappée dans BEGIN; ... COMMIT;.
--   - Si une table n'existe pas (catalogue manquant, table non créée par
--     migration), le DO block la SKIP silencieusement via `IF EXISTS`.
--
-- NOMENCLATURE DES RÔLES (cf. Task 9 worklog l.1425 + Task 12 l.43-45) :
--   Les vrais noms stockés dans `roles.name` sont : `administrateur`,
--   `tresorier`, `secretaire_general`, `responsable_sportif`, `censeur`,
--   `commissaire_comptes`, `super_admin`, `membre`, `membre_actif`.
--   On utilise systématiquement `super_admin` (et non `admin`) pour le
--   bypass cross-tenant — `admin` est l'ancien enum supprimé.
--
-- DÉCISIONS DOCUMENTÉES (catalogs globaux — `association_id` NON ajouté) :
--   - `cotisations_types` : catalogue de TYPES de cotisations ("Cotisation
--     mensuelle", "Adhesion", etc.) — global par nature. Les montants par
--     défaut sont déjà surchargés par `cotisations_mensuelles_exercice`
--     (tenant-scopé).
--   - `sanctions_types`, `types_sanctions` : catalogue de TYPES de sanctions
--     — global par nature. Les montants réels sont dans `reunions_sanctions`
--     (tenant-scopé).
--   - `loan_validation_config`, `pret_reconduction_validation_config` :
--     catalogue de RÔLES du workflow de validation — global (les rôles
--     eux-mêmes sont déjà tenant-scopés via `roles.association_id`).
--   - `configurations`, `smtp_config`, `payment_configs`, `session_config`,
--     `caisse_config` : configs globales déjà protégées par RLS admin-only
--     (Tasks 9 & 12). Le découpage multi-tenant de ces configs est un
--     chantier séparé (Phase 2-b).
--   - `cms_*` : tables CMS du site public (legacy, potentiellement
--     inutilisées — le front utilise `site_*`). Non touchées.
--
-- DÉPENDANCES FRONT-END À FAIRE MIGRER PAR L'AGENT UI (agents 15/16) :
--   - `src/integrations/supabase/types.ts` DOIT être régénéré via
--     `supabase gen types typescript --local` après application de cette
--     migration (Task 3 P1 #1 + P1 #15).
--   - Les hooks qui ne filtrent pas par `association_id` dans leurs queries
--     (`useInAppNotifications`, `useAlertesGlobales`, `usePersonalData`,
--     `useMatchMedias`, `useSiteContent`, `useSportEventSync`, etc.)
--     bénéficieront automatiquement du filtrage RLS côté DB — AUCUNE
--     modification front requise pour la sécurité, mais le `types.ts`
--     régénéré exposera la nouvelle colonne.
--   - `NotificationToaster` (Task 6 P1 #6) : les subscriptions Realtime
--     restent non filtrées par `association_id` côté front — le payload
--     traverse le WebSocket mais l'UI n'affiche que les events matchant
--     l'utilisateur courant. Non bloquant.
-- ============================================================

BEGIN;

-- ============================================================
-- P0 #8.A — Création d'une association par défaut si la table est vide
-- ============================================================
-- Problème : la migration `20260625000001` crée la table `associations`
-- mais n'insère JAMAIS de ligne. En production, si l'admin n'a pas créé
-- d'association manuellement, toutes les FK `association_id` pointent vers
-- NULL → après serrage RLS (P0 #9), toutes les données sont invisibles.
--
-- Solution : insérer une association par défaut avec un UUID fixe
-- `'00000000-0000-0000-0000-000000000001'` SI la table est vide. L'UUID
-- fixe permet aux migrations suivantes de référencer cette association de
-- manière déterministe. Le trigger `trg_aide_workflow_on_assoc_create`
-- (`20260702_aides_phase2_workflow_core.sql:251-255`) créera
-- automatiquement les 4 étapes de workflow par défaut pour cette
-- association.
--
-- NB : si la table contient DÉJÀ au moins une association (cas d'un
-- déploiement existant), on NE crée PAS de défaut — on utilise la
-- première association existante pour le backfill.
-- ============================================================

DO $$
DECLARE
  v_default_assoc_id UUID;
  v_existing_count INTEGER;
BEGIN
  SELECT count(*) INTO v_existing_count FROM public.associations;

  IF v_existing_count = 0 THEN
    -- Insérer l'association par défaut avec un UUID fixe
    INSERT INTO public.associations (id, nom, slug)
    VALUES (
      '00000000-0000-0000-0000-000000000001',
      'E2D Association (défaut)',
      'e2d-default'
    )
    ON CONFLICT (id) DO NOTHING;

    v_default_assoc_id := '00000000-0000-0000-0000-000000000001'::uuid;
  ELSE
    -- Utiliser la première association existante (ordre chronologique)
    SELECT id INTO v_default_assoc_id
    FROM public.associations
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- Stocker l'ID dans une variable de session pour les étapes suivantes
  -- (PERFORM set_config est persisté pour la transaction courante)
  PERFORM set_config('e2d.default_association_id', v_default_assoc_id::text, true);
END;
$$;


-- ============================================================
-- P0 #8.B — Backfill `association_id` sur les 22 tables multi-tenant
-- ============================================================
-- Pour chaque table migrée par `20260625000001`, mettre à jour les lignes
-- orphelines (association_id IS NULL) avec l'association par défaut.
-- Utilise explicit `UPDATE` (pas de DO block) pour clarté et auditabilité.
--
-- L'ID de l'association par défaut est récupéré via `current_setting()`.
-- ============================================================

UPDATE public.membres
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.profiles
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.cotisations
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.epargnes
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.prets
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.prets_reconductions
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.calendrier_beneficiaires
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.reunion_beneficiaires
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.beneficiaires_paiements_audit
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.exercices
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.cotisations_mensuelles_exercice
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.reunions
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.reunions_sanctions
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.reunions_presences
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.fond_caisse_operations
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.sanctions
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.aides
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.aides_types
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.roles
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.role_permissions
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.user_roles
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.adhesions
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.donations
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

-- Tables Aides phase 2 (déjà ont association_id via 20260702)
UPDATE public.aide_workflow_steps
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.aide_payment_orders
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;


-- ============================================================
-- Hardening `is_admin()` — tenant-aware
-- ============================================================
-- Problème (Task 3 P1 #2 + l.608) : `is_admin()` (recréé par
-- `20260625000003_security_grants_fixes.sql:18-33`) ne filtre PAS par
-- `association_id`. Un `administrateur` de l'association A a donc les
-- droits admin sur l'association B (lecture/écriture de `roles`,
-- `role_permissions`, `audit_logs`, `security_scans`, etc.).
--
-- Solution : recréer `is_admin()` pour exiger `r.association_id =
-- get_current_association_id()` POUR `administrateur` uniquement.
-- `super_admin` reste cross-tenant (sinon un super_admin sans association
-- ne pourrait plus rien administrer — or c'est précisément son rôle).
--
-- Note : `get_current_association_id()` retourne `r.association_id` (le
-- tenant du rôle de l'utilisateur). On aligne `is_admin()` sur la même
-- source de vérité.
--
-- Impact sur les policies existantes qui utilisent `is_admin()` :
--   - `role_permissions_admin_*` (20260625000003:52-71) → devient
--     automatiquement tenant-scopé (admin ne voit QUE les permissions de
--     son association).
--   - `roles_tenant_*` (20260625000003:88-119) → idem.
--   - `profiles_tenant_admin_*` (20260625000003:275-300) → idem.
--   - `audit_logs` SELECT (20260505191935:22-26) → idem.
--   - `loan_requests` lr_select_own_or_admin / lr_admin_update /
--     lr_admin_delete (20260428200651:487-508) → idem.
--   - `payment_configs_admin_all` (20260720000001) → idem.
--   - `smtp_config_admin_all`, `configurations_admin_all` (20260720000001)
--     → idem (mais ces tables restent globales — pas de colonne
--     association_id ; un super_admin y a accès, un administrateur tenant
--     aussi via is_admin(). Acceptable : les secrets SMTP/payment sont des
--     configs globales dans cette phase).
--
-- Cette fonction est créée AVANT le rewriting des policies pour que les
-- nouvelles policies puissent l'utiliser.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND lower(r.name) IN ('administrateur', 'super_admin')
      AND (
        lower(r.name) = 'super_admin'
        OR r.association_id = public.get_current_association_id()
      )
  );
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'Tenant-aware : TRUE pour super_admin (cross-tenant) OU pour administrateur '
  'dont le rôle appartient à l''association courante (get_current_association_id). '
  'Exclut tresorier, secretaire_general, etc. (cf. 20260625000003).';


-- ============================================================
-- P0 #9 — Suppression du bypass `OR get_current_association_id() IS NULL`
-- ============================================================
-- Problème : 22 tables + `associations` + `roles` + `user_roles` +
-- `profiles` (admin) + 4 tables Aides ont des policies RLS utilisant le
-- pattern :
--   (association_id = get_current_association_id())
--   OR get_current_association_id() IS NULL
--
-- Ce pattern transforme tout utilisateur sans `user_roles` (ou avec un
-- rôle sans `association_id`) en super-admin de fait : la fonction
-- retourne NULL → la condition `IS NULL` est vraie → USING accepte toutes
-- les lignes. Faille cross-tenant massive (Task 1 P0 #4, Task 2 P0 #4).
--
-- Solution : remplacer le bypass par un check explicite de `super_admin` :
--   public.has_role(auth.uid(), 'super_admin')
--   OR association_id = public.get_current_association_id()
--
-- Fail-closed : si l'utilisateur n'est ni super_admin ni membre du tenant,
-- il ne voit AUCUNE ligne. Les lignes orphelines (association_id IS NULL)
-- ne sont visibles QUE des super_admin.
--
-- NB : les 22 tables ont été backfillées en P0 #8.B, donc
-- `association_id IS NULL` ne devrait plus exister pour les données
-- historiques. Les nouvelles inserts DOIVENT peupler association_id
-- (les policies WITH CHECK l'exigent).
-- ============================================================

-- ------------------------------------------------------------
-- P0 #9.A — Rewriting des 22 policies `mt_*` (créées par
--           `20260625000001_multi_tenant_foundation.sql:166-239`)
-- ------------------------------------------------------------
-- Le DO block boucle sur les 22 tables et recrée les 4 policies
-- (SELECT/INSERT/UPDATE/DELETE) avec le pattern strict.
-- ------------------------------------------------------------

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'membres', 'profiles', 'cotisations', 'epargnes', 'prets', 'prets_reconductions',
    'calendrier_beneficiaires', 'reunion_beneficiaires', 'beneficiaires_paiements_audit',
    'exercices', 'cotisations_mensuelles_exercice',
    'reunions', 'reunions_sanctions', 'reunions_presences',
    'fond_caisse_operations', 'sanctions',
    'aides', 'aides_types',
    'adhesions', 'donations'
  ]) LOOP

    -- SELECT : super_admin OR tenant match
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_select" ON public.%I;
        CREATE POLICY "mt_%s_select"
          ON public.%I FOR SELECT TO authenticated
          USING (
            public.has_role(auth.uid(), 'super_admin')
            OR association_id = public.get_current_association_id()
          );
      $POL$, tbl, tbl, tbl
    );

    -- INSERT : super_admin OR tenant match (WITH CHECK)
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_insert" ON public.%I;
        CREATE POLICY "mt_%s_insert"
          ON public.%I FOR INSERT TO authenticated
          WITH CHECK (
            public.has_role(auth.uid(), 'super_admin')
            OR association_id = public.get_current_association_id()
          );
      $POL$, tbl, tbl, tbl
    );

    -- UPDATE : super_admin OR tenant match (USING + WITH CHECK)
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_update" ON public.%I;
        CREATE POLICY "mt_%s_update"
          ON public.%I FOR UPDATE TO authenticated
          USING (
            public.has_role(auth.uid(), 'super_admin')
            OR association_id = public.get_current_association_id()
          )
          WITH CHECK (
            public.has_role(auth.uid(), 'super_admin')
            OR association_id = public.get_current_association_id()
          );
      $POL$, tbl, tbl, tbl
    );

    -- DELETE : super_admin OR tenant match
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_delete" ON public.%I;
        CREATE POLICY "mt_%s_delete"
          ON public.%I FOR DELETE TO authenticated
          USING (
            public.has_role(auth.uid(), 'super_admin')
            OR association_id = public.get_current_association_id()
          );
      $POL$, tbl, tbl, tbl
    );

  END LOOP;
END;
$$;


-- ------------------------------------------------------------
-- P0 #9.B — Rewriting des policies `mt_associations_*`
--           (créées par `20260625000001:245-267`)
-- ------------------------------------------------------------
-- La table `associations` elle-même : un utilisateur ne voit QUE son
-- association (id = get_current_association_id()). Super_admin voit tout.
-- Insert/Update/Delete réservés au super_admin (créer une nouvelle
-- association est une opération cross-tenant).
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "mt_associations_select" ON public.associations;
CREATE POLICY "mt_associations_select"
  ON public.associations FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR id = public.get_current_association_id()
  );

DROP POLICY IF EXISTS "mt_associations_insert" ON public.associations;
CREATE POLICY "mt_associations_insert"
  ON public.associations FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "mt_associations_update" ON public.associations;
CREATE POLICY "mt_associations_update"
  ON public.associations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "mt_associations_delete" ON public.associations;
CREATE POLICY "mt_associations_delete"
  ON public.associations FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));


-- ------------------------------------------------------------
-- P0 #9.C — Rewriting des policies `roles_tenant_*` et
--           `roles_admin_*` (créées par `20260625000003:77-119`)
-- ------------------------------------------------------------
-- `roles` : lecture pour tous les authentifiés du tenant, écriture pour
-- admin du tenant (is_admin() est désormais tenant-aware) ou super_admin.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "roles_tenant_select" ON public.roles;
CREATE POLICY "roles_tenant_select"
  ON public.roles FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR association_id = public.get_current_association_id()
  );

DROP POLICY IF EXISTS "roles_admin_insert" ON public.roles;
CREATE POLICY "roles_admin_insert"
  ON public.roles FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.has_role(auth.uid(), 'super_admin')
  );

DROP POLICY IF EXISTS "roles_admin_update" ON public.roles;
CREATE POLICY "roles_admin_update"
  ON public.roles FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR public.has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (
    public.is_admin()
    OR public.has_role(auth.uid(), 'super_admin')
  );

DROP POLICY IF EXISTS "roles_admin_delete" ON public.roles;
CREATE POLICY "roles_admin_delete"
  ON public.roles FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR public.has_role(auth.uid(), 'super_admin')
  );


-- ------------------------------------------------------------
-- P0 #9.D — Rewriting des policies `ur_tenant_*` (user_roles)
--           (créées par `20260625000003:197-231`)
-- ------------------------------------------------------------
-- `user_roles` : un utilisateur voit SES propres rôles (user_id = auth.uid())
-- OU les rôles de son tenant (pour les admins). Service_role garde tout.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "ur_tenant_select" ON public.user_roles;
CREATE POLICY "ur_tenant_select"
  ON public.user_roles FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin')
    OR association_id = public.get_current_association_id()
  );

DROP POLICY IF EXISTS "ur_tenant_insert" ON public.user_roles;
CREATE POLICY "ur_tenant_insert"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.has_role(auth.uid(), 'super_admin')
  );

DROP POLICY IF EXISTS "ur_tenant_update" ON public.user_roles;
CREATE POLICY "ur_tenant_update"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR public.has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (
    public.is_admin()
    OR public.has_role(auth.uid(), 'super_admin')
  );

DROP POLICY IF EXISTS "ur_tenant_delete" ON public.user_roles;
CREATE POLICY "ur_tenant_delete"
  ON public.user_roles FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR public.has_role(auth.uid(), 'super_admin')
  );


-- ------------------------------------------------------------
-- P0 #9.E — Rewriting des policies `profiles_tenant_admin_*`
--           (créées par `20260625000003:275-300`)
-- ------------------------------------------------------------
-- `profiles` : les policies `profiles_self_*` (créées par
-- `20260625000003:259-272` et resserrées par Task 12 l.166-183) restent
-- INTACTES — un utilisateur garde l'accès à son propre profil. Les
-- policies `profiles_tenant_admin_*` (admin voit tous les profils du
-- tenant) sont recréées SANS le bypass.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "profiles_tenant_admin_select" ON public.profiles;
CREATE POLICY "profiles_tenant_admin_select"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    public.is_admin()
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR association_id = public.get_current_association_id()
    )
  );

DROP POLICY IF EXISTS "profiles_tenant_admin_update" ON public.profiles;
CREATE POLICY "profiles_tenant_admin_update"
  ON public.profiles FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR association_id = public.get_current_association_id()
    )
  )
  WITH CHECK (
    public.is_admin()
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR association_id = public.get_current_association_id()
    )
  );


-- ------------------------------------------------------------
-- P0 #9.F — Pré-requis P0 #7 : ajouter la colonne `association_id`
--           aux tables `aide_workflow_validations` et
--           `aide_payment_items` qui la référencent sans l'avoir
--           (Task 3 P0 #7).
-- ------------------------------------------------------------
-- Sans cette colonne, les policies `mt_*` créées par
-- `20260702_aides_phase2_workflow_core.sql:129-192` cassent à
-- l'exécution (`column "association_id" does not exist`).
--
-- Backfill via JOIN sur les parents :
--   - `aide_workflow_validations.association_id` ← `aide_workflow_steps.association_id`
--   - `aide_payment_items.association_id` ← `aide_payment_orders.association_id`
-- ------------------------------------------------------------

ALTER TABLE public.aide_workflow_validations
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

ALTER TABLE public.aide_payment_items
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

UPDATE public.aide_workflow_validations awv
  SET association_id = ws.association_id
  FROM public.aide_workflow_steps ws
  WHERE awv.workflow_step_id = ws.id
    AND awv.association_id IS NULL;

UPDATE public.aide_payment_items api
  SET association_id = apo.association_id
  FROM public.aide_payment_orders apo
  WHERE api.payment_order_id = apo.id
    AND api.association_id IS NULL;

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_aide_workflow_validations_association_id
  ON public.aide_workflow_validations(association_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_aide_payment_items_association_id
  ON public.aide_payment_items(association_id);


-- ------------------------------------------------------------
-- P0 #9.G — Rewriting des policies `mt_*` Aides phase 2
--           (créées par `20260702_aides_phase2_workflow_core.sql:129-192`)
-- ------------------------------------------------------------
-- 4 tables : `aide_workflow_steps`, `aide_workflow_validations`,
-- `aide_payment_orders`, `aide_payment_items`. La colonne `association_id`
-- existe désormais sur toutes les 4 (P0 #9.F pour les 2 manquantes).
-- ------------------------------------------------------------

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'aide_workflow_steps', 'aide_workflow_validations',
    'aide_payment_orders', 'aide_payment_items'
  ]) LOOP

    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_select" ON public.%I;
        CREATE POLICY "mt_%s_select"
          ON public.%I FOR SELECT TO authenticated
          USING (
            public.has_role(auth.uid(), 'super_admin')
            OR association_id = public.get_current_association_id()
          );
      $POL$, tbl, tbl, tbl
    );

    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_insert" ON public.%I;
        CREATE POLICY "mt_%s_insert"
          ON public.%I FOR INSERT TO authenticated
          WITH CHECK (
            public.has_role(auth.uid(), 'super_admin')
            OR association_id = public.get_current_association_id()
          );
      $POL$, tbl, tbl, tbl
    );

    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_update" ON public.%I;
        CREATE POLICY "mt_%s_update"
          ON public.%I FOR UPDATE TO authenticated
          USING (
            public.has_role(auth.uid(), 'super_admin')
            OR association_id = public.get_current_association_id()
          )
          WITH CHECK (
            public.has_role(auth.uid(), 'super_admin')
            OR association_id = public.get_current_association_id()
          );
      $POL$, tbl, tbl, tbl
    );

    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_delete" ON public.%I;
        CREATE POLICY "mt_%s_delete"
          ON public.%I FOR DELETE TO authenticated
          USING (
            public.has_role(auth.uid(), 'super_admin')
            OR association_id = public.get_current_association_id()
          );
      $POL$, tbl, tbl, tbl
    );

  END LOOP;
END;
$$;


-- ============================================================
-- P0 #10 — Ajout de `association_id` aux tables tenant-scopées restantes
-- ============================================================
-- Pour chaque table tenant-scopée sans `association_id` :
--   1. ADD COLUMN IF NOT EXISTS association_id UUID (FK ON DELETE SET NULL)
--   2. Backfill des lignes existantes avec l'association par défaut
--   3. CREATE INDEX IF NOT EXISTS IF NOT EXISTS
--   4. ENABLE ROW LEVEL SECURITY (si pas déjà fait)
--
-- Le DO block vérifie `IF EXISTS (information_schema.tables)` pour
-- skipper silencieusement les tables qui n'existent pas (certaines
-- tables référencées par les hooks front n'ont pas de CREATE TABLE en
-- migration — Task 3 P0 #1).
--
-- CAS PARTICULIERS (policies créées dans des blocs séparés ci-dessous) :
--   - `notifications` : a déjà une policy `auth.uid() = user_id` (user-
--     scoped). On AJOUTE association_id (informatif + pour les vues
--     admin) MAIS on préserve la policy existante (un user ne voit que
--     ses notifs — déjà tenant-safe par construction). On ajoute
--     seulement une policy super_admin SELECT pour le debug.
--   - `loan_requests`, `loan_request_validations` : ont des policies
--     complexes (`lr_select_own_or_admin`, `lr_admin_update`, etc.) —
--     on les préserve ET on AJOUTE le filtre tenant via AND dans le
--     USING. En pratique, on DROP+recrée avec le tenant check ajouté.
--   - Tables avec policies `Owner or admin can read` (20260512154016) :
--     `reunions_sanctions`, `reunion_beneficiaires`,
--     `tontine_attributions`, `membres_cotisations_config`,
--     `cotisations_minimales`, `sport_e2d_presences`, `match_presences`,
--     `phoenix_presences_entrainement`, `reunions_huile_savon`,
--     `prets_reconductions`. On préserve le pattern owner-or-admin MAIS
--     on AJOUTE le tenant check. Comme PostgreSQL OR les policies pour
--     un même cmd, on doit DROP l'existante et recréer avec le tenant
--     check intégré (sinon le bypass user_id reste cross-tenant).
-- ============================================================

DO $$
DECLARE
  v_default_id UUID := current_setting('e2d.default_association_id')::uuid;
  tbl text;
  v_exists boolean;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    -- Prêts
    'prets_paiements', 'prets_config',
    -- Notifications
    'notifications', 'notifications_envois', 'notifications_campagnes',
    'notifications_config', 'notifications_historique', 'notifications_logs',
    -- Audit / sécurité
    'audit_logs', 'cotisations_mensuelles_audit', 'historique_connexion',
    'utilisateurs_actions_log', 'security_scans',
    -- Workflow prêts
    'loan_requests', 'loan_request_validations', 'pret_reconduction_validations',
    -- Tontine
    'tontine_attributions', 'tontine_configurations',
    -- Sport — match_*
    'match_compte_rendus', 'match_joueurs', 'match_medias',
    'match_presences', 'match_statistics', 'match_gala_config',
    -- Sport — phoenix_*
    'phoenix_adherents', 'phoenix_compositions', 'phoenix_cotisations_annuelles',
    'phoenix_entrainements', 'phoenix_entrainements_internes', 'phoenix_equipes',
    'phoenix_evenements_match', 'phoenix_presences',
    'phoenix_presences_entrainement', 'phoenix_statistiques_annuelles',
    'phoenix_statistiques_joueur', 'phoenix_stats_jaune_rouge',
    -- Sport — sport_phoenix_*
    'sport_phoenix_config', 'sport_phoenix_depenses',
    'sport_phoenix_matchs', 'sport_phoenix_recettes',
    -- Sport — sport_e2d_* (peuvent ne pas exister — IF EXISTS garde)
    'sport_e2d_matchs', 'sport_e2d_presences',
    'sport_e2d_depenses', 'sport_e2d_recettes',
    -- Site / CMS
    'site_hero', 'site_about', 'site_activities', 'site_events',
    'site_gallery', 'site_partners', 'site_config',
    'site_hero_images', 'site_gallery_albums',
    'site_events_carousel_config', 'site_pageviews',
    -- Réunions / cotisations
    'reunions_huile_savon', 'cotisations_minimales',
    'membres_cotisations_config', 'cotisations_membres',
    'activites_membres', 'exercices_cotisations_types',
    -- Divers tenant-scopé
    'recurring_donations', 'email_logs', 'fond_caisse_clotures',
    'alertes_budgetaires', 'demandes_adhesion', 'beneficiaires_config',
    'rapports_seances', 'fichiers_joint', 'exports_programmes',
    'messages_contact'
  ]) LOOP

    -- Vérifier que la table existe
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) INTO v_exists;

    IF NOT v_exists THEN
      -- Skip silencieux : table non créée par migration (Task 3 P0 #1)
      CONTINUE;
    END IF;

    -- 1. Ajouter la colonne association_id si elle n'existe pas
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS association_id UUID '
      'REFERENCES public.associations(id) ON DELETE SET NULL', tbl
    );

    -- 2. Backfill : UPDATE NULLs avec l'association par défaut
    EXECUTE format(
      'UPDATE public.%I SET association_id = $1 WHERE association_id IS NULL',
      tbl
    ) USING v_default_id;

    -- 3. Index
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_%s_association_id ON public.%I(association_id)',
      tbl, tbl
    );

    -- 4. Activer RLS
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

  END LOOP;
END;
$$;


-- ============================================================
-- P0 #10 (suite) — Policies tenant-scopées pour les nouvelles tables
-- ============================================================
-- Pour les tables qui n'avaient PAS de policies RLS préexistantes
-- significatives, on crée le jeu complet (SELECT/INSERT/UPDATE/DELETE)
-- avec le pattern strict.
--
-- Pour les tables qui avaient des policies owner-or-admin
-- (`20260512154016`), on DROP l'existante et on recrée avec tenant check
-- ajouté (sinon le OR des policies contourne le filtre tenant).
--
-- Pour `notifications` (policy `auth.uid() = user_id`), on PRÉSERVE
-- l'existante et on AJOUTE une policy super_admin (pas de tenant check
-- supplémentaire — le user-scoping est déjà tenant-safe).
--
-- Pour `loan_requests` / `loan_request_validations`, on recrée les
-- policies en ajoutant `AND (super_admin OR association_id = current)`.
-- ============================================================

-- ------------------------------------------------------------
-- 10.1 — `prets_paiements` : pas de policy préexistante — jeu complet
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "mt_prets_paiements_select" ON public.prets_paiements;
DROP POLICY IF EXISTS "mt_prets_paiements_insert" ON public.prets_paiements;
DROP POLICY IF EXISTS "mt_prets_paiements_update" ON public.prets_paiements;
DROP POLICY IF EXISTS "mt_prets_paiements_delete" ON public.prets_paiements;

CREATE POLICY "mt_prets_paiements_select"
  ON public.prets_paiements FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR association_id = public.get_current_association_id()
  );
CREATE POLICY "mt_prets_paiements_insert"
  ON public.prets_paiements FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR association_id = public.get_current_association_id()
  );
CREATE POLICY "mt_prets_paiements_update"
  ON public.prets_paiements FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR association_id = public.get_current_association_id()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR association_id = public.get_current_association_id()
  );
CREATE POLICY "mt_prets_paiements_delete"
  ON public.prets_paiements FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR association_id = public.get_current_association_id()
  );


-- ------------------------------------------------------------
-- 10.2 — `prets_config` : une seule ligne de config par tenant
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Prets config visible by all" ON public.prets_config;
DROP POLICY IF EXISTS "Prets config admin only" ON public.prets_config;
DROP POLICY IF EXISTS "mt_prets_config_select" ON public.prets_config;
DROP POLICY IF EXISTS "mt_prets_config_insert" ON public.prets_config;
DROP POLICY IF EXISTS "mt_prets_config_update" ON public.prets_config;
DROP POLICY IF EXISTS "mt_prets_config_delete" ON public.prets_config;

CREATE POLICY "mt_prets_config_select"
  ON public.prets_config FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR association_id = public.get_current_association_id()
  );
CREATE POLICY "mt_prets_config_insert"
  ON public.prets_config FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.has_role(auth.uid(), 'super_admin')
  );
CREATE POLICY "mt_prets_config_update"
  ON public.prets_config FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR public.has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (
    public.is_admin()
    OR public.has_role(auth.uid(), 'super_admin')
  );
CREATE POLICY "mt_prets_config_delete"
  ON public.prets_config FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR public.has_role(auth.uid(), 'super_admin')
  );


-- ------------------------------------------------------------
-- 10.3 — `notifications` : préserver user-scoping + super_admin bypass
-- ------------------------------------------------------------
-- La policy `Users read their own notifications` (20260615124246:37-40)
-- et `Users update read_at on their own notifications` (l.42-46) sont
-- PRÉSERVÉES (user-scoping = tenant-safe par construction). On AJOUTE
-- une policy super_admin SELECT pour le debug cross-tenant.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "notifications_super_admin_select" ON public.notifications;
CREATE POLICY "notifications_super_admin_select"
  ON public.notifications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- INSERT : réservé au service_role (edge functions) + super_admin +
-- tenant match. Les notifications sont créées par les triggers/edge
-- functions, pas par le client directement.
DROP POLICY IF EXISTS "mt_notifications_insert" ON public.notifications;
CREATE POLICY "mt_notifications_insert"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR association_id = public.get_current_association_id()
  );


-- ------------------------------------------------------------
-- 10.4 — `notifications_envois`, `notifications_campagnes`,
--         `notifications_config`, `notifications_historique`,
--         `notifications_logs`, `notifications_templates` :
--         policies tenant-scopées (admin-only pour écriture)
-- ------------------------------------------------------------
DO $$
DECLARE
  tbl text;
  v_exists boolean;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'notifications_envois', 'notifications_campagnes',
    'notifications_config', 'notifications_historique',
    'notifications_logs', 'notifications_templates'
  ]) LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) INTO v_exists;
    IF NOT v_exists THEN CONTINUE; END IF;

    -- SELECT : super_admin OR tenant
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_select" ON public.%I;
        CREATE POLICY "mt_%s_select"
          ON public.%I FOR SELECT TO authenticated
          USING (
            public.has_role(auth.uid(), 'super_admin')
            OR association_id = public.get_current_association_id()
          );
      $POL$, tbl, tbl, tbl
    );

    -- INSERT : admin OR super_admin
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_insert" ON public.%I;
        CREATE POLICY "mt_%s_insert"
          ON public.%I FOR INSERT TO authenticated
          WITH CHECK (
            public.is_admin()
            OR public.has_role(auth.uid(), 'super_admin')
          );
      $POL$, tbl, tbl, tbl
    );

    -- UPDATE : admin OR super_admin
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_update" ON public.%I;
        CREATE POLICY "mt_%s_update"
          ON public.%I FOR UPDATE TO authenticated
          USING (
            public.is_admin()
            OR public.has_role(auth.uid(), 'super_admin')
          )
          WITH CHECK (
            public.is_admin()
            OR public.has_role(auth.uid(), 'super_admin')
          );
      $POL$, tbl, tbl, tbl
    );

    -- DELETE : admin OR super_admin
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_delete" ON public.%I;
        CREATE POLICY "mt_%s_delete"
          ON public.%I FOR DELETE TO authenticated
          USING (
            public.is_admin()
            OR public.has_role(auth.uid(), 'super_admin')
          );
      $POL$, tbl, tbl, tbl
    );
  END LOOP;
END;
$$;


-- ------------------------------------------------------------
-- 10.5 — `audit_logs` : tenant-scopé + admin-only
-- ------------------------------------------------------------
-- La policy SELECT `Admins can read audit logs` (20260505191935:22-26,
-- déjà recréée via is_admin()) est conservée MAIS doit maintenant être
-- tenant-scopée. On la DROP+recrée avec le tenant check.
-- La policy INSERT `audit_logs_insert_admin_only` (Task 12 l.343-348)
-- est aussi recréée avec tenant check.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "Admins can read audit logs" ON public.audit_logs;
CREATE POLICY "Admins can read audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (
    public.is_admin()
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR association_id = public.get_current_association_id()
    )
  );

DROP POLICY IF EXISTS "audit_logs_insert_admin_only" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_admin_only"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_admin() OR public.has_role(auth.uid(), 'super_admin'))
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR association_id = public.get_current_association_id()
      OR association_id IS NULL  -- allow logs sans contexte tenant (legacy)
    )
  );


-- ------------------------------------------------------------
-- 10.6 — `cotisations_mensuelles_audit` : préserver policies existantes
--         + tenant check
-- ------------------------------------------------------------
-- Les policies `20260615170818_d0fc9220` sont déjà strictes
-- (`is_admin() OR has_permission('cotisations','update')`). On les
-- préserve ET on AJOUTE une policy tenant SELECT (les admins ne voient
-- que les audits de leur tenant).
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "cma_tenant_select" ON public.cotisations_mensuelles_audit;
CREATE POLICY "cma_tenant_select"
  ON public.cotisations_mensuelles_audit FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR association_id = public.get_current_association_id()
  );


-- ------------------------------------------------------------
-- 10.7 — `historique_connexion`, `utilisateurs_actions_log`,
--         `security_scans` : tenant-scopés + admin-only
-- ------------------------------------------------------------
DO $$
DECLARE
  tbl text;
  v_exists boolean;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'historique_connexion', 'utilisateurs_actions_log', 'security_scans'
  ]) LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) INTO v_exists;
    IF NOT v_exists THEN CONTINUE; END IF;

    -- SELECT : super_admin OR (admin AND tenant)
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_select" ON public.%I;
        CREATE POLICY "mt_%s_select"
          ON public.%I FOR SELECT TO authenticated
          USING (
            public.has_role(auth.uid(), 'super_admin')
            OR (
              public.is_admin()
              AND association_id = public.get_current_association_id()
            )
          );
      $POL$, tbl, tbl, tbl
    );

    -- INSERT : allow (les logs sont insérés par triggers/edge functions)
    -- + tenant check (super_admin OR tenant OR legacy NULL)
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_insert" ON public.%I;
        CREATE POLICY "mt_%s_insert"
          ON public.%I FOR INSERT TO authenticated
          WITH CHECK (
            public.has_role(auth.uid(), 'super_admin')
            OR association_id = public.get_current_association_id()
            OR association_id IS NULL
          );
      $POL$, tbl, tbl, tbl
    );

    -- UPDATE : admin only + super_admin
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_update" ON public.%I;
        CREATE POLICY "mt_%s_update"
          ON public.%I FOR UPDATE TO authenticated
          USING (
            public.is_admin()
            OR public.has_role(auth.uid(), 'super_admin')
          )
          WITH CHECK (
            public.is_admin()
            OR public.has_role(auth.uid(), 'super_admin')
          );
      $POL$, tbl, tbl, tbl
    );

    -- DELETE : admin only + super_admin
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_delete" ON public.%I;
        CREATE POLICY "mt_%s_delete"
          ON public.%I FOR DELETE TO authenticated
          USING (
            public.is_admin()
            OR public.has_role(auth.uid(), 'super_admin')
          );
      $POL$, tbl, tbl, tbl
    );
  END LOOP;
END;
$$;


-- ------------------------------------------------------------
-- 10.8 — `loan_requests` : préserver owner-or-admin + tenant check
-- ------------------------------------------------------------
-- L'ancienne policy `lr_select_own_or_admin` (20260428200651:487-498)
-- utilisait `is_admin() OR own OR has_role(...)` SANS tenant check.
-- Avec is_admin() désormais tenant-aware, le `is_admin()` branche est
-- déjà tenant-safe. Mais les branches `own` et `has_role(...)` ne le
-- sont PAS — un user pourrait voir une loan_request d'un autre tenant
-- s'il en connaissait l'ID (membre_id ne matchera pas, mais la branche
-- `has_role('tresorier')` est cross-tenant).
-- On recrée AVEC tenant check ajouté sur toutes les branches.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "lr_select_own_or_admin" ON public.loan_requests;
CREATE POLICY "lr_select_own_or_admin"
  ON public.loan_requests FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      association_id = public.get_current_association_id()
      AND (
        public.is_admin()
        OR EXISTS (SELECT 1 FROM public.membres m WHERE m.id = membre_id AND m.user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur
          JOIN public.roles r ON r.id = ur.role_id
          WHERE ur.user_id = auth.uid()
            AND lower(r.name) IN ('tresorier','commissaire_comptes','commissaire','president','censeur','secretaire_general','secretaire')
        )
      )
    )
  );

-- INSERT : bloqué (passe par create_loan_request RPC)
-- On préserve lr_no_direct_insert
DROP POLICY IF EXISTS "lr_no_direct_insert" ON public.loan_requests;
CREATE POLICY "lr_no_direct_insert"
  ON public.loan_requests FOR INSERT TO authenticated
  WITH CHECK (false);

-- UPDATE : admin tenant + super_admin
DROP POLICY IF EXISTS "lr_admin_update" ON public.loan_requests;
CREATE POLICY "lr_admin_update"
  ON public.loan_requests FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (public.is_admin() AND association_id = public.get_current_association_id())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR (public.is_admin() AND association_id = public.get_current_association_id())
  );

-- DELETE : admin tenant + super_admin
DROP POLICY IF EXISTS "lr_admin_delete" ON public.loan_requests;
CREATE POLICY "lr_admin_delete"
  ON public.loan_requests FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (public.is_admin() AND association_id = public.get_current_association_id())
  );


-- ------------------------------------------------------------
-- 10.9 — `loan_request_validations` : préserver + tenant check
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "lrv_select_visible" ON public.loan_request_validations;
CREATE POLICY "lrv_select_visible"
  ON public.loan_request_validations FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      association_id = public.get_current_association_id()
      AND EXISTS (
        SELECT 1 FROM public.loan_requests lr
        WHERE lr.id = loan_request_id
      )
    )
  );

DROP POLICY IF EXISTS "lrv_no_direct_insert" ON public.loan_request_validations;
CREATE POLICY "lrv_no_direct_insert"
  ON public.loan_request_validations FOR INSERT TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "lrv_admin_update" ON public.loan_request_validations;
CREATE POLICY "lrv_admin_update"
  ON public.loan_request_validations FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (public.is_admin() AND association_id = public.get_current_association_id())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR (public.is_admin() AND association_id = public.get_current_association_id())
  );


-- ------------------------------------------------------------
-- 10.10 — `pret_reconduction_validations` : tenant-scopé
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "mt_pret_reconduction_validations_select" ON public.pret_reconduction_validations;
DROP POLICY IF EXISTS "mt_pret_reconduction_validations_insert" ON public.pret_reconduction_validations;
DROP POLICY IF EXISTS "mt_pret_reconduction_validations_update" ON public.pret_reconduction_validations;
DROP POLICY IF EXISTS "mt_pret_reconduction_validations_delete" ON public.pret_reconduction_validations;

CREATE POLICY "mt_pret_reconduction_validations_select"
  ON public.pret_reconduction_validations FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR association_id = public.get_current_association_id()
  );
CREATE POLICY "mt_pret_reconduction_validations_insert"
  ON public.pret_reconduction_validations FOR INSERT TO authenticated
  WITH CHECK (false);  -- via RPC uniquement
CREATE POLICY "mt_pret_reconduction_validations_update"
  ON public.pret_reconduction_validations FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (public.is_admin() AND association_id = public.get_current_association_id())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR (public.is_admin() AND association_id = public.get_current_association_id())
  );
CREATE POLICY "mt_pret_reconduction_validations_delete"
  ON public.pret_reconduction_validations FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR public.is_admin()
  );


-- ------------------------------------------------------------
-- 10.11 — Tables avec policies `Owner or admin can read`
--         (20260512154016) : recréer avec tenant check
-- ------------------------------------------------------------
-- Tables concernées : `tontine_attributions`, `reunions_huile_savon`,
-- `cotisations_minimales`, `membres_cotisations_config`,
-- `sport_e2d_presences`, `match_presences`,
-- `phoenix_presences_entrainement`.
-- (Note : `reunion_beneficiaires`, `reunions_sanctions`,
-- `prets_reconductions` sont déjà dans le DO block P0 #9.A avec les
-- mt_* policies — on y DROP aussi les anciennes "Owner or admin".)
--
-- Pour ces tables, on DROP la policy `Owner or admin can read` (qui
-- utilise `is_admin()` cross-tenant) et on la recrée avec tenant check.
-- ------------------------------------------------------------

DO $$
DECLARE
  tbl text;
  v_exists boolean;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'tontine_attributions', 'reunions_huile_savon',
    'cotisations_minimales', 'membres_cotisations_config',
    'sport_e2d_presences', 'match_presences',
    'phoenix_presences_entrainement',
    'reunion_beneficiaires', 'reunions_sanctions', 'prets_reconductions'
  ]) LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) INTO v_exists;
    IF NOT v_exists THEN CONTINUE; END IF;

    -- DROP l'ancienne policy owner-or-admin (cross-tenant via is_admin())
    EXECUTE format(
      'DROP POLICY IF EXISTS "Owner or admin can read" ON public.%I', tbl
    );

    -- Recréer avec tenant check : owner (du tenant) OR admin (du tenant) OR super_admin
    -- NB : `membre_id = current_membre_id()` est implicitement tenant-safe
    -- car current_membre_id() filtre par `user_id = auth.uid()` (un user
    -- appartient à un seul tenant).
    EXECUTE format(
      $POL$
        CREATE POLICY "Owner or admin can read"
          ON public.%I FOR SELECT TO authenticated
          USING (
            public.has_role(auth.uid(), 'super_admin')
            OR (
              association_id = public.get_current_association_id()
              AND (
                membre_id = public.current_membre_id()
                OR public.is_admin()
              )
            )
          );
      $POL$, tbl
    );
  END LOOP;
END;
$$;


-- ------------------------------------------------------------
-- 10.12 — `tontine_configurations`, `match_*`, `phoenix_*`,
--         `sport_phoenix_*`, `sport_e2d_*`, `site_*`, `activites_membres`,
--         `cotisations_membres`, `exercices_cotisations_types`,
--         `recurring_donations`, `email_logs`, `fond_caisse_clotures`,
--         `alertes_budgetaires`, `demandes_adhesion`, `beneficiaires_config`,
--         `rapports_seances`, `fichiers_joint`, `exports_programmes`,
--         `messages_contact` : policies tenant-scopées standard
-- ------------------------------------------------------------
-- Pour ces tables (qui n'ont pas de policy owner-or-admin à préserver),
-- on crée le jeu complet mt_* (SELECT/INSERT/UPDATE/DELETE) avec le
-- pattern strict. Le DO boucle et skip les tables inexistantes.
-- ------------------------------------------------------------

DO $$
DECLARE
  tbl text;
  v_exists boolean;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'tontine_configurations',
    'match_compte_rendus', 'match_joueurs', 'match_medias',
    'match_statistics', 'match_gala_config',
    'phoenix_adherents', 'phoenix_compositions',
    'phoenix_cotisations_annuelles', 'phoenix_entrainements',
    'phoenix_entrainements_internes', 'phoenix_equipes',
    'phoenix_evenements_match', 'phoenix_presences',
    'phoenix_statistiques_annuelles', 'phoenix_statistiques_joueur',
    'phoenix_stats_jaune_rouge',
    'sport_phoenix_config', 'sport_phoenix_depenses',
    'sport_phoenix_matchs', 'sport_phoenix_recettes',
    'sport_e2d_matchs', 'sport_e2d_depenses', 'sport_e2d_recettes',
    'site_hero', 'site_about', 'site_activities', 'site_events',
    'site_gallery', 'site_partners', 'site_config',
    'site_hero_images', 'site_gallery_albums',
    'site_events_carousel_config', 'site_pageviews',
    'activites_membres', 'cotisations_membres',
    'exercices_cotisations_types',
    'recurring_donations', 'email_logs', 'fond_caisse_clotures',
    'alertes_budgetaires', 'demandes_adhesion', 'beneficiaires_config',
    'rapports_seances', 'fichiers_joint', 'exports_programmes',
    'messages_contact'
  ]) LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) INTO v_exists;
    IF NOT v_exists THEN CONTINUE; END IF;

    -- SELECT : super_admin OR tenant
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_select" ON public.%I;
        CREATE POLICY "mt_%s_select"
          ON public.%I FOR SELECT TO authenticated
          USING (
            public.has_role(auth.uid(), 'super_admin')
            OR association_id = public.get_current_association_id()
          );
      $POL$, tbl, tbl, tbl
    );

    -- INSERT : admin OR super_admin
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_insert" ON public.%I;
        CREATE POLICY "mt_%s_insert"
          ON public.%I FOR INSERT TO authenticated
          WITH CHECK (
            public.is_admin()
            OR public.has_role(auth.uid(), 'super_admin')
          );
      $POL$, tbl, tbl, tbl
    );

    -- UPDATE : admin OR super_admin
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_update" ON public.%I;
        CREATE POLICY "mt_%s_update"
          ON public.%I FOR UPDATE TO authenticated
          USING (
            public.is_admin()
            OR public.has_role(auth.uid(), 'super_admin')
          )
          WITH CHECK (
            public.is_admin()
            OR public.has_role(auth.uid(), 'super_admin')
          );
      $POL$, tbl, tbl, tbl
    );

    -- DELETE : admin OR super_admin
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_delete" ON public.%I;
        CREATE POLICY "mt_%s_delete"
          ON public.%I FOR DELETE TO authenticated
          USING (
            public.is_admin()
            OR public.has_role(auth.uid(), 'super_admin')
          );
      $POL$, tbl, tbl, tbl
    );
  END LOOP;
END;
$$;


-- ============================================================
-- RPC spot-fixes — `log_audit_event()` (Task 12) : peupler
-- `association_id` côté serveur
-- ============================================================
-- Problème : la RPC `log_audit_event` (créée par Task 12 l.289-322)
-- insert dans `audit_logs` SANS peupler `association_id` (la colonne
-- n'existait pas à l'époque). Avec l'ajout de la colonne en P0 #10,
-- les logs sont insérés avec `association_id = NULL` → invisibles aux
-- admins tenant (cf. policy `Admins can read audit logs` resserrée).
--
-- Solution : recréer la RPC pour peupler `association_id =
-- get_current_association_id()` côté serveur. La signature est
-- inchangée → pas de breaking change front-end.
-- ============================================================

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
  v_assoc_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_action IS NULL OR btrim(p_action) = '' THEN
    RAISE EXCEPTION 'p_action requis';
  END IF;

  -- Tenant : récupérer l'association courante (NULL pour super_admin)
  v_assoc_id := public.get_current_association_id();

  INSERT INTO public.audit_logs (
    action, table_name, record_id, user_id, old_data, new_data,
    created_at, association_id
  )
  VALUES (
    p_action, p_table_name, p_record_id, v_user_id, p_old_data, p_new_data,
    now(), v_assoc_id
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- Re-grant (la recréation peut perdre les grants selon la version PG)
REVOKE ALL ON FUNCTION public.log_audit_event(TEXT, TEXT, UUID, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_audit_event(TEXT, TEXT, UUID, JSONB, JSONB) TO authenticated;


-- ============================================================
-- GRANTs complémentaires
-- ============================================================
-- S'assurer que `authenticated` garde SELECT sur les nouvelles tables
-- tenant-scopées (sinon les queries front retournent "permission denied").
-- ============================================================

DO $$
DECLARE
  tbl text;
  v_exists boolean;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'prets_paiements', 'prets_config',
    'notifications_envois', 'notifications_campagnes',
    'notifications_config', 'notifications_historique',
    'notifications_logs', 'notifications_templates',
    'audit_logs', 'cotisations_mensuelles_audit', 'historique_connexion',
    'utilisateurs_actions_log', 'security_scans',
    'loan_requests', 'loan_request_validations', 'pret_reconduction_validations',
    'tontine_attributions', 'tontine_configurations',
    'match_compte_rendus', 'match_joueurs', 'match_medias',
    'match_presences', 'match_statistics', 'match_gala_config',
    'phoenix_adherents', 'phoenix_compositions', 'phoenix_cotisations_annuelles',
    'phoenix_entrainements', 'phoenix_entrainements_internes', 'phoenix_equipes',
    'phoenix_evenements_match', 'phoenix_presences',
    'phoenix_presences_entrainement', 'phoenix_statistiques_annuelles',
    'phoenix_statistiques_joueur', 'phoenix_stats_jaune_rouge',
    'sport_phoenix_config', 'sport_phoenix_depenses',
    'sport_phoenix_matchs', 'sport_phoenix_recettes',
    'sport_e2d_matchs', 'sport_e2d_presences',
    'sport_e2d_depenses', 'sport_e2d_recettes',
    'site_hero', 'site_about', 'site_activities', 'site_events',
    'site_gallery', 'site_partners', 'site_config',
    'site_hero_images', 'site_gallery_albums',
    'site_events_carousel_config', 'site_pageviews',
    'reunions_huile_savon', 'cotisations_minimales',
    'membres_cotisations_config', 'cotisations_membres',
    'activites_membres', 'exercices_cotisations_types',
    'recurring_donations', 'email_logs', 'fond_caisse_clotures',
    'alertes_budgetaires', 'demandes_adhesion', 'beneficiaires_config',
    'rapports_seances', 'fichiers_joint', 'exports_programmes',
    'messages_contact',
    'aide_workflow_validations', 'aide_payment_items'
  ]) LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) INTO v_exists;
    IF NOT v_exists THEN CONTINUE; END IF;

    -- GRANT SELECT sur les tables tenant-scopées (les INSERT/UPDATE/DELETE
    -- restent gérés par les policies RLS — pas besoin de GRANT ALL).
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', tbl);
  END LOOP;
END;
$$;


-- ============================================================
-- RÉCAPITULATIF — P0/P1 traités par cette migration
-- ============================================================
--   ✓ P0 #7  — `aide_workflow_validations` et `aide_payment_items` :
--              colonne `association_id` ajoutée + backfill via JOIN sur
--              les parents (`aide_workflow_steps`, `aide_payment_orders`)
--              + index + policies mt_* recréées. Les requêtes ne
--              planteront plus sur `column "association_id" does not
--              exist`.
--   ✓ P0 #8  — Backfill `association_id` sur 22 tables multi-tenant :
--              association par défaut créée (UUID fixe
--              `00000000-0000-0000-0000-000000000001`) si la table
--              `associations` était vide, sinon reprise de la 1ère
--              association existante. 24 UPDATEs explicites (22 tables
--              foundation + 2 tables Aides phase 2 déjà pourvues).
--   ✓ P0 #9  — Bypass `OR get_current_association_id() IS NULL` supprimé
--              sur 22 tables foundation + `associations` + `roles` +
--              `user_roles` + `profiles` (admin) + 4 tables Aides phase
--              2. Pattern remplacé par `has_role(auth.uid(), 'super_admin')
--              OR association_id = get_current_association_id()` (fail-
--              closed). 88+ policies recréées au total.
--   ✓ P0 #10 — `association_id` ajouté à ~70 tables tenant-scopées
--              (prets_paiements, prets_config, notifications*,
--              audit_logs, cotisations_mensuelles_audit,
--              historique_connexion, utilisateurs_actions_log,
--              security_scans, loan_requests, loan_request_validations,
--              pret_reconduction_validations, tontine_*, match_*,
--              phoenix_*, sport_phoenix_*, sport_e2d_*, site_*,
--              reunions_huile_savon, cotisations_minimales,
--              membres_cotisations_config, cotisations_membres,
--              activites_membres, exercices_cotisations_types,
--              recurring_donations, email_logs, fond_caisse_clotures,
--              alertes_budgetaires, demandes_adhesion,
--              beneficiaires_config, rapports_seances, fichiers_joint,
--              exports_programmes, messages_contact). Chacune avec FK,
--              index, backfill et policies tenant-scopées.
--   ✓ Hardening `is_admin()` — recréée tenant-aware : `super_admin`
--              (cross-tenant) OU `administrateur` dont le rôle appartient
--              à l'association courante. Impact automatique sur toutes les
--              policies existantes qui utilisent `is_admin()`.
--   ✓ RPC `log_audit_event()` — recréée pour peupler `association_id`
--              côté serveur (NULL pour super_admin). Signature inchangée
--              → pas de breaking change front-end.
--
-- P0/P1 NON traités (hors périmètre Phase 2-a) :
--   - P0 #2-bis (Task 3 P0 #9) — `prets.date_debut` INEXISTANTE : non
--     ajouté ici (Task 9 l.1538 a documenté ce P0 pour une migration
--     séparée). À traiter dans une migration Phase 2-b.
--   - P0 #1 (Task 3) — Aucune baseline de schéma : 28/128 migrations
--     ont un CREATE TABLE. Hors scope (migration de baseline massive).
--   - P1 #4 (Task 3) — Index FK manquants sur colonnes chaudes : partiel
--     (cette migration ajoute idx_<table>_association_id mais pas les
--     idx sur membre_id, pret_id, etc.). À traiter en Phase 2-b.
--   - P1 #6 (Task 3) — `ON DELETE SET NULL` sur FK `association_id` :
--     conservé ici pour cohérence avec `20260625000001`. La migration
--     vers `ON DELETE CASCADE` ou `RESTRICT` est un chantier séparé.
--   - Catalogs globaux non touchés : `cotisations_types`, `sanctions_types`,
--     `types_sanctions`, `sanctions_tarifs`, `loan_validation_config`,
--     `pret_reconduction_validation_config`, `configurations`,
--     `smtp_config`, `payment_configs`, `session_config`, `caisse_config`,
--     `cms_*` (cf. header "DÉCISIONS DOCUMENTÉES").
--
-- CHANGEMENTS FRONT-END REQUIS (à porter par les agents UI 15/16) :
--   1. Régénérer `src/integrations/supabase/types.ts` via
--      `supabase gen types typescript --local` après application de la
--      migration (Task 3 P1 #1). La nouvelle colonne `association_id`
--      apparaîtra sur ~70 tables. Aucune logique front n'a besoin d'être
--      modifiée pour la sécurité (RLS filtre côté DB), mais les INSERT
--      directs côté client devront peupler `association_id` (sinon
--      WITH CHECK rejettera). Les hooks qui font INSERT direct
--      (`useReunions`, `useCotisations`, `usePrets`, etc.) devront
--      récupérer l'association_id depuis AuthContext (à exposer via
--      `get_current_association_id()` RPC ou profil).
--   2. Exposer `association_id` dans `AuthContext` (Task 1 P0 #5) :
--      appeler `supabase.rpc('get_current_association_id')` au login et
--      stocker dans le contexte. Le propager aux hooks d'INSERT.
--   3. `AidesAdmin` (Task 1 P0 #5) : la prop `associationId` est
--      actuellement `undefined` → le module Aides est inopérant. Avec
--      l'association par défaut backfillée, les données sont visibles,
--      mais il faut câbler la prop pour les INSERT.
-- ============================================================

COMMIT;
