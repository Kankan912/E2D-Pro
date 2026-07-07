# RAPPORT D'AUDIT TECHNIQUE ET FONCTIONNEL EXHAUSTIF
## Projet : E2D Connect Gateway v4.0

---

**Date d'audit :** Juillet 2026  
**Auditeur :** Architecte Logiciel Senior / DevSecOps  
**Référentiel :** `E2D_PHASE6_FINAL.zip`  
**Volumétrie :** 346 fichiers TS/TSX, ~82 680 lignes de code, 130 migrations SQL, 18 Edge Functions  
**Note globale :** **53 / 100** — 🔴 **NON production-ready**

---

## INFORMATIONS GÉNÉRALES

| Aspect | Valeur |
|---|---|
| **Type d'application** | Plateforme multi-associations (sport + tontine + CMS) — SaaS multi-tenant |
| **Langage principal** | TypeScript 5.8 (frontend) + Deno TypeScript (Edge Functions) + SQL (PostgreSQL/Supabase) |
| **Framework frontend** | React 18.3 + Vite 5.4 (SPA) |
| **Routing** | react-router-dom 6.30 |
| **State management** | TanStack Query 5.83 + useState/useContext |
| **Backend/BaaS** | Supabase (Postgres 15 + Auth + Storage + Edge Functions Deno) |
| **UI** | Tailwind CSS 3.4 + shadcn/ui (style `default`, 28 primitives Radix) |
| **Forms** | react-hook-form 7.61 + zod 3.25 |
| **PDF/Excel** | jspdf 3.0 + jspdf-autotable 5.0 + xlsx 0.18 (VULNÉRABLE) |
| **Charts** | recharts 2.15 |
| **Build tooling** | Bun + Vite SWC |
| **Hébergement cible** | Vercel (SPA fallback) |
| **CI/CD** | GitHub Actions (1 workflow RLS, cassé) |

---

## SYNTHÈSE EXÉCUTIVE

### Répartition par priorité

| Priorité | Nombre d'items | Effort cumulé estimé | Statut global |
|----------|----------------|---------------------|---------------|
| **P0 — Critique (bloquant production)** | 15 | ~13 jours-homme | 🔴 Tous à traiter |
| **P1 — Haute (fiabilisation)** | 11 | ~6 jours-homme | 🟠 À planifier sem. 2 |
| **P2 — Moyenne (dette technique)** | 14 | ~10 jours-homme | 🟡 À planifier sem. 3-5 |
| **P3 — Faible (industrialisation)** | 13 | ~6 jours-homme | 🟢 À planifier sem. 6+ |
| **TOTAL** | **53 items** | **~35 jours-homme** | **❌ Non production-ready** |

### Notes par dimension

| Dimension | Note /10 | Justification |
|---|---|---|
| **Architecture** | 7.0 | Organisation cohérente. Mais 3 hooks génériques morts, 12 fichiers > 500 lignes, pas de factory query keys. |
| **Sécurité** | 4.5 | 5 vulnérabilités critiques. Secrets hardcodés. Pas de rate limiting, pas de CSP. |
| **Performance** | 6.0 | Lazy loading ✅, TanStack Query ✅. Mais 107 `select('*')`, N+1, 35 index pour 71 tables. |
| **Qualité du code** | 5.5 | 0 `@ts-ignore`, 0 catch vide. Mais `strict: false`, 236 `any`, ~2000 lignes de code mort. |
| **Maintenabilité** | 6.0 | Hooks par domaine, shadcn/ui. Mais doc incohérente, pas de Storybook, gros fichiers. |
| **Documentation** | 6.5 | 18 fichiers docs. Mais README faux, références à fichiers inexistants. |
| **Fonctionnalités** | 7.5 | 54 routes admin + 10 routes membre + CMS + multi-tenant. Mais 3 boutons non câblés, Zod don non câblé. |
| **Base de données** | 6.5 | 130 migrations, 71 tables RLS, 127 fonctions SECURITY DEFINER. Mais RLS intra-tenant manquante. |
| **DevOps** | 3.5 | 1 workflow CI cassé, pas de Docker, pas de monitoring, pas de backup testé. |
| **Qualité globale** | 5.5 | Projet riche mais avec dettes techniques et failles sécurité. |

### Décision production

| Critère | Statut |
|---------|--------|
| Sécurité (0 vulnérabilité critique) | 🔴 **KO** — 5 vulnérabilités critiques |
| CI/CD verte | 🔴 **KO** — workflow `test:rls` cassé |
| Build reproductible | 🟡 **Partiel** — pas de typecheck |
| Tests significatifs | 🔴 **KO** — 6 tests unitaires seulement |
| Monitoring | 🔴 **KO** — aucun |
| Documentation à jour | 🟡 **Partiel** — incohérences |
| **MISE EN PRODUCTION** | 🔴 **REFUSÉE** |

