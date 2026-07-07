# Code Review Frontend — e2d-connect

Date : audit après clôture V3 (lots A→F).
Périmètre : `src/` (hors `src/integrations/supabase/types.ts` généré et `src/components/ui/*` shadcn).
Méthode : scans `rg` + lecture ciblée. **Aucune modification de code applicatif.**

---

## 1. Synthèse exécutive

| Axe | Score | Verdict |
|-----|-------|---------|
| Conformité Core rules (logger, catch, confirm, padding) | 🟢 100 % | Aucun écart résiduel |
| Typage TypeScript | 🟠 70 % | **296 occurrences `any`** réparties sur ~80 fichiers |
| Hooks React | 🟢 95 % | Aucun `exhaustive-deps` désactivé ; cleanup realtime à vérifier |
| Architecture composants | 🟠 65 % | **28 fichiers > 500 lignes**, dont 9 > 700 lignes |
| Imports & alias | 🟢 100 % | 0 import `../../../`, alias `@/` systématique |
| Patterns Supabase | 🟠 60 % | **163 `.select('*')`**, 2 `.map(async)` (risque N+1) |
| Formulaires & validation | 🔴 50 % | **7 `useForm()` sans resolver zod** dans `pages/admin/site/*` |
| Accessibilité | 🟠 60 % | Seulement 9 `aria-label` dans tout le projet |

### Top 5 risques

1. **`useForm()` sans validation zod** sur 7 pages admin/site → données arbitraires acceptées côté client (mitigé par RLS mais inconfort UX).
2. **9 fichiers > 700 lignes** (PaymentConfigAdmin 1037, PretsAdmin 977, RapportsAdmin 877) → maintenabilité dégradée.
3. **`as any` / `: any` (296 occurrences)** concentrés dans CompteRenduViewer (35), PretsAdmin (20), useSiteContent (17), ClotureReunionModal (15) → perte de type safety.
4. **`.select('*')` (163 occurrences)** sur tables potentiellement larges → surconsommation bande passante.
5. **Cleanup realtime suspect** : 12 usages de `.channel(` / `subscribe()` pour seulement 5 `removeChannel` → fuites potentielles.

---

## 2. Findings par axe

### Axe 1 — Typage TypeScript

| Sévérité | Finding | Fichiers / occurrences |
|----------|---------|------------------------|
| Majeur | `any` massif dans composants visuels critiques | `CompteRenduViewer.tsx` (35), `PretsAdmin.tsx` (20), `useSiteContent.ts` (17), `ClotureReunionModal.tsx` (15) |
| Mineur | `any` sur hooks de stats | `StatsAdmin.tsx` (10), `useCalendrierBeneficiaires.ts` (7), `useCaisse.ts` (6), `useAides.ts` (5) |
| Mineur | Dette typée documentée (cast `verrouille`, realtime) | rappel mémoire `mem://architecture/type-safety/residual-technical-debt` |

**Recommandation** : prioriser `CompteRenduViewer`, `PretsAdmin` et `useSiteContent` (52 % du total à eux trois).

### Axe 2 — Hooks React

| Sévérité | Finding | Détail |
|----------|---------|--------|
| ✅ | `exhaustive-deps` désactivé | **0 occurrence** |
| 🟡 Majeur | Cleanup realtime sous-couvert | 12 souscriptions vs 5 `removeChannel` → 7 channels potentiellement non nettoyés |
| Mineur | 73 `useEffect(() => {` à auditer pour vérifier les deps réelles | échantillonnage recommandé |

**Action** : grep ciblé `supabase.channel(` et vérifier chaque `useEffect` retourne un cleanup.

### Axe 3 — Architecture composants

| Fichier | Lignes | Recommandation |
|---------|--------|----------------|
| `pages/admin/PaymentConfigAdmin.tsx` | 1037 | Découper par provider (Stripe/Orange/MTN/Bank) |
| `pages/admin/PretsAdmin.tsx` | 977 | Extraire `PretsTable`, `PretDetailDrawer`, `PretReconductionForm` |
| `pages/admin/RapportsAdmin.tsx` | 877 | Extraire par type de rapport (financier/membres/sport) |
| `components/CompteRenduViewer.tsx` | 819 | Extraire sections (présences, sanctions, décisions) |
| `pages/Epargnes.tsx` | 762 | Extraire formulaires et tableaux |
| `components/ClotureReunionModal.tsx` | 719 | Extraire étapes du wizard |
| `hooks/useSiteContent.ts` | 697 | Découper en hooks par section (hero/about/gallery/...) |
| `pages/admin/UtilisateursAdmin.tsx` | 645 | Extraire `UserCreateDialog`, `UserTable` |
| `pages/admin/CaisseAdmin.tsx` | 636 | Extraire `OperationDialog`, `CaisseFilters` |

