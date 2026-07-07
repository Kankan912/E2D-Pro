# CAHIER DES CHARGES - SITE WEB E2D CONNECT

**Version:** 3.0  
**Dernière mise à jour:** Janvier 2026

---

## 📋 CONTEXTE DU PROJET

### Présentation
Site web vitrine public pour l'Association Sportive E2D, intégré au portail de gestion complet de l'association. Le site affiche dynamiquement les résultats sportifs et événements de l'association.

### Objectifs
- Présenter l'association et ses activités au grand public
- Afficher les résultats des matchs E2D en temps réel
- Permettre les dons et adhésions en ligne
- Gérer le contenu via un CMS admin intégré

---

## 🎯 PÉRIMÈTRE FONCTIONNEL

### 1. SITE WEB PUBLIC (Frontend)

#### 1.1 Page d'Accueil (`/`)

**A. Section Hero**
- Carousel d'images avec défilement automatique
- Badge personnalisable ("E2D Connect")
- Titre et sous-titre accrocheurs
- 2 boutons d'action (CTA)
- 3 statistiques clés
- Configuration via `cms_hero_slides`

**B. Section À Propos (`#apropos`)**
- Mission et vision de l'association
- Histoire (titre + contenu riche)
- 3-4 valeurs fondamentales avec icônes
- Configuration via `cms_sections`

**C. Section Activités (`#activites`)**
- Cards avec icône, titre, description
- Images illustratives
- CTA "Contactez-nous"
- Configuration via `cms_sections`

**D. Section Événements (`#evenements`)** ✨ v3.0
- Liste des événements à venir
- **Matchs E2D intégrés** avec score si terminé
- Lien vers détail (`/evenements/:id`)
- Configuration via `cms_events` + sync `sport_e2d_matchs`

**E. Section Galerie (`#galerie`)**
- Organisation par albums
- Support photos et vidéos (YouTube/Vimeo)
- Lightbox avec navigation clavier
- Lazy loading optimisé
- Configuration via `cms_gallery`

**F. Section Partenaires (`#partenaires`)**
- Logos des partenaires avec liens
- CTA "Devenir Partenaire"
- Configuration via `cms_partners`

**G. Section Contact (`#contact`)**
- Formulaire (nom, email, téléphone, message)
- Stockage dans `messages_contact`
- Email notification automatique
- Validation Zod

**H. Footer**
- Configuration dynamique via `cms_settings`
- Réseaux sociaux, coordonnées, liens rapides

#### 1.2 Navigation (Navbar)
- Logo E2D
- Menu desktop avec liens d'ancrage
- Menu mobile responsive (burger)
- Bouton "Portail Membre" (lien vers `/auth`)
- Détection scroll et active state

#### 1.3 Page Détail Événement (`/evenements/:id`) ✨ NOUVEAU

**Pour les matchs E2D publiés :**
- Informations du match (date, lieu, adversaire)
- Score final (si terminé)
- Compte rendu complet :
  - Résumé
  - Faits marquants
  - Score mi-temps
  - Conditions de jeu
  - Ambiance
  - Commentaire arbitrage
- Statistiques individuelles :
  - Buteurs avec nombre de buts
  - Passeurs avec nombre de passes
  - Cartons (jaunes et rouges)
- Homme du match (MOTM)
- Galerie médias (photos/vidéos)

#### 1.4 Pages Secondaires

**Page Don (`/don`)**
- Sélection du montant (5 montants + personnalisé)
- 4 méthodes de paiement :
  - Stripe (carte bancaire)
  - PayPal
  - HelloAsso
  - Virement bancaire
- Option don récurrent
- Modal de confirmation
- Email reçu fiscal

**Page Adhésion (`/adhesion`)**
- Formulaire d'inscription membre
- Choix type adhésion (E2D / Phoenix / Les deux)
- Paiement de la cotisation
- Validation et confirmation par email
- Création automatique du compte

---

### 2. SYSTÈME DE GESTION DE CONTENU (CMS)

