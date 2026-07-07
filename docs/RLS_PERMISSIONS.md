# Permissions & Row Level Security (RLS)

## Système de rôles

### Rôles applicatifs

| Rôle | Accès |
|------|-------|
| `super_admin` | Accès total |
| `administrateur` | Gestion complète (membres, finances, sport) |
| `tresorier` | Caisse, cotisations, prêts, épargnes |
| `secretaire_general` | Réunions, présences, sanctions, notifications |
| `responsable_sportif` | Sport (matchs, équipes, classements) |
| `membre` | Consultation de ses propres données |

### Tables de rôles

- **`roles`** : Définition des rôles (nom, description)
- **`user_roles`** : Association user_id ↔ role_id (pour RLS)
- **`membres_roles`** : Association membre_id ↔ role_id (pour l'affichage)
- **`role_permissions`** : Permissions granulaires par ressource (resource, permission, granted)

## Fonctions SQL de vérification

```sql
-- Vérifie si l'utilisateur courant est admin (administrateur, tresorier, super_admin, secretaire_general)
is_admin() → boolean

-- Vérifie si l'utilisateur a un rôle spécifique
has_role(role_name text) → boolean
has_role(user_id uuid, role app_role) → boolean

-- Vérifie une permission granulaire (resource + action)
has_permission(resource text, permission text) → boolean
```

## Politique RLS type

```sql
-- Lecture : tous les membres authentifiés
CREATE POLICY "select_policy" ON table
  FOR SELECT TO authenticated
  USING (true);

-- Écriture : uniquement les admins
CREATE POLICY "insert_policy" ON table
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

-- Données personnelles : uniquement le propriétaire
CREATE POLICY "select_own" ON table
  FOR SELECT TO authenticated
  USING (membre_id IN (
    SELECT id FROM membres WHERE user_id = auth.uid()
  ));
```

## Ressources protégées

| Ressource | Lecture | Écriture | Suppression |
|-----------|---------|----------|-------------|
| `membres` | Authentifié | Admin | Admin |
| `cotisations` | Authentifié | Admin, Trésorier | Admin |
| `fond_caisse_operations` | Admin, Trésorier, SG | Admin, Trésorier | Admin |
| `prets` | Authentifié | Admin, Trésorier | Admin |
| `reunions` | Authentifié | Admin, SG | Admin |
| `sport_*` | Authentifié | Admin, Resp. Sportif | Admin |
| `donations` | Public (insert) | Admin | Admin |
| `profiles` | Propriétaire | Propriétaire | — |

## Vérification côté client

```typescript
// Dans un composant
const { hasPermission, isAdmin } = usePermissions();

if (hasPermission('caisse', 'write')) {
  // Afficher le bouton de création
}

// Dans le routing
<PermissionRoute resource="caisse" permission="read">
  <CaisseAdmin />
</PermissionRoute>
```