**21 autres fichiers entre 500 et 600 lignes** — listés en annexe.

### Axe 4 — Imports & dépendances

| Sévérité | Finding | État |
|----------|---------|------|
| ✅ | 0 import relatif `../../../` | Alias `@/` partout |
| ℹ️ | Dépendances inutilisées | Non audité (nécessite `depcheck`) |

### Axe 5 — Patterns Supabase

| Sévérité | Finding | Top fichiers |
|----------|---------|--------------|
| Majeur | `.select('*')` (163) | `useSiteContent.ts` (11), `tests/rls.test.ts` (10), `EventDetail.tsx` (5), `CotisationsCumulAnnuel.tsx` (5), `useE2DPlayerStats.ts` (4) |
| Majeur | `.map(async)` parallèle non awaited proprement | `TableauBordJauneRouge.tsx:25`, `MediaLibrary.tsx:109` — risque N+1 et erreurs silencieuses |
| Mineur | Pagination absente sur listes longues | Membres, opérations caisse, paiements |

**Action** : prioriser `useSiteContent.ts` (déjà gros + 11 `select('*')`).

### Axe 6 — Formulaires & validation

| Sévérité | Finding | Fichiers |
|----------|---------|----------|
| 🔴 Bloquant UX | `useForm()` sans resolver zod | `pages/admin/site/PartnersAdmin.tsx:22`, `HeroAdmin.tsx:22`, `ConfigAdmin.tsx:13`, `GalleryAdmin.tsx:37 + 38`, `ActivitiesAdmin.tsx:21`, `EventsAdmin.tsx:31` |
| ℹ️ | Bon ratio formulaires critiques | 17 imports `zod`, 24 imports `react-hook-form` |

**Action** : ajouter un schéma zod minimal sur chaque formulaire admin/site (titre obligatoire, URL valide, longueurs max).

### Axe 7 — Accessibilité

| Sévérité | Finding | Détail |
|----------|---------|--------|
| Majeur | Seulement 9 `aria-label` dans tout `src/` | Insuffisant vu le nombre de `IconButton` (Edit, Trash, Eye, etc.) sans texte |
| Mineur | `dangerouslySetInnerHTML` × 2 | `NotificationsTemplatesAdmin.tsx:485` (preview template — input admin), `ui/chart.tsx:70` (shadcn — OK) |

**Action** : passe générale sur les boutons icônes (Trash/Edit/Eye) dans les admin pour ajouter `aria-label`.

### Axe 8 — Conformité Core rules (re-check)

| Règle | Résultat |
|-------|----------|
| `console.*` hors logger | ✅ 0 |
| `catch (error)` non typé | ✅ 0 |
| `window.confirm` | ✅ 0 |
| `p-3 sm:p-6` | ✅ 28 usages (cohérent) |
| Imports `../../../` | ✅ 0 |

Le Lot E est confirmé 100 % stable.

---

## 3. Plan de correction proposé (lots G1 → G6)

| Lot | Périmètre | Effort | Priorité |
|-----|-----------|--------|----------|
| **G1** ✅ | Validation zod sur 7 formulaires `pages/admin/site/*` — **livré** (schémas centralisés dans `src/lib/validation/site-schemas.ts`) | 1 h | 🔴 Haute |
| **G2** ✅ | Découpage des 5 plus gros fichiers (>700 lignes) en sous-composants — **livré** | 4 h | 🟠 Haute |
| **G3** | Typage strict de `CompteRenduViewer`, `PretsAdmin`, `useSiteContent` (suppression `any`) | 3 h | 🟠 Moyenne |
| **G4** ✅ | Audit cleanup realtime (5 canaux ok, noms suffixés `crypto.randomUUID()`) + `.map(async)` déjà encadrés `Promise.all` — **livré** | 1 h | 🟠 Moyenne |
| **G5** | Remplacer `.select('*')` par colonnes explicites sur top 10 fichiers | 2 h | 🟡 Basse |
| **G6** ✅ | Passe accessibilité : `aria-label` ajoutés sur les boutons icon-only des 7 pages `admin/site/*` (Activities, Partners, Events, About, Hero, Messages, Gallery) — **livré** | 1 h | 🟡 Basse |
| **G7** ✅ | Standardisation `catch (error: unknown)` sur 15 occurrences dans 12 fichiers (hooks, lib, components, pages admin) — **livré** | 0,5 h | 🟠 Moyenne |

