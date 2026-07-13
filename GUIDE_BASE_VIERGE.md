# 🗄️ Configuration Base de Données — Mode Base Vierge

> **Votre base Supabase est complètement vide (0 table) ?**
> Suivez ces 2 étapes simples. C'est tout !

---

## 📋 Ce que vous allez faire

| Étape | Fichier | Durée | Résultat |
|-------|---------|-------|----------|
| **1** | `DATABASE_FROM_SCRATCH.sql` | 1 min | Crée toutes les tables (73 tables) |
| **2** | `DATABASE_FUNCTIONS_POLICIES.sql` | 1 min | Ajoute fonctions, triggers, policies, index |

**Total : 2 minutes · 0 compétence technique requise**

---

## 🚀 Étape 1 — Créer toutes les tables

1. Ouvrez le fichier **`DATABASE_FROM_SCRATCH.sql`** à la racine de votre projet avec le Bloc-notes
2. **Copiez tout** le contenu (Ctrl+A puis Ctrl+C)
3. Allez sur **Supabase** → **SQL Editor** → **New query**
4. **Collez** le contenu dans l'éditeur (Ctrl+V)
5. Cliquez sur le bouton vert **RUN**
6. Attendez le message **"Success"** ✅ (environ 30 secondes)

### Résultat attendu
- 73 tables créées (membres, cotisations, prêts, aides, réunions, etc.)
- RLS (Row Level Security) activé sur toutes les tables
- L'association par défaut "E2D Connect" créée
- Les 7 rôles créés (super_admin, administrateur, tresorier, etc.)

---

## 🔧 Étape 2 — Ajouter fonctions, triggers et policies

1. Ouvrez le fichier **`DATABASE_FUNCTIONS_POLICIES.sql`** à la racine de votre projet
2. **Copiez tout** le contenu (Ctrl+A puis Ctrl+C)
3. Allez sur **Supabase** → **SQL Editor** → **New query**
4. **Collez** le contenu dans l'éditeur
5. Cliquez sur **RUN**
6. Attendez **"Success"** ✅ (environ 30 secondes)

### Résultat attendu
- Fonctions de sécurité créées (`is_admin()`, `has_role()`, `get_current_association_id()`)
- Triggers `updated_at` sur toutes les tables
- Trigger d'invalidation de session sur désactivation utilisateur
- Policies RLS (admins gèrent tout, membres lisent leurs données)
- 16 index de performance créés
- Fonctions de chiffrement des secrets (`set_secret_config`, `get_secret_config`)

---

## ✅ Vérification

Après les 2 étapes, vérifiez que tout est en place :

1. Allez sur Supabase → **Table Editor**
2. Vous devriez voir **73 tables** dans la liste
3. Allez sur **Authentication** → **Policies**
4. Vous devriez voir des policies sur la plupart des tables

---

## ❓ Problèmes courants

### "permission denied for schema public"

**Solution :** Sur Supabase → Settings → Database → changez la valeur de `db_schema` pour `public`.

### "function auth.uid() does not exist"

**Solution :** C'est normal si vous n'êtes pas authentifié. Les policies utilisent `auth.uid()` qui retourne NULL pour les utilisateurs anonymes. Exécutez quand même le SQL — les policies seront actives une fois les utilisateurs connectés.

### "relation already exists"

**Solution :** Normal si vous avez déjà exécuté le fichier. Les `CREATE TABLE IF NOT EXISTS` ignorent les tables existantes.

### Des NOTICE jaunes apparaissent

**Solution :** C'est normal. Les `NOTICE` sont des informations (ex: "table already exists, skipping"). Ce ne sont pas des erreurs.

---

## 🎯 Prochaines étapes

Une fois la base configurée :

1. Configurez votre `.env.local` avec les clés Supabase
2. Envoyez le code sur GitHub (repo "E2D")
3. Déployez sur Vercel
4. Votre site est en ligne !

Voir `GUIDE_EXPRESS_COMPTES_EXISTANTS.md` pour le déploiement complet.

---

*Fichiers créés pour base vierge · Juillet 2026 · Version 4.1.0*