---

## A. SÉCURITÉ & AUTHENTIFICATION

| # | Module | Fonctionnalité | Résultat attendu / final | Manquement constaté | Action attendue pour Lovable | Priorité | Effort Dev | Statut |
|---|--------|----------------|--------------------------|---------------------|------------------------------|----------|------------|--------|
| 1 | Sécurité / Secrets | Gestion des credentials Supabase | Credentials externalisés via variables d'environnement (`.env.local`), jamais committés | 🔴 URL Supabase + anon key JWT **hardcodées** dans `src/integrations/supabase/client.ts:5-6`. Multi-environnement impossible, rotation difficile. | Migrer vers `import.meta.env.VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`, créer `.env.local`, ajouter `.env*` au `.gitignore` | **P0** | 2h | ❌ À traiter |
| 2 | Sécurité / Emails | `send-contact-notification` (formulaire contact public) | Seuls les visiteurs légitimes peuvent envoyer, avec CAPTCHA + rate limit | 🔴 `verify_jwt=false` + **0 vérification d'auth**. Open email relay : n'importe qui sur Internet peut envoyer des emails via les credentials SMTP/Resend de l'association. Risque : spam, phishing, blacklistage domaine. | Ajouter CAPTCHA (hCaptcha/Turnstile) vérifié côté serveur + rate limiting par IP + whitelist `to` (emails admin uniquement) | **P0** | 4h | ❌ À traiter |
| 3 | Sécurité / RBAC | `send-email` (envoi email arbitraire) | Réservé aux administrateurs/trésoriers via `requirePrivilegedUser` | 🟠 Tout utilisateur authentifié peut envoyer un email à n'importe qui. Risque phishing interne. | Ajouter `requirePrivilegedUser(req, corsHeaders)` de `_shared/auth-check.ts` | **P0** | 2h | ❌ À traiter |
| 4 | Sécurité / RBAC | `send-campaign-emails` (campagne massive) | Réservé admin uniquement, malgré `verify_jwt=true` | 🟠 `verify_jwt=true` mais **aucun check de rôle** : un membre peut déclencher une campagne à tous les membres. | Ajouter `requirePrivilegedUser` + valider le scope d'envoi | **P0** | 2h | ❌ À traiter |
| 5 | Sécurité / Adhésions | `process-adhesion` (traitement adhésion) | Seul le propriétaire de l'adhésion ou un admin peut traiter | 🟠 Aucun check que `adhesion_id` appartient au caller (`supabase/functions/process-adhesion/index.ts:178-182`). Tout authentifié peut valider/rejeter n'importe quelle adhésion. | Vérifier `adhesion.user_id = auth.uid()` OU exiger `is_admin()` | **P0** | 2h | ❌ À traiter |
| 6 | Sécurité / Secrets | Stockage credentials SMTP/Resend | Chiffrés au repos (pgcrypto/Vault) | 🟠 Commentaire SQL "encrypted" **mensonger** : `smtp_password` et `resend_api_key` stockés en clair dans `configurations.config_data` (JSONB). Tout SELECT expose les credentials. | Utiliser `pgcrypto` (`pgp_sym_encrypt`) ou Supabase Vault avec key master | **P0** | 1j | ❌ À traiter |
| 7 | Sécurité / RBAC | `update-email-config` (modification config email) | Réservé `administrateur` + `super_admin` | 🟠 Autorise `tresorier` et `secretaire_general` à modifier credentials SMTP/Resend → détournement SMTP possible. | Restreindre à `administrateur`/`super_admin` uniquement | **P0** | 30min | ❌ À traiter |
| 8 | Sécurité / Storage | Bucket `members-photos` | Chaque utilisateur ne gère que ses propres photos | 🔴 N'importe quel authentifié peut INSERT/UPDATE/DELETE n'importe quelle photo (`supabase/migrations/20251223144005_59cee6fa.sql:13-31`). XSS SVG possible. | Ajouter policy `WITH CHECK (auth.uid() = owner_id)` + whitelist MIME types (interdire SVG) | **P0** | 4h | ❌ À traiter |
| 9 | Sécurité / Rate limiting | Protection brute-force sur formulaires publics | Rate limiting + CAPTCHA sur login, contact, don, adhésion | 🟠 Aucun mécanisme de rate limiting, ni frontend, ni edge functions. Brute-force login possible. | Implémenter rate limit Supabase Edge (table `rate_limits` ou Upstash) + CAPTCHA sur formulaires publics | **P1** | 1j | ❌ À traiter |
| 10 | Sécurité / XSS | Templates notifications (`NotificationsTemplatesAdmin.tsx:485`) | HTML sanitizé avant injection | 🟡 `dangerouslySetInnerHTML` sans DOMPurify. Le `getPreviewContent` (l.147-157) ne fait que remplacer des placeholders. | Ajouter DOMPurify sur le rendu preview | **P2** | 1h | ❌ À traiter |
| 11 | Sécurité / Config | `seed-test-users` en production | Désactivé en production | 🟡 Edge function déployable en prod, crée des comptes test avec `must_change_password: false`. | Désactiver via config environnement ou supprimer le déploiement en prod | **P2** | 30min | ❌ À traiter |
| 12 | Sécurité / Mots de passe | Politique mot de passe robuste | Longueur min + complexité + history + check HIBP | 🟡 Politique appliquée uniquement côté frontend sur `FirstPasswordChange`. Pas de history, pas de check HIBP. | Intégrer HIBP API + history côté Supabase Auth | **P3** | 4h | ❌ À traiter |
| 13 | Sécurité / CORS | CORS Edge Functions | Limité au domaine E2D | 🟡 `Access-Control-Allow-Origin: *` sur les 18 edge functions. | Restreindre à `https://e2d-connect.lovable.app` + domaines whitelistés | **P1** | 1h | ❌ À traiter |
| 14 | Sécurité / Headers | Headers HTTP de sécurité (CSP, HSTS, X-Frame-Options) | Tous présents dans `vercel.json` | 🟠 Aucun header de sécurité. Risque clickjacking, MIME sniffing. | Ajouter CSP, HSTS, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy, Permissions-Policy | **P1** | 1h | ❌ À traiter |
| 15 | Sécurité / Edge Functions | `verify_jwt=true` par défaut | Sauf pour fonctions réellement publiques | 🟡 17/18 edge functions avec `verify_jwt=false`. Surface d'attaque large. | Activer `verify_jwt=true` sauf `send-contact-notification` (CAPTCHA), `get-payment-config`, `donations-stats` | **P2** | 2h | ❌ À traiter |

