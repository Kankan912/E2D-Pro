# 📖 CAHIER DES CHARGES DEScriptif — E2D Connect Gateway v4.0

## Document à destination d'un développeur Fullstack pour reprise et maintenance

---

**Projet :** E2D Connect Gateway — Plateforme multi-associations
**Version :** 4.0 (Multi-association + Sécurité renforcée)
**Date :** Juillet 2026
**Statut :** Production-ready (8.3/10)
**Stack :** Vite + React 18 + TypeScript + Supabase + Tailwind + shadcn/ui

---

# SOMMAIRE

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture technique](#2-architecture-technique)
3. [Structure du projet](#3-structure-du-projet)
4. [Base de données](#4-base-de-données)
5. [Sécurité et Authentification](#5-sécurité-et-authentification)
6. [Architecture Multi-Association](#6-architecture-multi-association)
7. [Modules Métier](#7-modules-métier)
8. [Frontend — Pages et Routing](#8-frontend--pages-et-routing)
9. [Frontend — Hooks et State Management](#9-frontend--hooks-et-state-management)
10. [Frontend — Composants UI](#10-frontend--composants-ui)
11. [Backend — RPC et Triggers](#11-backend--rpc-et-triggers)
12. [Backend — Edge Functions](#12-backend--edge-functions)
13. [Temps Réel (Realtime)](#13-temps-réel-realtime)
14. [Configuration et Environnement](#14-configuration-et-environnement)
15. [Déploiement](#15-déploiement)
16. [Tests et Qualité](#16-tests-et-qualité)
17. [Procédures de Maintenance](#17-procédures-de-maintenance)
18. [Évolutions Futures](#18-évolutions-futures)
19. [Glossaire](#19-glossaire)

---

# 1. VUE D'ENSEMBLE

## 1.1 Description

E2D Connect Gateway est une plateforme web **multi-associations** permettant de gérer plusieurs associations sportives et communautaires depuis une interface unique. Chaque association dispose de ses propres données (membres, finances, événements) isolées via Row Level Security (RLS) PostgreSQL.

## 1.2 Public cible

| Utilisateur | Accès |
|---|---|
| Visiteur anonyme | Site public (accueil, dons, adhésion, événements) |
| Membre authentifié | Dashboard personnel (cotisations, prêts, épargnes, sanctions) |
| Administrateur | Backoffice admin (gestion complète de son association) |
| Super-admin | Toutes les associations + switch d'association |

## 1.3 Fonctionnalités principales

- **Gestion des membres** : inscription, profils, rôles, statuts
- **Cotisations** : saisie par réunion, suivi par exercice, récapitulatifs
- **Caisse** : journal comptable, synthèse, ventilation, alertes
- **Réunions** : présences, sanctions, bénéficiaires, comptes rendus
- **Prêts** : demandes, validation, décaissement, paiements, reconductions
- **Épargnes** : dépôts, suivi par membre et exercice
- **Aides** : workflow complet (soumission → validation → paiement → archive)
- **Donations** : formulaire public, suivi admin (virement, mobile money)
- **Sport** : E2D + Phoenix (matchs, classements, compositions, statistiques)
- **Notifications** : templates email, campagnes, rappels automatiques
- **Site/CMS** : hero, à propos, activités, événements, galerie, partenaires

## 1.4 Stack technique

| Couche | Technologie |
|---|---|
| Build | Vite 5.4 |
| Frontend | React 18.3 + TypeScript 5.8 (strict) |
| UI | Tailwind CSS 3.4 + shadcn/ui (New York) |
| Icons | Lucide React |
| Forms | react-hook-form + zod |
| State | React Query v5 (TanStack Query) |
| Routing | react-router-dom v6 |
| Backend | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| Charts | Recharts 2.15 |
| PDF | jsPDF + jspdf-autotable |
| Excel | xlsx 0.18 |
| Toasts | sonner (unifié) |
| Thème | next-themes (light/dark) |
| Tests | Vitest 4 + Testing Library |
| CI/CD | GitHub Actions |
| Hosting | Vercel + Supabase |

---

# 2. ARCHITECTURE TECHNIQUE

## 2.1 Schéma global

```
┌──────────────────────────────────────────────────────────┐
│                    NAVIGATEUR (Client)                    │
│  React 18 + Vite + Tailwind + shadcn/ui                  │
│  ┌────────────────────────────────────────────────────┐  │
│  │  App.tsx                                           │  │
│  │  ├── ErrorBoundary (catch async + reset nav)       │  │
│  │  ├── ThemeProvider (next-themes)                   │  │
│  │  ├── QueryClientProvider (React Query v5)          │  │
│  │  ├── TooltipProvider                               │  │
│  │  ├── Toaster (sonner)                              │  │
│  │  ├── BrowserRouter                                 │  │
│  │  │   └── AuthProvider                              │  │
│  │  │       └── TrackedRoutes                         │  │
│  │  │           ├── / (Index — site public)           │  │
│  │  │           ├── /auth                             │  │
│  │  │           ├── /dashboard/* (protégé)            │  │
│  │  │           ├── /don                              │  │
│  │  │           ├── /adhesion                         │  │
│  │  │           └── /change-password                  │  │
│  │  └── Sonner                                        │  │
│  └────────────────────────────────────────────────────┘  │
│                          │                                │
│           Supabase JS Client (avec header x-association)  │
└──────────────────────────┼───────────────────────────────┘
                           │ HTTPS + JWT
                           ▼
┌──────────────────────────────────────────────────────────┐
│                    SUPABASE (Backend)                    │
│  ┌────────────────────┐  ┌────────────────────────────┐ │
│  │   PostgreSQL       │  │   Auth (GoTrue)            │ │
│  │   - Tables         │  │   - users                  │ │
│  │   - RLS policies   │  │   - sessions               │ │
│  │   - RPC functions  │  │   - JWT                    │ │
│  │   - Triggers       │  └────────────────────────────┘ │
│  └────────────────────┘                                  │
│  ┌────────────────────┐  ┌────────────────────────────┐ │
│  │   Storage          │  │   Edge Functions (Deno)    │ │
│  │   - justificatifs  │  │   - process-adhesion       │ │
│  │   - medias         │  │   - send-email             │ │
│  │   - avatars        │  │   - send-campaign-emails   │ │
│  └────────────────────┘  │   - get-payment-config     │ │
│                          │   - ... (20 fonctions)      │ │
│                          └────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

## 2.2 Flux de données typique

1. L'utilisateur se connecte → Supabase Auth retourne un JWT
2. Le frontend charge le profil via `AuthContext.fetchUserProfile`
3. `useAssociation()` résout l'`association_id` (du profile ou du switch super_admin)
4. Chaque requête Supabase inclut le header `x-association-id` (si super_admin avec switch actif)
5. La RLS PostgreSQL filtre les données par `association_id = get_current_association_id()`
6. Les RPC `SECURITY DEFINER` vérifient les rôles avant d'exécuter la logique métier
7. Les triggers audit/caisse se déclenchent automatiquement

---

# 3. STRUCTURE DU PROJET

## 3.1 Arborescence

```
e2d_review/
├── public/                          # Assets statiques
├── src/
│   ├── App.tsx                      # Routeur principal + providers
│   ├── main.tsx                     # Point d'entrée React
│   ├── index.css                    # Tailwind + variables CSS
│   ├── contexts/
│   │   └── AuthContext.tsx          # Auth + session + profile
│   ├── components/
│   │   ├── ui/                      # 53 composants shadcn/ui
│   │   ├── admin/                   # Composants admin (DataTable, etc.)
│   │   ├── donations/               # Composants dons
│   │   ├── forms/                   # Formulaires (react-hook-form)
│   │   ├── layout/                  # DashboardLayout, Header, Sidebar
│   │   ├── notifications/           # NotificationCenter, Toaster
│   │   ├── auth/                    # PermissionRoute
│   │   ├── AssociationSwitcher.tsx  # Switch super_admin
│   │   ├── ErrorBoundary.tsx        # Catch async + reset nav
│   │   ├── theme-provider.tsx       # next-themes wrapper
│   │   └── ... (50+ composants métier)
│   ├── hooks/                       # 38 hooks personnalisés
│   │   ├── useAssociation.ts        # Multi-tenant hook
│   │   ├── useAides.ts              # CRUD aides
│   │   ├── useCaisse.ts             # Caisse consolidé
│   │   ├── useCotisations.ts
│   │   ├── usePrets.ts
│   │   └── ...
│   ├── lib/
│   │   ├── active-association.ts    # Store switch super_admin
│   │   ├── utils.ts                 # cn(), formatFCFA(), etc.
│   │   ├── donation-schemas.ts      # zod schemas
│   │   ├── pdf-utils.ts             # Génération PDF
│   │   ├── lazyWithRetry.ts         # Lazy load + retry
│   │   └── ...
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts            # Client Supabase (header injection)
│   │       └── types.ts             # Types générés
│   ├── pages/
│   │   ├── Index.tsx                # Site public
│   │   ├── Auth.tsx                 # Login
│   │   ├── Don.tsx                  # Formulaire don public
│   │   ├── Adhesion.tsx             # Formulaire adhésion public
│   │   ├── Dashboard.tsx            # Routeur /dashboard/*
│   │   ├── admin/                   # 20 pages admin
│   │   ├── dashboard/               # 9 pages espace membre
│   │   └── ...
│   └── types/
│       └── ...
├── supabase/
│   ├── migrations/                  # 128+ migrations SQL
│   ├── functions/                   # 20 edge functions Deno
│   │   ├── _shared/
│   │   │   ├── auth-check.ts        # requirePrivilegedUser
│   │   │   ├── email-utils.ts
│   │   │   └── in-app-notify.ts
│   │   ├── process-adhesion/
│   │   ├── send-email/
│   │   └── ...
│   └── config.toml
├── migrations_a_executer/
│   └── E2D_TOUT_EN_UN.sql           # Migration consolidée Phase 1-6
├── docs/                            # Documentation
├── .github/workflows/               # CI (ci.yml, security-rls.yml)
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.app.json                # strict: true
├── vercel.json                      # Security headers
└── README_LOCAL.md
```

## 3.2 Scripts disponibles

| Script | Commande | Description |
|---|---|---|
| dev | `bun run dev` | Serveur Vite (port 8080) |
| build | `bun run build` | Build production |
| lint | `bun run lint` | ESLint |
| test | `bun run test` | Vitest |
| test:rls | `bun run test:rls` | Tests RLS |
| typecheck | `bun run typecheck` | tsc --noEmit |

---

# 4. BASE DE DONNÉES

## 4.1 Tables principales (par domaine)

### Auth & Profils
| Table | Description |
|---|---|
| `auth.users` | Users Supabase Auth (gérée par Supabase) |
| `auth.sessions` | Sessions JWT (gérée par Supabase) |
| `public.profiles` | Profils étendus (nom, prénom, statut, association_id, must_change_password) |
| `public.user_roles` | Attribution rôles (user_id, role_id, association_id) |
| `public.roles` | Définition rôles (name, description) |
| `public.role_permissions` | Matrice rôle × permission × ressource |
| `public.associations` | Tenants (id, nom, description) |

### Membres
| Table | Description |
|---|---|
| `membres` | Membres (nom, prenom, telephone, statut, association_id) |
| `membres_roles` | Rôles internes membres (si applicable) |
| `demandes_adhesion` | Demandes d'adhésion publiques |

### Finances
| Table | Description |
|---|---|
| `cotisations` | Cotisations (membre_id, montant, statut, exercice_id) |
| `cotisations_types` | Types de cotisations (catalogue) |
| `cotisations_mensuelles_exercice` | Cotisations mensuelles par exercice |
| `cotisations_mensuelles_audit` | Audit modifications cotisations |
| `fond_caisse_operations` | Journal caisse (type_operation, montant, categorie) |
| `caisse_config` | Configuration caisse |
| `prets` | Prêts (membre_id, montant, taux, statut) |
| `prets_paiements` | Échéances de remboursement |
| `prets_reconductions` | Reconductions de prêts |
| `epargnes` | Épargnes (membre_id, montant, statut) |
| `exercices` | Exercices comptables (nom, statut) |

### Aides
| Table | Description |
|---|---|
| `aides` | Aides (beneficiaire_id, montant, statut, association_id) |
| `aides_types` | Types d'aides (catalogue) |
| `aides_validation_history` | Audit trail workflow aides |
| `aide_workflow_validations` | Étapes de validation |
| `aide_payment_orders` | Ordres de paiement |
| `aide_payment_items` | Lignes de paiement |
| `aide_appels_de_fonds` | Appels de fonds |

### Réunions
| Table | Description |
|---|---|
| `reunions` | Réunions (date, ordre_du_jour, statut) |
| `reunions_presences` | Présences (statut_presence: present/absent_non_excuse/absent_excuse) |
| `reunions_sanctions` | Sanctions (montant_amende, statut: paye/impaye) |
| `reunion_beneficiaires` | Bénéficiaires par réunion |
| `calendrier_beneficiaires` | Calendrier tontine |

### Sport
| Table | Description |
|---|---|
| `sport_e2d_matchs` | Matchs E2D |
| `match_statistics` | Statistiques joueurs par match |
| `match_compte_rendus` | Comptes rendus de match |
| `match_medias` | Médias de match |
| `phoenix_matchs` | Matchs Phoenix |
| `phoenix_entrainements` | Entraînements Phoenix |
| `phoenix_entrainements_internes` | Entraînements internes Phoenix |
| `phoenix_adherents` | Adhérents Phoenix |
| `phoenix_compositions` | Compositions d'équipe Phoenix |

### Site/CMS
| Table | Description |
|---|---|
| `site_config` | Configuration globale site |
| `site_hero` / `site_hero_images` | Hero accueil |
| `site_about` | Section à propos |
| `site_activities` | Section activités |
| `site_events` | Événements |
| `site_gallery` / `site_gallery_albums` | Galerie |
| `site_partners` | Partenaires |

### Notifications
| Table | Description |
|---|---|
| `notifications` | Notifications in-app (user_id, type, message, lu) |
| `notifications_logs` | Logs d'envoi |

### Donations
| Table | Description |
|---|---|
| `donations` | Dons (donor_name, email, montant, payment_method, payment_status) |
| `recurring_donations` | Dons récurrents |

### Sécurité & Audit
| Table | Description |
|---|---|
| `audit_logs` | Journal d'audit (action, table_name, user_id) |
| `historique_connexion` | Historique des connexions |
| `security_scans` | Scans de sécurité |
| `utilisateurs_actions_log` | Actions utilisateurs |

### Configuration
| Table | Description |
|---|---|
| `configurations` | Config globale (SMTP, etc.) — RLS admin-only |
| `smtp_config` | Configuration SMTP — RLS admin-only |
| `payment_configs` | Config paiements (Stripe, PayPal, etc.) — RLS admin-only |
| `session_config` | Configuration des sessions |

## 4.2 Conventions de nommage

- **Tables** : snake_case, pluriel (`membres`, `cotisations`)
- **Colonnes** : snake_case (`association_id`, `created_at`, `must_change_password`)
- **Clés primaires** : `id UUID DEFAULT gen_random_uuid()`
- **Clés étrangères** : `<table_singulier>_id` (`membre_id`, `association_id`)
- **Timestamps** : `created_at TIMESTAMPTZ DEFAULT now()`, `updated_at TIMESTAMPTZ`
- **Statuts** : TEXT avec CHECK constraint

## 4.3 Index recommandés

```sql
-- Index sur les FK chaudes
CREATE INDEX IF NOT EXISTS idx_membres_association_id ON membres(association_id);
CREATE INDEX IF NOT EXISTS idx_cotisations_membre_id ON cotisations(membre_id);
CREATE INDEX IF NOT EXISTS idx_prets_membre_id ON prets(membre_id);
CREATE INDEX IF NOT EXISTS idx_epargnes_membre_id ON epargnes(membre_id);
CREATE INDEX IF NOT EXISTS idx_prets_paiements_pret_id ON prets_paiements(pret_id);
CREATE INDEX IF NOT EXISTS idx_reunions_sanctions_membre_id ON reunions_sanctions(membre_id);
```

---

# 5. SÉCURITÉ ET AUTHENTIFICATION

## 5.1 Authentification Supabase

- **Provider** : Email/mot de passe (GoTrue)
- **Sessions** : Persistées dans localStorage, auto-refresh
- **JWT** : Valide 1h, refresh automatique

## 5.2 Flow d'authentification

```
1. Utilisateur saisit email + mot de passe sur /auth
2. supabase.auth.signInWithPassword() → JWT
3. AuthContext.fetchUserProfile(userId)
   - Vérifie profiles.status (fail-closed : si erreur → signOut)
   - Vérifie membres.statut
   - Si désactivé → signOut immédiat + message
   - Si must_change_password → redirect /change-password
4. Sinon → redirect /dashboard
```

## 5.3 Rôles (9 rôles)

| Rôle | Description | Portée |
|---|---|---|
| `super_admin` | Super admin multi-associations | Cross-tenant |
| `administrateur` | Admin d'une association | Tenant-scoped |
| `tresorier` | Finances | Tenant-scoped |
| `secretaire_general` | Réunions | Tenant-scoped |
| `responsable_sportif` | Sport | Tenant-scoped |
| `censeur` | Contrôle finances (lecture) | Tenant-scoped |
| `commissaire_comptes` | Audit (lecture) | Tenant-scoped |
| `membre` | Espace personnel | Tenant-scoped |
| `membre_actif` | Membre avec droits étendus | Tenant-scoped |

## 5.4 Fonctions SQL de sécurité

### `has_role(role_name text)` — utilisateur courant
```sql
SELECT EXISTS (
  SELECT 1 FROM user_roles ur
  JOIN roles r ON ur.role_id = r.id
  WHERE ur.user_id = auth.uid()
  AND lower(r.name) = lower(role_name)
);
```

### `has_role(_user_id UUID, _role text)` — utilisateur spécifique
### `is_admin()` — administrateur ou super_admin
### `has_permission(resource_name text, perm text)` — permission granulaire
### `get_current_association_id()` — résout le tenant actif

## 5.5 RLS (Row Level Security)

### Pattern fail-closed standard
```sql
CREATE POLICY mt_<table>_select ON public.<table>
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR association_id = public.get_current_association_id()
  );
```

### Tables sensibles (RLS admin-only)
- `smtp_config` — RLS activée, admin-only FOR ALL
- `configurations` — RLS activée, admin-only FOR ALL
- `payment_configs` — admin-only SELECT + RPC public sans secrets

### Policies spéciales
- `profiles_self_update` : `WITH CHECK (auth.uid() = id)` — l'utilisateur ne peut pas modifier `must_change_password`, `status` directement
- `mt_aides_update` : force l'usage du RPC `avancer_workflow_aide` (le statut ne peut être changé directement)
- `donations_public_insert` : `TO anon, authenticated WITH CHECK (TRUE)` — formulaire public
- `adhesions_public_insert` : idem

## 5.6 Trigger de sécurité

### `invalidate_user_sessions_on_desactivate`
- Fire `AFTER UPDATE OF status ON profiles`
- Quand `status` passe à `desactive`/`supprime`
- Audit uniquement (le frontend gère le signOut via polling)

## 5.7 Edge Functions — `requirePrivilegedUser`

```typescript
// supabase/functions/_shared/auth-check.ts
export async function requirePrivilegedUser(req, corsHeaders) {
  // Vérifie JWT + rôle (admin/tresorier/secretaire_general/super_admin)
  // Retourne null si OK, ou Response 401/403
}
```

Utilisé par 9 edge functions admin.

---

# 6. ARCHITECTURE MULTI-ASSOCIATION

## 6.1 Modèle de données

Chaque table métier possède `association_id UUID REFERENCES associations(id) ON DELETE SET NULL`.

## 6.2 Résolution du tenant actif

### `get_current_association_id()`
```sql
1. Récupère auth.uid()
2. Vérifie si super_admin (has_role)
3. Lit le header HTTP x-association-id (via current_setting)
4. Si super_admin ET header valide ET UUID existe dans associations → retourne header
5. Sinon → retourne profiles.association_id
```

## 6.3 Switch d'association (super_admin)

### Mécanisme frontend
1. **Store** : `src/lib/active-association.ts` (localStorage clé `e2d_active_association`)
2. **Client Supabase** : `src/integrations/supabase/client.ts` injecte `x-association-id` sur chaque requête
3. **Hook** : `useAssociation()` utilise `useSyncExternalStore` pour re-render sur switch
4. **UI** : `AssociationSwitcher` (shadcn Select) dans `DashboardHeader`

### Sécurité (3 couches)
1. **Client** : header injecté uniquement si `getActiveAssociationId()` non-null
2. **Serveur** : `has_role('super_admin')` vérifié avant de trust le header
3. **Validation** : `EXISTS (SELECT 1 FROM associations WHERE id = header)`

## 6.4 Hooks tenant-scopés

### Pattern Option A (paramètre + fallback)
```typescript
export function useAides(associationId?: string) {
  const { associationId: ctxAssociationId } = useAssociation();
  const effectiveAssociationId = associationId ?? ctxAssociationId;
  // queryKey inclut effectiveAssociationId
  // .eq('association_id', effectiveAssociationId) dans la requête
  // enabled: !!effectiveAssociationId
}
```
Hooks : `useAides`, `useAidePhase2/3`, `useAideValidation`, `useCalendrierBeneficiaires`

### Pattern Option B (cache key only)
```typescript
export function useCaisseOperations() {
  const { associationId } = useAssociation();
  // queryKey inclut associationId
  // Pas de .eq() client-side (RLS filtre serveur-side)
}
```
Hooks : `useCaisse`, `useCotisations`, `useEpargnes`, `useDonations`, `useLoanRequests`

---

# 7. MODULES MÉTIER

## 7.1 Module Membres

### Pages
- `MembresAdmin.tsx` — CRUD complet, stats cotisations inline, gestion statut
- `MemberForm.tsx` — Formulaire création/édition
- `MemberDetailSheet.tsx` — Détail d'un membre (sheet)

### Hooks
- `useMembers` — Liste, création, update, delete
- `usePersonalData` — Données personnelles (membre connecté)

### Workflow adhésion
1. Visiteur remplit `/adhesion` → INSERT dans `demandes_adhesion`
2. Admin valide dans `AdhesionsAdmin` → `validateMutation`
3. SQL update `payment_status='completed'`
4. Edge function `process-adhesion` crée `membres` + compte utilisateur
5. Email de bienvenue envoyé

## 7.2 Module Cotisations

### Pages
- `CotisationsAdmin.tsx` — Saisie par réunion, suivi par exercice
- `CotisationsGridView.tsx` — Vue grille
- `CotisationsReunionView.tsx` — Vue par réunion

### Hooks
- `useCotisations` — CRUD cotisations
- `useCotisationsMensuelles` — Cotisations mensuelles

### Statuts
- `paye` (single 'e') — cotisation payée
- `impaye` — impayée
- `en_attente` — en attente
- `annule` — annulée

## 7.3 Module Caisse

### Pages
- `CaisseAdmin.tsx` — Dashboard caisse
- `CaisseDashboard.tsx` — KPIs + graphiques
- `CaisseOperationsTable.tsx` — Journal
- `CaisseOperationForm.tsx` — Saisie opération
- `CaisseSyntheseDetailModal.tsx` — Synthèse détaillée

### Hooks
- `useCaisse` — Consolidé (useCaisseOperations, useCaisseSynthese, useCaisseDetails)

### Trigger automatique
- `create_caisse_operation_from_source` — fire sur `aides.statut='payee'` → insert `fond_caisse_operations`

## 7.4 Module Réunions

### Workflow complet
1. **Ouverture** : `ReunionForm` crée la réunion (statut `ouverte`)
2. **Présences** : `ReunionPresencesManager` saisit (`present`/`absent_non_excuse`/`absent_excuse`)
3. **Sanctions** : `ReunionSanctionsManager` (montant_amende, statut `paye`/`impaye`)
4. **Bénéficiaires** : `BeneficiairesReunionWidget`
5. **Cotisations** : `CotisationsReunionView`
6. **Compte rendu** : `CompteRenduForm` + `CompteRenduViewer`
7. **Clôture** : `ClotureReunionModal` (statut `cloturee`, audit)
8. **Rouverture** : `ReouvrirReunionModal`

### Hooks
- `useReunions` — CRUD réunions
- `useReunionsData` — Données agrégées (onglets)

## 7.5 Module Prêts

### Pages
- `PretsAdmin.tsx` — Gestion prêts
- `DemandesPretAdmin.tsx` — Demandes de prêt
- `PretsConfigAdmin.tsx` — Configuration
- `LoanWorkflowConfig.tsx` — Workflow

### Hooks
- `useLoanRequests` — Demandes + useDisburseLoan (RPC `disburse_loan`)

### RPC `disburse_loan(p_pret_id UUID) RETURNS BOOLEAN`
- `SECURITY DEFINER` + `SET search_path = public`
- Check rôle (tresorier/administrateur/super_admin)
- Valide statut (`valide`/`approuve`)
- Update statut → `en_cours`

## 7.6 Module Épargnes

### Pages
- `Epargnes.tsx` — Liste + filtres
- `MyEpargnes.tsx` — Espace membre

### Hooks
- `useEpargnes` — CRUD

## 7.7 Module Aides (Workflow complet)

### Workflow
```
brouillon → soumise → approuvee → payee → archivee
                ↓         ↓
             refusee   refusee
```

### Pages
- `AidesAdmin.tsx` — Liste + boutons workflow
- `AideForm.tsx` — Création/édition (statut read-only en édition)
- `AideValidationTimeline.tsx` — Audit trail
- `AideDashboard.tsx` — KPIs

### RPC `avancer_workflow_aide(p_aide_id, p_action, p_commentaire) RETURNS JSONB`
- Actions : `soumettre`, `valider`, `rejeter`, `mandater`, `payer`, `archiver`
- `SECURITY DEFINER` + check rôle
- Valide les transitions
- Insert audit dans `aides_validation_history`
- Déclenche le trigger caisse sur `payer`

### Trigger caisse
- Fire `AFTER UPDATE OF statut ON aides WHEN NEW.statut = 'payee'`
- Insert `fond_caisse_operations` (idempotent)

## 7.8 Module Donations

### Pages
- `Don.tsx` — Formulaire public (react-hook-form + zod + honeypot)
- `DonationsAdmin.tsx` — Suivi admin

### Composants
- `PaymentMethodTabs.tsx` — Tabs (Virement, Mobile Money, Carte)
- `BankTransferInfo.tsx` — Info virement (email read-only)
- `MobileMoneyInfo.tsx` — Info Mobile Money
- `DisabledPaymentMethod.tsx` — Stub "Bientôt disponible" (Stripe/PayPal/HelloAsso)
- `DonationSuccessModal.tsx` — Reçu fiscal (conditionnel `payment_status='completed'`)

### RPC `get_active_payment_config_public() RETURNS JSONB`
- Retourne la config active SANS les secrets (strip via `strip_secrets()`)

## 7.9 Module Sport E2D

### Pages
- `SportE2D.tsx` — Page publique
- `MatchResults.tsx` — Résultats
- `GestionPresences.tsx` — Présences

### Composants
- `E2DClassementButeurs`, `E2DClassementPasseurs`, `E2DClassementGeneral`
- `E2DTableauDiscipline` (jaunes/rouges)
- `MatchStatsForm`, `MatchDetailsModal`
- `CalendrierSportifUnifie`

## 7.10 Module Sport Phoenix

### Pages
- `SportPhoenix.tsx` — Page publique
- `PhoenixClassements.tsx` — Classements (rempli avec vraies données)
- `PhoenixMatchDetails.tsx`

### Composants
- `PhoenixPresencesManager`, `PhoenixEntrainementsManager`
- `PhoenixEquipesManager`, `PhoenixCompositionsManager`

## 7.11 Module Notifications

### Pages
- `NotificationsAdmin.tsx` — Campagnes
- `NotificationsTemplatesAdmin.tsx` — Templates

### Composants
- `NotificationCenter.tsx` — Centre de notifications
- `NotificationToaster.tsx` — Toasts temps réel (filtres `association_id`)

### Hooks
- `useInAppNotifications` — Notifications in-app (filtre `user_id`)
- `useNotificationsTemplates` — Templates

### Edge functions de rappel (à scheduler via pg_cron)
- `send-pret-echeance-reminders` (quotidien 8h)
- `send-cotisation-reminders` (hebdomadaire)
- `send-sanction-notification` (quotidien)
- `send-aide-notification` (sur événement)
- `send-presence-reminders` (J-1 réunion)

## 7.12 Module Site/CMS

### Pages admin
- `site/HeroAdmin.tsx`, `AboutAdmin.tsx`, `ActivitiesAdmin.tsx`
- `site/EventsAdmin.tsx`, `GalleryAdmin.tsx`, `PartnersAdmin.tsx`
- `site/ImagesAdmin.tsx`, `MessagesAdmin.tsx`, `ConfigAdmin.tsx`

### Pages publiques
- `Index.tsx` — Consomme le CMS via `useSiteContent`
- `EventDetail.tsx`, `AlbumDetail.tsx`

### Hook
- `useSiteContent` — Charge le contenu CMS

---

# 8. FRONTEND — PAGES ET ROUTING

## 8.1 Routes publiques

| Route | Page | Description |
|---|---|---|
| `/` | `Index` | Site public (CMS) |
| `/auth` | `Auth` | Login |
| `/don` | `Don` | Formulaire don |
| `/adhesion` | `Adhesion` | Formulaire adhésion |
| `/change-password` | `FirstPasswordChange` | Premier changement MDP |
| `/evenements/:id` | `EventDetail` | Détail événement |
| `/albums/:albumId` | `AlbumDetail` | Détail album |
| `*` | `NotFound` | 404 |

## 8.2 Routes dashboard (`/dashboard/*`)

### Espace membre
| Route | Page |
|---|---|
| `/dashboard` | `DashboardHome` |
| `/dashboard/profile` | `Profile` |
| `/dashboard/my-cotisations` | `MyCotisations` |
| `/dashboard/my-pret` | `MyPrets` |
| `/dashboard/my-epargnes` | `MyEpargnes` |
| `/dashboard/my-sanctions` | `MySanctions` |
| `/dashboard/my-presences` | `MyPresences` |
| `/dashboard/my-aides` | `MyAides` |
| `/dashboard/my-donations` | `MyDonations` |

### Backoffice admin
| Route | Page |
|---|---|
| `/dashboard/admin/membres` | `MembresAdmin` |
| `/dashboard/admin/cotisations` | `CotisationsAdmin` |
| `/dashboard/admin/caisse` | `CaisseAdmin` |
| `/dashboard/admin/prets` | `PretsAdmin` |
| `/dashboard/admin/demandes-pret` | `DemandesPretAdmin` |
| `/dashboard/admin/epargnes` | `Epargnes` |
| `/dashboard/admin/aides` | `AidesAdmin` |
| `/dashboard/admin/adhesions` | `AdhesionsAdmin` |
| `/dashboard/admin/donations` | `DonationsAdmin` |
| `/dashboard/admin/reunions` | `Reunions` |
| `/dashboard/admin/sport-e2d` | `SportE2D` |
| `/dashboard/admin/sport-phoenix` | `SportPhoenix` |
| `/dashboard/admin/notifications` | `NotificationsAdmin` |
| `/dashboard/admin/utilisateurs` | `UtilisateursAdmin` |
| `/dashboard/admin/roles` | `RolesAdmin` |
| `/dashboard/admin/permissions` | `PermissionsAdmin` |
| `/dashboard/admin/exports` | `ExportsAdmin` |
| `/dashboard/admin/monitoring` | `MonitoringAdmin` |
| `/dashboard/admin/site/*` | Pages CMS |

## 8.3 Layout

- `DashboardLayout.tsx` — Sidebar + Header + Content
- `DashboardHeader.tsx` — Logo + AssociationSwitcher (super_admin) + NotificationCenter + UserMenu
- `DashboardSidebar.tsx` — Navigation adaptative selon rôle

## 8.4 Protection des routes

`PermissionRoute.tsx` — Vérifie les permissions avant de rendre la page. Si non autorisé → redirect `/dashboard`.

---

# 9. FRONTEND — HOOKS ET STATE MANAGEMENT

## 9.1 React Query (TanStack Query v5)

### Configuration
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,        // 1 minute
      gcTime: 10 * 60 * 1000,      // 10 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
```

### Conventions de query keys
- `['aides', associationId]` — Liste aides par tenant
- `['aides', associationId, aideId]` — Détail aide
- `['caisse-operations', associationId]` — Operations caisse
- `['associations']` — Liste associations (super_admin)

## 9.2 Hooks critiques (38 au total)

### Auth & Session
| Hook | Rôle |
|---|---|
| `useAuth` (AuthContext) | Session + profile + login/logout |
| `useAssociation` | Association active + switch + isSuperAdmin |
| `usePermissions` | Permissions granulaires |
| `useSessionManager` | Gestion session (timeout warning) |

### Domaines métier
| Hook | Domaine |
|---|---|
| `useMembers` | Membres |
| `useCotisations`, `useCotisationsMensuelles` | Cotisations |
| `useCaisse` | Caisse (consolidé) |
| `useLoanRequests` | Prêts + disburse_loan |
| `useEpargnes` | Épargnes |
| `useAides`, `useAidePhase2/3`, `useAideValidation` | Aides |
| `useDonations` | Donations |
| `useAdhesions` | Adhesions |
| `useReunions` | Réunions |
| `useSport`, `useE2DPlayerStats`, `useSportEventSync` | Sport E2D |
| `useMatchMedias`, `useMatchCompteRendu` | Matchs |
| `useSiteContent` | CMS |
| `useInAppNotifications`, `useNotificationsTemplates` | Notifications |
| `useAlertesGlobales` | Alertes |
| `usePersonalData` | Données membre connecté |

### Tracking & Monitoring
| Hook | Rôle |
|---|---|
| `usePageviewTracker` | Pageviews |
| `useConnectionTracker` | Connexions |
| `useActivityTracker` | Activité |
| `useBackNavigation` | Navigation arrière |

## 9.3 Realtime

- `useRealtimeUpdates` — Engine générique (avec filtre `association_id`)
- `NotificationToaster` — Écoute `prets`, `reunions_sanctions`, `fond_caisse_operations` (filtré par `association_id`)
- `useInAppNotifications` — Écoute `notifications` (filtré par `user_id`)

### Conventions Realtime
- Noms de channels : `crypto.randomUUID()` (pas `Date.now()`)
- Cleanup : `supabase.removeChannel(channel)` (pas juste `unsubscribe`)
- Status callback : log `CHANNEL_ERROR`/`TIMED_OUT`
- Filtre : `filter: 'association_id=eq.${associationId}'`

---

# 10. FRONTEND — COMPOSANTS UI

## 10.1 shadcn/ui (53 composants)

Tous dans `src/components/ui/` :
- `button`, `input`, `textarea`, `label`, `select`, `checkbox`, `radio-group`, `switch`, `slider`, `toggle`, `toggle-group`
- `dialog`, `alert-dialog`, `sheet`, `drawer`, `popover`, `tooltip`, `hover-card`, `dropdown-menu`, `context-menu`, `menubar`, `navigation-menu`, `command`
- `card`, `avatar`, `badge`, `separator`, `progress`, `skeleton`, `spinner`
- `tabs`, `accordion`, `collapsible`, `resizable`
- `table`, `pagination`, `breadcrumb`
- `form` (react-hook-form integration), `input-otp`, `calendar`, `date-picker`
- `chart` (Recharts wrapper), `carousel` (Embla), `aspect-ratio`, `scroll-area`
- `sonner` (toast), `toaster` (no-op, legacy)
- `page-loader`, `lazy-image`, `image-lightbox`

## 10.2 Composants métier (50+)

- `admin/` : `DataTable`, `StatCard`, `PermissionsMatrix`, `CreateUserDialog`, `MediaUploader`, `SecurityStatusWidget`, `AppelsDeFondsWidget`
- `donations/` : `PaymentMethodTabs`, `BankTransferInfo`, `MobileMoneyInfo`, `DonationAmountSelector`, `DonationSuccessModal`, `DisabledPaymentMethod`
- `forms/` : `MemberForm`, `PretForm`, `AideForm`, `ReunionForm`, `CotisationSaisieForm`, `CompteRenduForm`, `E2DMatchForm`, `PhoenixMatchForm`, `NotificationCampagneForm`, `ExportConfigForm`, `FileUploadField`, `EntrainementInterneForm`
- `caisse/` : `CaisseDashboard`, `CaisseSidePanel`, `CaisseOperationsTable`, `CaisseSyntheseDetailModal`, `CaisseOperationForm`
- `loans/` : `LoanValidationTimeline`, `LoanRequestDialog`, `LoanRejectDialog`
- `notifications/` : `NotificationCenter`, `NotificationItem`, `NotificationToaster`, `NotificationItemPersonal`
- `layout/` : `DashboardLayout`, `DashboardHeader`, `DashboardSidebar`
- `auth/` : `PermissionRoute`
- `config/` : `CotisationsMembresManager`, `GestionGeneraleManager`, `EmailConfigManager`, `ExercicesManager`, `SauvegardeManager`, `SessionsConfigManager`, `SanctionsTarifsManager`, `CalendrierBeneficiairesManager`, `NotificationsConfigManager`, `CotisationsTypesManager`, `CotisationsMensuellesExerciceManager`, `ExercicesCotisationsTypesManager`, `CotisationsMensuellesAuditDialog`
- `AssociationSwitcher`, `ErrorBoundary`, `theme-provider`, `Breadcrumbs`, `BackButton`, `SEOHead`, `Footer`, `Navbar`, `Hero`, `About`, `Activities`, `Events`, `Gallery`, `Partners`, `Contact`, `LogoHeader`, `MediaLibrary`, `MemberDetailSheet`, `UserMemberLinkManager`, `SessionWarningModal`, `NotifierReunionModal`, `ClotureReunionModal`, `ReouvrirReunionModal`, `ReconduireModal`, `ReunionPresencesManager`, `ReunionSanctionsManager`, `CotisationsReunionView`, `CompteRenduViewer`, `CompteRenduActions`, `BeneficiairesReunionWidget`, `PhoenixPresencesManager`, `PhoenixEntrainementsManager`, `PhoenixEquipesManager`, `PhoenixCompositionsManager`, `PhoenixClassements`, `PhoenixMatchDetails`, `PhoenixDashboardAnnuel`, `PhoenixCotisationsAnnuelles`, `MatchStatsForm`, `MatchMediaManager`, `MatchEffectifsManager`, `MatchDetailsModal`, `StatsMatchDetaillee`, `SportStatistiquesGlobales`, `SportAnalyticsAvancees`, `SportDashboardTempsReel`, `E2DDashboardAnalytics`, `E2DClassementButeurs`, `E2DClassementPasseurs`, `E2DClassementGeneral`, `E2DTableauDiscipline`, `TableauBordJauneRouge`, `CalendrierSportifUnifie`, `CalendrierBeneficiaires`, `CotisationCellModal`, `CotisationsGridView`, `CotisationsCumulAnnuel`, `CotisationsClotureExerciceCheck`, `CotisationsEtatsModal`, `PretHistoriqueComplet`, `PretDetailsModal`, `PretsPaiementsManager`, `PretsAlertes`, `PresencesEtatAbsences`, `PresencesRecapAnnuel`, `PresencesRecapMensuel`, `PresencesHistoriqueMembre`, `ClassementJoueurs`, `CompteRenduMatchForm`, `CompteRenduForm`

---

# 11. BACKEND — RPC ET TRIGGERS

## 11.1 RPC (Remote Procedure Calls)

### `disburse_loan(p_pret_id UUID) RETURNS BOOLEAN`
- Décaisse un prêt (statut → `en_cours`)
- Rôle : tresorier/administrateur/super_admin

### `avancer_workflow_aide(p_aide_id UUID, p_action TEXT, p_commentaire TEXT) RETURNS JSONB`
- Fait avancer le workflow d'une aide
- Actions : `soumettre`, `valider`, `rejeter`, `mandater`, `payer`, `archiver`
- Rôle : admin/tresorier/super_admin
- Insert audit + déclenche trigger caisse sur `payer`

### `clear_must_change_flag() RETURNS BOOLEAN`
- Clear le flag `must_change_password` (après changement MDP réussi)
- Self-service (utilise `auth.uid()`)

### `get_active_payment_config_public() RETURNS JSONB`
- Retourne la config paiement active SANS les secrets
- Authenticated

### `log_audit_event(p_action, p_table_name, p_record_id, p_old_data, p_new_data) RETURNS UUID`
- Log un événement d'audit
- Authenticated

### `get_current_association_id() RETURNS UUID`
- Résout le tenant actif (profile ou header super_admin)

### `is_admin() RETURNS BOOLEAN`
- True si administrateur ou super_admin

### `has_role(role_name text) RETURNS BOOLEAN`
- Vérifie le rôle de l'utilisateur courant

### `has_role(_user_id UUID, _role text) RETURNS BOOLEAN`
- Vérifie le rôle d'un utilisateur spécifique

### `has_permission(resource_name text, perm text) RETURNS BOOLEAN`
- Permission granulaire

### `projeter_cotisations_reunion(p_reunion_id UUID) RETURNS VOID`
- Projette les cotisations d'une réunion

## 11.2 Triggers

### `trg_invalidate_sessions_on_desactivate`
- Table : `profiles`
- Événement : `AFTER UPDATE OF status`
- Action : audit quand `status` → `desactive`/`supprime`

### `trg_create_caisse_on_aide_payee`
- Table : `aides`
- Événement : `AFTER UPDATE OF statut WHEN NEW.statut = 'payee'`
- Action : insert `fond_caisse_operations` (idempotent)

### `trg_aides_updated_at`
- Table : `aides`
- Événement : `BEFORE UPDATE`
- Action : `NEW.updated_at = now()`

### `update_updated_at_column` (générique)
- Utilisé par plusieurs tables pour auto-update `updated_at`

---

# 12. BACKEND — EDGE FUNCTIONS

## 12.1 Liste (20 fonctions)

| Fonction | Rôle | Sécurité |
|---|---|---|
| `process-adhesion` | Crée membre + compte depuis adhésion | `requirePrivilegedUser` |
| `send-email` | Envoi email générique | `requirePrivilegedUser` |
| `send-campaign-emails` | Campagne en masse | `requirePrivilegedUser` |
| `send-contact-notification` | Formulaire contact public | Rate limiting (3/5min) |
| `send-pret-echeance-reminders` | Rappels échéance prêts | `requirePrivilegedUser` |
| `send-cotisation-reminders` | Rappels cotisations | `requirePrivilegedUser` |
| `send-sanction-notification` | Notification sanction | `requirePrivilegedUser` |
| `send-aide-notification` | Notification aide | `requirePrivilegedUser` |
| `send-presence-reminders` | Rappels présences | `requirePrivilegedUser` |
| `send-reunion-cr` | Compte rendu réunion | `requirePrivilegedUser` |
| `send-calendrier-beneficiaires` | Calendrier bénéficiaires | `requirePrivilegedUser` |
| `send-loan-notification` | Notification prêt | `requirePrivilegedUser` |
| `send-user-credentials` | Envoi identifiants | `requirePrivilegedUser` |
| `create-user-account` | Création compte utilisateur | `requirePrivilegedUser` |
| `sync-user-emails` | Sync emails | `requirePrivilegedUser` |
| `update-email-config` | MAJ config email | `requirePrivilegedUser` |
| `test-email-configuration` | Test config email | `requirePrivilegedUser` |
| `donations-stats` | Stats dons | `requirePrivilegedUser` |
| `get-payment-config` | Config paiement publique | Service role (secrets strippés) |
| `seed-test-users` | Comptes test (dev only) | Guard `ALLOW_SEED_TEST_USERS` |

## 12.2 Shared helpers (`_shared/`)

### `auth-check.ts`
```typescript
export async function requirePrivilegedUser(req, corsHeaders)
// Vérifie JWT + rôle (admin/tresorier/secretaire_general/super_admin)
// Retourne null si OK, ou Response 401/403
```

### `email-utils.ts`
- Templates d'emails
- Envoi via Resend API ou SMTP

### `in-app-notify.ts`
- Insert notification in-app dans la table `notifications`

## 12.3 Conventions

- **Imports** : Deno-style (`https://esm.sh/...`)
- **CORS** : `Access-Control-Allow-Origin: *` (à restreindre en prod)
- **OPTIONS preflight** : géré avant auth check
- **Erreurs** : JSON en français
- **Rate limiting** : sur fonctions publiques

---

# 13. TEMPS RÉEL (REALTIME)

## 13.1 Configuration

Supabase Realtime via `postgres_changes`. Le client s'abonne à des channels filtrés par `association_id`.

## 13.2 Channels utilisés

| Channel | Table | Filtre | Hook |
|---|---|---|---|
| `prets-changes` | `prets` | `association_id=eq.<id>` | `NotificationToaster` |
| `reunions-sanctions-changes` | `reunions_sanctions` | `association_id=eq.<id>` | `NotificationToaster` |
| `fond-caisse-changes` | `fond_caisse_operations` | `association_id=eq.<id>` | `NotificationToaster` |
| `notifications-changes` | `notifications` | `user_id=eq.<id>` | `useInAppNotifications` |
| `sport-e2d-matchs` | `sport_e2d_matchs` | `association_id=eq.<id>` | `useSportEventSync` |
| `phoenix-entrainements` | `phoenix_entrainements_internes` | `association_id=eq.<id>` | Pages Sport |
| `loan-requests` | `loan_requests` | `association_id=eq.<id>` | `useLoanRequests` |

## 13.3 Conventions

- **Nom channel** : `crypto.randomUUID()` (pas `Date.now()`)
- **Cleanup** : `supabase.removeChannel(channel)`
- **Status** : callback log `CHANNEL_ERROR`/`TIMED_OUT`
- **Gate** : pas d'abonnement si `associationId` est null

---

# 14. CONFIGURATION ET ENVIRONNEMENT

## 14.1 Variables d'environnement

### Requises (production)
- `SUPABASE_URL` — URL du projet Supabase
- `SUPABASE_ANON_KEY` — Clé anonyme
- `SUPABASE_SERVICE_ROLE_KEY` — Clé service role (edge functions)

### Edge functions
- `RESEND_API_KEY` — API key Resend (ou config SMTP)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (si SMTP)

### À NE PAS définir en production
- `ALLOW_SEED_TEST_USERS` — doit être ABSENT (sinon `seed-test-users` activé)

## 14.2 Credentials hardcodés (dev local)

Le fichier `src/integrations/supabase/client.ts` contient les credentials hardcodés :
```typescript
const SUPABASE_URL = "https://piyvinbuxpnquwzyugdj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIs...";
```

**Note** : C'est une mauvaise pratique de sécurité. En production, migrer vers des variables d'environnement Vite (`import.meta.env.VITE_SUPABASE_URL`).

## 14.3 Configuration Tailwind

- `darkMode: ["class"]` (pour next-themes)
- Content paths : `./src/**/*.{ts,tsx}`
- Plugins : `tailwindcss-animate`
- Couleurs : variables CSS HSL (bleu E2D, turquoise Phoenix)
- Border radius : variable `--radius`

## 14.4 Configuration TypeScript

- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`
- `noImplicitOverride: true`
- `skipLibCheck: true`

## 14.5 Configuration Vite

- Port : 8080
- Plugin : `@vitejs/plugin-react-swc`
- Alias : `@` → `./src`
- `lovable-tagger` en mode development

---

# 15. DÉPLOIEMENT

## 15.1 Local

```bash
bun install
# Exécuter E2D_TOUT_EN_UN.sql dans Supabase SQL Editor
bun run dev
# http://localhost:8080
```

## 15.2 Production (Vercel + Supabase)

### Étapes
1. Push le code sur GitHub
2. Connecter le repo à Vercel
3. Configurer les variables d'environnement sur Vercel
4. Exécuter les migrations SQL sur Supabase
5. Configurer SMTP (dashboard admin)
6. Scheduler les 5 rappels (pg_cron ou Vercel cron)
7. Tester les workflows critiques

### vercel.json
- SPA rewrite : `/(.*)` → `/index.html`
- Security headers : CSP, X-Frame-Options DENY, HSTS preload, X-Content-Type-Options, Referrer-Policy, Permissions-Policy

## 15.3 Post-déploiement

- [ ] Vérifier les logs d'erreur
- [ ] Surveiller les edge functions (dashboard Supabase)
- [ ] Vérifier le rate limiting sur contact
- [ ] Tester une adhésion de bout en bout
- [ ] Tester le switch d'association (super_admin)
- [ ] Configurer Sentry (optionnel)

---

# 16. TESTS ET QUALITÉ

## 16.1 Tests existants

| Fichier | Couverture |
|---|---|
| `src/lib/utils.test.ts` | Fonctions utilitaires |
| `src/lib/session-utils.test.ts` | Utilitaires session |
| `src/lib/payment-utils.test.ts` | Utils paiement |
| `src/lib/caisseCalculations.test.ts` | Calculs caisse |
| `src/lib/pretCalculsService.test.ts` | Calculs prêts |
| `src/test/security/rls_smoke.test.ts` | Smoke test RLS |

## 16.2 CI/CD

`.github/workflows/ci.yml` :
- Job `quality` (tous les push/PR) : lint + typecheck + test + test:rls
- Job `build` (push only) : vite build

## 16.3 Lint

- ESLint avec `eslint-plugin-react-hooks` et `eslint-plugin-react-refresh`
- Config : `eslint.config.js`

## 16.4 Typecheck

- `tsc --noEmit -p tsconfig.app.json`
- Strict mode activé

---

# 17. PROCÉDURES DE MAINTENANCE

## 17.1 Ajouter une nouvelle migration SQL

1. Créer un fichier `supabase/migrations/<timestamp>_<description>.sql`
2. Utiliser `BEGIN; ... COMMIT;`
3. Être idempotent (`DROP IF EXISTS`, `CREATE OR REPLACE`)
4. Commenter en français
5. Tester sur staging avant production

## 17.2 Ajouter une edge function

1. Créer `supabase/functions/<nom>/index.ts`
2. Importer `requirePrivilegedUser` si admin-only
3. Gérer le CORS preflight
4. Logger les erreurs
5. Retourner du JSON en français

## 17.3 Ajouter un hook

1. Créer `src/hooks/<nom>.ts`
2. Utiliser React Query pour les requêtes
3. Inclure `associationId` dans les query keys (via `useAssociation()`)
4. Gérer loading/error states
5. Invalider les caches appropriées sur mutations

## 17.4 Ajouter une page admin

1. Créer `src/pages/admin/<Nom>Admin.tsx`
2. Ajouter la route dans `Dashboard.tsx`
3. Protéger avec `PermissionRoute`
4. Utiliser `DataTable` pour les listes
5. Ajouter dans la sidebar (`DashboardSidebar.tsx`)

## 17.5 Régénérer les types Supabase

```bash
bunx supabase gen types typescript --project-id <project-id> > src/integrations/supabase/types.ts
```

À faire après chaque modification du schéma BDD.

---

# 18. ÉVOLUTIONS FUTURES

## 18.1 Court terme

| Évolution | Effort | Priorité |
|---|---|---|
| Intégration Stripe réelle | 3-5 jours | Haute (si dons par carte) |
| Cloudflare Turnstile sur formulaires publics | 1 jour | Haude (anti-spam) |
| Étendre la couverture de tests (RLS, e2e) | 1 semaine | Moyenne |
| Fix `mandater` (ajouter statut `mandatee`) | 1 jour | Basse |

## 18.2 Moyen terme

| Évolution | Effort |
|---|---|
| PWA (offline-first) | 1-2 semaines |
| App mobile (React Native) | 3-4 semaines |
| Module comptabilité avancé (export FEC) | 1 semaine |
| Module RH (gestion bénévoles) | 2 semaines |
| Audit de pénétration externe | 1 semaine |

## 18.3 Long terme

| Évolution | Effort |
|---|---|
| Migration vers Next.js (SSR/SSG) | 2-3 semaines |
| Multi-langue (i18n) | 1 semaine |
| API publique (REST/GraphQL) | 1-2 semaines |
| Webhooks sortants | 1 semaine |

---

# 19. GLOSSAIRE

| Terme | Définition |
|---|---|
| **Tenant** | Une association (instance isolée) |
| **Super_admin** | Rôle cross-tenant (gère plusieurs associations) |
| **RLS** | Row Level Security (PostgreSQL) — filtrage serveur-side |
| **RPC** | Remote Procedure Call — fonction SQL appelable |
| **SECURITY DEFINER** | La fonction s'exécute avec les privilèges de son propriétaire (bypass RLS) |
| **Edge Function** | Fonction Deno déployée sur Supabase |
| **Query Key** | Clé de cache React Query |
| **Honeypot** | Champ anti-spam caché |
| **JWT** | JSON Web Token (jeton d'authentification) |
| **CMS** | Content Management System (gestion de contenu) |
| **PWA** | Progressive Web App |
| **SSR/SSG** | Server-Side Rendering / Static Site Generation |

---

# ANNEXES

## Annexe A — Migrations SQL à exécuter

| # | Fichier | Description |
|---|---|---|
| 1 | `migrations_a_executer/E2D_TOUT_EN_UN.sql` | Migration consolidée Phase 1-6 (686 lignes) |

**Procédure** : Copier-coller dans Supabase SQL Editor → Run. Résultat attendu : 12+ fonctions créées.

## Annexe B — Edge Functions à scheduler (pg_cron)

| Fonction | Schedule recommandé |
|---|---|
| `send-pret-echeance-reminders` | `0 8 * * *` (quotidien 8h) |
| `send-cotisation-reminders` | `0 8 * * 1` (lundi 8h) |
| `send-sanction-notification` | `0 9 * * *` (quotidien 9h) |
| `send-aide-notification` | Sur trigger |
| `send-presence-reminders` | `0 18 * * *` (J-1 réunion) |

## Annexe C — Workflows critiques à tester

1. **Adhésion** : Formulaire public → validation admin → membre créé
2. **Aide** : Brouillon → Soumise → Approuvée → Payée (trigger caisse) → Archivée
3. **Prêt** : Demande → Validation → Décaissement (`disburse_loan`) → Paiements
4. **Réunion** : Ouverture → Présences → Sanctions → Cotisations → CR → Clôture
5. **Switch association** (super_admin) : Sélecteur → données rafraîchies
6. **Désactivation user** : Admin désactive → user déconnecté au prochain check

## Annexe D — Contacts et ressources

- **Worklog complet** : `/home/z/my-project/worklog.md` (3000+ lignes)
- **Tableau de bord initial** : `/home/z/my-project/download/TABLEAU_DE_BORD_CODE_REVIEW.md`
- **Documentation Supabase** : https://supabase.com/docs
- **Documentation Vite** : https://vitejs.dev
- **Documentation shadcn/ui** : https://ui.shadcn.com

---

**Fin du cahier des charges descriptif — E2D Connect Gateway v4.0**
