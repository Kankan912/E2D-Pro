/**
 * Convertit une URL Google Drive en URL d'affichage direct
 * @param url - URL Google Drive (view, sharing, etc.)
 * @returns URL d'affichage direct ou URL originale si non convertible
 */
export function convertGoogleDriveUrl(url: string): string {
  // Formats supportés:
  // https://drive.google.com/file/d/FILE_ID/view
  // https://drive.google.com/open?id=FILE_ID
  // https://drive.google.com/uc?id=FILE_ID

  const fileIdMatch =
    url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    url.match(/[?&]id=([a-zA-Z0-9_-]+)/);

  if (fileIdMatch) {
    const fileId = fileIdMatch[1];
    // URL pour affichage direct (images/vidéos)
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }

  return url;
}

/**
 * Convertit une URL OneDrive en URL de téléchargement direct
 * @param url - URL OneDrive partagée
 * @returns URL de téléchargement direct ou URL originale si non convertible
 */
export function convertOneDriveUrl(url: string): string {
  // Formats supportés:
  // https://1drv.ms/i/s!xxxxx
  // https://onedrive.live.com/embed?...

  if (url.includes("1drv.ms")) {
    // Convertir en URL embed pour affichage direct
    const shortId = url.split("/").pop();
    return `https://onedrive.live.com/embed?resid=${shortId}`;
  }

  if (url.includes("onedrive.live.com")) {
    // Si c'est déjà une URL embed, la garder
    if (url.includes("/embed")) {
      return url;
    }
    // Sinon, essayer de la convertir en embed
    return url.replace("/view", "/embed").replace("/download", "/embed");
  }

  return url;
}

/**
 * Détecte si une URL est un lien externe (Google Drive, OneDrive, ou lien direct)
 * @param url - URL à vérifier
 * @returns true si c'est un lien externe
 */
export function isExternalUrl(url: string): boolean {
  if (!url) return false;

  return (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.includes("drive.google.com") ||
    url.includes("1drv.ms") ||
    url.includes("onedrive.live.com")
  );
}

/**
 * Convertit automatiquement les URLs externes en URLs d'affichage
 * @param url - URL à convertir
 * @returns URL convertie pour affichage direct
 */
export function processExternalUrl(url: string): string {
  if (!url) return url;

  if (url.includes("drive.google.com")) {
    return convertGoogleDriveUrl(url);
  }

  if (url.includes("1drv.ms") || url.includes("onedrive.live.com")) {
    return convertOneDriveUrl(url);
  }

  return url;
}

/**
 * Valide qu'une URL de média est accessible
 * @param url - URL à valider
 * @returns Objet avec isValid et le type détecté
 */
export async function validateMediaUrl(
  url: string
): Promise<{ isValid: boolean; type: "image" | "video" | "unknown" }> {
  if (!url) return { isValid: false, type: "unknown" };

  try {
    // Détection du type par extension
    const lowerUrl = url.toLowerCase();
    if (
      lowerUrl.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/) ||
      url.includes("drive.google.com") ||
      url.includes("1drv.ms")
    ) {
      return { isValid: true, type: "image" };
    }

    if (lowerUrl.match(/\.(mp4|webm|ogg|mov|avi)(\?|$)/)) {
      return { isValid: true, type: "video" };
    }

    return { isValid: true, type: "unknown" };
  } catch {
    return { isValid: false, type: "unknown" };
  }
}

/**
 * Formate la taille d'un fichier en lecture humaine
 * @param bytes - Taille en bytes
 * @returns Chaîne formatée (ex: "2.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}