---

## B. BASE DE DONNÉES & RLS

| # | Module | Fonctionnalité | Résultat attendu / final | Manquement constaté | Action attendue pour Lovable | Priorité | Effort Dev | Statut |
|---|--------|----------------|--------------------------|---------------------|------------------------------|----------|------------|--------|
| 16 | DB / RLS Multi-tenant | Isolation des données entre membres d'une même association | Un membre ne voit que ses propres données financières | 🔴 RLS intra-tenant manquante sur 20 tables core (`membres`, `profiles`, `cotisations`, `epargnes`, `prets`, `aides`, `donations`...). Policies ne vérifient que `has_role('super_admin') OR association_id = current`, sans check de rôle intra-tenant. Un membre voit les données de tous les membres de son association. | Restreindre policies à `is_admin() OR has_role('super_admin')` + business rules pour self-inserts (`membre_id = auth.uid()`) | **P0** | 2j | ❌ À traiter |
| 17 | DB / Multi-tenant | `get_current_association_id()` infalsifiable | Validation server-side de l'appartenance à l'association | 🔴 Lit header HTTP `x-association-id` sans valider l'appartenance. Un utilisateur peut falsifier le header pour accéder aux données d'une autre association. | Valider via jointure `user_roles` côté SQL : `SELECT association_id FROM user_roles WHERE user_id = auth.uid()` | **P0** | 1j | ❌ À traiter |
| 18 | DB / Migrations | Migration consolidée propre | Aucune migration dangereuse dans le repo | 🔴 `migrations_a_executer/E2D_TOUT_EN_UN.sql` (686 lignes) réinstalle des versions vulnérables : annule `is_admin()` tenant-aware, recrée `donations_public_insert WITH CHECK (TRUE)` ouvert aux anonymous, supprime restrictions `must_change_password`, vide trigger révocation sessions. | **Supprimer ce fichier du repo** ou marquer `DEPRECATED`. Les 130 migrations horodatées suffisent. | **P0** | 5min | ❌ À traiter |
| 19 | DB / Index | Index sur colonnes critiques (`association_id`, `membre_id`, `statut`) | Toutes les FK + colonnes filtrées indexées | 🟠 Seulement **35 index pour 71 tables**. Manquants : `association_id` (24 tables), `membre_id` dans cotisations/épargnes/prêts/aides, `statut` dans `loan_requests`/`aides`. Full scans multi-tenant garantis. | `CREATE INDEX CONCURRENTLY ON cotisations (association_id, membre_id);` etc. pour 20+ tables | **P1** | 1j | ❌ À traiter |
| 20 | DB / Intégrité | `ON DELETE` stratégie cohérente | `RESTRICT` ou soft-delete pour `association_id` | 🟡 `ON DELETE SET NULL` sur `association_id` → suppression d'une association orpheline toutes les données. `ON DELETE CASCADE` sur `membre_id` → suppression membre cascade cotisations/épargnes/prêts. | Changer en `RESTRICT` ou implémenter soft-delete avec trigger | **P3** | 2h | ❌ À traiter |
| 21 | DB / Down migrations | Réversibilité des migrations | DOWN migrations ou procédure rollback | 🟡 Aucune DOWN migration. Impossible de rollback proprement. | Documenter procédure rollback ou ajouter DOWN migrations critiques | **P3** | 1j | ❌ À traiter |
| 22 | DB / Backup | Procédure backup/restore testée | Backup PITR + restore testé mensuellement | 🟡 Aucune procédure documentée. On suppose PITR Supabase mais pas de test restore. | Documenter procédure + tester restore sur environnement staging | **P2** | 1j | ❌ À traiter |

