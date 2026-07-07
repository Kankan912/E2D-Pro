import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Upload, X, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";

interface FileUploadFieldProps {
  label: string;
  value?: string | null;
  onChange: (url: string | null) => void;
  bucket?: string;
  accept?: string;
  maxSizeMB?: number;
}

/**
 * Champ d'upload de fichier.
 * - Pour les buckets PRIVÉS (ex: justificatifs), on stocke uniquement le chemin
 *   du fichier et on génère une URL signée à la demande pour la prévisualisation.
 * - La valeur retournée à `onChange` est le chemin (path) du fichier dans le bucket
 *   pour les buckets privés, ou l'URL publique pour les buckets publics.
 */
const PRIVATE_BUCKETS = new Set(["justificatifs"]);

export default function FileUploadField({
  label,
  value,
  onChange,
  bucket = "justificatifs",
  accept = ".pdf,.jpg,.jpeg,.png,.doc,.docx",
  maxSizeMB = 5,
}: FileUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const isPrivate = PRIVATE_BUCKETS.has(bucket);

  // Génère une URL signée pour les buckets privés (rétrocompatible avec
  // les anciennes valeurs qui contenaient déjà l'URL publique complète).
  useEffect(() => {
    let cancelled = false;
    async function loadPreview() {
      if (!value) {
        setPreviewUrl(null);
        return;
      }
      // Si c'est déjà une URL complète (legacy ou bucket public), on l'utilise telle quelle
      if (value.startsWith("http")) {
        setPreviewUrl(value);
        return;
      }
      if (isPrivate) {
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(value, 60 * 10); // 10 minutes
        if (!cancelled) {
          if (error) {
            logger.error("Erreur génération URL signée", error, { component: "FileUploadField", data: { bucket, path: value } });
            setPreviewUrl(null);
          } else {
            setPreviewUrl(data.signedUrl);
          }
        }
      } else {
        const { data } = supabase.storage.from(bucket).getPublicUrl(value);
        if (!cancelled) setPreviewUrl(data.publicUrl);
      }
    }
    loadPreview();
    return () => {
      cancelled = true;
    };
  }, [value, bucket, isPrivate]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxSizeMB * 1024 * 1024) {
      toast({
        title: "Fichier trop volumineux",
        description: `La taille maximale est de ${maxSizeMB} MB`,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // PERFORMANCE (Audit Fix #41 / P3): compress images before upload.
      // Reduces bandwidth + storage by 60-80% on average.
      let fileToUpload: File | Blob = file;
      if (file.type.startsWith('image/') && file.type !== 'image/gif' && file.type !== 'image/svg+xml') {
        const { compressImage } = await import('@/lib/image-compression');
        fileToUpload = await compressImage(file, { maxWidth: 1920, quality: 0.85 });
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, fileToUpload);

      if (uploadError) throw uploadError;

      // Pour un bucket privé : on stocke le path. Pour un bucket public : URL publique.
      if (isPrivate) {
        onChange(filePath);
      } else {
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
        onChange(urlData.publicUrl);
      }

      toast({
        title: "Fichier téléversé",
        description: "Le fichier a été téléversé avec succès",
      });
    } catch (error: unknown) {
      logger.error("Erreur upload fichier", error, { component: "FileUploadField", data: { bucket } });
      toast({
        title: "Erreur",
        description:
          "Impossible de téléverser le fichier: " +
          (error instanceof Error ? error.message : "Erreur"),
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!value) return;

    try {
      let filePath = value;
      // Cas legacy : URL complète stockée
      if (value.startsWith("http")) {
        const marker = isPrivate
          ? `/storage/v1/object/sign/${bucket}/`
          : `/storage/v1/object/public/${bucket}/`;
        const parts = value.split(marker);
        if (parts.length === 2) {
          filePath = parts[1].split("?")[0];
        } else {
          filePath = value.split("/").pop() || value;
        }
      }

      await supabase.storage.from(bucket).remove([filePath]);
      onChange(null);

      toast({
        title: "Fichier supprimé",
        description: "Le fichier a été supprimé avec succès",
      });
    } catch (error: unknown) {
      logger.error("Erreur suppression fichier", error, { component: "FileUploadField", data: { bucket } });
      onChange(null);
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      {value ? (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
          <FileText className="w-5 h-5 text-primary flex-shrink-0" />
          {previewUrl ? (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline truncate flex-1"
            >
              Voir le fichier
            </a>
          ) : (
            <span className="text-sm text-muted-foreground truncate flex-1">
              Chargement…
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            className="text-destructive hover:text-destructive"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div className="relative">
          <Input
            type="file"
            accept={accept}
            onChange={handleFileChange}
            disabled={uploading}
            className="cursor-pointer"
          />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="ml-2 text-sm">Téléversement...</span>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Formats acceptés: PDF, JPG, PNG, DOC. Max {maxSizeMB} MB.
      </p>
    </div>
  );
}
