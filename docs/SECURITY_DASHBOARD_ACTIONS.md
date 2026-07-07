# Actions de sécurité à effectuer dans le Dashboard Supabase

Ces actions ne peuvent **pas** être faites depuis le code. Elles doivent être exécutées
manuellement par un administrateur dans le dashboard Supabase du projet
`piyvinbuxpnquwzyugdj`.

## 0. ⚠️ CRITIQUE — Désactiver l'auto-inscription publique
Les comptes membres doivent être créés **uniquement** par l'administrateur.
La page `/auth` ne propose plus de bouton "Créer un compte", mais Supabase
accepte toujours les `signUp()` au niveau API tant que cette option est active.
- Aller dans **Authentication → Providers → Email**.
- Désactiver **"Allow new users to sign up"** (ou "Enable signup").
- Conserver "Confirm email" activé pour les invitations admin.

## 1. Réduire la durée de vie des OTP
Le linter signale "Auth OTP long expiry".
- Aller dans **Authentication → Providers → Email**.
- Réduire `OTP Expiry` à **600 secondes (10 minutes)** maximum.
- Référence : https://supabase.com/docs/guides/platform/going-into-prod#security

## 2. Activer la protection contre les mots de passe compromis
Le linter signale "Leaked Password Protection Disabled".
- Aller dans **Authentication → Policies / Password Settings**.
- Activer **"Check passwords against HaveIBeenPwned"**.
- Référence : https://supabase.com/docs/guides/auth/password-security

## 3. Mettre à jour PostgreSQL
Le linter signale "Current Postgres version has security patches available".
- Aller dans **Settings → Infrastructure → Postgres Version**.
- Lancer l'upgrade vers la dernière version disponible.
- Faire un snapshot avant.
- Référence : https://supabase.com/docs/guides/platform/upgrading

## 4. Vérifier le bucket `justificatifs`
La migration a basculé ce bucket en privé via SQL. Vérifier dans
**Storage → justificatifs** que la propriété **Public** est bien à **OFF**.

## 5. Buckets publics restants (par design)
Les buckets suivants **doivent rester publics** car ils servent le site vitrine :
- `site-hero`, `site-gallery`, `site-partners`, `site-events`, `site-images`
- `members-photos`, `sport-logos`, `match-medias`

Les warnings "Public Bucket Allows Listing" sur ces buckets sont **acceptés**.

## 6. Bucket dupliqué `membre-photos`
Un bucket `membre-photos` (singulier, sans 's') existe en doublon de `members-photos`
qui est le bucket réellement utilisé. À supprimer manuellement :
- **Storage → membre-photos → Delete bucket** (vérifier qu'il est vide d'abord).

---

Les warnings du linter Supabase liés aux fonctions `SECURITY DEFINER` (≈ 80 occurrences)
sont **acceptés** : ces fonctions (`is_admin`, `has_role`, `has_permission`, RPC métier)
exécutent volontairement des opérations privilégiées via leur logique interne.
