# Guide de Contribution

## Ajouter une nouvelle fonctionnalité

### 1. Créer le hook métier

```typescript
// src/hooks/useMonModule.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useMonModule = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["mon-module"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ma_table").select("*");
      if (error) throw error;
      return data;
    },
  });

  return { data, isLoading };
};
```

### 2. Créer les composants

- Placer dans `src/components/` ou `src/pages/monmodule/components/`
- Utiliser les tokens Tailwind sémantiques (`bg-primary`, `text-foreground`)
- Importer les composants shadcn/ui depuis `@/components/ui/`

### 3. Créer la page

```typescript
// src/pages/MonModule.tsx
import DashboardLayout from "@/components/layout/DashboardLayout";

const MonModule = () => (
  <DashboardLayout>
    {/* Contenu */}
  </DashboardLayout>
);

export default MonModule;
```

### 4. Ajouter la route

Dans `src/App.tsx` :
```typescript
const MonModule = lazy(() => import("./pages/MonModule"));
// ...
<Route path="/mon-module" element={<PermissionRoute resource="mon_module" permission="read"><MonModule /></PermissionRoute>} />
```

### 5. Ajouter au menu

Dans `src/components/layout/DashboardSidebar.tsx`, ajouter l'entrée de navigation.

## Conventions

- **Hooks** : un fichier par domaine, nommé `use[Domaine].ts`
- **Composants** : PascalCase, un composant par fichier, < 300 lignes
- **Types** : interfaces exportées depuis le hook ou un fichier `types.ts` dédié
- **Requêtes Supabase** : toujours via React Query, jamais d'appels directs dans les composants
- **Joins typés** : utiliser `src/types/supabase-joins.ts` pour les résultats de jointures
- **Couleurs** : jamais de classes Tailwind hardcodées (`bg-blue-500`), toujours des tokens (`bg-primary`)

## Tests

```bash
# Lancer les tests
npm run test

# Lancer un test spécifique
npx vitest run src/lib/utils.test.ts
```

## Migrations SQL

Utiliser l'outil de migration Supabase dans Lovable. Ne jamais modifier `src/integrations/supabase/types.ts` manuellement.
