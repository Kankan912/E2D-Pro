# Changelog — Refonte Avril 2026

Récapitulatif des 8 lots livrés lors de la refonte d'avril 2026.

## Lot 1 — Prêts & Caisse
- Service `pretCalculsService` unifié (intérêt direct, reconduction, prorata).
- Hook `useCaisse` + RPC `get_solde_caisse()` comme source unique de vérité.
- Solde empruntable = 80 % du fond − prêts en cours.

## Lot 2 — Sécurité RLS
- Politiques durcies via `is_admin()` et `auth.uid()`.
- Vue `configurations_public` pour exposition limitée des configurations.
- Logs d'audit obligatoires sur insertions sensibles.

## Lot 3 — Cotisations & Exercices
- Index unique partiel garantissant un seul exercice actif à la fois.
- Verrouillage : modification d'un exercice actif requiert admin + motif.
- Types filtrés via `exercices_cotisations_types.actif`.

## Lot 4 — Aides & Caisse
- Statut `alloué` déclenche automatiquement une écriture de dépense dans `fond_caisse_operations`.
- Synchronisation bidirectionnelle aide ↔ caisse.

## Lot 5 — Notifications / Emails
- `email-utils.ts` : retry exponentiel sur 3 tentatives (500, 1000, 2000 ms).
- Détection automatique des erreurs transitoires (timeout, 429, 5xx).
- Logging centralisé dans `notifications_envois`.
- 9 Edge Functions redéployées avec la nouvelle logique partagée.

## Lot 6 — Sport / Synchronisation matchs
- Nouveau trigger `trg_sync_e2d_match_to_site_event` (INSERT/UPDATE/DELETE).
- Filtre serveur strict : `statut_publication = 'publie'` et `≠ annulé`.
- Source de vérité côté serveur ; le hook frontend devient une redondance.

## Lot 7 — Galerie / Albums
- Vérification : table `site_gallery_albums` + route `/albums/:albumId` opérationnelles.
- Upload groupé fonctionnel.

## Lot 8 — Stabilité globale
- `ErrorBoundary` à 2 niveaux (App + Dashboard) avec fonction retry.
- `lazyWithRetry` appliqué à TOUS les imports dynamiques de routes.
- `vercel.json` : fallback SPA `/(.*)` → `/index.html`.

## Lot 9 — Tests unitaires (post-refonte)
- 26 tests Vitest couvrant les calculs critiques :
  - `pretCalculsService.test.ts` (11 tests).
  - `caisseCalculations.test.ts` (6 tests).
  - `cotisationsLogic.test.ts` (9 tests).
- Exécution : `bunx vitest run`.

## Lot 10 — Documentation
- Mise à jour `ARCHITECTURE.md`, `GUIDE_UTILISATEUR.md`, `IMPLEMENTATION_CHECKLIST.md`.
- Création de ce CHANGELOG.

## Lot 11 — Audit sécurité final
- Linter Supabase exécuté : 71 warnings analysés.
- Aucun ERROR critique. Tous les warnings restants sont des choix par design documentés dans la mémoire sécurité projet :
  - Buckets publics : intentionnels (photos, assets site).
  - SECURITY DEFINER exposés : nécessaires au fonctionnement RLS.
  - Auth (OTP, leaked password, version Postgres) : à régler côté dashboard Supabase.
