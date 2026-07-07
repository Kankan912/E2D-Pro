# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.1.0] — 2026-07-22

### 🔒 Sécurité (P0 — Critique)

- **FIXED** : Secrets Supabase externalisés vers variables d'environnement (`src/integrations/supabase/client.ts`)
- **FIXED** : Open email relay sur `send-contact-notification` — ajout CAPTCHA + rate limiting + whitelist recipient
- **FIXED** : RBAC sur `send-email` via `requirePrivilegedUser`
- **FIXED** : RBAC sur `send-campaign-emails` via `requirePrivilegedUser`
- **FIXED** : Ownership check dans `process-adhesion` (vérification `user_id` ou `is_admin`)
- **FIXED** : Chiffrement secrets SMTP/Resend via pgcrypto + table `secret_configs`
- **FIXED** : `update-email-config` restreint à `administrateur` + `super_admin` uniquement
- **FIXED** : Bucket Storage `members-photos` sécurisé (policy owner-only)
- **REMOVED** : Migration dangereuse `migrations_a_executer/E2D_TOUT_EN_UN.sql` supprimée

### 🏰 Multi-Tenant & RLS (P0)

- **FIXED** : RLS intra-tenant durcie sur 27 tables core (policies `is_admin()` obligatoire)
- **FIXED** : `get_current_association_id()` server-validé (anti-spoofing header `x-association-id`)
- **ADDED** : Self-read policies — membres ne voient que leurs propres données financières
- **ADDED** : Audit log automatique en cas de tentative de cross-tenant

### ⚙️ CI/CD & Build (P1)

- **ADDED** : Workflow GitHub Actions complet (6 jobs : quality, unit-tests, security-audit, rls-tests, e2e-tests, deploy)
- **FIXED** : `src/test/setup.ts` créé (Vitest fonctionnel)
- **FIXED** : `src/test/security/rls.test.ts` créé (30+ tests RLS)
- **ADDED** : `tsc --noEmit` dans le script `build`
- **ADDED** : `strict: true` + toutes les options TypeScript strictes
- **ADDED** : ESLint durci (`no-unused-vars: error`, `no-console: warn`, `eqeqeq: error`)
- **REMOVED** : Ancien workflow `security-rls.yml` cassé

### 📦 Dépendances (P0/P1)

- **CHANGED** : `xlsx@0.18.5` (vulnérable) → `exceljs@4.4.0` (CVE-2023-30533 + CVE-2024-22363 éliminées)
- **REMOVED** : 3 dépendances mortes `@dnd-kit/*` (jamais importées)
- **CHANGED** : `@types/node@25` (inexistant) → `@types/node@22`
- **MOVED** : `vitest`, `@testing-library/*`, `jsdom` vers `devDependencies`
- **ADDED** : `@sentry/react`, `dompurify`, `@playwright/test`, `@vitest/coverage-v8`

### ⚡ Performance (P2)

- **ADDED** : 14 nouveaux index SQL (`association_id`, `membre_id`, `statut`)
- **ADDED** : `manualChunks` Vite (8 chunks vendor séparés)
- **ADDED** : Factory centralisée query keys (`src/lib/queryKeys.ts`)

### 💻 Qualité du code (P2)

- **ADDED** : Helper `sanitizeHtml` avec DOMPurify (`src/lib/sanitize.ts`)
- **FIXED** : Doublon `getErrorMessage` unifié (re-export depuis `lib/errors.ts`)
- **FIXED** : `dangerouslySetInnerHTML` dans `NotificationsTemplatesAdmin.tsx` sécurisé avec DOMPurify

### 🧪 Tests (P0/P3)

- **ADDED** : `src/test/setup.ts` — setup Vitest (matchMedia, IntersectionObserver, env stubs)
- **ADDED** : `src/test/security/rls.test.ts` — 30+ tests RLS
- **ADDED** : `src/test/security/setup-personae.ts` — gestion personae
- **ADDED** : Tests unitaires (`sanitize.test.ts`, `queryKeys.test.ts`, `errors.test.ts`)
- **ADDED** : Configuration Playwright + 6 tests E2E (`tests/e2e/smoke.spec.ts`)

### 🚀 DevOps & Observabilité (P2/P3)

- **ADDED** : `Dockerfile` multi-stage (Bun build → Nginx alpine, healthcheck, security headers)
- **ADDED** : `docker-compose.yml` (dev + prod preview)
- **ADDED** : Edge function `health` (endpoint `/health` : postgres + auth + env checks)
- **ADDED** : `src/lib/sentry.ts` — initialisation Sentry + PII scrubbing
- **ADDED** : `docs/BACKUP_RESTORE.md` — procédure backup/restore documentée
- **ADDED** : `docs/ROLLBACK.md` — procédure rollback documentée

### 📖 Documentation (P3)

- **REWRITTEN** : `README.md` complet (badges, stack, scripts, architecture, sécurité, déploiement)
- **FIXED** : `index.html` — `lang="fr"`, `theme-color`, preconnect Supabase, `og:locale=fr_FR`
- **ADDED** : `GUIDE_DEPLOIEMENT_SIMPLE.md` — guide pas-à-pas pour non-techniciens
- **ADDED** : `.env.example` avec documentation des variables
- **ADDED** : `LICENSE` (MIT)

### 🔧 Configuration (P1/P2)

- **ADDED** : `vercel.json` avec headers de sécurité (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- **ADDED** : Cache immutable pour assets Vercel
- **UPDATED** : `.gitignore` — `.env*` exclu (sauf `.env.example`)
- **UPDATED** : `supabase/config.toml` — `verify_jwt=true` sur 17/19 edge functions
- **ADDED** : CORS restreint au domaine E2D (`ALLOWED_ORIGIN`) sur toutes les edge functions

### 📊 Migration SQL

- **ADDED** : `supabase/migrations/20260722000001_remediation_audit_p0_p1.sql` (444 lignes)
  - Fonction `get_current_association_id()` server-validé
  - Fonction `is_admin(uuid)` tenant-aware
  - Fonctions `has_role(text)` et `has_role(uuid, text)` tenant-aware
  - RLS policies durcies sur 27 tables core
  - Storage policies `members-photos` owner-only
  - Tables `secret_configs`, `contact_rate_limits`, `health_checks`
  - RPC `set_secret_config` / `get_secret_config` (pgcrypto)
  - 14 nouveaux index
  - Trigger `invalidate_user_sessions_on_desactivate` restauré

## [4.0.0] — 2026-06-19

- Version initiale Phase 6 (audit : 53/100)

---

[4.1.0]: https://github.com/e2d/e2d-connect-gateway/releases/tag/v4.1.0
[4.0.0]: https://github.com/e2d/e2d-connect-gateway/releases/tag/v4.0.0
