import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Link2, X, Loader2, Image, Video } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import { getErrorMessage } from "@/lib/errors";
import {
  uploadFile,
  deleteFile,
  isSupabaseStorageUrl,
} from "@/lib/storage-utils";
import {
  processExternalUrl,
  validateMediaUrl,
  formatFileSize,
} from "@/lib/media-utils";

interface MediaUploaderProps {
  bucket: string;
  accept: string; // "image/*", "video/*", "image/*,video/*"
  currentUrl?: string;
  onUrlChange: (url: string, source: "upload" | "external") => void;
  label: string;
  maxSizeMB?: number;
}

export default function MediaUploader({
  bucket,
  accept,
  currentUrl,
  onUrlChange,
  label,
  maxSizeMB = 20,
}: MediaUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [externalUrl, setExternalUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState(currentUrl || "");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const handleFileSelect = async (file: File) => {
    // Validation de la taille
    if (file.size > maxSizeBytes) {
      toast({
        variant: "destructive",
        title: "Fichier trop volumineux",
        description: `La taille maximale est de ${maxSizeMB}MB. Votre fichier fait ${formatFileSize(file.size)}.`,
      });
      return;
    }

    // Validation du type
    const acceptTypes = accept.split(",").map((t) => t.trim());
    const isValidType = acceptTypes.some((type) => {
      if (type === "image/*") return file.type.startsWith("image/");
      if (type === "video/*") return file.type.startsWith("video/");
      return file.type === type;
    });

    if (!isValidType) {
      toast({
        variant: "destructive",
        title: "Type de fichier non supporté",
        description: `Formats acceptés: ${accept}`,
      });
      return;
    }

    setIsUploading(true);

    try {
      // Supprimer l'ancien fichier si c'était un upload Supabase
      if (currentUrl && isSupabaseStorageUrl(currentUrl)) {
        await deleteFile(bucket, currentUrl);
      }

      // Upload du nouveau fichier
      const publicUrl = await uploadFile(bucket, file);
      setPreviewUrl(publicUrl);
      onUrlChange(publicUrl, "upload");

      toast({
        title: "✅ Upload réussi",
        description: "Le fichier a été uploadé avec succès.",
      });
    } catch (error: unknown) {
      logger.error("Upload error:", error);
      toast({
        variant: "destructive",
        title: "Erreur d'upload",
        description:
          error instanceof Error ? getErrorMessage(error) : "Une erreur est survenue.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleExternalUrlSubmit = async () => {
    if (!externalUrl.trim()) {
      toast({
        variant: "destructive",
        title: "URL manquante",
        description: "Veuillez saisir une URL.",
      });
      return;
    }

    // Convertir l'URL si c'est Google Drive ou OneDrive
    const processedUrl = processExternalUrl(externalUrl);

    // Valider l'URL
    const validation = await validateMediaUrl(processedUrl);
    if (!validation.isValid) {
      toast({
        variant: "destructive",
        title: "URL invalide",
        description: "L'URL fournie ne semble pas valide.",
      });
      return;
    }

    // Supprimer l'ancien fichier si c'était un upload Supabase
    if (currentUrl && isSupabaseStorageUrl(currentUrl)) {
      await deleteFile(bucket, currentUrl);
    }

    setPreviewUrl(processedUrl);
    onUrlChange(processedUrl, "external");

    toast({
      title: "✅ URL enregistrée",
      description: "Le lien externe a été enregistré avec succès.",
    });
  };

  const handleRemove = async () => {
    if (currentUrl && isSupabaseStorageUrl(currentUrl)) {
      const deleted = await deleteFile(bucket, currentUrl);
      if (deleted) {
        toast({
          title: "Fichier supprimé",
          description: "Le fichier a été supprimé du stockage.",
        });
      }
    }

    setPreviewUrl("");
    setExternalUrl("");
    onUrlChange("", "external");
  };

  const isVideo = accept.includes("video");
  const isImage = accept.includes("image");

  return (
    <div className="space-y-4">
      <Label>{label}</Label>

      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload">
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="external">
            <Link2 className="w-4 h-4 mr-2" />
            Lien Externe
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={`${accept},.heic,.heif`}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
              className="hidden"
            />

            {isUploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Upload en cours...
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {isImage && <Image className="w-12 h-12 mx-auto text-muted-foreground" />}
                {isVideo && <Video className="w-12 h-12 mx-auto text-muted-foreground" />}
                <div>
                  <p className="text-sm font-medium">
                    Glissez-déposez ou cliquez pour uploader
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {accept.replace(/\*/g, "tous formats")} • Max {maxSizeMB}MB
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Parcourir les fichiers
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="external" className="space-y-4">
          <div className="space-y-2">
            <Input
              placeholder="https://drive.google.com/... ou URL directe"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              💡 Supporté: Google Drive, OneDrive, liens directs (https://...)
            </p>
            <Button
              type="button"
              onClick={handleExternalUrlSubmit}
              className="w-full"
            >
              Enregistrer le lien
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Preview */}
      {previewUrl && (
        <div className="space-y-2">
          <Label>Aperçu</Label>
          <div className="relative border rounded-lg p-4 bg-muted/20">
            {isImage && !isVideo && (
              <img
                src={previewUrl}
                alt="Preview"
                className="max-h-40 mx-auto rounded"
              />
            )}
            {isVideo && (
              <video
                src={previewUrl}
                controls
                className="max-h-40 mx-auto rounded"
              />
            )}
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="absolute top-2 right-2"
              onClick={handleRemove}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