#### 2.1 Architecture Backend

**Tables CMS :**
| Table | Description |
|-------|-------------|
| `cms_hero_slides` | Slides du carousel Hero |
| `cms_sections` | Sections de pages |
| `cms_events` | Événements publics |
| `cms_gallery` | Photos et vidéos |
| `cms_partners` | Partenaires |
| `cms_settings` | Configuration clé-valeur |
| `cms_pages` | Pages CMS |

**Buckets Storage :**
- `site-hero` : Images Hero
- `site-gallery` : Galerie photos/vidéos
- `site-partners` : Logos partenaires
- `site-events` : Images événements
- `site-images` : Images système

**Sécurité RLS :**
- Lecture publique (SELECT) pour contenu actif
- Gestion réservée aux admins (INSERT/UPDATE/DELETE)

#### 2.2 Pages d'Administration

| Route | Description |
|-------|-------------|
| `/dashboard/admin/site/hero` | Carousel Hero |
| `/dashboard/admin/site/about` | Section À Propos |
| `/dashboard/admin/site/activities` | Activités |
| `/dashboard/admin/site/events` | Événements |
| `/dashboard/admin/site/gallery` | Galerie + Albums |
| `/dashboard/admin/site/partners` | Partenaires |
| `/dashboard/admin/site/config` | Configuration |
| `/dashboard/admin/site/images` | Images système |
| `/dashboard/admin/site/messages` | Messages contact |

---

### 3. SYNCHRONISATION SPORT E2D ✨ v3.0

#### 3.1 Architecture

Les matchs E2D publiés sont automatiquement synchronisés vers le site public :

```
sport_e2d_matchs (statut_publication = 'publie')
        ↓
    sync-events.ts
        ↓
    cms_events (avec match_id, match_type, auto_sync)
        ↓
    Site public (/evenements/:id)
```

#### 3.2 Champs de synchronisation

| `cms_events` | Source `sport_e2d_matchs` |
|--------------|---------------------------|
| `title` | Adversaire + date |
| `event_date` | `date_match` |
| `event_time` | `heure_match` |
| `location` | `lieu` |
| `description` | Score si terminé |
| `match_id` | `id` |
| `match_type` | 'e2d' |
| `auto_sync` | true |

#### 3.3 Logique de publication

- `statut_publication = 'publie'` → Visible sur le site
- `statut_publication = 'brouillon'` → Retiré du site
- `statut_publication = 'archive'` → Retiré du site

#### 3.4 Bouton de synchronisation manuelle

Page Sport E2D inclut un bouton "Synchroniser site" pour forcer la synchronisation de tous les matchs publiés.

---

### 4. SYSTÈME DE DONS & ADHÉSIONS

#### 4.1 Tables Backend
- `donations` - Historique des dons
- `adhesions` - Adhésions membres
- `payment_configs` - Configuration moyens de paiement

#### 4.2 Edge Functions
- `get-payment-config` - Récupération config paiements
- `process-adhesion` - Traitement adhésion
- `send-email` - Envoi emails confirmation
- `donations-stats` - Statistiques dons

#### 4.3 Frontend
- Schémas de validation Zod (`donation-schemas.ts`)
- Utilitaires paiement (`payment-utils.ts`)
- Composants : `DonationAmountSelector`, `PaymentMethodTabs`, `BankTransferInfo`, `DonationSuccessModal`

---

## 🛠️ STACK TECHNIQUE

### Frontend
- **Framework** : React 18 + TypeScript
- **Build** : Vite
- **Routing** : React Router DOM v6
- **Styling** : Tailwind CSS + shadcn/ui
- **State** : React Query (TanStack Query)
- **Forms** : React Hook Form + Zod
- **Icons** : Lucide React

### Backend
- **BaaS** : Supabase (Lovable Cloud)
- **Database** : PostgreSQL
- **Storage** : Supabase Storage (buckets)
- **Auth** : Supabase Auth
- **Functions** : Supabase Edge Functions (Deno)

