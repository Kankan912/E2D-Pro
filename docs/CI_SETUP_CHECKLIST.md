# Checklist : configurer les GitHub Secrets pour la CI RLS

Ce guide t'explique, étape par étape, comment activer l'exécution automatique
des tests RLS (`npm run test:rls`) à chaque push sur GitHub.

## Étape 1 — Générer les 3 comptes de test

1. Connecte-toi à l'application avec ton compte **administrateur**.
2. Va dans **Admin → Monitoring & Audit**.
3. Dans la carte **« Comptes de test CI »**, clique sur
   **« Générer les comptes de test CI »**.
4. Trois comptes Supabase sont créés ou mis à jour automatiquement :
   - `ci-anon@e2d-test.local` (sans rôle)
   - `ci-membre@e2d-test.local` (rôle membre)
   - `ci-administrateur@e2d-test.local` (rôle administrateur)
5. Les 8 valeurs nécessaires s'affichent à l'écran.

> Les mots de passe ne sont affichés qu'une seule fois. Tu peux régénérer
> autant de fois que tu veux : les anciens mots de passe sont remplacés.

## Étape 2 — Ajouter les 8 secrets dans GitHub

1. Ouvre ton dépôt GitHub.
2. Va dans **Settings → Secrets and variables → Actions**.
3. Clique sur **« New repository secret »**.
4. Pour chacun des 8 secrets ci-dessous, copie le **nom exact** et la
   **valeur** depuis la carte « Comptes de test CI » :

| Nom du secret GitHub | Source |
|---|---|
| `VITE_SUPABASE_URL` | affiché par l'écran |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | affiché par l'écran |
| `VITE_TEST_ANON_EMAIL` | affiché par l'écran |
| `VITE_TEST_ANON_PASSWORD` | affiché par l'écran |
| `VITE_TEST_MEMBER_EMAIL` | affiché par l'écran |
| `VITE_TEST_MEMBER_PASSWORD` | affiché par l'écran |
| `VITE_TEST_ADMIN_EMAIL` | affiché par l'écran |
| `VITE_TEST_ADMIN_PASSWORD` | affiché par l'écran |

> Astuce : le bouton **« Copier les 8 secrets »** copie tout au format
> `clé=valeur` (8 lignes) pour faciliter le collage.

## Étape 3 — Vérifier le workflow

1. Va dans l'onglet **Actions** de ton dépôt.
2. Sélectionne le workflow **« Security RLS Tests »**.
3. Clique sur **« Run workflow »** (déclenchement manuel) pour valider.
4. Le workflow doit passer au vert. S'il échoue :
   - vérifie que les 8 secrets sont bien orthographiés (sensible à la casse) ;
   - régénère les comptes via l'écran admin et recopie les valeurs.

## Que faire si je n'ai pas accès à GitHub ?

Sans accès au dépôt GitHub, seul le propriétaire peut ajouter les secrets.
Tu peux toujours :

- exécuter les tests RLS localement (les valeurs sont alors lues depuis ton
  fichier `.env`) ;
- partager les valeurs **en privé** à la personne qui gère GitHub.

Ne colle jamais les mots de passe générés dans un message public, un ticket ou
le code source.
