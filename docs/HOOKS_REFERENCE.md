# Référence des Hooks

## Hooks Génériques

| Hook | Fichier | Description |
|------|---------|-------------|
| `useSupabaseQuery` | `hooks/generic/useSupabaseQuery.ts` | Wrapper léger pour les requêtes SELECT simples |
| `useSupabaseMutation` | `hooks/generic/useSupabaseMutation.ts` | Wrapper pour INSERT/UPDATE/DELETE avec invalidation cache |
| `useSupabaseRealtime` | `hooks/generic/useSupabaseRealtime.ts` | Écoute temps réel Supabase avec invalidation automatique du cache React Query |
| `useRealtimeUpdates` | `hooks/useRealtimeUpdates.ts` | Souscription temps réel bas-niveau (postgres_changes) |

## Hooks par Domaine

### Caisse (Trésorerie)

| Hook | Description | Query Keys |
|------|-------------|------------|
| `useCaisseOperations(filters?)` | Liste les opérations du fond de caisse avec filtres | `['caisse-operations', filters]` |
| `useCaisseStats()` | Statistiques globales (solde, entrées/sorties du mois) | `['caisse-stats']` |
| `useCaisseConfig()` | Configuration caisse (seuils d'alerte, % empruntable) | `['caisse-config']` |
| `useUpdateCaisseConfig()` | Mutation : mise à jour configuration | invalide `caisse-config`, `caisse-stats` |
| `useCreateCaisseOperation()` | Mutation : créer opération manuelle | invalide `caisse-operations`, `caisse-stats` |
| `useDeleteCaisseOperation()` | Mutation : supprimer opération (manuelles uniquement) | invalide `caisse-operations`, `caisse-stats` |
| `useCaisseVentilation(type?)` | Ventilation par catégorie (entrées/sorties/toutes) | `['caisse-ventilation', type]` |
| `useCaisseDetails(type, enabled)` | Détails d'une catégorie spécifique | `['caisse-details', type]` |
| `useCaisseSynthese()` | Synthèse complète (totaux par catégorie, taux recouvrement) | `['caisse-synthese']` |

### Membres

| Hook | Description | Query Keys |
|------|-------------|------------|
| `useMembers()` | CRUD membres (liste, créer, modifier, supprimer) | `['members']` |
| `useMemberDetails(membreId)` | Détails complets d'un membre (cotisations, épargnes, prêts, sanctions) | `['member-*', membreId]` |
| `useMemberCotisationStats(membreId)` | Stats cotisations d'un membre | `['member-cotisation-stats', membreId]` |

### Cotisations

| Hook | Description |
|------|-------------|
| `useCotisations()` | Gestion des cotisations par exercice/réunion |
| `useCotisationsMensuelles()` | Cotisations mensuelles par exercice |

### Réunions

| Hook | Description |
|------|-------------|
| `useReunions()` | CRUD réunions avec présences et sanctions |
| `useReunionsData()` | Hook composite pour la page réunions (state + handlers) |

### Sport

| Hook | Description |
|------|-------------|
| `useSport()` | Matchs, compositions, classements |
| `useE2DPlayerStats()` | Statistiques joueurs E2D |
| `useMatchCompteRendu()` | Comptes rendus de matchs |
| `useMatchMedias()` | Médias associés aux matchs |

### Autres

| Hook | Description |
|------|-------------|
| `usePermissions()` | Vérification des permissions utilisateur |
| `useRoles()` | Gestion des rôles |
| `useUtilisateurs()` | Gestion des comptes utilisateur |
| `useDonations()` | Gestion des dons |
| `useAides()` | Gestion des aides aux bénéficiaires |
| `useEpargnes()` | Gestion des épargnes |
| `useAdhesions()` | Gestion des adhésions |
| `useCalendrierBeneficiaires()` | Calendrier des bénéficiaires tontine |
| `usePersonalData()` | Données personnelles du membre connecté |
| `useSessionManager()` | Gestion de la session (timeout, renouvellement) |
| `useActivityTracker()` | Détection d'activité utilisateur |
| `useSiteContent()` | Contenu CMS du site public |
| `useNotificationsTemplates()` | Templates de notifications email |
| `useAlertesGlobales()` | Alertes budgétaires globales |

## Utilisation des hooks génériques

### useSupabaseQuery — Requêtes SELECT

```typescript
import { useSupabaseQuery } from '@/hooks/generic/useSupabaseQuery';

// Requête simple
const { data } = useSupabaseQuery<ConfigRow[]>('configurations', ['config'], {
  orderBy: 'cle',
});

// Avec filtres
const { data } = useSupabaseQuery<Member[]>('membres', ['members-active'], {
  filters: { statut: 'actif' },
  orderBy: 'nom',
  limit: 50,
});
```

### useSupabaseMutation — Mutations INSERT/UPDATE/DELETE

```typescript
import { useSupabaseMutation } from '@/hooks/generic/useSupabaseMutation';

// Suppression avec invalidation de cache
const deleteMutation = useSupabaseMutation('configurations', 'delete', {
  invalidateKeys: [['config']],
  successMessage: 'Configuration supprimée',
});
deleteMutation.mutate(configId);
```

### useSupabaseRealtime — Temps réel avec invalidation cache

```typescript
import { useSupabaseRealtime } from '@/hooks/generic/useSupabaseRealtime';

// Écouter les changements sur fond_caisse_operations et invalider le cache
useSupabaseRealtime('fond_caisse_operations', [
  ['caisse-operations'],
  ['caisse-stats'],
]);

// Écouter uniquement les INSERT sur cotisations
useSupabaseRealtime('cotisations', [['cotisations']], {
  event: 'INSERT',
});

// Désactiver temporairement
useSupabaseRealtime('membres', [['members']], {
  enabled: isOnline,
});
```
