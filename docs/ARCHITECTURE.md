# Architecture du Projet E2D

## Vue d'ensemble

Application de gestion associative construite avec **React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui**, connectée à un backend **Supabase** (PostgreSQL, Auth, Storage, Edge Functions).

## Structure des dossiers

```
src/
├── assets/            # Images importées comme modules ES6
├── components/        # Composants réutilisables
│   ├── ui/            # shadcn/ui primitives (Button, Card, Dialog…)
│   ├── admin/         # Composants spécifiques à l'admin
│   ├── auth/          # Routes protégées, guards de permissions
│   ├── caisse/        # Module trésorerie (dashboard, opérations, synthèse)
│   ├── config/        # Formulaires de configuration (exercices, cotisations…)
│   ├── donations/     # Module dons
│   ├── forms/         # Formulaires métier réutilisables
│   ├── layout/        # DashboardLayout, Header, Sidebar
│   └── notifications/ # Système de notifications
├── contexts/          # AuthContext (session Supabase, profil, permissions)
├── hooks/             # Custom hooks React Query (un par domaine)
│   └── generic/       # useSupabaseQuery, useSupabaseMutation (helpers légers)
├── integrations/
│   └── supabase/      # Client Supabase auto-généré + types DB
├── lib/               # Utilitaires purs (formatage, export PDF/Excel, calculs)
├── pages/             # Routes de l'application
│   ├── admin/         # Pages d'administration
│   ├── dashboard/     # Pages du tableau de bord membre
│   └── reunions/      # Feature slice refactorisé (index, hooks, components)
├── test/              # Setup Vitest, mocks Supabase
└── types/             # Types partagés (supabase-joins, donations…)
```

## Patterns clés

### 1. Feature-Based Slices

Les gros modules sont organisés en slices :

```
src/pages/reunions/
├── index.tsx                 # Shell principal (tabs, modals)
├── types.ts                  # Interfaces métier
├── hooks/useReunionsData.ts  # Logique + state
└── components/               # Composants de chaque onglet
```

### 2. Hooks par domaine

Chaque domaine métier a un hook dédié (`useCaisse`, `useMembers`, `useReunions`, `useSport`…) qui encapsule :
- Les requêtes React Query (`useQuery`)
- Les mutations (`useMutation`) avec invalidation de cache
- Les types associés

Les hooks génériques (`useSupabaseQuery`, `useSupabaseMutation`) servent uniquement pour les cas simples sans logique métier.

### 3. Authentification & Permissions

- `AuthContext` gère la session Supabase, le profil utilisateur, et le membre lié
- Fonctions SQL `is_admin()`, `has_permission(resource, permission)`, `has_role(role)`
- RLS (Row Level Security) sur toutes les tables
- `PermissionRoute` protège les routes côté client
- Hook `usePermissions` pour vérifier les droits dans les composants

### 4. Supabase Integration

- **Client** : `src/integrations/supabase/client.ts`
- **Types** : `src/integrations/supabase/types.ts` (auto-généré, lecture seule)
- **Joins typés** : `src/types/supabase-joins.ts` pour les résultats de `.select("*, table(*)")`
- **Edge Functions** : `supabase/functions/` (envoi d'emails, création d'utilisateurs…)
- **Storage** : Buckets pour photos membres, galerie, logos sport, médias matchs

### 5. Design System

- Tokens CSS sémantiques dans `src/index.css` (variables HSL)
- Configuration Tailwind dans `tailwind.config.ts`
- Composants shadcn/ui personnalisés dans `src/components/ui/`
- Thème clair/sombre via `next-themes`

## Flux de données

```
Composant → Hook (useQuery/useMutation) → Supabase Client → PostgreSQL
                                                          → Storage
                                                          → Edge Functions
```

React Query gère le cache, le refetch automatique et l'invalidation. Les hooks domaine retournent des données typées et des fonctions de mutation prêtes à l'emploi.

## Tests

- **Vitest** + **Testing Library** pour les tests unitaires
- Mocks Supabase dans `src/test/mocks/supabase.ts`
- Configuration dans `vitest.config.ts`

## Stabilité & résilience (post-refonte avril 2026)

### ErrorBoundary à 2 niveaux
- **App-level** (`src/App.tsx`) : capture toute erreur non gérée du shell de l'app.
- **Dashboard-level** (`src/pages/Dashboard.tsx`) : isole les erreurs des modules admin.
- Bouton « Réessayer » qui réinitialise l'état d'erreur sans rechargement complet.

### Chargement des chunks (`lazyWithRetry`)
- Helper `src/lib/lazyWithRetry.ts` qui retente automatiquement un import dynamique en cas d'échec réseau.
- Appliqué à TOUTES les routes (App.tsx, Dashboard.tsx).
- Évite les écrans blancs après déploiement (vieux chunks invalidés).

### Synchronisation serveur du sport
- Trigger PostgreSQL `trg_sync_e2d_match_to_site_event` sur `sport_e2d_matchs`.
- Filtre : `statut_publication = 'publie'` uniquement.
- Le hook frontend `useSportEventSync` reste en redondance temps réel.

### Fiabilisation des emails
- `supabase/functions/_shared/email-utils.ts` : retry exponentiel 3 tentatives (500/1000/2000 ms).
- Détection erreurs transitoires : timeout, 429, 5xx.
- Logging centralisé automatique dans `notifications_envois`.