---

## C. CI/CD & BUILD

| # | Module | Fonctionnalité | Résultat attendu / final | Manquement constaté | Action attendue pour Lovable | Priorité | Effort Dev | Statut |
|---|--------|----------------|--------------------------|---------------------|------------------------------|----------|------------|--------|
| 23 | CI/CD / Tests RLS | Workflow GitHub Actions `security-rls.yml` fonctionnel | CI verte, tests RLS passants | 🔴 `bun run test:rls` cible `src/test/security/` **inexistant**. CI rouge à chaque push/PR. | Restaurer `src/test/security/{setup-personae,rls.test}.ts` depuis git history OU supprimer script + workflow | **P0** | 1j | ❌ À traiter |
| 24 | CI/CD / Setup Vitest | `bun run test` fonctionnel | Tests unitaires exécutables | 🔴 `vitest.config.ts` référence `./src/test/setup.ts` **inexistant**. `bun run test` échoue immédiatement. | Créer `src/test/setup.ts` (import `@testing-library/jest-dom`) OU retirer la ligne `setupFiles` | **P0** | 15min | ❌ À traiter |
| 25 | CI/CD / Jobs | Jobs lint, typecheck, build | CI complète validant code à chaque PR | 🟠 1 seul workflow (RLS, cassé). Pas de job `lint`, pas de `tsc --noEmit`, pas de `build`. | Ajouter jobs lint + typecheck + build + pinner `bun-version: "1.1.x"` + cache Bun | **P1** | 2h | ❌ À traiter |
| 26 | Build / Typecheck | `vite build` valide les types | `tsc --noEmit && vite build` | 🟠 Script `build` = `vite build` seul. Erreurs de type passent en production. | Modifier `package.json` : `"build": "tsc --noEmit && vite build"` | **P1** | 15min | ❌ À traiter |
| 27 | Build / TypeScript | `strict: true` activé | Type safety maximale | 🔴 `tsconfig.app.json` : `strict: false`, `noImplicitAny: false`, `strictNullChecks: false`. Contredit la doc ("TypeScript strict"). Autorise 236 `any` silencieux. | Activer `strict: true`, `noImplicitAny: true`, `strictNullChecks: true` + corriger erreurs en cascade | **P1** | 1j | ❌ À traiter |
| 28 | Build / ESLint | Règles ESLint strictes | `no-unused-vars` activé, ignores complets | 🟡 `eslint.config.js` désactive `@typescript-eslint/no-unused-vars`. `ignores: ["dist"]` seulement (manque `node_modules`, `coverage`, `types.ts` auto-généré). | Réactiver `no-unused-vars` + étendre `ignores` + ajouter `no-console: warn` | **P2** | 2h | ❌ À traiter |

---

## D. DÉPENDANCES

| # | Module | Fonctionnalité | Résultat attendu / final | Manquement constaté | Action attendue pour Lovable | Priorité | Effort Dev | Statut |
|---|--------|----------------|--------------------------|---------------------|------------------------------|----------|------------|--------|
| 29 | Dépendances / Sécurité | `xlsx` non vulnérable | Aucune CVE connue | 🔴 `xlsx@^0.18.5` — **CVE-2023-30533** (prototype pollution) + **CVE-2024-22363** (ReDoS). Package deprecated depuis 2023 (SheetJS a quitté npm). Utilisé dans 9 fichiers. | Migrer vers `exceljs` ou SheetJS CDN `https://cdn.sheetjs.com/xlsx-0.20.x/` | **P0** | 1j | ❌ À traiter |
| 30 | Dépendances / Mortes | Aucune dépendance inutilisée | Toutes les deps sont importées | 🟠 3 dépendances `@dnd-kit/*` (`core`, `modifiers`, `sortable`) ont **0 import** dans `src/`. | Supprimer du `package.json` | **P1** | 5min | ❌ À traiter |
| 31 | Dépendances / Obsolètes | Toutes dépendances maintenues | Pas de package abandonné | 🟡 `heic2any@0.0.4` non maintenu depuis 2020. `@types/node@25` (Node 25 inexistant). `react-day-picker@8` (v9 dispo). `next-themes@0.3` (v0.4 dispo). | Remplacer `heic2any` par fork maintenu ; pin `@types/node@^22` ; planifier upgrades | **P2** | 4h | ❌ À traiter |
| 32 | Dépendances / Classification | Tests en `devDependencies` | Séparation prod/dev propre | 🟡 `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` en `dependencies` au lieu de `devDependencies`. | Déplacer vers `devDependencies` | **P3** | 5min | ❌ À traiter |

