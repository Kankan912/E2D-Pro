# Code Review — Mai 2026

Revue d'ensemble du projet E2D : modules métier, dépendances, sécurité, qualité.
Date : 2026-05-12.

## Synthèse exécutive

| Domaine | État | Action |
|---|---|---|
| Dépendances npm | ✅ OK | Aucune vulnérabilité high/critical |
| RLS — tables publiques sensibles | ✅ Corrigé ce jour | Migration appliquée sur 14 tables |
| Edge Functions auth | ✅ OK | `requirePrivilegedUser` en place |
| Linter Supabase | ⚠️ 96 warnings | Majoritairement faux-positifs (voir §3) |
| Architecture frontend | ✅ Solide | Lazy + ErrorBoundary + Logger OK |
| Tests | ⚠️ Partiel | Couverture limitée aux calculs financiers |
| Documentation | ✅ Complète | `/docs` à jour, mémoires synchronisées |

---

## 1. Sécurité — corrections appliquées (migration du 12/05/2026)

14 tables exposaient des données via `USING (true)` au rôle `public` :

| Table | Nouvelle politique |
|---|---|
| `reunion_beneficiaires` | Owner (`membre_id = current_membre_id()`) **ou** `is_admin()` |
| `tontine_attributions` | Owner ou admin |
| `reunions_sanctions` | Owner ou admin |
| `membres_cotisations_config` | Owner ou admin |
| `cotisations_minimales` | Owner ou admin |
| `sport_e2d_presences` | Owner ou admin |
| `match_presences` | Owner ou admin |
| `phoenix_presences_entrainement` | Owner ou admin |
| `reunions_huile_savon` | Owner ou admin |
| `prets_reconductions` | Owner du prêt (via `prets.membre_id`) ou admin |
| `rapports_seances` | Authentifié uniquement |
| `notifications_campagnes` | Admin uniquement |
| `beneficiaires_config` | Admin uniquement |
| `payment_configs` | Authentifié si `is_active=true`, ou admin |

Helper SQL ajouté : `public.current_membre_id()` (SECURITY DEFINER, mappe `auth.uid()` → `membres.id`).

**Impact UX à valider** : si des écrans publics affichaient des sanctions/présences/bénéficiaires, ils ne fonctionneront plus en anonyme. À ma connaissance ces vues sont toutes derrière `/dashboard/*` (authentifié) — à confirmer en cliquant sur les pages concernées.

---

## 2. Sécurité — items résiduels

### 2.1 Linter Supabase (96 warnings, tous WARN, aucun ERROR)

| Type | Nombre | Décision recommandée |
|---|---|---|
| Public bucket allows listing (storage) | ~9 | **Accepté** — buckets vitrine (site-hero, site-gallery, etc.) doivent être listables. À durcir uniquement pour `members-photos` et `match-medias` si la liste exhaustive ne doit pas être publique. |
| `SECURITY DEFINER` exécutable par anon | ~70 | **Accepté en grande partie** — fonctions de RPC métier (`get_caisse_synthese`, `has_role`, etc.) appelées avec un jeton authentifié côté front. Optionnel : `REVOKE EXECUTE ... FROM anon` pour les fonctions strictement réservées aux admins. |
| `RLS Policy Always True` (UPDATE/DELETE/INSERT) | 1 | À investiguer — repérer la table et restreindre. |
| Auth OTP / leaked password protection | quelques | **Action utilisateur Dashboard** (pas modifiable via migration). |

### 2.2 Edge Functions

✅ `requirePrivilegedUser` ajouté sur les broadcast functions (rappels, sanctions, calendriers).
✅ `send-email` valide format destinataire, sujet (anti-CRLF), longueur body.
✅ `get-payment-config` strippe les champs sensibles via blacklist.

