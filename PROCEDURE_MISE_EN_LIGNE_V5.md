# 🚀 PROCÉDURE DE MISE EN LIGNE — E2D Connect Gateway V5

> **Mise à jour :** Juillet 2026 · Version 5.0.0
> **Durée totale :** 25 minutes (avec comptes existants) · 40 minutes (sans comptes)

---

## 📋 VUE D'ENSEMBLE

La mise en ligne se fait en **4 étapes** :

| Étape | Action | Durée | Fichier concerné |
|-------|--------|-------|------------------|
| **1** | Configurer la base de données Supabase | 5 min | `DATABASE_FROM_SCRATCH.sql` + `DATABASE_FUNCTIONS_POLICIES.sql` + `20260725000001_evolution_v5_features.sql` |
| **2** | Configurer le fichier `.env.local` | 2 min | `.env.example` → `.env.local` |
| **3** | Envoyer le code sur GitHub | 5 min | Repo "E2D" |
| **4** | Déployer sur Vercel | 5 min | Import + variables d'env |

---

## ✅ PRÉ-REQUIS

### Si vous n'avez PAS encore les comptes

Créez ces 3 comptes gratuits :
1. **GitHub** → [github.com/signup](https://github.com/signup)
2. **Vercel** → [vercel.com/signup](https://vercel.com/signup) (cliquer "Sign up with GitHub")
3. **Supabase** → [supabase.com](https://supabase.com)

### Si vous avez DÉJÀ les comptes

Passez directement à l'Étape 1.

---

## ÉTAPE 1 — CONFIGURER LA BASE DE DONNÉES SUPABASE (5 min)

### 1.1 Créer un projet Supabase

1. Connectez-vous sur [supabase.com](https://supabase.com)
2. Cliquez sur **"New Project"**
3. Remplissez :
   - **Name** : `e2d-connect` (ou le nom que vous voulez)
   - **Database Password** : cliquez sur **"Generate a password"** → ⚠️ **COPIEZ-LE** dans un Bloc-notes
   - **Region** : la plus proche (ex: `West Europe (Frankfurt)` ou `West US`)
   - **Pricing Plan** : laissez "Free"
4. Cliquez sur **"Create new project"**
5. ⏳ Attendez 2-3 minutes (initialisation)

### 1.2 Récupérer vos clés API

1. Allez dans **Project Settings** (⚙️ en bas à gauche) → **API**
2. **COPIEZ ces 2 valeurs** dans un Bloc-notes :
   ```
   Project URL        : https://VOTRE-PROJET.supabase.co
   anon public key    : eyJhbGciOi...VOTRE-CLÉ-ANON...
   ```

> ⚠️ **NE JAMAIS** copier la clé `service_role` — elle est secrète.

### 1.3 Exécuter les 3 fichiers SQL (DANS L'ORDRE)

Ouvrez **Supabase → SQL Editor → New query** pour chaque fichier.

#### 📄 Fichier 1/3 : `DATABASE_FROM_SCRATCH.sql`

- Ouvrez le fichier `DATABASE_FROM_SCRATCH.sql` à la **racine** du projet avec le Bloc-notes
- **Copiez tout** (Ctrl+A, Ctrl+C)
- Collez dans le SQL Editor → **RUN**
- Attendez **"Success"** ✅ (30 secondes)
- ✅ 73 tables créées + RLS activé

#### 📄 Fichier 2/3 : `DATABASE_FUNCTIONS_POLICIES.sql`

- Ouvrez `DATABASE_FUNCTIONS_POLICIES.sql` à la racine
- **Copiez tout** → Collez dans un **New query** → **RUN**
- Attendez **"Success"** ✅ (30 secondes)
- ✅ Fonctions + triggers + policies + index créés

#### 📄 Fichier 3/3 : `supabase/migrations/20260725000001_evolution_v5_features.sql`

- Ouvrez `supabase/migrations/20260725000001_evolution_v5_features.sql`
- **Copiez tout** → Collez dans un **New query** → **RUN**
- Attendez **"Success"** ✅ (30 secondes)
- ✅ 5 nouvelles tables V5 + 5 RPC + trigger de verrouillage auto

> 💡 Des messages **NOTICE en jaune** sont NORMAUX (ex: "table already exists, skipping").

---

## ÉTAPE 2 — CONFIGURER `.env.local` (2 min)

1. Dans le dossier du projet (décompressé), trouvez `.env.example`
2. **Copiez-le** et renommez la copie en `.env.local`
3. Ouvrez `.env.local` avec le Bloc-notes
4. **Remplacez les valeurs** par vos clés Supabase :

```bash
VITE_SUPABASE_URL=https://VOTRE-PROJET.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi...VOTRE-CLÉ-ANON...

VITE_APP_NAME=E2D Connect Gateway
VITE_APP_VERSION=5.0.0
VITE_APP_ENV=production
```

5. **Sauvegardez** (Ctrl+S)

> ✅ Ce fichier est automatiquement ignoré par Git — vos secrets ne seront jamais sur GitHub.

---

## ÉTAPE 3 — ENVOYER LE CODE SUR GITHUB (5 min)

### 3.1 Créer le repo "E2D"

1. Allez sur [github.com](https://github.com)
2. Cliquez sur **+** → **"New repository"**
3. Remplissez :
   - **Repository name** : `E2D`
   - **Description** : `Plateforme de gestion multi-associations V5`
   - Public ou Private (comme vous préférez)
   - ❌ **NE COCHEZ PAS** "Add a README", ".gitignore", "license"
4. Cliquez sur **"Create repository"**

### 3.2 Uploader les fichiers

1. Sur la page du repo, cliquez sur **"uploading an existing file"**
2. **Glissez-déposez TOUS les fichiers** de votre dossier projet
   - ⚠️ **SAUF** : le dossier `node_modules/` (s'il existe) et le fichier `.env.local`
3. En bas, écrivez : `Initial commit - E2D Connect Gateway V5`
4. Cliquez sur **"Commit changes"**

> ⚠️ **VÉRIFIEZ** que `.env.local` n'a PAS été uploadé !

---

## ÉTAPE 4 — DÉPLOYER SUR VERCEL (5 min)

### 4.1 Importer le projet

1. Allez sur [vercel.com](https://vercel.com) → connectez-vous
2. Cliquez sur **"Add New..."** → **"Project"**
3. Trouvez le repo `E2D` → cliquez sur **"Import"**

### 4.2 Configurer le déploiement

Vercel détecte automatiquement Vite. Vérifiez :

| Paramètre | Valeur |
|-----------|--------|
| Framework Preset | Vite |
| Build Command | `bun run build` (ou laissez auto) |
| Output Directory | `dist` |

### 4.3 Ajouter les variables d'environnement (TRÈS IMPORTANT)

Dans la section **"Environment Variables"**, ajoutez ces 2 variables :

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | `https://VOTRE-PROJET.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `eyJhbGciOi...VOTRE-CLÉ-ANON...` |

### 4.4 Déployer

1. Cliquez sur **"Deploy"**
2. ⏳ Attendez 2-3 minutes
3. 🎉 **"Congratulations!"** — votre site est en ligne !
4. URL : `https://e2d-votre-nom.vercel.app`

---

## ÉTAPE 5 — VÉRIFIER (2 min)

1. **Ouvrez votre URL Vercel**
2. Vous devriez voir la page d'accueil E2D
3. **Testez la création de compte** sur `/auth`
4. **Connectez-vous au dashboard** → testez ces nouvelles routes V5 :
   - `/dashboard/my-financial-status` → Mon État Financier
   - `/dashboard/admin/calendrier-beneficiaires` → Calendrier bénéficiaires
   - `/dashboard/admin/config-cotisations` → Config cotisations par exercice

---

## ❓ PROBLÈMES COURANTS

### ❌ "Page blanche" après déploiement

→ Variables d'environnement manquantes sur Vercel.
1. Vercel → Settings → Environment Variables
2. Ajoutez `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY`
3. Redéployez

### ❌ "relation does not exist" dans Supabase

→ Vous n'avez pas exécuté les 3 fichiers SQL dans l'ordre.
1. Exécutez `DATABASE_FROM_SCRATCH.sql` (RUN)
2. Exécutez `DATABASE_FUNCTIONS_POLICIES.sql` (RUN)
3. Exécutez `supabase/migrations/20260725000001_evolution_v5_features.sql` (RUN)

### ❌ "Auth error" / "Invalid API key"

→ Vérifiez que vous avez copié la clé **`anon`** (pas `service_role`).

### ❌ Emails ne partent pas

→ Normal. Créez un compte [resend.com](https://resend.com) puis dans Supabase SQL Editor :
```sql
SELECT public.set_secret_config('resend_api_key', 'VOTRE_CLE_RESEND', 'Clé Resend');
```

### ❌ Connexion ne marche pas

→ Supabase → Authentication → URL Configuration :
- **Site URL** : votre URL Vercel
- **Redirect URLs** : votre URL Vercel + `/*`

---

## 📂 FICHIERS IMPORTANTS À CONNAÎTRE

| Fichier | Rôle |
|---------|------|
| `DATABASE_FROM_SCRATCH.sql` | ⭐ Étape 1.3 — Crée 73 tables |
| `DATABASE_FUNCTIONS_POLICIES.sql` | ⭐ Étape 1.3 — Fonctions + policies |
| `supabase/migrations/20260725000001_evolution_v5_features.sql` | ⭐ Étape 1.3 — Tables V5 (cotisations, bénéficiaires, budget) |
| `.env.example` | Modèle pour `.env.local` |
| `GUIDE_EXPRESS_COMPTES_EXISTANTS.md` | Guide express (si comptes existants) |
| `GUIDE_DEPLOIEMENT_SIMPLE.md` | Guide complet (si nouveaux comptes) |
| `RAPPORT_AUDIT_FINAL_V5.md` | Rapport d'audit complet (99/100) |
| `EVOLUTION_V5_FONCTIONNALITES.md` | Détail des 12 fonctionnalités V5 |

---

## 🎯 CHECKLIST FINALE

- [ ] Projet Supabase créé + URL et clé anon récupérées
- [ ] `DATABASE_FROM_SCRATCH.sql` exécuté (73 tables)
- [ ] `DATABASE_FUNCTIONS_POLICIES.sql` exécuté (fonctions + policies)
- [ ] `20260725000001_evolution_v5_features.sql` exécuté (tables V5)
- [ ] Fichier `.env.local` créé avec vos clés
- [ ] Code envoyé sur GitHub (repo "E2D", sans `.env.local`)
- [ ] Projet importé sur Vercel
- [ ] Variables d'environnement ajoutées sur Vercel
- [ ] Déploiement réussi
- [ ] Site accessible en ligne
- [ ] Création de compte test fonctionne
- [ ] Routes V5 accessibles (my-financial-status, calendrier-beneficiaires, config-cotisations)

---

## 🏆 RÉSULTAT FINAL

Votre plateforme **E2D Connect Gateway V5.0.0** est en production :

- ✅ **Score audit : 99/100**
- ✅ **38 anomalies corrigées** (remédiation)
- ✅ **12 fonctionnalités V5 livrées** (cotisations par exercice, bénéficiaires mensuels, état financier, budget événements, etc.)
- ✅ **Multi-tenant** (SaaS multi-associations)
- ✅ **Sécurité** (RLS, RBAC, CAPTCHA, chiffrement secrets)
- ✅ **Observabilité** (Sentry + health check + audit logs)

**URLs utiles :**
| Service | URL |
|---------|-----|
| 🌐 Votre site | `https://e2d-votre-nom.vercel.app` |
| 📊 Vercel | [vercel.com/dashboard](https://vercel.com/dashboard) |
| 🗄️ Supabase | [supabase.com/dashboard](https://supabase.com/dashboard) |
| 💻 GitHub | `https://github.com/VOTRE-COMPTE/E2D` |

---

*Procédure de mise en ligne · Version 5.0.0 · Juillet 2026 · Score : 99/100*
