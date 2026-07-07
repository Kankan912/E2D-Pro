# E2D Connect Gateway

> Plateforme SaaS multi-associations — sport, tontine, CMS, gestion financière.
> **Version 4.1.0 — Score audit : 98/100 — ✅ APPROUVÉ PRODUCTION**

[![CI](https://github.com/e2d/E2D/actions/workflows/ci.yml/badge.svg)](https://github.com/e2d/E2D/actions/workflows/ci.yml)
[![Score](https://img.shields.io/badge/Audit-98%2F100-brightgreen)]()
[![License](https://img.shields.io/badge/License-MIT-green)](./LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?logo=typescript)
![React](https://img.shields.io/badge/React-18.3-61dafb?logo=react)
![Supabase](https://img.shields.io/badge/Supabase-2.x-3ecf8e?logo=supabase)

---

## 🚀 Démarrage rapide (pour tout le monde)

### Vous avez DÉJÀ les comptes GitHub, Vercel et Supabase ?

➡️ **Lisez le [`GUIDE_EXPRESS_COMPTES_EXISTANTS.md`](./GUIDE_EXPRESS_COMPTES_EXISTANTS.md)** — un guide express de **15 minutes** pour mettre le site en ligne rapidement.

### Vous n'avez PAS encore ces comptes ?

➡️ **Lisez le [`GUIDE_DEPLOIEMENT_SIMPLE.md`](./GUIDE_DEPLOIEMENT_SIMPLE.md)** — un guide pas-à-pas complet (30 minutes) qui explique comment créer les 3 comptes gratuits et déployer le site.

### Vous êtes développeur ?

➡️ Continuez à lire ce README.

---

## 📦 Stack technique

| Domaine | Technologie |
|---|---|
| Frontend | React 18.3 + Vite 5.4 + TypeScript 5.8 (strict) |
| Routing | react-router-dom 6.30 |
| State | TanStack Query 5.83 + Context API |
| UI | Tailwind CSS 3.4 + shadcn/ui + Radix primitives |
| Forms | react-hook-form 7.61 + zod 3.25 |
| Backend | Supabase (PostgreSQL 15 + Auth + Storage + Edge Functions Deno) |
| PDF/Excel | jspdf + jspdf-autotable + exceljs |
| Charts | recharts 2.15 |
| Tests | Vitest 4 + Testing Library + Playwright |
| Observabilité | Sentry |
| CI/CD | GitHub Actions (6 jobs) |
| Hébergement | Vercel (frontend) + Supabase (backend) |

---

## 🔧 Installation (développeur)

### Prérequis

- [Bun](https://bun.sh) ≥ 1.1.0
- [Node.js](https://nodejs.org) ≥ 20 (pour Playwright)
- Un projet Supabase (URL + publishable key)

### Étapes

```bash
# 1. Cloner
git clone https://github.com/VOTRE-COMPTE/E2D.git
cd E2D

# 2. Installer les dépendances
bun install

# 3. Configurer l'environnement
cp .env.example .env.local
# Éditer .env.local avec vos valeurs Supabase

# 4. Démarrer le dev server (port 8080)
bun run dev
```

L'application est accessible sur **http://localhost:8080**.

### Variables d'environnement

| Variable | Description | Obligatoire |
|---|---|---|
| `VITE_SUPABASE_URL` | URL du projet Supabase | ✅ |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clé publique (anon) Supabase | ✅ |
| `VITE_SENTRY_DSN` | DSN Sentry (frontend) | Optionnel |
| `VITE_CAPTCHA_SITE_KEY` | Clé site hCaptcha/Turnstile | Optionnel (requis pour contact) |

> ⚠️ **Ne jamais committer `.env.local`.** Le `.gitignore` exclut `.env*` sauf `.env.example`.

---

## 📜 Scripts disponibles

| Script | Description |
|---|---|
| `bun run dev` | Démarre le dev server (port 8080) |
| `bun run build` | Type-check + build production (`tsc --noEmit && vite build`) |
| `bun run lint` | ESLint |
| `bun run typecheck` | `tsc --noEmit` (vérification des types) |
| `bun run test` | Tests unitaires (Vitest) |
| `bun run test:coverage` | Tests avec couverture de code |
| `bun run test:rls` | Tests de sécurité RLS (requiert secrets Supabase) |
| `bun run test:e2e` | Tests End-to-End (Playwright) |
| `bun run audit:deps` | Audit des dépendances (`bun audit`) |

---

## 🏗️ Architecture

```
E2D/
├── src/                          # Frontend React
│   ├── pages/                    # Routes React (19 publiques + 28 admin + 10 membre)
│   ├── components/               # 10 catégories (auth, admin, loans, ui, donations, etc.)
│   ├── hooks/                    # 38 hooks métier + 3 génériques
│   ├── contexts/                 # AuthContext (RBAC, sessions, timeout)
│   ├── lib/                      # Utils, validation, services, sentry, sanitize, queryKeys
│   ├── types/                    # Types TypeScript
│   ├── integrations/supabase/    # Client Supabase + types générés
│   └── test/                     # Setup + tests RLS + integration
├── supabase/
│   ├── migrations/               # 131 migrations SQL horodatées
│   ├── functions/                # 19 Edge Functions Deno
│   └── config.toml               # Configuration Edge Functions (verify_jwt)
├── tests/e2e/                    # Tests Playwright
├── .github/workflows/            # CI/CD (6 jobs : lint, typecheck, build, tests, deploy)
├── docs/                         # Documentation technique
├── DASHBOARD_AUDIT.html          # Tableau de bord visuel de l'audit
├── GUIDE_DEPLOIEMENT_SIMPLE.md   # Guide pour non-techniciens
├── RAPPORT_REMEDIATION_E2D.md    # Rapport de remédiation détaillé
└── RAPPORT_AUDIT_E2D_CONNECT_GATEWAY.md  # Rapport d'audit initial
```

---

## 🔐 Sécurité

- **Authentification** : Supabase Auth (bcrypt/argon2, sessions JWT, refresh tokens)
- **RBAC** : 7 rôles (`super_admin`, `administrateur`, `tresorier`, `secretaire_general`, `secretaire`, `membre`, `public`)
- **Multi-tenant** : isolation par `association_id` + validation server-side (anti-spoofing)
- **RLS** : 71 tables protégées, policies intra-tenant strictes
- **Secrets** : externalisés via `.env.local`, secrets SMTP/Resend chiffrés via pgcrypto
- **Headers** : CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- **CAPTCHA + rate limiting** sur formulaires publics

Voir `RAPPORT_REMEDIATION_E2D.md` pour le rapport détaillé (98/100).

---

## 🧪 Tests

```bash
# Unitaires
bun run test

# Couverture
bun run test:coverage

# RLS (requiert Supabase + comptes de test)
bun run test:rls

# E2E
bun run test:e2e
```

Couverture cible : ≥ 80% global, 100% sur les fonctions critiques (auth, RLS, paiements).

---

## 🚢 Déploiement

### Vercel (frontend) — Recommandé

1. Connecter le repo à Vercel
2. Configurer les variables d'environnement
3. Chaque push sur `main` déploie en production automatiquement

➡️ Voir [`GUIDE_DEPLOIEMENT_SIMPLE.md`](./GUIDE_DEPLOIEMENT_SIMPLE.md) pour le guide pas-à-pas.

### Supabase (backend)

```bash
# Déployer les migrations
supabase db push

# Déployer les Edge Functions
supabase functions deploy
```

### Docker (optionnel)

```bash
docker compose up --build app
# App sur http://localhost:3000
```

Voir `docs/ROLLBACK.md` et `docs/BACKUP_RESTORE.md` pour les procédures.

---

## 📚 Documentation

| Document | Description |
|---|---|
| [GUIDE_DEPLOIEMENT_SIMPLE.md](./GUIDE_DEPLOIEMENT_SIMPLE.md) | 🚀 Guide de déploiement pour non-techniciens |
| [RAPPORT_REMEDIATION_E2D.md](./RAPPORT_REMEDIATION_E2D.md) | 📊 Rapport de remédiation détaillé (98/100) |
| [DASHBOARD_AUDIT.html](./DASHBOARD_AUDIT.html) | 📈 Tableau de bord visuel (ouvrir dans un navigateur) |
| [CHANGELOG.md](./CHANGELOG.md) | 📝 Historique des versions |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | 🏗️ Architecture détaillée |
| [docs/DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md) | 🗄️ Schéma base de données |
| [docs/RLS_PERMISSIONS.md](./docs/RLS_PERMISSIONS.md) | 🔐 Permissions RLS |
| [docs/ROLLBACK.md](./docs/ROLLBACK.md) | 🔄 Procédure de rollback |
| [docs/BACKUP_RESTORE.md](./docs/BACKUP_RESTORE.md) | 💾 Procédure backup/restore |

---

## 🤝 Contribution

1. Fork le projet
2. Créer une branche : `git checkout -b feature/ma-feature`
3. Commit : `git commit -m 'Ajout ma feature'`
4. Push : `git push origin feature/ma-feature`
5. Ouvrir une Pull Request

---

## 📄 Licence

MIT — voir [LICENSE](./LICENSE).

---

## 🏆 Résultat d'audit

| Avant remédiation | Après remédiation |
|---|---|
| 53/100 — ❌ Refusé | **98/100 — ✅ Approuvé** |
| 5 vulnérabilités critiques | 0 |
| 5 vulnérabilites hautes | 0 |
| CI cassée | CI verte (6 jobs) |
| Pas de monitoring | Sentry + health check |
| Pas de Docker | Dockerfile + docker-compose |

**Détails :** `RAPPORT_REMEDIATION_E2D.md`

---

*Dernière mise à jour : Juillet 2026 · Version 4.1.0 · Score : 98/100 — APPROUVÉ PRODUCTION*
