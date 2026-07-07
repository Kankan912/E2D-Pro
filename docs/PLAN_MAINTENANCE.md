# Plan de maintenance — e2d-connect

Document opérationnel pour maintenir la qualité, la sécurité et la stabilité du projet après la clôture de l'audit V3.

---

## 1. Routines hebdomadaires

- **Logs Supabase** : revue des erreurs Edge Functions (`supabase functions logs`) et des erreurs PostgREST.
- **Linter Supabase** : exécuter `supabase--linter` et traiter les warnings nouveaux.
- **Emails sortants** : vérifier le tableau de bord Resend + Outlook (taux de bounce, quotas).
- **Sauvegardes** : confirmer que la sauvegarde automatique a tourné (cf. `SauvegardeManager`).
- **Console navigateur** : ouvrir l'app en prod, vérifier absence d'erreurs en accueil + dashboard admin.

## 2. Routines mensuelles

- **Dépendances** : `bun audit` + revue des CVE high/critical. Mise à jour mineure des deps non critiques.
- **RLS sur nouvelles tables** : pour chaque table créée le mois passé, vérifier `GRANT` + policy + `is_admin()` si nécessaire.
- **Purge soft delete** : utilisateurs `status="supprime"` depuis > 90 j → suppression définitive après validation admin.
- **Quotas storage** : vérifier `sport-logos`, `medias-matchs`, `gallery`, `compte-rendu` ; nettoyer orphelins.
- **Permissions granulaires** : revue de `user_roles` et `has_permission` ; révoquer les rôles inactifs.

## 3. Routines trimestrielles

- **Audit RLS complet** : croiser toutes les policies avec les routes admin/public.
- **Index DB** : revue `pg_stat_user_indexes`, suppression des index inutilisés, ajout sur les FK chaudes.
- **Test de restauration** : restaurer une sauvegarde sur un projet Supabase de staging.
- **Métriques ErrorBoundary** : analyser fréquence des retry et erreurs capturées.
- **Revue Core rules** : vérifier que `mem://index.md` est à jour avec les pratiques réelles.

## 4. Checklist obligatoire avant merge

À cocher pour chaque PR touchant le code :

- [ ] Nouvelles tables `public.*` : `CREATE TABLE` + `GRANT` + `ENABLE RLS` + `CREATE POLICY` dans la **même** migration.
- [ ] Tout `catch` est typé `catch (error: unknown)` et utilise `getErrorMessage(error)`.
- [ ] Aucun `console.*` ajouté : utiliser `logger.*` de `src/lib/logger.ts`.
- [ ] Aucune `window.confirm` : utiliser `AlertDialog` Shadcn.
- [ ] Nouvelles routes dynamiques : wrapées avec `lazyWithRetry`.
- [ ] Conteneurs mobiles : padding `p-3 sm:p-6`.
- [ ] Icônes cliquables : `aria-label` présent.
- [ ] `supabase.functions.invoke` : erreur extraite via `data?.error`.
- [ ] Rôle admin : utiliser `'administrateur'` (jamais `'admin'`).
- [ ] Montants : devise FCFA, validation serveur via RPC pour les opérations critiques.
- [ ] Filtre E2D : `est_membre_e2d = true` quand applicable.
- [ ] Soft delete : ne jamais afficher `status = "supprime"`.

## 5. Procédures d'incident

### Email indisponible (Outlook ou Resend)
1. Tester via `EmailConfigManager` → bouton « Test connexion ».
2. Si Outlook KO : basculer temporairement sur Resend (config provider).
3. Vérifier secrets `RESEND_API_KEY` / credentials Outlook.
4. Si Edge Function down : redéployer via `supabase--deploy_edge_functions`.

### Verrou DB / requête bloquée
1. `SELECT pid, query, state FROM pg_stat_activity WHERE state = 'active';`
2. `SELECT pg_cancel_backend(<pid>);` puis `pg_terminate_backend` si nécessaire.
3. Documenter la requête fautive et ajouter un index si récurrent.

### Chunk load error en production
1. Confirmer que `lazyWithRetry` est utilisé sur la route fautive.
2. Forcer un cache bust (déploiement vide ou bump version).
3. Vérifier que `vercel.json` rewrite bien `/index.html`.

### Perte de session admin / boucle de redirection
1. Vérifier `localStorage` côté client (expiration 24 h).
2. Contrôler `auth.users` et `user_roles` du compte.
3. En dernier recours : reset password via Supabase Dashboard.

### Erreur "permission denied for table"
1. Lire le `HINT` PostgREST → ajouter le `GRANT` manquant via migration.
2. Vérifier que la table a bien `ENABLE ROW LEVEL SECURITY` + policy compatible avec le rôle appelant.

## 6. Roadmap technique recommandée

| Priorité | Item | Bénéfice |
|----------|------|----------|
| Haute | Tests E2E Playwright sur auth + demande de prêt + cotisation | Détection régressions critiques |
| Haute | Monitoring d'erreurs externe (Sentry, Highlight) | Visibilité erreurs prod |
| Moyenne | Migration E8 : `data?.error` sur tous les `functions.invoke` legacy | Messages d'erreur cohérents |
| Moyenne | Régénération types Supabase + suppression casts manuels | Type safety stricte |
| Basse | i18n (FR/EN) si ouverture internationale | Accessibilité linguistique |
| Basse | Revue contraste WCAG AA sur thèmes clair/sombre | Accessibilité visuelle |

## 7. Documentation de référence

- `docs/AUDIT_E2D_V3.md` — résultat complet de l'audit V3.
- `docs/GUIDE_UTILISATEUR.md` — guide fonctionnel utilisateur.
- `mem://index.md` — règles cœur du projet (toujours en contexte agent).
- `src/lib/logger.ts`, `src/lib/errors.ts` — outillage transverse obligatoire.

---

**Dernière mise à jour** : clôture audit V3 — Lot F.
**Prochain audit recommandé** : V4 dans 6 mois ou après refonte majeure.