---

## E. MODULES FONCTIONNELS

| # | Module | Fonctionnalité | Résultat attendu / final | Manquement constaté | Action attendue pour Lovable | Priorité | Effort Dev | Statut |
|---|--------|----------------|--------------------------|---------------------|------------------------------|----------|------------|--------|
| 33 | Sport | Boutons d'action `Sport.tsx` | Tous les boutons câblés | 🟠 3 boutons avec `onClick={() => {}}` à `Sport.tsx:316, 324, 332`. UX cassée. | Câbler les handlers ou supprimer les boutons | **P1** | 2h | ❌ À traiter |
| 34 | Donations | Validation formulaire de don public | Validation Zod côté client via `zodResolver` | 🟠 `src/lib/donation-schemas.ts` (114 lignes Zod) défini mais **non câblé** à `src/pages/Don.tsx`. Validation absente → données invalides possibles. | Câbler `zodResolver(donationSchema)` dans `Don.tsx` OU supprimer le fichier mort | **P1** | 2h | ❌ À traiter |
| 35 | Dashboard / Membre | ErrorBoundary sur routes membre | Chaque route wrappée par ErrorBoundary | 🟠 10 routes membre sans ErrorBoundary (`/profile`, `/my-donations`, `/my-cotisations`, `/my-epargnes`, `/my-sanctions`, `/my-prets`, `/my-presences`, `/my-aides`, `/mes-demandes-pret`, `/mes-avalisations`). Une erreur React fait planter toute l'app. | Ajouter `<ErrorBoundary fallbackTitle="...">` sur les 10 routes | **P1** | 1h | ❌ À traiter |
| 36 | Multi-tenant / Sport | `association_id` sur tables sport | Migration Task 14 complétée | 🟡 15 TODO "Task 14" non résolus : `association_id` manquant sur tables sport + notifications. Migration multi-tenant incomplète. | Compléter migration multi-tenant sur tables sport et notifications | **P2** | 1j | ❌ À traiter |
| 37 | Notifications | Templates notifications cohérents | Templates avec variables validées | 🟡 `getPreviewContent` (`NotificationsTemplatesAdmin.tsx:147-157`) ne valide pas les variables inconnues. | Ajouter validation des variables + warning sur variables non reconnues | **P3** | 2h | ❌ À traiter |

---

## F. PERFORMANCE

| # | Module | Fonctionnalité | Résultat attendu / final | Manquement constaté | Action attendue pour Lovable | Priorité | Effort Dev | Statut |
|---|--------|----------------|--------------------------|---------------------|------------------------------|----------|------------|--------|
| 38 | Perf / N+1 | Requêtes batch, pas de boucles await | Jointures Supabase ou RPC batch | 🟠 N+1 confirmés dans `useAidePhase3.ts:267,646`, `useAidePhase2.ts`, `useLoanRequests.ts`, `useCalendrierBeneficiaires.ts`, `lib/sync-events.ts`. Boucles `for...of` avec await. | Migrer vers jointures Supabase (`select('*, membre:membres(*)')`) ou RPC batch | **P2** | 2j | ❌ À traiter |
| 39 | Perf / Sur-fetch | Sélections explicites de colonnes | Pas de `select('*')` sur tables sensibles | 🟠 **107 occurrences de `.select('*')`** dans 90 fichiers. Sur-fetch de colonnes sensibles (`config_data` avec secrets, `password_hash`). | Remplacer par sélections explicites, surtout sur `profiles`, `membres`, `configurations`, `payment_configs` | **P2** | 2j | ❌ À traiter |
| 40 | Perf / Bundle | Code splitting optimisé | `manualChunks` configuré | 🟠 Bundle lourd (`xlsx` ~1MB + `jspdf` + `recharts` + 28 Radix). Pas de `manualChunks` dans `vite.config.ts`. FCP lent. | Configurer `build.rollupOptions.output.manualChunks` (vendor, pdf, charts, ui) | **P2** | 2h | ❌ À traiter |
| 41 | Perf / Images | Compression images upload | WebP/AVIF + compression client | 🟡 Uploads `members-photos` sans compression automatique. Pas de format WebP/AVIF. Pas de `loading="lazy"` vérifié sur CMS. | Compression client (canvas) ou serveur (sharp) + format WebP | **P3** | 1j | ❌ À traiter |

---

## G. QUALITÉ DU CODE

