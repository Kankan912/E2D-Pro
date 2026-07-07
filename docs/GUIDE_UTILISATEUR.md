# Guide Utilisateur — Plateforme E2D

## Table des matières

1. [Connexion et première utilisation](#1-connexion-et-première-utilisation)
2. [Tableau de bord membre](#2-tableau-de-bord-membre)
3. [Profil personnel](#3-profil-personnel)
4. [Guide administrateur](#4-guide-administrateur)
5. [Réunions](#5-réunions)
6. [Finances](#6-finances)
7. [Sport](#7-sport)
8. [Site web (CMS)](#8-site-web-cms)

---

## 1. Connexion et première utilisation

### Se connecter
- Accédez à la page de connexion via le bouton **"Espace membre"** du site.
- Entrez l'email et le mot de passe fournis par l'administrateur.

### Changement de mot de passe obligatoire
- À la première connexion, vous serez redirigé vers une page de changement de mot de passe.
- Choisissez un mot de passe sécurisé (minimum 8 caractères).
- Une fois changé, vous accéderez au tableau de bord.

### Session et sécurité
- Votre session expire après une période d'inactivité.
- Un avertissement apparaîtra avant l'expiration pour vous permettre de prolonger.

---

## 2. Tableau de bord membre

Le tableau de bord affiche un résumé de vos données personnelles :

- **Mes Cotisations** — Historique et état de vos cotisations mensuelles et spéciales.
- **Mes Épargnes** — Solde et historique de vos dépôts d'épargne.
- **Mes Prêts** — Prêts en cours, montants restants, échéances.
- **Mes Sanctions** — Amendes éventuelles et leur statut de paiement.
- **Mes Présences** — Historique de présence aux réunions et événements.
- **Mes Aides** — Aides reçues de l'association.
- **Mes Dons** — Historique de vos dons.

---

## 3. Profil personnel

Accessible via le menu **Profil** :
- Modifier votre nom, prénom, téléphone.
- Voir votre email de connexion.
- Consulter vos rôles dans l'association.

---

## 4. Guide administrateur

### Gestion des membres
- **Menu** : Administration > Membres
- Ajouter, modifier ou désactiver un membre.
- Chaque membre peut être lié à un compte utilisateur.

### Création de comptes utilisateur
- **Menu** : Administration > Utilisateurs
- Créer un compte avec email + mot de passe temporaire.
- L'utilisateur devra changer son mot de passe à la première connexion.

### Attribution de rôles
- **Menu** : Administration > Rôles & Permissions
- 7 rôles disponibles : Administrateur, Trésorier, Secrétaire Général, Responsable Sportif, Censeur, Commissaire, Membre.
- Chaque rôle a des permissions spécifiques configurables.

---

## 5. Réunions

### Créer une réunion
1. Allez dans **Réunions** > **Nouvelle réunion**.
2. Renseignez la date, le lieu et l'ordre du jour.
3. La réunion est créée en statut **Planifiée**.

### Pendant la réunion
- **Présences** — Cochez les membres présents/absents.
- **Cotisations** — Saisissez les paiements de cotisations reçus.
- **Sanctions** — Enregistrez les amendes (retard, absence, etc.).

### Clôturer une réunion
- Cliquez sur **Clôturer** pour finaliser la réunion.
- Un compte-rendu peut être généré et envoyé par email aux membres.

---

## 6. Finances

### Caisse (Trésorerie)
- **Menu** : Administration > Caisse
- Vue du solde global, journal comptable avec débit/crédit.
- Toutes les entrées (cotisations, sanctions, remboursements) et sorties (prêts, aides) sont automatiquement tracées.

### Prêts
- Accorder un prêt à un membre avec montant, taux d'intérêt et échéance.
- Suivre les remboursements par versement.
- Possibilité de reconduire un prêt.

### Aides
- Allouer une aide à un bénéficiaire.
- Différents types d'aides configurables (décès, maladie, etc.).

### Bénéficiaires
- Calendrier des bénéficiaires par exercice.
- Calcul automatique des montants avec déductions éventuelles.

### Épargnes
- Suivi des dépôts d'épargne par membre et par réunion.

---

## 7. Sport

### Section E2D
- Gérer les matchs E2D (création, scores, statistiques joueurs).
- Classements automatiques : général, buteurs, passeurs.
- Tableau de discipline (cartons jaunes/rouges).

### Section Phoenix
- Gestion des matchs Phoenix avec compositions d'équipe.
- Suivi des entraînements et présences.
- Cotisations annuelles spécifiques.

### Fonctionnalités communes
- Médias de match (photos/vidéos).
- Comptes-rendus de match.
- Statistiques détaillées par joueur.

---

## 8. Site web (CMS)

### Modifier le Hero (Bandeau principal)
- **Menu** : Administration > Site > Hero
- Ajouter/modifier les slides du carousel principal.
- Chaque slide : titre, sous-titre, image de fond, bouton CTA.

### Galerie photos
- **Menu** : Administration > Site > Galerie
- Organiser les photos par album.
- Ajouter des légendes et descriptions.

### Événements
- **Menu** : Administration > Site > Événements
- Créer des événements publics avec date, lieu, description.
- Les matchs peuvent être synchronisés automatiquement.

### Partenaires
- **Menu** : Administration > Site > Partenaires
- Ajouter des logos et liens de partenaires.

### Contenu des pages
- **Menu** : Administration > Site > Contenu
- Modifier les textes des sections À propos, Activités, Contact.

---

## Support

Pour toute question technique, contactez l'administrateur de la plateforme via le formulaire de contact du site ou directement par email.

## Nouveautés post-refonte (avril 2026)

### Réouverture d'une réunion clôturée
Une réunion au statut « Terminée » peut être ramenée à « En cours » par un administrateur :
1. Ouvrir la fiche de la réunion concernée.
2. Cliquer sur **Rouvrir la réunion**.
3. Confirmer dans la boîte de dialogue.

Effet : la réunion redevient modifiable. Les cotisations associées sont déverrouillées et les sanctions générées peuvent être ajustées.

### Gestion des albums dans la galerie
Les images publiques peuvent être regroupées en albums :
1. **Admin → Site → Galerie**.
2. Onglet **Albums** : créer un album avec titre, description et image de couverture.
3. À l'upload d'images, sélectionner l'album cible.
4. Côté public, la page `/gallery` affiche d'abord les albums ; clic → page détail `/albums/:id` avec lightbox.

### Verrouillage de l'exercice actif
Un seul exercice cotisations peut être actif à la fois (contrainte serveur).
- Pour modifier un exercice actif, vous devez fournir un **motif** (audit obligatoire).
- Pour activer un autre exercice, l'actuel doit d'abord être basculé en « clôturé ».

### Fiabilité des emails
Les envois d'emails sont automatiquement retentés en cas d'erreur réseau temporaire (3 tentatives). Tous les envois (succès ou échec) sont consultables dans **Admin → Notifications → Historique**.
