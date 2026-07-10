import { z } from "zod";

/**
 * Schémas Zod pour le module Dons (Phase 3-d / Task 19).
 *
 * Historique :
 * - Avant Phase 3-d : `donorInfoSchema` et `donationAmountSchema` existaient
 *   mais N'ÉTAIENT PAS utilisés par `Don.tsx` (Task 4 P1 #4). Le formulaire
 *   public insérait en base avec juste un check `!donorName || !donorEmail`.
 * - Phase 3-d : `donationFormSchema` (ci-dessous) combine infos donateur +
 *   montant + méthode de paiement + honeypot anti-spam. Il est câblé à
 *   `Don.tsx` via `react-hook-form` + `zodResolver`.
 *
 * Devise : `FCFA` a été ajouté à l'enum `currency` (Task 4 P2 #14 — la valeur
 * par défaut dans `types/donations.ts` est `FCFA` mais l'enum zod l'omettait,
 * rendant le schema inutilisable pour le form public FCFA).
 */

export const donorInfoSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Email invalide"),
  phone: z.string().optional(),
  message: z.string().optional(),
});

export const donationAmountSchema = z.object({
  amount: z.number().min(1, "Le montant doit être supérieur à 0"),
  // Phase 3-d : `FCFA` ajouté (P2 Task 4 #14). La devise par défaut du formulaire
  // public est FCFA — l'enum doit refléter `DonationCurrency` de `types/donations.ts`.
  currency: z.enum(['FCFA', 'EUR', 'USD', 'GBP', 'CAD', 'CHF']).default('FCFA'),
  isRecurring: z.boolean().default(false),
  frequency: z.enum(['monthly', 'yearly']).optional(),
});

export const adhesionSchema = z.object({
  nom: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  prenom: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
  email: z.string().email("Email invalide"),
  telephone: z.string().min(10, "Numéro de téléphone invalide"),
  type_adhesion: z.enum(['e2d', 'phoenix', 'both']),
  message: z.string().optional(),
  accepte_conditions: z.boolean().refine((val) => val === true, {
    message: "Vous devez accepter les conditions",
  }),
});

/**
 * Schéma complet du formulaire public de don (Phase 3-d / Task 19).
 *
 * Combine :
 *  - infos donateur (nom, email, téléphone, message)
 *  - montant + devise + récurrent + fréquence
 *  - méthode de paiement (enum strict — empêche l'injection de méthodes arbitraires)
 *  - honeypot `website` (anti-spam — doit rester vide ; voir commentaire dans Don.tsx)
 *
 * Bornes du montant : 1 à 1 000 000 (couvre les presets 1k→50k FCFA + marge pour
 * les dons personnalisés tout en empêchant les montants absurdes qui planteraient
 * `DECIMAL(10,2)` côté DB — cf. Task 5 P1 #13 sur la précision NUMERIC).
 */
export const donationFormSchema = z.object({
  donorName: z
    .string()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(100, "Le nom ne doit pas dépasser 100 caractères"),
  donorEmail: z
    .string()
    .min(1, "L'email est requis")
    .email("Email invalide")
    .max(255, "L'email ne doit pas dépasser 255 caractères"),
  donorPhone: z
    .string()
    .max(20, "Le numéro ne doit pas dépasser 20 caractères")
    .optional()
    .or(z.literal("")),
  amount: z
    .number({ invalid_type_error: "Le montant doit être un nombre" })
    .min(1, "Le montant doit être supérieur à 0")
    .max(1000000, "Le montant ne peut pas dépasser 1 000 000"),
  currency: z.enum(['FCFA', 'EUR', 'USD', 'GBP', 'CAD', 'CHF']),
  paymentMethod: z.enum([
    'bank_transfer',
    'orange_money',
    'mtn_money',
    'stripe',
    'paypal',
    'helloasso',
  ]),
  isRecurring: z.boolean(),
  frequency: z.enum(['monthly', 'yearly']).optional(),
  donorMessage: z
    .string()
    .max(1000, "Le message ne doit pas dépasser 1000 caractères")
    .optional()
    .or(z.literal("")),
  /**
   * Honeypot anti-spam (Phase 3-d / Task 19 Fix 3 — Option C).
   * Champ caché `website` : les bots remplissent automatiquement tous les
   * inputs textuels ; les humains ne le voient jamais (sr-only, tabIndex=-1,
   * autoComplete="off"). Si non-vide à la soumission, on "réussit"
   * silencieusement sans insérer en base (voir `Don.tsx` onSubmit).
   *
   * TODO (Phase 4) : migrer vers Cloudflare Turnstile (privacy-friendly, free)
   * pour une protection plus robuste. Le honeypot reste utile en complément
   * (Turnstile peut être contourné par du solving humain, le honeypot catch
   * les bots génériques qui ne respectent pas les conventions d'accessibilité).
   */
  website: z.string().optional(),
});

export type DonorInfo = z.infer<typeof donorInfoSchema>;
export type DonationAmount = z.infer<typeof donationAmountSchema>;
export type AdhesionForm = z.infer<typeof adhesionSchema>;
export type DonationFormValues = z.infer<typeof donationFormSchema>;