| # | Module | Fonctionnalité | Résultat attendu / final | Manquement constaté | Action attendue pour Lovable | Priorité | Effort Dev | Statut |
|---|--------|----------------|--------------------------|---------------------|------------------------------|----------|------------|--------|
| 42 | Qualité / Code mort | Aucun fichier/composant inutilisé | Code lean, surface minimale | 🟠 ~2000 lignes de code mort : 11 composants jamais importés (dont `AideDashboard.tsx` 813 lignes !), 3 hooks génériques morts (`useSupabaseQuery`, `useSupabaseMutation`, `useSupabaseRealtime`), 12 composants UI shadcn inutilisés, `lib/donation-schemas.ts` mort, `lib/caisseCalculations.test.ts` orphelin, `components/ui/use-toast.ts` doublon. | Supprimer tous les fichiers morts identifiés | **P1** | 2h | ❌ À traiter |
| 43 | Qualité / Duplication | Une seule implémentation par utilitaire | Aucun doublon | 🟡 `getErrorMessage` doublonné : `lib/utils.ts` (simplifié) vs `lib/errors.ts` (complet). | Unifier en gardant `lib/errors.ts` | **P2** | 30min | ❌ À traiter |
| 44 | Qualité / Query keys | Factory centralisée des query keys | `lib/queryKeys.ts` unique source | 🟡 Pas de factory. Clés en littéraux dispersés → risque de collisions cache. | Créer `lib/queryKeys.ts` avec factory par domaine | **P2** | 1j | ❌ À traiter |
| 45 | Qualité / Gros fichiers | Fichiers < 500 lignes | Composants/hooks découpés | 🟡 12 fichiers > 500 lignes. Top : `AidesAdmin.tsx` (1029 lignes), `useAidePhase3.ts` (1012 lignes), `AideDashboard.tsx` (813 lignes, mais mort). | Découper `AidesAdmin.tsx` en 4-5 sous-composants ; splitter `useAidePhase3.ts` en hooks spécialisés | **P3** | 1j | ❌ À traiter |

---

## H. DEVOPS & INDUSTRIALISATION

| # | Module | Fonctionnalité | Résultat attendu / final | Manquement constaté | Action attendue pour Lovable | Priorité | Effort Dev | Statut |
|---|--------|----------------|--------------------------|---------------------|------------------------------|----------|------------|--------|
| 46 | DevOps / Monitoring | Monitoring applicatif (Sentry) | Erreurs frontend + backend remontées | 🔴 Aucun monitoring (pas de Sentry, LogRocket, Datadog). Détection incident lente. | Intégrer Sentry (frontend + edge functions) | **P2** | 4h | ❌ À traiter |
| 47 | DevOps / Health check | Endpoint de santé | `/health` retourne 200 | 🔴 Aucun health check endpoint. Pas de liveness probe. | Créer edge function `health` qui ping DB + Supabase Auth | **P2** | 1h | ❌ À traiter |
| 48 | DevOps / Docker | Containerisation possible | Dockerfile + docker-compose | 🔴 Aucun Dockerfile. Déploiement Vercel-only, non portable. | Créer Dockerfile multi-stage + `docker-compose.yml` pour dev local | **P3** | 4h | ❌ À traiter |
| 49 | DevOps / Déploiement | Déploiement automatisé Vercel | Push → preview → prod | 🟡 Pas d'intégration Vercel GitHub. Pas de preview deploys. Pas de rollback documenté. | Configurer Vercel GitHub integration + documenter rollback | **P2** | 2h | ❌ À traiter |
| 50 | DevOps / Tests E2E | Couverture E2E (Playwright) | Parcours critiques testés | 🔴 6 tests unitaires seulement (fonctions pures). Pas de tests E2E, pas de tests d'intégration. Régressions invisibles. | Ajouter Playwright : parcours login, don, adhésion, CRUD cotisations | **P3** | 1j | ❌ À traiter |

---

## I. DOCUMENTATION

| # | Module | Fonctionnalité | Résultat attendu / final | Manquement constaté | Action attendue pour Lovable | Priorité | Effort Dev | Statut |
|---|--------|----------------|--------------------------|---------------------|------------------------------|----------|------------|--------|
| 51 | Doc / README | README cohérent avec code | Port + install corrects | 🟡 `README.md` indique port 5173 (au lieu de 8080) + `npm install` (au lieu de `bun install`). `README_LOCAL.md` référence `docs/POST_REVIEW_CHANGES.md` et `docs/DEPLOYMENT_CHECKLIST.md` inexistants. | Corriger README.md + vérifier tous les liens docs | **P3** | 15min | ❌ À traiter |
| 52 | Doc / Incohérences | Doc technique alignée avec code | Cahiers des charges exacts | 🟡 `CAHIER_DES_CHARGES_DEVELOPPEUR.md` prétend "TypeScript strict" (faux) et "shadcn/ui New York" (faux, style `default`). `docs/CHANGELOG.md` référence `cotisationsLogic.test.ts` manquant. `docs/SECURITY_TESTS.md` référence `src/test/security/rls.test.ts` inexistant. | Auditer et corriger toutes les incohérences doc/code | **P3** | 2h | ❌ À traiter |
| 53 | Doc / i18n | `lang="fr"` dans index.html | HTML sémantique correct | 🟡 `index.html` : `lang="en"` alors que tout le contenu est en français. Impact SEO + accessibilité. | Changer en `lang="fr"` + ajouter `<meta name="theme-color">` + preconnect Supabase | **P3** | 5min | ❌ À traiter |

