# 🚀 GUIDE DE DÉPLOIEMENT — Mode Simple

> **Vous n'avez aucune compétence technique ? Ce guide est pour vous.**
> Suivez les étapes dans l'ordre. En 30 minutes, votre site sera en ligne.

---

## 📋 Ce dont vous avez besoin avant de commencer

Avant de commencer, créez ces 3 comptes gratuits (ils sont tous gratuits et sécurisés) :

| # | Service | Pour quoi faire | Lien d'inscription |
|---|---------|-----------------|-------------------|
| 1️⃣ | **GitHub** | Héberger votre code (gratuit, privé possible) | [github.com/signup](https://github.com/signup) |
| 2️⃣ | **Vercel** | Mettre votre site en ligne gratuitement | [vercel.com/signup](https://vercel.com/signup) |
| 3️⃣ | **Supabase** | Base de données + authentification | [supabase.com](https://supabase.com) |

> 💡 **Conseil** : Utilisez le bouton "Sign up with GitHub" sur Vercel et Supabase pour éviter de créer d'autres mots de passe.

---

## ÉTAPE 1 — Récupérer le projet (5 minutes)

### Option A : Vous avez le fichier ZIP

1. **Décompressez** le fichier `E2D_CONNECT_GATEWAY_FINAL.zip` sur votre ordinateur
2. Vous obtenez un dossier `E2D/`

### Option B : Cloner depuis GitHub

Si quelqu'un a déjà mis le projet sur GitHub :
```bash
git clone https://github.com/VOTRE-COMPTE/E2D.git
```

---

## ÉTAPE 2 — Créer votre base de données Supabase (10 minutes)

1. **Allez sur** [supabase.com](https://supabase.com) et connectez-vous

2. **Cliquez sur** "New Project" (Nouveau projet)

3. **Remplissez le formulaire :**
   - **Name** (Nom) : `e2d-connect` (ou ce que vous voulez)
   - **Database Password** : Cliquez sur "Generate a password" puis **COPIEZ CE MOT DE PASSE** dans un endroit sûr (Bloc-notes)
   - **Region** (Région) : Choisissez la plus proche de vos utilisateurs (ex: `West Europe (Frankfurt)` pour l'Europe, `West US` pour l'Afrique de l'Ouest)
   - **Pricing Plan** : laissez "Free" (Gratuit)

4. **Cliquez sur** "Create new project" — attendez 2-3 minutes

5. **Récupérez vos clés** (très important) :
   - Allez dans le menu de gauche → **Project Settings** (⚙️ en bas)
   - Cliquez sur **API**
   - Vous voyez 2 informations essentielles :
     - **Project URL** : `https://xxxxx.supabase.co` → **COPIEZ**
     - **anon public** key : `eyJhbGc...` → **COPIEZ**

> ⚠️ **NE JAMAIS** copier la clé `service_role` — elle est secrète et ne doit jamais être dans le code.

6. **Créez les tables de la base de données** :
   - Allez dans le menu de gauche → **SQL Editor**
   - Cliquez sur "New query"
   - Ouvrez le fichier `FRESH_INSTALL_COMPLETE.sql` à la RACINE de votre projet avec le Bloc-notes
   - **Copiez tout le contenu** et collez-le dans le SQL Editor
   - Cliquez sur **RUN** (Exécuter)
   - Vous devriez voir "Success" ✅

---

## ÉTAPE 3 — Configurer les variables d'environnement (3 minutes)

1. **Dans le dossier du projet**, trouvez le fichier `.env.example`

2. **Copiez ce fichier** et renommez la copie en `.env.local`

3. **Ouvrez `.env.local`** avec le Bloc-notes (ou VS Code) et remplacez les valeurs :

```bash
# Remplacez par VOTRE URL Supabase (de l'étape 2)
VITE_SUPABASE_URL=https://votre-projet.supabase.co

# Remplacez par VOTRE clé anon (de l'étape 2)
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGc...votre-clé-anon...

# Les autres lignes peuvent rester vides pour commencer
VITE_APP_NAME=E2D Connect Gateway
VITE_APP_VERSION=4.1.0
VITE_APP_ENV=production
```

4. **Sauvegardez** le fichier

> ✅ Ce fichier `.env.local` est automatiquement ignoré par Git — vos secrets ne seront jamais envoyés sur GitHub.

---

## ÉTAPE 4 — Mettre le projet sur GitHub (5 minutes)

### 4.1 — Créer un nouveau dépôt sur GitHub

1. **Allez sur** [github.com](https://github.com) et connectez-vous
2. **Cliquez sur** le bouton vert **"New"** (ou le `+` en haut à droite → "New repository")
3. **Remplissez :**
   - **Repository name** : `E2D`
   - **Description** : `Plateforme de gestion multi-associations`
   - **Public** ou **Private** (comme vous préférez)
   - ❌ **NE COCHEZ PAS** "Add a README", "Add .gitignore", "Choose a license" (ils existent déjà dans le projet)
4. **Cliquez sur** "Create repository"

### 4.2 — Envoyer le code sur GitHub

**Méthode simple (sans ligne de commande) :**

1. Sur la page de votre nouveau dépôt GitHub, cliquez sur **"uploading an existing file"**
2. **Glissez-déposez tous les fichiers** de votre dossier `E2D/` (SAUF le dossier `node_modules/` si vous l'avez, et le fichier `.env.local`)
3. En bas, écrivez un message : "Initial commit"
4. **Cliquez sur** "Commit changes"

> ⚠️ **VÉRIFIEZ BIEN** : le fichier `.env.local` ne doit PAS être envoyé sur GitHub. Le fichier `.gitignore` s'en charge automatiquement, mais avec l'upload web, vérifiez manuellement.

**Méthode pro (avec Git en ligne de commande) :**

```bash
cd E2D
git init
git add .
git commit -m "Initial commit - E2D Connect Gateway v4.1.0"
git branch -M main
git remote add origin https://github.com/VOTRE-COMPTE/E2D.git
git push -u origin main
```

---

## ÉTAPE 5 — Déployer sur Vercel (5 minutes)

1. **Allez sur** [vercel.com](https://vercel.com) et connectez-vous (avec GitHub)

2. **Cliquez sur** "Add New..." → "Project"

3. **Importez votre dépôt** GitHub : cliquez sur `E2D`

4. **Configurez le déploiement** :
   - **Framework Preset** : Vite (détecté automatiquement)
   - **Build Command** : `bun run build` (déjà configuré)
   - **Output Directory** : `dist` (déjà configuré)

5. **Ajoutez les variables d'environnement** (très important) :
   - Déployez vers la section "Environment Variables"
   - Ajoutez ces 2 variables (mêmes valeurs que dans `.env.local`) :

   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | `https://votre-projet.supabase.co` |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | `eyJhbGc...votre-clé-anon...` |

6. **Cliquez sur** "Deploy" (Déployer)

7. **Patientez 2-3 minutes** ⏳ — Vercel compile et déploie votre site

8. **🎉 BRAVO !** Votre site est en ligne à l'adresse :
   `https://e2d-votre-nom.vercel.app`

---

## ÉTAPE 6 — Vérifier que tout fonctionne (2 minutes)

1. **Ouvrez votre site** à l'URL Vercel
2. Vous devriez voir la **page d'accueil** de E2D Connect Gateway
3. **Testez la connexion** :
   - Allez sur `/auth` (page de connexion)
   - Créez un compte avec votre email
   - Vérifiez que vous recevez l'email de confirmation

> 💡 Si ça ne marche pas, voir la section "Problèmes courants" ci-dessous.

---

## 🔄 Mises à jour futures

Quand vous voulez modifier le site :

1. Modifiez les fichiers sur votre ordinateur
2. Envoyez les changements sur GitHub (même méthode qu'étape 4.2)
3. **Vercel détecte automatiquement** le changement et redéploie en 2 minutes
4. Votre site est à jour !

---

## ❓ Problèmes courants et solutions

### Problème : "Page blanche" après déploiement

**Solution :** Vous avez oublié les variables d'environnement sur Vercel.
1. Allez sur Vercel → votre projet → Settings → Environment Variables
2. Ajoutez `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY`
3. Redéployez : Deployments → les 3 points `...` → Redeploy

### Problème : "Erreur de connexion à la base de données"

**Solution :** Vérifiez que vous avez bien exécuté le SQL dans Supabase (étape 2.6).

### Problème : "Invalid API key"

**Solution :** Vérifiez que vous avez copié la clé `anon` (pas `service_role`).

### Problème : Emails ne partent pas

**Solution :** C'est normal. Il faut configurer SMTP ou Resend.
1. Créez un compte sur [resend.com](https://resend.com) (gratuit, 3000 emails/mois)
2. Récupérez votre API key
3. Dans Supabase → SQL Editor, exécutez :
```sql
SELECT public.set_secret_config('resend_api_key', 'VOTRE_CLE_RESEND', 'Clé Resend');
```

---

## 📞 Besoin d'aide ?

| Ressource | Lien |
|-----------|------|
| 📖 Documentation complète | `README.md` dans le projet |
| 🔧 Rapport technique détaillé | `RAPPORT_REMEDIATION_E2D.md` |
| 📊 Tableau de bord d'audit | `DASHBOARD_AUDIT.html` (ouvrir dans un navigateur) |
| 🆘 Supabase Support | [supabase.com/docs](https://supabase.com/docs) |
| 🆘 Vercel Support | [vercel.com/docs](https://vercel.com/docs) |

---

## ✅ Checklist finale

Avant de considérer que tout est terminé, vérifiez ces points :

- [ ] Compte GitHub créé
- [ ] Compte Vercel créé (lié à GitHub)
- [ ] Compte Supabase créé
- [ ] Projet Supabase créé + URL et clé anon récupérées
- [ ] SQL exécuté dans Supabase (tables créées)
- [ ] Fichier `.env.local` créé avec vos valeurs
- [ ] Code envoyé sur GitHub (sans `.env.local`)
- [ ] Projet importé sur Vercel
- [ ] Variables d'environnement ajoutées sur Vercel
- [ ] Déploiement réussi
- [ ] Site accessible en ligne
- [ ] Création de compte test fonctionne

**🎉 Félicitations ! Votre plateforme E2D Connect Gateway est en production.**

---

*Dernière mise à jour : Juillet 2026 · Version 4.1.0*
