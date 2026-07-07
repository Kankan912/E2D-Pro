# Audit Finances — Phase 1 (mise à jour post-clarifications)

## Synthèse

| Réf | Module | Sujet | Statut |
|-----|--------|-------|--------|
| C1-C4 | Cotisations | Calculs, source unique, verrouillage | ✅ Conforme |
| C5 | Bénéficiaires | Formule `mensuel × N` | ✅ Conforme (épargne individuelle, pas redistribution) |
| C6 | Bénéficiaires | Regroupement visuel par mois | ✅ Déjà implémenté (`CalendrierBeneficiairesManager`) |
| C7 | Bénéficiaires | Ajout/modification/suppression manuelle | ✅ Déjà implémenté |
| **C8** | Bénéficiaires | Permissions trop larges (`secretaire_general` inclus) | ✅ **Corrigé** (RLS + frontend) |
| C9-C10 | Prêts | Remboursement partiel sans recalcul d'intérêts | ✅ Conforme |
| **C11** | Prêts | Statut `en_attente_reconduction` | ✅ **Corrigé** (workflow tables) |
| **C12** | Prêts | Workflow multi-valideurs configurable | ✅ **SQL livré** — frontend partiel (voir ci-dessous) |
| **C13** | Bénéficiaires | Durée d'exercice (12 mois en dur) | ✅ **Corrigé** (RPC + colonne + frontend dynamiques) |
| C14-C15 | Caisse | Source unique `get_caisse_synthese` | ✅ Conforme |

## Corrections livrées (migration `20260601`)

### C8 — Permissions calendrier bénéficiaires
- Nouvelle fonction `public.can_manage_beneficiaires()` : admin + trésorier uniquement
- Policies RLS `calendrier_beneficiaires` (INSERT/UPDATE/DELETE) refondues sur ce helper
- Frontend `CalendrierBeneficiairesManager.tsx` : `secretaire_general` retiré du check `isAdmin`

### C13 — Durée d'exercice dynamique ✅
- RPC `calculer_montant_beneficiaire` : nb de mois calculé depuis `exercices.date_debut/date_fin`, plus de `× 12` en dur (champ `nb_mois` exposé dans le JSON retourné)
- Colonne `calendrier_beneficiaires.montant_total` : **n'est plus générée** (`GENERATED ALWAYS AS … * 12` supprimée). Désormais colonne `numeric` standard maintenue par trigger `trg_calendrier_beneficiaires_compute_total` = `montant_mensuel × get_exercice_nb_mois(exercice_id)`
- Nouvelle fonction utilitaire `public.get_exercice_nb_mois(uuid)` (min 1, défaut 12 si dates absentes)
- Backfill effectué sur les lignes existantes selon la vraie durée de chaque exercice
- Frontend `CalendrierBeneficiairesManager.tsx` : variable `nbMoisExercice` calculée depuis `selectedExerciceData.date_debut/date_fin` ; preview dialog d'ajout et entête PDF utilisent désormais la durée réelle (plus de `× 12` en dur)

### C11/C12 — Workflow reconduction prêt (SQL)
Tables créées :
- `pret_reconduction_validation_config(role, label, ordre, actif)` — éditable admin
- `pret_reconduction_validations(reconduction_id, role, label, ordre, statut, …)`
- Colonnes ajoutées sur `prets_reconductions` : `current_step`, `motif_rejet`, `created_by`

RPC créées (calque exact de `loan_requests`) :
- `upsert_pret_reconduction_validation_step`, `delete_*`, `reorder_*`
- `validate_pret_reconduction_step(_recon_id, _commentaire)`
- `reject_pret_reconduction_step(_recon_id, _motif)`

Triggers :
- BEFORE INSERT : statut initial (`in_progress` si config active, sinon legacy admin direct)
- AFTER INSERT : création des lignes d'étapes
- Ancien `trg_enforce_reconduction_validation` désactivé

**Compatibilité descendante** : si aucune étape n'est configurée dans `pret_reconduction_validation_config`, le comportement legacy est conservé (admin/trésorier valide direct, autres → `en_attente`). Le système est donc opérationnel immédiatement.

## Reste à livrer (frontend reconduction)

À implémenter dans un commit dédié (volume estimé ≈ 4 fichiers) :
1. `src/pages/admin/PretsReconductionConfig.tsx` — page admin (calque `LoanWorkflowConfig.tsx`)
2. `src/components/loans/ReconductionValidationTimeline.tsx` — affichage des étapes
3. `src/components/ReconduireModal.tsx` — message adapté lorsque workflow actif
4. `src/pages/admin/PretsAdmin.tsx` — section "Reconductions en cours" utilisant les nouvelles RPC
5. (option) Edge function `send-reconduction-notification`

Tant que ces fichiers ne sont pas livrés, le mode legacy fonctionne via les triggers de compatibilité.

## Hors scope

- Bloc Réunions (Phase 2)
- Bloc Email / Notifications / Users / Logs (Phase 3)
- Bloc Matchs / Site / Galerie / Navigation (Phase 4)
- Bloc UX / API format / messages techniques (Phase 5)
