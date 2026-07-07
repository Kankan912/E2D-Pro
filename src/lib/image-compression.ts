/**
 * Client-side image compression utility (Audit Fix #41 / P3).
 *
 * Compresses images BEFORE upload to reduce bandwidth and storage.
 * Uses browser Canvas API — no external dependency.
 *
 * Features:
 *   - Auto-resize to max dimension (default 1920px)
 *   - JPEG/WEBP quality control (default 0.85)
 *   - HEIC support (via heic2any if available)
 *   - Preserves EXIF orientation
 *
 * Usage:
 *   const compressed = await compressImage(file, { maxWidth: 1280, quality: 0.8 });
 *   await supabase.storage.from('members-photos').upload(path, compressed);
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0 to 1
  outputType?: 'image/jpeg' | 'image/webp' | 'image/png';
  maxFileSizeMB?: number; // if source is already smaller, skip compression
}

const DEFAULTS: Required<CompressionOptions> = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.85,
  outputType: 'image/jpeg',
  maxFileSizeMB: 5,
};

/**
 * Compress an image file client-side.
 * Returns a Blob (compressed) or the original File if compression isn't beneficial.
 */
export async function compressImage(
  file: File | Blob,
  options: CompressionOptions = {}
): Promise<Blob> {
  const opts = { ...DEFAULTS, ...options };

  // Skip if already small enough
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB < 0.1) {
    return file;
  }

  // Handle HEIC via heic2any (dynamic import to avoid bundle cost)
  if (file.type === 'image/heic' || file.type === 'image/heif') {
    try {
      const heic2any = (await import('heic2any')).default;
      const converted = (await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: opts.quality,
      })) as Blob;
      file = new File([converted], 'converted.jpg', { type: 'image/jpeg' });
    } catch (e) {
      console.warn('[compressImage] HEIC conversion failed, using original:', e);
      return file;
    }
  }

  // Only process raster images
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const { width: srcW, height: srcH } = bitmap;

    // Compute target dimensions (preserve aspect ratio)
    let { maxWidth, maxHeight } = opts;
    let targetW = srcW;
    let targetH = srcH;

    if (srcW > maxWidth || srcH > maxHeight) {
      const ratioW = maxWidth / srcW;
      const ratioH = maxHeight / srcH;
      const ratio = Math.min(ratioW, ratioH);
      targetW = Math.round(srcW * ratio);
      targetH = Math.round(srcH * ratio);
    }

    // Draw to canvas
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close?.();

    // Convert to target format
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, opts.outputType, opts.quality);
    });

    if (!blob) return file;

    // Only use compressed version if it's actually smaller
    return blob.size < file.size ? blob : file;
  } catch (e) {
    console.warn('[compressImage] Compression failed, using original:', e);
    return file;
  }
}

/**
 * Generate a thumbnail (smaller version) of an image.
 * Useful for list views / previews.
 */
export async function generateThumbnail(
  file: File | Blob,
  size: number = 200
): Promise<Blob> {
  return compressImage(file, {
    maxWidth: size,
    maxHeight: size,
    quality: 0.7,
    outputType: 'image/jpeg',
  });
}

/**
 * Get image dimensions without loading the full file.
 */
export async function getImageDimensions(
  file: File | Blob
): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const dims = { width: bitmap.width, height: bitmap.height };
  bitmap.close?.();
  return dims;
}

/**
 * Format file size for display.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