### Intégrations Paiement
- Stripe (cartes bancaires)
- PayPal
- HelloAsso
- Virement bancaire

---

## 📂 STRUCTURE DES FICHIERS

### Composants Publics
```
src/components/
├── Navbar.tsx           # Navigation responsive
├── Hero.tsx             # Carousel Hero
├── About.tsx            # Section À Propos
├── Activities.tsx       # Cards activités
├── Events.tsx           # Liste événements + matchs
├── Gallery.tsx          # Galerie avec albums
├── Partners.tsx         # Grid partenaires
├── Contact.tsx          # Formulaire contact
├── Footer.tsx           # Footer dynamique
├── SEOHead.tsx          # Meta tags SEO
├── Breadcrumbs.tsx      # Fil d'Ariane
└── LogoHeader.tsx       # Header logo
```

### Pages Publiques
```
src/pages/
├── Index.tsx            # Page d'accueil
├── Don.tsx              # Page de don
├── Adhesion.tsx         # Page d'adhésion
├── EventDetail.tsx      # Détail événement/match
└── MatchResults.tsx     # Résultats matchs
```

### Hooks & Utilitaires
```
src/hooks/
└── useSiteContent.ts    # Hooks React Query CMS

src/lib/
├── storage-utils.ts     # Upload Supabase Storage
├── media-utils.ts       # Gestion médias hybrides
├── payment-utils.ts     # Logique paiements
├── donation-schemas.ts  # Validation formulaires
└── sync-events.ts       # Synchronisation Sport
```

---

## ✅ ÉTAT D'AVANCEMENT

### Complété (100%)

#### Infrastructure
- [x] 7 tables CMS avec RLS
- [x] 5 buckets Supabase Storage
- [x] Migrations SQL appliquées
- [x] Données de démonstration

#### Backend
- [x] Hook `useSiteContent.ts` complet
- [x] 17 Edge Functions déployées
- [x] Synchronisation Sport E2D

#### Admin CMS
- [x] 9 pages admin fonctionnelles
- [x] Composant `MediaUploader`
- [x] Routes protégées
- [x] Images système configurables

#### Frontend Public
- [x] 8 composants dynamiques
- [x] Navbar responsive
- [x] Footer dynamique
- [x] Page détail événement avec stats match
- [x] Lazy loading images
- [x] SEO optimisé

#### Dons/Adhésions
- [x] Page `/don` complète
- [x] Page `/adhesion` complète
- [x] 4 méthodes de paiement
- [x] Validation Zod

---

## 🎨 DESIGN & UX

### Principes
- Design moderne et épuré
- Palette de couleurs E2D (vert/or)
- Responsive mobile-first
- Animations subtiles
- Loading states (skeletons)

### Accessibilité
- Navigation clavier
- Contraste WCAG AA
- ARIA labels
- Focus visible

---

## 🔐 SÉCURITÉ

### Backend
- Row Level Security (RLS) sur toutes les tables
- Authentification Supabase (JWT)
- Permissions granulaires
- Validation côté serveur

### Frontend
- Routes protégées (`AdminRoute`)
- Validation formulaires (Zod)
- Sanitization inputs
- HTTPS obligatoire

---

## 📊 MÉTRIQUES & SEO

### SEO Implémenté
- Meta tags dynamiques (`SEOHead.tsx`)
- Open Graph pour réseaux sociaux
- Sitemap XML
- Robots.txt
- URLs propres

### Performance
- Lazy loading images
- Skeleton loaders
- Optimisation bundle Vite
- Cache React Query

---

## 🚀 DÉPLOIEMENT

### Environnements
- **Production** : Lovable Cloud
- **Base de données** : Supabase Cloud
- **CDN** : Intégré Lovable

### Process
1. Push code sur repo Git
2. Auto-deploy Lovable
3. Vérification admin CMS
4. Publication

---

**Document créé le** : Novembre 2024  
**Dernière mise à jour** : Janvier 2026  
**Version** : 3.0