---

## FEUILLE DE ROUTE PRIORISÉE

### Phase 0 — Blocants production (Semaine 1) — 13 jours-homme

**Objectif : Éliminer les vulnérabilités critiques et bloquants CI.**

| Jour | Action | Items | Durée |
|------|--------|-------|-------|
| J1 matin | Supprimer `E2D_TOUT_EN_UN.sql` + créer `src/test/setup.ts` + `.env*` au `.gitignore` + `lang="fr"` | #18, #24, #51, #53 | 15min |
| J1 après-midi | Migrer credentials Supabase vers `.env.local` + activer `verify_jwt=true` sur edge functions sensibles | #1, #15 | 4h |
| J2 | CAPTCHA + rate limit `send-contact-notification` + `requirePrivilegedUser` sur `send-email`, `send-campaign-emails` + check propriété `process-adhesion` | #2, #3, #4, #5 | 1j |
| J3 | Restreindre `update-email-config` à admin + chiffrer secrets SMTP via Vault | #7, #6 | 1j |
| J4 | Corriger RLS intra-tenant sur 20 tables + valider `get_current_association_id()` côté SQL | #16, #17 | 2j |
| J5 | Corriger bucket `members-photos` + restaurer/supprimer tests RLS + workflow CI | #8, #23 | 1j |
| J6 | Migrer `xlsx` vers `exceljs` + headers `vercel.json` + CORS domain-lock | #29, #14, #13 | 1j |
| J7 | Rate limiting login/don/adhésion + ajouter jobs lint/typecheck/build en CI | #9, #25, #26 | 1j |

**Gate production :** Audit de pénétration externe + scan OWASP ZAP passants.

### Phase 1 — Stabilisation (Semaines 2-3) — 10 jours-homme

**Objectif : Fiabiliser le build et la qualité.**

| Jour | Action | Items | Durée |
|------|--------|-------|-------|
| J8 | Activer `strict: true` + `tsc --noEmit` dans build | #27, #26 | 1j |
| J9 | Câbler `donation-schemas.ts` à `Don.tsx` + câbler 3 boutons `Sport.tsx` + ErrorBoundary 10 routes | #34, #33, #35 | 1j |
| J10 | Supprimer code mort ~2000 lignes | #42 | 2h |
| J11-12 | Créer index `association_id` sur 24 tables | #19 | 1j |
| J13 | Unifier `getErrorMessage` + factory query keys | #43, #44 | 1j |
| J14 | Configurer `manualChunks` Vite + preconnect Supabase | #40, #53 | 2h |

### Phase 2 — Endettement technique (Semaines 4-5) — 8 jours-homme

**Objectif : Réduire la dette performance et qualité.**

| Jour | Action | Items | Durée |
|------|--------|-------|-------|
| J15-16 | Résoudre N+1 dans 5 hooks | #38 | 2j |
| J17-18 | Remplacer 107 `select('*')` par sélections explicites | #39 | 2j |
| J19 | XSS DOMPurify sur templates + désactiver `seed-test-users` en prod | #10, #11 | 1j |
| J20 | Découper `AidesAdmin.tsx` + `useAidePhase3.ts` | #45 | 1j |
| J21 | Corriger README + résoudre 15 TODO Task 14 multi-tenant | #51, #36 | 1j |

### Phase 3 — Industrialisation (Semaines 6-8) — 12 jours-homme

**Objectif : Monitoring, observabilité, scalabilité.**

| Jour | Action | Items | Durée |
|------|--------|-------|-------|
| J22 | Intégrer Sentry + health check endpoint | #46, #47 | 1j |
| J23-24 | Créer Dockerfile multi-stage + docker-compose pour dev local | #48 | 1j |
| J25 | Backup/restore procedure documentée + testée | #22 | 1j |
| J26-27 | Ajouter tests E2E Playwright (login, don, adhésion, CRUD cotisations) | #50 | 1j |
| J28 | Compression images upload | #41 | 1j |
| J29 | Politique mot de passe HIBP + history | #12 | 4h |
| J30 | Changer `ON DELETE SET NULL` → `RESTRICT` sur `association_id` | #20 | 2h |