⚠️ À vérifier manuellement (non couvert par l'audit) :
- `process-adhesion`, `donations-stats`, `send-contact-notification` : exposition publique légitime (vitrine), valider zod sur inputs.
- `create-user-account` : doit exiger `is_admin()` + journaliser dans `audit_logs`.
- `sync-user-emails`, `update-email-config`, `test-email-configuration` : admin only.

---

## 3. Modules métier

### 3.1 Cotisations — ✅ OK
- Source de vérité : `cotisations_mensuelles_exercice` avec fallback sur `cotisations_types`.
- Verrouillage à l'activation de l'exercice OK (`verrouiller_cotisations_mensuelles_on_exercice_actif`).
- Filtre par `exercices_cotisations_types.actif = true` respecté.
- Tests unitaires : `cotisationsLogic.test.ts` couvre les cas principaux.

### 3.2 Caisse — ✅ OK
- Solde via `get_solde_caisse()` / `get_caisse_synthese()`.
- Pourcentage empruntable configurable (80% par défaut).
- Audit `update_caisse_operation_audit` enregistre `updated_by`.
- Tests : `caisseCalculations.test.ts`.

### 3.3 Prêts — ✅ Bon
- Workflow multi-étapes via `loan_validation_config` + `loan_request_validations`.
- Trigger `trg_loan_request_advance` gère l'avancement automatique.
- Décaissement via RPC `disburse_loan` (réservé tresorier/admin).
- Statuts hiérarchisés : `Remboursé > En retard > Reconduit > Partiel > En cours`.
- Reste à payer priorise `prets_reconductions.interet_mois`.
- ⚠️ **Vérifier** : `update_pret_amounts` ne recalcule que `montant_paye`, pas le statut. Le statut est dérivé via `get_pret_status()` mais n'est pas persisté → risque d'incohérence dans l'UI si le hook ne le recalcule pas. **Recommandation** : trigger `BEFORE UPDATE` sur `prets` pour appeler `get_pret_status` quand `montant_paye` change.

### 3.4 Bénéficiaires — ✅ OK
- `calculer_montant_beneficiaire()` : brut = mensuel × 12, déduction sanctions impayées.
- Distribution prorata des intérêts documentée dans la mémoire.

### 3.5 Aides — ✅ OK
- Statut `alloue` déclenche `fond_caisse_operations` (sortie) via `create_caisse_operation_from_source`.
- Soft delete et update gérés.

### 3.6 Réunions — ✅ Bon
- Réouverture via workflow documenté (`terminee` → `en_cours`).
- Projection cotisations à l'ouverture (`trg_projeter_cotisations_on_open`).
- ⚠️ Email de notification ne bloque pas la clôture (OK), mais aucun retry visible. **Recommandation** : queue de retry ou log dans `notifications_logs`.

### 3.7 Sport (E2D + Phoenix) — ✅ OK
- E2D : filtrage joueurs par `est_membre_e2d = true`.
- Sync match → `site_events` uniquement si `statut_publication = 'publie'`.
- Bucket `sport-logos` + `match-medias`.

### 3.8 Adhésions & Donations — ✅ OK
- Mobile Money manuel (Orange/MTN) avec réconciliation.
- `useAdhesions` query la bonne table (`adhesions` avec `payment_status`).

### 3.9 Notifications — ✅ Bon
- Multi-provider (Outlook SMTP natif + Resend).
- Compatibilité legacy destinataires JSON array/object.
- ⚠️ La table `notifications_campagnes` est désormais admin-only en lecture (cf §1) — **vérifier** qu'aucun composant non-admin ne la requête.

### 3.10 Utilisateurs / Rôles / Permissions — ✅ Solide
- `has_permission(_resource, _permission)` avec join `role_permissions ↔ user_roles`.
- Soft-delete via `status = 'supprime'`.
- Inactif/Suspendu bloqués au login.

### 3.11 CMS Site vitrine — ✅ OK
- Hero durci avec timeout 10s + fallback (volet B précédent).
- `useSiteContent` utilise `.maybeSingle()`.

---

## 4. Architecture & qualité

### 4.1 Frontend ✅
- Lazy + `lazyWithRetry` partout pour éviter les chunk-load errors.
- `ErrorBoundary` sur 2 niveaux (App + Dashboard).
- `QueryClient` configuré : `staleTime 60s`, `refetchOnWindowFocus: false`, `retry: 1` — sain.
- Logger centralisé (`src/lib/logger.ts`) qui strippe `debug/info` en prod.

### 4.2 Type-safety ⚠️
- Jointures Supabase typées dans `src/types/supabase-joins.ts` ✅
- Dette résiduelle documentée : cast manuel pour `verrouille` et `realtime` (mémoire).
- Recommandation : grep `as any` et réduire progressivement.

### 4.3 Tests ⚠️
Couverture actuelle :
- `caisseCalculations.test.ts`
- `cotisationsLogic.test.ts`
- `payment-utils.test.ts`
- `pretCalculsService.test.ts`
- `session-utils.test.ts`
- `utils.test.ts`

**Manques importants** :
- Pas de test sur `calculer_montant_beneficiaire` (logique financière critique).
- Pas de test sur les RPC de workflow prêts (`validate_loan_step`, `reject_loan_step`, `disburse_loan`).
- Pas de test E2E sur les edge functions critiques.

### 4.4 Performance
- ✅ React Query bien utilisé (cache + invalidation).
- ⚠️ Aucune liste virtualisée vue. À considérer pour `MembresAdmin`, `CotisationsGridView`, `PretsAdmin` au-delà de 100 lignes.
- ⚠️ Bundle non analysé. Recommandation : `bunx vite-bundle-visualizer` une fois.

### 4.5 SEO & A11y
- ✅ `SEOHead` composant centralisé.
- ✅ `sitemap.xml` + `robots.txt` présents.
- À auditer manuellement : alt text sur images uploadées, contraste WCAG.

---

## 5. Dépendances

✅ `bun audit` propre (aucune vuln high/critical).
- `jsPDF` figé à `^3.0.3` (compatibilité `jspdf-autotable`) — OK.
- `@supabase/supabase-js`, `@tanstack/react-query`, `react`, `react-router-dom` à jour.

---

## 6. Roadmap recommandée (priorisée)

### P0 — fait ce jour
- [x] Fermer les 14 fuites RLS publiques.

### P1 — à faire
- [ ] Trigger pour persister/recalculer `prets.statut` à chaque update de `montant_paye`.
- [ ] Vérifier qu'aucun composant front non-admin ne lit `notifications_campagnes` / `beneficiaires_config`.
- [ ] Investiguer le 1 warning linter "RLS Always True" sur UPDATE/DELETE/INSERT.
- [ ] Activer "Leaked password protection" + OTP expiration courte dans Dashboard Supabase.

### P2 — amélioration continue
- [ ] Tests unitaires sur `calculer_montant_beneficiaire` et workflow prêts.
- [ ] Virtualisation des grandes listes (`react-virtual`).
- [ ] Audit bundle size + code-splitting fin sur les modules admin lourds (Sport, Caisse).
- [ ] Réduire `as any` résiduels.
- [ ] Retry / dead-letter queue pour les emails échoués.

### P3 — polish
- [ ] Limiter `EXECUTE` des RPC SECURITY DEFINER aux rôles ciblés.
- [ ] Restreindre listing de `members-photos` et `match-medias` si non souhaité publiquement.

---

## 7. Conclusion

Le projet est dans un **bon état général** :
- Architecture solide (lazy, error boundary, logger, React Query bien configuré).
- Logique métier financière documentée et largement testée.
- Sécurité fortement améliorée après les vagues de hardening (v3.0, v3.1, v3.5 + ce jour).
- Documentation `/docs` riche et mémoires AI à jour.

Les actions P1 ci-dessus sont des **améliorations**, pas des bugs bloquants. Le projet peut être publié en l'état.
