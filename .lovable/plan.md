# E2D Connect Gateway — Lovable Project Context

## Project Overview

**Name:** E2D Connect Gateway
**Version:** 4.1.0
**Type:** SaaS multi-association platform (sport + tontine + CMS)
**Audit Score:** 99/100 — APPROVED FOR PRODUCTION

## Tech Stack

- **Frontend:** React 18.3 + Vite 5.4 + TypeScript 5.8 (strict mode)
- **Backend:** Supabase (PostgreSQL 15 + Auth + Storage + Edge Functions Deno)
- **UI:** Tailwind CSS 3.4 + shadcn/ui (Radix primitives)
- **State:** TanStack Query 5.83 + Context API
- **Forms:** react-hook-form 7.61 + zod 3.25
- **Routing:** react-router-dom 6.30

## Project Structure

```
src/
├── pages/              # 16 pages (public + admin + member)
├── components/         # 163 components (auth, admin, loans, ui, donations, etc.)
├── hooks/              # 38 domain hooks
├── contexts/           # AuthContext (RBAC, sessions, timeout)
├── lib/                # Utils, validation, services, sentry, sanitize, queryKeys
├── types/              # TypeScript types
├── integrations/supabase/  # Supabase client + generated types (5787 lines)
└── test/               # Tests RLS + setup

supabase/
├── migrations/         # 131 SQL migrations
├── functions/          # 19 Edge Functions (Deno)
└── config.toml         # verify_jwt=true on sensitive functions
```

## Key Architectural Decisions

1. **Multi-tenant isolation** via `association_id` + server-validated `get_current_association_id()`
2. **RBAC** with 7 roles: super_admin, administrateur, tresorier, secretaire_general, secretaire, membre, public
3. **RLS** on 71 tables, intra-tenant strict policies
4. **Secrets** externalized via `.env.local`, SMTP/Resend encrypted via pgcrypto
5. **TypeScript strict** mode enabled (no implicit any, strict null checks)

## Lovable Continuity Notes

### What Lovable can safely modify
- `src/pages/` — add/edit React pages
- `src/components/` — add/edit components
- `src/hooks/` — add/edit domain hooks
- `src/lib/` — utility functions
- `supabase/functions/` — Edge Functions (Deno)
- `supabase/migrations/` — SQL migrations (timestamped, idempotent)

### What requires careful attention
- `src/integrations/supabase/types.ts` — auto-generated from Supabase schema (regenerate with `supabase gen types`)
- `src/contexts/AuthContext.tsx` — central auth logic, do not break RBAC
- `supabase/migrations/20260722000001_remediation_audit_p0_p1.sql` — security migration, do not modify
- `.env.local` — never commit, contains secrets
- `supabase/config.toml` — `verify_jwt` flags, do not disable on sensitive functions

### Build & Test Commands
```bash
bun install          # Install dependencies
bun run dev          # Dev server (port 8080)
bun run build        # tsc --noEmit && vite build
bun run lint         # ESLint
bun run typecheck    # tsc --noEmit
bun run test         # Vitest unit tests
bun run test:rls     # RLS security tests (needs Supabase secrets)
bun run test:e2e     # Playwright E2E tests
```

### Environment Variables (in .env.local)
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase anon key
- `VITE_SENTRY_DSN` — Sentry DSN (optional)
- `VITE_CAPTCHA_SITE_KEY` — hCaptcha/Turnstile site key (optional)

### Known Technical Debt (documented in TECH_UPGRADE_PLAN.md)
1. `xlsx@0.18.5` still used in 8 files — migration to `exceljs` planned (Semester 2)
2. `heic2any@0.0.4` unmaintained — replacement planned
3. `queryKeys.ts` factory created but not yet wired to all 38 hooks
4. `select-columns.ts` helper created but `select('*')` not yet fully migrated

### CI/CD
- GitHub Actions workflow: `.github/workflows/ci.yml`
- 6 jobs: quality (lint+typecheck+build), unit-tests, security-audit, rls-tests, e2e-tests, deploy
- Auto-deploy to Vercel on push to `main`

### Deployment
- Frontend: Vercel (auto-deploy from GitHub)
- Backend: Supabase (migrations via `supabase db push`, functions via `supabase functions deploy`)
- Docker: `Dockerfile` + `docker-compose.yml` available

## Contact

For questions about this project, refer to:
- `README.md` — main documentation
- `RAPPORT_REMEDIATION_E2D.md` — detailed remediation report
- `GUIDE_EXPRESS_COMPTES_EXISTANTS.md` — quick deployment guide
- `docs/` — technical documentation