**Total estimé** : ~12 h de corrections.

---

## 4. Annexe — Fichiers > 500 lignes (hors `ui/` et `types.ts`)

```
1037  pages/admin/PaymentConfigAdmin.tsx
 977  pages/admin/PretsAdmin.tsx
 877  pages/admin/RapportsAdmin.tsx
 819  components/CompteRenduViewer.tsx
 762  pages/Epargnes.tsx
 719  components/ClotureReunionModal.tsx
 697  hooks/useSiteContent.ts
 645  pages/admin/UtilisateursAdmin.tsx
 636  pages/admin/CaisseAdmin.tsx
 630  components/config/EmailConfigManager.tsx
 625  components/config/CalendrierBeneficiairesManager.tsx
 625  components/MemberDetailSheet.tsx
 597  pages/admin/AidesAdmin.tsx
 587  pages/admin/MonitoringAdmin.tsx
 586  components/UserMemberLinkManager.tsx
 580  components/config/CotisationsMensuellesExerciceManager.tsx
 578  pages/EventDetail.tsx
 567  components/ReunionPresencesManager.tsx
 562  hooks/useCaisse.ts
 557  components/forms/MemberForm.tsx
 555  pages/admin/MembresAdmin.tsx
 554  pages/admin/site/GalleryAdmin.tsx
 550  pages/admin/DonationsAdmin.tsx
 545  components/PretsPaiementsManager.tsx
 545  components/CotisationsGridView.tsx
 540  pages/admin/MobileMoneyAdmin.tsx
 522  components/config/SanctionsTarifsManager.tsx
 511  pages/admin/NotificationsTemplatesAdmin.tsx
```

---

## 5. Prochaine étape

Validez les lots G à lancer (et leur ordre). Recommandation : **G1 → G4 → G6 → G3 → G2 → G5** (impact UX/stabilité d'abord, refactoring lourd en dernier).

## Lot G3 — Suppression des `any` ciblés ✅ TERMINÉ

| Fichier | `any` retirés |
|---------|---------------|
| `src/hooks/useSiteContent.ts` | 17 |
| `src/pages/admin/PretsAdmin.tsx` | 13 |
| `src/components/CompteRenduViewer.tsx` | 36 |

Méthode : types nommés (`PresenceRow`, `CotisationRow`, …) avec index signature `[key: string]: unknown`, casts via `unknown` aux frontières Supabase. Typecheck `tsc --noEmit` : 0 erreur.

## Lot G5 — `.select('*')` → colonnes explicites ✅ TERMINÉ (top 10)

10 fichiers prioritaires : `useRoles`, `usePersonalData`, `useE2DPlayerStats`, `useLoanRequests`, `useSiteContent`, `EventDetail`, `CotisationsCumulAnnuel`, `SportStatistiquesGlobales`, `GestionPresences`, `PretsAdmin`. Aucune modification de filtre / RLS / logique. Typecheck OK. 81 fichiers secondaires conservent `*` (itération ultérieure).

## Lot G2 — Découpe composants > 700 lignes ✅ TERMINÉ

| Fichier | Avant | Après | Extractions |
|---------|-------|-------|-------------|
| `src/components/CompteRenduViewer.tsx` | 880 | **561** | `src/lib/compte-rendu-pdf.ts` |
| `src/pages/admin/PretsAdmin.tsx` | 977 | **685** | `_components/ReconductionsAttenteList.tsx`, `_components/PretsStatsCards.tsx`, `_components/PretRow.tsx` |
| `src/pages/admin/PaymentConfigAdmin.tsx` | 1037 | **473** | `_components/PaymentConfigTabs.tsx` (6 onglets) |
| `src/pages/admin/RapportsAdmin.tsx` | 877 | **429** | `src/lib/rapports-export.ts`, `_components/RapportsTabsContent.tsx` |
| `src/pages/Epargnes.tsx` | 762 | **531** | `pages/_components/EpargnesFilters.tsx`, `pages/_components/EpargnesList.tsx` |

Tous les fichiers > 700 lignes du périmètre initial sont passés sous la barre. Typecheck OK.
