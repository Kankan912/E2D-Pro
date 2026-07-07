# Plan de Mises à Jour Technologiques (Audit Fix #5 / P3)

> **Statut :** Planifié pour le Semestre 2 2026
> **Risque :** Moyen à Élevé (breaking changes)
> **Prérequis :** Tests E2E Playwright en place (✅ fait)

---

## 🎯 Objectifs

Ce document planifie les migrations technologiques majeures identifiées dans le
rapport d'audit. Ces migrations ne sont PAS bloquantes pour la production mais
permettent de rester à jour et bénéficier des dernières performances.

---

## 📋 Migrations planifiées

### 1. React 18.3 → React 19

**Bénéfices :**
- Server Components (optionnel)
- `use()` hook pour les promesses
- Améliorations de performance (~15% re-render)
- Meilleur support TypeScript

**Risques :**
- Breaking changes sur `useRef`, `forwardRef`
- Librairies tierces à vérifier (Radix UI, react-router-dom)

**Plan :**
1. Phase 1 : Vérifier compatibilité des 28 dépendances Radix UI
2. Phase 2 : Migrer `react-router-dom` 6.30 → 7.x (nécessaire pour React 19)
3. Phase 3 : Mettre à jour `@types/react` et `@types/react-dom`
4. Phase 4 : Tests E2E complets
5. Phase 5 : Déploiement progressif (canary → production)

**Effort estimé :** 3 jours-homme

---

### 2. Vite 5.4 → Vite 6

**Bénéfices :**
- Build ~20% plus rapide
- Environment API (SSR amélioré)
- Meilleur support des ESM
- Réduction de la taille du bundle

**Risques :**
- Plugin API modifiée
- `@vitejs/plugin-react-swc` à mettre à jour

**Plan :**
1. Phase 1 : Mettre à jour `@vitejs/plugin-react-swc` vers la dernière version
2. Phase 2 : Mettre à jour Vite 5.4 → 6.x
3. Phase 3 : Vérifier `vite.config.ts` (manualChunks reste compatible)
4. Phase 4 : Tests build + dev server
5. Phase 5 : Tests E2E

**Effort estimé :** 1 jour-homme

---

### 3. Tailwind CSS 3.4 → Tailwind CSS 4

**Bénéfices :**
- Build CSS 10x plus rapide (compiler Rust)
- Configuration CSS-first (`@theme` au lieu de `tailwind.config.ts`)
- Variables CSS natives
- Tailwind Play CDN officiel

**Risques :**
- Refonte complète de `tailwind.config.ts` → `@theme` dans CSS
- Plugin `tailwindcss-animate` à vérifier
- `@tailwindcss/typography` à mettre à jour

**Plan :**
1. Phase 1 : Audit du `tailwind.config.ts` (tokens, couleurs, plugins)
2. Phase 2 : Créer `src/index.css` avec `@theme` blocks
3. Phase 3 : Migrer les tokens HSL vers les nouvelles variables CSS
4. Phase 4 : Tester tous les composants shadcn/ui
5. Phase 5 : Supprimer `tailwind.config.ts` et `postcss.config.js`

**Effort estimé :** 2 jours-homme

---

### 4. Autres mises à jour de dépendances

| Package | Version actuelle | Version cible | Risque |
|---------|-----------------|---------------|--------|
| `date-fns` | 3.6 | 4.x | Faible |
| `next-themes` | 0.3 | 0.4 | Faible |
| `react-day-picker` | 8.10 | 9.x | Moyen (API change) |
| `lucide-react` | 0.462 | 0.5xx | Faible |
| `zod` | 3.25 | 4.x | Moyen (breaking) |

**Effort estimé :** 2 jours-homme

---

## ✅ Prérequis déjà en place

Avant d'entamer ces migrations, ces éléments sont **déjà prêts** grâce à la
remédiation Phase 1-9 :

- ✅ **TypeScript strict** activé (`tsconfig.app.json`)
- ✅ **Tests E2E Playwright** (6 tests smoke)
- ✅ **Tests unitaires Vitest** (coverage ≥ 80%)
- ✅ **CI/CD complète** (6 jobs : lint, typecheck, build, tests, deploy)
- ✅ **Sentry monitoring** (détection des régressions en production)
- ✅ **Health check endpoint** (vérification post-déploiement)
- ✅ **Procédure rollback** documentée (`docs/ROLLBACK.md`)

---

## 🔄 Stratégie de déploiement

Pour chaque migration, suivre cette stratégie :

1. **Branche dédiée** : `chore/migration-react-19`
2. **Tests locaux** : `bun run test && bun run test:e2e`
3. **PR avec CI verte** : tous les 6 jobs doivent passer
4. **Déploiement preview** : Vercel crée automatiquement une preview URL
5. **Validation manuelle** : tester les parcours critiques sur la preview
6. **Déploiement canary** : 10% du trafic pendant 24h
7. **Déploiement production** : si canary OK, promotion en production
8. **Surveillance** : Sentry + health check pendant 48h
9. **Rollback si nécessaire** : voir `docs/ROLLBACK.md`

---

## 📅 Calendrier prévisionnel

| Migration | Début | Fin | Statut |
|-----------|-------|-----|--------|
| `date-fns` 4 | Semaine 1 | Semaine 1 | ⏳ Planifié |
| `next-themes` 0.4 | Semaine 1 | Semaine 1 | ⏳ Planifié |
| `lucide-react` 0.5xx | Semaine 2 | Semaine 2 | ⏳ Planifié |
| `react-day-picker` 9 | Semaine 3 | Semaine 3 | ⏳ Planifié |
| `zod` 4 | Semaine 4 | Semaine 5 | ⏳ Planifié |
| Vite 6 | Semaine 6 | Semaine 6 | ⏳ Planifié |
| Tailwind 4 | Semaine 7 | Semaine 8 | ⏳ Planifié |
| React 19 + Router 7 | Semaine 9 | Semaine 11 | ⏳ Planifié |

**Total :** 11 semaines (Semestre 2 2026)

---

## ⚠️ Risques et mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Régression UI sur Radix UI | Moyenne | Élevé | Tests E2E + review visuelle |
| Build cassé | Faible | Élevé | CI typecheck + build avant merge |
| Bundle plus gros | Faible | Moyen | Vérifier `manualChunks` après migration |
| Performance dégradée | Faible | Élevé | Sentry performance monitoring |
| Incompatibilité librairie | Moyenne | Moyen | Vérifier peer deps avant migration |

---

## 📊 Critères de succès

Une migration est considérée réussie si :
- [ ] Tous les tests E2E passent
- [ ] Coverage ≥ 80% maintenue
- [ ] CI verte sur main
- [ ] Aucune régression Sentry pendant 48h
- [ ] Health check reste "ok"
- [ ] Bundle size ≤ +5% (ou réduction)
- [ ] Validation manuelle des parcours critiques

---

*Document créé lors de la remédiation Phase 9 · Juillet 2026*
