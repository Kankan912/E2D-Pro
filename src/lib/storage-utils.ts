import { supabase } from "@/integrations/supabase/client";
import { processFileForUpload } from "./heic-converter";

import { logger } from "@/lib/logger";
/**
 * Upload un fichier vers un bucket Supabase Storage
 * Convertit automatiquement les fichiers HEIC en JPEG
 * @param bucket - Nom du bucket (site-gallery, site-partners, etc.)
 * @param file - Fichier à uploader
 * @param path - Chemin optionnel dans le bucket
 * @returns URL publique du fichier uploadé
 */
export async function uploadFile(
  bucket: string,
  file: File,
  path?: string
): Promise<string> {
  // Process file (converts HEIC to JPEG if needed)
  const processedFile = await processFileForUpload(file);
  
  const fileExt = processedFile.name.split(".").pop();
  const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
  const filePath = path ? `${path}/${fileName}` : fileName;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, processedFile, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    logger.error("Upload error:", error);
    throw new Error(`Erreur d'upload: ${error.message}`);
  }

  return getPublicUrl(bucket, data.path);
}

/**
 * Supprime un fichier d'un bucket Supabase Storage
 * @param bucket - Nom du bucket
 * @param filePath - Chemin du fichier (extrait de l'URL)
 * @returns true si la suppression a réussi
 */
export async function deleteFile(
  bucket: string,
  fileUrl: string
): Promise<boolean> {
  try {
    // Extraire le chemin du fichier depuis l'URL
    const urlParts = fileUrl.split(`/storage/v1/object/public/${bucket}/`);
    if (urlParts.length < 2) {
      logger.warn("Format d'URL invalide pour la suppression:", fileUrl);
      return false;
    }

    const filePath = urlParts[1];

    const { error } = await supabase.storage.from(bucket).remove([filePath]);

    if (error) {
      logger.error("Delete error:", error);
      return false;
    }

    return true;
  } catch (err: unknown) {
    logger.error("Erreur lors de la suppression:", err);
    return false;
  }
}

/**
 * Obtient l'URL publique d'un fichier
 * @param bucket - Nom du bucket
 * @param filePath - Chemin du fichier dans le bucket
 * @returns URL publique complète
 */
export function getPublicUrl(bucket: string, filePath: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}

/**
 * Vérifie si une URL provient de Supabase Storage
 * @param url - URL à vérifier
 * @returns true si l'URL est de Supabase Storage
 */
export function isSupabaseStorageUrl(url: string): boolean {
  return url.includes("/storage/v1/object/public/");
}
