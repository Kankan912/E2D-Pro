/**
 * Centralized TanStack Query key factory (Audit Fix #44 / P2).
 *
 * WHY: Previously, query keys were scattered as string literals across 38
 * hooks. This caused cache collisions, made invalidation fragile, and
 * prevented type-safe key construction. This factory is the single source
 * of truth for all query keys in the app.
 *
 * Usage:
 *   queryKey: queryKeys.cotisations.list({ associationId, exerciceId })
 *   invalidate: queryClient.invalidateQueries({ queryKey: queryKeys.cotisations.all })
 */

export const queryKeys = {
  // Association / tenant
  associations: {
    all: ["associations"] as const,
    list: () => [...queryKeys.associations.all, "list"] as const,
    detail: (id: string) => [...queryKeys.associations.all, "detail", id] as const,
  },

  // Auth / RBAC
  auth: {
    all: ["auth"] as const,
    profile: (userId: string) => [...queryKeys.auth.all, "profile", userId] as const,
    permissions: (userId: string) => [...queryKeys.auth.all, "permissions", userId] as const,
    roles: () => [...queryKeys.auth.all, "roles"] as const,
  },

  // Members
  membres: {
    all: ["membres"] as const,
    list: (filters?: { associationId?: string; search?: string }) =>
      [...queryKeys.membres.all, "list", filters] as const,
    detail: (id: string) => [...queryKeys.membres.all, "detail", id] as const,
  },

  // Cotisations
  cotisations: {
    all: ["cotisations"] as const,
    list: (filters?: { associationId?: string; exerciceId?: string; membreId?: string }) =>
      [...queryKeys.cotisations.all, "list", filters] as const,
    detail: (id: string) => [...queryKeys.cotisations.all, "detail", id] as const,
    mensuelles: (exerciceId: string) =>
      [...queryKeys.cotisations.all, "mensuelles", exerciceId] as const,
    projections: (reunionId: string) =>
      [...queryKeys.cotisations.all, "projections", reunionId] as const,
  },

  // Epargnes
  epargnes: {
    all: ["epargnes"] as const,
    list: (filters?: { associationId?: string; membreId?: string }) =>
      [...queryKeys.epargnes.all, "list", filters] as const,
    detail: (id: string) => [...queryKeys.epargnes.all, "detail", id] as const,
    beneficiaires: (associationId: string) =>
      [...queryKeys.epargnes.all, "beneficiaires", associationId] as const,
  },

  // Prêts
  prets: {
    all: ["prets"] as const,
    list: (filters?: { associationId?: string; membreId?: string; statut?: string }) =>
      [...queryKeys.prets.all, "list", filters] as const,
    detail: (id: string) => [...queryKeys.prets.all, "detail", id] as const,
    paiements: (pretId: string) =>
      [...queryKeys.prets.all, "paiements", pretId] as const,
    reconductions: (associationId: string) =>
      [...queryKeys.prets.all, "reconductions", associationId] as const,
  },

  // Loan requests (demandes de prêt)
  loanRequests: {
    all: ["loanRequests"] as const,
    list: (filters?: { associationId?: string; statut?: string }) =>
      [...queryKeys.loanRequests.all, "list", filters] as const,
    detail: (id: string) => [...queryKeys.loanRequests.all, "detail", id] as const,
    validations: (id: string) =>
      [...queryKeys.loanRequests.all, "validations", id] as const,
    mine: (userId: string) => [...queryKeys.loanRequests.all, "mine", userId] as const,
    avalisations: (userId: string) =>
      [...queryKeys.loanRequests.all, "avalisations", userId] as const,
  },

  // Aides
  aides: {
    all: ["aides"] as const,
    list: (filters?: { associationId?: string; statut?: string }) =>
      [...queryKeys.aides.all, "list", filters] as const,
    detail: (id: string) => [...queryKeys.aides.all, "detail", id] as const,
    workflow: (id: string) => [...queryKeys.aides.all, "workflow", id] as const,
    payments: (id: string) => [...queryKeys.aides.all, "payments", id] as const,
    stats: (associationId: string) => [...queryKeys.aides.all, "stats", associationId] as const,
  },

  // Donations
  donations: {
    all: ["donations"] as const,
    list: (filters?: { associationId?: string }) =>
      [...queryKeys.donations.all, "list", filters] as const,
    mine: (userId: string) => [...queryKeys.donations.all, "mine", userId] as const,
    stats: (associationId: string) => [...queryKeys.donations.all, "stats", associationId] as const,
  },

  // Adhesions
  adhesions: {
    all: ["adhesions"] as const,
    list: (filters?: { associationId?: string }) =>
      [...queryKeys.adhesions.all, "list", filters] as const,
    detail: (id: string) => [...queryKeys.adhesions.all, "detail", id] as const,
  },

  // Réunions
  reunions: {
    all: ["reunions"] as const,
    list: (filters?: { associationId?: string }) =>
      [...queryKeys.reunions.all, "list", filters] as const,
    detail: (id: string) => [...queryKeys.reunions.all, "detail", id] as const,
    presences: (reunionId: string) =>
      [...queryKeys.reunions.all, "presences", reunionId] as const,
    sanctions: (reunionId: string) =>
      [...queryKeys.reunions.all, "sanctions", reunionId] as const,
  },

  // Notifications
  notifications: {
    all: ["notifications"] as const,
    list: (userId: string) => [...queryKeys.notifications.all, "list", userId] as const,
    templates: () => [...queryKeys.notifications.all, "templates"] as const,
    unreadCount: (userId: string) =>
      [...queryKeys.notifications.all, "unread", userId] as const,
  },

  // Caisse
  caisse: {
    all: ["caisse"] as const,
    operations: (associationId: string) =>
      [...queryKeys.caisse.all, "operations", associationId] as const,
    config: (associationId: string) => [...queryKeys.caisse.all, "config", associationId] as const,
  },

  // Sport
  sport: {
    all: ["sport"] as const,
    matchs: (filters?: { equipe?: string }) => [...queryKeys.sport.all, "matchs", filters] as const,
    classements: (equipe: string) => [...queryKeys.sport.all, "classements", equipe] as const,
    effectifs: (equipe: string) => [...queryKeys.sport.all, "effectifs", equipe] as const,
    entrainements: (equipe: string) => [...queryKeys.sport.all, "entrainements", equipe] as const,
    sanctions: (equipe: string) => [...queryKeys.sport.all, "sanctions", equipe] as const,
  },

  // Site / CMS
  site: {
    all: ["site"] as const,
    hero: () => [...queryKeys.site.all, "hero"] as const,
    about: () => [...queryKeys.site.all, "about"] as const,
    activities: () => [...queryKeys.site.all, "activities"] as const,
    events: () => [...queryKeys.site.all, "events"] as const,
    gallery: () => [...queryKeys.site.all, "gallery"] as const,
    partners: () => [...queryKeys.site.all, "partners"] as const,
    config: () => [...queryKeys.site.all, "config"] as const,
    pageviews: () => [...queryKeys.site.all, "pageviews"] as const,
  },

  // Audit logs / monitoring
  audit: {
    all: ["audit"] as const,
    logs: (filters?: { action?: string; resource?: string; limit?: number }) =>
      [...queryKeys.audit.all, "logs", filters] as const,
    securityScans: () => [...queryKeys.audit.all, "securityScans"] as const,
  },
} as const;

export type QueryKeyFactory = typeof queryKeys;
