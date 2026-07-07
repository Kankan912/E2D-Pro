import { z } from "zod";

/**
 * Schémas zod pour les formulaires d'administration du site public.
 * Centralisés ici afin d'être réutilisables et testables.
 * Messages d'erreur en français (Core rule UI/UX).
 */

const optionalUrl = z
  .string()
  .trim()
  .max(2048, { message: "URL trop longue (max 2048 caractères)" })
  .url({ message: "URL invalide" })
  .or(z.literal(""))
  .optional()
  .nullable();

const optionalString = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: `Maximum ${max} caractères` })
    .optional()
    .or(z.literal(""))
    .nullable();

const ordreSchema = z.coerce
  .number({ invalid_type_error: "Doit être un nombre" })
  .int({ message: "Doit être un entier" })
  .min(0, { message: "Doit être ≥ 0" })
  .max(9999, { message: "Doit être ≤ 9999" })
  .optional()
  .default(0);

/* ---------------------- HERO ---------------------- */
export const heroSchema = z.object({
  badge_text: optionalString(80),
  titre: z
    .string()
    .trim()
    .min(1, { message: "Titre requis" })
    .max(150, { message: "Maximum 150 caractères" }),
  sous_titre: z
    .string()
    .trim()
    .min(1, { message: "Sous-titre requis" })
    .max(500, { message: "Maximum 500 caractères" }),
  image_url: optionalUrl,
  media_source: optionalString(50),
  bouton_1_texte: optionalString(50),
  bouton_1_lien: optionalString(500),
  bouton_2_texte: optionalString(50),
  bouton_2_lien: optionalString(500),
  stat_1_nombre: optionalString(20),
  stat_1_label: optionalString(60),
  stat_2_nombre: optionalString(20),
  stat_2_label: optionalString(60),
  stat_3_nombre: optionalString(20),
  stat_3_label: optionalString(60),
});
export type HeroFormValues = z.infer<typeof heroSchema>;

/* ---------------------- PARTNERS ---------------------- */
export const partnerSchema = z.object({
  nom: z
    .string()
    .trim()
    .min(1, { message: "Nom requis" })
    .max(100, { message: "Maximum 100 caractères" }),
  logo_url: optionalUrl,
  media_source: optionalString(50),
  site_web: optionalUrl,
  description: optionalString(500),
  ordre: ordreSchema,
});
export type PartnerFormValues = z.infer<typeof partnerSchema>;

/* ---------------------- ACTIVITIES ---------------------- */
export const activitySchema = z.object({
  titre: z
    .string()
    .trim()
    .min(1, { message: "Titre requis" })
    .max(120, { message: "Maximum 120 caractères" }),
  description: z
    .string()
    .trim()
    .min(1, { message: "Description requise" })
    .max(1000, { message: "Maximum 1000 caractères" }),
  icon: z
    .string()
    .trim()
    .min(1, { message: "Icône requise" })
    .max(40, { message: "Maximum 40 caractères" }),
  ordre: ordreSchema,
  features: z
    .string()
    .trim()
    .min(1, { message: "Au moins une caractéristique requise" })
    .max(500, { message: "Maximum 500 caractères" }),
});
export type ActivityFormValues = z.infer<typeof activitySchema>;

/* ---------------------- EVENTS ---------------------- */
export const eventSchema = z.object({
  titre: z
    .string()
    .trim()
    .min(1, { message: "Titre requis" })
    .max(150, { message: "Maximum 150 caractères" }),
  type: z
    .string()
    .trim()
    .min(1, { message: "Type requis" })
    .max(60, { message: "Maximum 60 caractères" }),
  date: z
    .string()
    .min(1, { message: "Date requise" })
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Format de date invalide" }),
  heure: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, { message: "Heure invalide" })
    .optional()
    .or(z.literal("")),
  lieu: z
    .string()
    .trim()
    .min(1, { message: "Lieu requis" })
    .max(150, { message: "Maximum 150 caractères" }),
  image_url: optionalUrl,
  media_source: optionalString(50),
  description: optionalString(2000),
  ordre: ordreSchema,
  album_id: z.string().uuid({ message: "Album invalide" }).optional().or(z.literal("")).nullable(),
});
export type EventFormValues = z.infer<typeof eventSchema>;

/* ---------------------- GALLERY ---------------------- */
export const gallerySchema = z
  .object({
    titre: z
      .string()
      .trim()
      .min(1, { message: "Titre requis" })
      .max(150, { message: "Maximum 150 caractères" }),
    categorie: z.enum(["Photo", "Vidéo"], { errorMap: () => ({ message: "Catégorie invalide" }) }),
    ordre: ordreSchema,
    image_url: optionalUrl,
    video_url: optionalUrl,
    media_source: optionalString(50),
  })
  .refine(
    (data) =>
      (data.categorie === "Photo" && !!data.image_url) ||
      (data.categorie === "Vidéo" && !!data.video_url),
    { message: "Le média est requis", path: ["image_url"] },
  );
export type GalleryFormValues = z.infer<typeof gallerySchema>;

export const galleryAlbumSchema = z.object({
  titre: z
    .string()
    .trim()
    .min(1, { message: "Titre requis" })
    .max(150, { message: "Maximum 150 caractères" }),
  description: optionalString(500),
  ordre: ordreSchema,
  cover_image_url: optionalUrl,
});
export type GalleryAlbumFormValues = z.infer<typeof galleryAlbumSchema>;

/* ---------------------- ABOUT ---------------------- */
export const valeurSchema = z.object({
  icone: z.string().trim().min(1, { message: "Icône requise" }).max(40),
  titre: z.string().trim().min(1, { message: "Titre requis" }).max(100),
  description: z.string().trim().min(1, { message: "Description requise" }).max(500),
});

export const aboutSchema = z.object({
  titre: z.string().trim().min(1, { message: "Titre requis" }).max(150),
  sous_titre: z.string().trim().max(500, { message: "Maximum 500 caractères" }).optional().or(z.literal("")),
  histoire_titre: z.string().trim().max(150, { message: "Maximum 150 caractères" }).optional().or(z.literal("")),
  histoire_contenu: z.string().trim().max(5000, { message: "Maximum 5000 caractères" }).optional().or(z.literal("")),
  valeurs: z.array(valeurSchema).max(20, { message: "Maximum 20 valeurs" }),
});
export type AboutFormValues = z.infer<typeof aboutSchema>;

/* ---------------------- CONFIG (dynamic) ---------------------- */
/**
 * Valide un couple (type, valeur) provenant de la table `configurations`.
 * Retourne `null` si valide, sinon le message d'erreur en français.
 */
export function validateConfigValue(type: string | null | undefined, value: string): string | null {
  const v = (value ?? "").trim();
  if (v === "") return null; // vide autorisé (champ optionnel)
  if (v.length > 2048) return "Valeur trop longue (max 2048 caractères)";

  switch (type) {
    case "email": {
      const ok = z.string().email().safeParse(v).success;
      return ok ? null : "Adresse email invalide";
    }
    case "url": {
      const ok = z.string().url().safeParse(v).success;
      return ok ? null : "URL invalide";
    }
    case "color": {
      return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? null : "Couleur hex invalide (#fff ou #ffffff)";
    }
    case "phone": {
      return /^[+\d\s().-]{6,20}$/.test(v) ? null : "Numéro de téléphone invalide";
    }
    default:
      return null;
  }
}
