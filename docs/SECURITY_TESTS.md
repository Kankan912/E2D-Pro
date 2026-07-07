# Tests RLS automatisés

Suite Vitest dédiée vérifiant que les politiques RLS critiques restent en place.

## Fichiers
- `src/test/security/setup-personae.ts` — helpers (anon / membre / admin)
- `src/test/security/rls.test.ts` — assertions par table et par persona

## Configuration

Les tests utilisent de **vrais comptes** sur l'instance Supabase (pas de mocks).
Définissez ces variables (dans `.env.local` ou en CI) :

```
VITE_TEST_MEMBER_EMAIL=membre.test@example.com
VITE_TEST_MEMBER_PASSWORD=********
VITE_TEST_ADMIN_EMAIL=admin.test@example.com
VITE_TEST_ADMIN_PASSWORD=********
```

Si une variable manque, la suite est **skip** (pas de faux positif).

### Création des comptes
1. Créer 2 comptes via le tunnel d'inscription habituel
2. Pour le compte admin, attribuer le rôle `administrateur` via la table `user_roles`
3. Pour le compte membre, ne lui donner aucun rôle privilégié

## Exécution locale
```bash
npm run test:rls
```

## Couverture (28 cas)

| Table | Anon | Membre | Admin |
|---|---|---|---|
| `messages_contact`, `demandes_adhesion` | SELECT ❌ | SELECT ❌ | SELECT ✅ |
| `cms_*` (7 tables) | SELECT ✅ | INSERT ❌ | — |
| `fichiers_joint` | SELECT ❌ | — | — |
| `sport_*_depenses/recettes` (4) | SELECT ❌ | SELECT ✅ | — |
| `audit_logs`, `payment_configs`, `fond_caisse_clotures`, `adhesions` | SELECT ❌ | SELECT ❌ | SELECT ✅ |

## CI/CD

Ajoutez à votre workflow GitHub Actions / GitLab CI :
```yaml
- run: npm run test:rls
  env:
    VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
    VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.VITE_SUPABASE_PUBLISHABLE_KEY }}
    VITE_TEST_MEMBER_EMAIL: ${{ secrets.TEST_MEMBER_EMAIL }}
    VITE_TEST_MEMBER_PASSWORD: ${{ secrets.TEST_MEMBER_PASSWORD }}
    VITE_TEST_ADMIN_EMAIL: ${{ secrets.TEST_ADMIN_EMAIL }}
    VITE_TEST_ADMIN_PASSWORD: ${{ secrets.TEST_ADMIN_PASSWORD }}
```

## Intégration CI/CD (GitHub Actions)

Le workflow `.github/workflows/security-rls.yml` exécute automatiquement `bun run test:rls` à chaque push sur `main` et à chaque pull request.

### Secrets GitHub à configurer

Dans **Settings → Secrets and variables → Actions** du repository :

| Secret | Description |
|--------|-------------|
| `VITE_SUPABASE_URL` | URL du projet Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clé publique anon |
| `VITE_TEST_ANON_EMAIL` / `VITE_TEST_ANON_PASSWORD` | Compte anonyme de test |
| `VITE_TEST_MEMBER_EMAIL` / `VITE_TEST_MEMBER_PASSWORD` | Compte membre standard |
| `VITE_TEST_ADMIN_EMAIL` / `VITE_TEST_ADMIN_PASSWORD` | Compte administrateur |

### Bloquer les déploiements en cas d'échec

Activer **Settings → Branches → Branch protection rules** sur `main` et cocher *Require status checks to pass* avec le job `Security RLS Tests`.
