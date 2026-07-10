# CMS E2D Connect - Implémentation Complète

**Version:** 3.0  
**Dernière mise à jour:** Janvier 2026

---

## ✅ Architecture CMS

### Tables CMS (7 tables)

| Table | Description | Bucket Storage |
|-------|-------------|----------------|
| `cms_hero_slides` | Slides du carousel Hero | `site-hero` |
| `cms_sections` | Sections de pages | - |
| `cms_events` | Événements publics | `site-events` |
| `cms_gallery` | Photos et vidéos | `site-gallery` |
| `cms_partners` | Partenaires | `site-partners` |
| `cms_settings` | Configuration clé-valeur | `site-images` |
| `cms_pages` | Pages CMS | - |

### Buckets Storage (5 buckets)

- `site-hero` : Images Hero carousel
- `site-gallery` : Photos et vidéos galerie
- `site-partners` : Logos partenaires
- `site-events` : Images événements
- `site-images` : Images système (logo, fallbacks)

### Politiques RLS

- **Lecture publique** : Contenu actif visible par tous
- **Gestion admin** : INSERT/UPDATE/DELETE réservés aux admins

---

## ✅ Pages Admin CMS

| Route | Composant | Description |
|-------|-----------|-------------|
| `/dashboard/admin/site/hero` | `HeroAdmin.tsx` | Gestion carousel Hero |
| `/dashboard/admin/site/about` | `AboutAdmin.tsx` | Section À Propos |
| `/dashboard/admin/site/activities` | `ActivitiesAdmin.tsx` | CRUD Activités |
| `/dashboard/admin/site/events` | `EventsAdmin.tsx` | CRUD Événements |
| `/dashboard/admin/site/gallery` | `GalleryAdmin.tsx` | Gestion Photos/Vidéos + Albums |
| `/dashboard/admin/site/partners` | `PartnersAdmin.tsx` | CRUD Partenaires |
| `/dashboard/admin/site/config` | `ConfigAdmin.tsx` | Configuration générale |
| `/dashboard/admin/site/images` | `ImagesAdmin.tsx` | Images du site |
| `/dashboard/admin/site/messages` | `MessagesAdmin.tsx` | Messages contact |

---

## ✅ Hook Principal

**Fichier :** `src/hooks/useSiteContent.ts`

### Hooks Disponibles

```typescript
// Lecture
useSiteHero()           // Données Hero
useSiteAbout()          // Données À Propos
useSiteActivities()     // Liste activités
useSiteEvents()         // Liste événements
useSiteGallery()        // Liste médias galerie
useSitePartners()       // Liste partenaires
useSiteConfig()         // Configuration

// Mutations
useUpdateSiteHero()     // MAJ Hero
useUpdateSiteAbout()    // MAJ À Propos
useCreateActivity()     // Créer activité
useUpdateActivity()     // MAJ activité
useDeleteActivity()     // Supprimer activité
// ... etc pour chaque entité
```

---

## ✅ Composants Publics

| Composant | Hook utilisé | Fallback configurable |
|-----------|--------------|----------------------|
| `Hero.tsx` | `useSiteHero()` | `hero_fallback_image` |
| `About.tsx` | `useSiteAbout()` | - |
| `Activities.tsx` | `useSiteActivities()` | - |
| `Events.tsx` | `useSiteEvents()` | `events_fallback_image` |
| `Gallery.tsx` | `useSiteGallery()` | - |
| `Partners.tsx` | `useSitePartners()` | - |
| `Contact.tsx` | `useSiteConfig()` | - |
| `Footer.tsx` | `useSiteConfig()` | - |

---

## ✨ Images du Site Configurables

Les images suivantes sont configurables via le CMS :

| Image | Clé `cms_settings` | Fallback par défaut |
|-------|-------------------|---------------------|
| Hero fallback | `hero_fallback_image` | `/src/assets/hero-sports.jpg` |
| Events fallback | `events_fallback_image` | `/src/assets/team-celebration.jpg` |
| Logo du site | `site_logo` | `/src/assets/logo-e2d.png` |

**Page admin :** `/dashboard/admin/site/images` (ImagesAdmin.tsx)

---

## ✨ Synchronisation Sport E2D (v3.0)

### Architecture

Les matchs E2D publiés sont automatiquement synchronisés vers `cms_events` :

```typescript
// src/lib/sync-events.ts
syncAllSportEventsToWebsite(includeAll: boolean)
syncE2DMatchToWebsite(match: E2DMatch)
removeE2DEventFromCMS(matchId: string)
```

### Champs de synchronisation

| Champ `cms_events` | Source |
|--------------------|--------|
| `match_id` | `sport_e2d_matchs.id` |
| `match_type` | 'e2d' |
| `auto_sync` | true |
| `title` | Adversaire + date |
| `event_date` | Date du match |
| `location` | Lieu du match |
| `description` | Score si terminé |

### Logique de publication

- `statut_publication = 'publie'` → Visible sur le site
- `statut_publication = 'brouillon'` → Retiré du site
- `statut_publication = 'archive'` → Retiré du site

### Page publique détaillée

**Route :** `/evenements/:id` (EventDetail.tsx)

Affiche pour les matchs E2D :
- ✅ Informations du match (date, lieu, adversaire)
- ✅ Score final (si match terminé)
- ✅ Compte rendu complet (6 champs)
- ✅ Statistiques joueurs (buteurs, passeurs, cartons)
- ✅ Homme du match
- ✅ Galerie médias

---

## ✅ Structure des Fichiers

```
src/
├── components/
│   ├── Hero.tsx              # Carousel dynamique
│   ├── About.tsx             # Section À Propos
│   ├── Activities.tsx        # Cards activités
│   ├── Events.tsx            # Liste événements + matchs
│   ├── Gallery.tsx           # Galerie avec albums
│   ├── Partners.tsx          # Grid partenaires
│   ├── Contact.tsx           # Formulaire contact
│   └── Footer.tsx            # Footer dynamique
├── pages/
│   ├── EventDetail.tsx       # Détail événement/match
│   └── admin/site/
│       ├── HeroAdmin.tsx
│       ├── AboutAdmin.tsx
│       ├── ActivitiesAdmin.tsx
│       ├── EventsAdmin.tsx
│       ├── GalleryAdmin.tsx
│       ├── PartnersAdmin.tsx
│       ├── ConfigAdmin.tsx
│       ├── ImagesAdmin.tsx
│       └── MessagesAdmin.tsx
├── hooks/
│   └── useSiteContent.ts     # Hooks CMS complets
└── lib/
    ├── storage-utils.ts      # Upload Supabase Storage
    ├── media-utils.ts        # Gestion médias hybrides
    └── sync-events.ts        # Synchronisation Sport
```

---

## ⚠️ Notes Architecture v3.0

1. **Table unifiée présences** : `reunions_presences` (legacy `reunion_presences` supprimée)

2. **Vue statistiques E2D** : `e2d_player_stats_view` avec `SECURITY INVOKER = true`

3. **Compte rendu match** : 6 champs affichés si renseignés
   - `resume`, `faits_marquants`, `score_mi_temps`
   - `conditions_jeu`, `ambiance`, `arbitrage_commentaire`

4. **Bouton sync manuel** : Page Sport E2D permet de forcer la synchronisation

---

## 🚀 Utilisation

1. Connectez-vous en tant qu'admin
2. Accédez à "Site Web" dans la sidebar
3. Modifiez le contenu de chaque section
4. Les changements s'affichent immédiatement sur le site public
5. Les matchs E2D publiés apparaissent automatiquement dans les événements

---

**Document mis à jour** : Janvier 2026  
**Version** : 3.0