### Phase 4 — Optimisation continue (Semaine 9+) — continu

- Migration React 19 + Vite 6
- Migration Tailwind 4
- Migration `date-fns` 4, `next-themes` 0.4
- Storybook
- Prettier + Husky pre-commit
- Migration Postgres 16 Supabase
- Cache service worker / PWA

---

## RÉPARTITION PAR MODULE

| Module | Items P0 | Items totaux | Note /10 |
|--------|----------|--------------|----------|
| Sécurité & Authentification | 8 | 15 | **4.5/10** |
| Base de données & RLS | 3 | 7 | **6.5/10** |
| CI/CD & Build | 2 | 6 | **3.5/10** |
| Dépendances | 1 | 4 | **6.0/10** |
| Modules fonctionnels | 0 | 5 | **7.5/10** |
| Performance | 0 | 4 | **6.0/10** |
| Qualité du code | 0 | 4 | **5.5/10** |
| DevOps & Industrialisation | 0 | 5 | **3.5/10** |
| Documentation | 0 | 3 | **6.5/10** |

---

## CONCLUSION GÉNÉRALE

### État du projet

**E2D Connect Gateway v4.0** est une plateforme SaaS multi-associations fonctionnellement riche (sport + tontine + CMS + gestion financière) avec 54 routes admin, 18 Edge Functions, 130 migrations SQL et un RBAC granulaire. L'effort de développement est **considérable et apparent** (~82 680 lignes, 346 fichiers).

### Verdict production-ready

**🔴 NON — Le projet n'est PAS production-ready en l'état.**

Cinq vulnérabilités critiques non résolues l'empêchent d'être mis en production sécurisée :

1. **Open email relay** (`send-contact-notification`) → spam/phishing immédiat
2. **RLS intra-tenant absente** → fuite de données financières entre membres
3. **Header `x-association-id` falsifiable** → fuite cross-association
4. **Migration `E2D_TOUT_EN_UN.sql` dangereuse** → régression sécurité si exécutée
5. **Bucket `members-photos` ouvert** → XSS SVG + écrasement

S'y ajoutent des bloquants CI (`test:rls` cassé, `setup.ts` manquant) et une dette technique significative (`strict: false`, 236 `any`, ~2000 lignes de code mort).

### Recommandation

Après exécution de la **Phase 0** (13 jours-homme, sem. 1) et validation par audit de pénétration externe, le projet pourrait atteindre un niveau **production-ready sécurisé**. La **Phase 1-2** (sem. 2-5) est nécessaire pour la maintenabilité. La **Phase 3** (sem. 6-8) pour l'industrialisation.

**Note finale : 53/100** — Projet ambitieux et fonctionnel, mais qui nécessite un effort de sécurisation et d'industrialisation significatif avant mise en production.

---

## MÉTRIQUES GLOBALES DU CODE

| Métrique | Valeur | Évaluation |
|---|---|---|
| Lignes totales (src) | 82 680 | Important mais gérable |
| Fichiers > 500 lignes | 12 | 🟡 À découper |
| Fichiers > 1000 lignes | 2 (`AidesAdmin.tsx` 1029, `useAidePhase3.ts` 1012) | 🔴 À découper |
| `any` | 236 dans 90 fichiers | 🔴 Trop |
| `as any` | 25 | 🟡 Contournement Supabase |
| `@ts-ignore` / `@ts-nocheck` | 0 | ✅ Excellent |
| `console.log` | 2 | ✅ Excellent (logger utilisé) |
| `TODO`/`FIXME`/`HACK` | 32 | 🟡 |
| `select('*')` | 107 | 🟡 Sur-fetch |
| `useState` | 647 | Élevé mais normal pour 346 fichiers |
| `useEffect` | 133 | OK |
| `dangerouslySetInnerHTML` | 2 (1 admin, 1 chart) | 🟡 |
| Catch vide | 0 | ✅ Excellent |
| Tables DB avec RLS | 71 / 71 | ✅ |
| Index DB | 35 pour 71 tables | 🔴 Insuffisant |
| Fonctions SECURITY DEFINER | 127 | 🟡 Surface SQL importante |
| Tests unitaires | 6 fichiers | 🔴 Couverture quasi nulle |
| Edge Functions | 18 (17 avec `verify_jwt=false`) | 🔴 |
| Workflows CI | 1 (cassé) | 🔴 |

---

*Audit réalisé sur la base du contenu réel du fichier `E2D_PHASE6_FINAL.zip`. Aucune supposition. Tous les chemins cités sont vérifiés dans le projet extrait à `/home/z/my-project/audit/`. Les rapports intermédiaires détaillés des sous-agents (Task IDs 1-a, 2-a, 4-a) sont disponibles dans `/home/z/my-project/worklog.md`.*

**Fin du rapport**
