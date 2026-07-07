import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Upload,
  Trash2,
  Image as ImageIcon,
  Search,
  Check,
  Copy,
  FolderOpen,
  Calendar,
  FileType,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { ImageLightbox, LightboxImage } from "@/components/ui/image-lightbox";
import { processFileForUpload } from "@/lib/heic-converter";

interface MediaFile {
  name: string;
  id: string;
  created_at: string;
  metadata: Record<string, any> | null;
  url: string;
}

interface MediaLibraryProps {
  onSelect?: (url: string) => void;
  mode?: "manage" | "select";
  bucket?: string;
}

const BUCKETS = [
  { id: "site-images", label: "Images Site" },
  { id: "site-gallery", label: "Galerie" },
  { id: "site-events", label: "Événements" },
  { id: "site-partners", label: "Partenaires" },
  { id: "site-hero", label: "Hero" },
  { id: "members-photos", label: "Photos Membres" },
  { id: "sport-logos", label: "Logos Sport" },
  { id: "justificatifs", label: "Justificatifs" },
];

export const MediaLibrary = ({ 
  onSelect, 
  mode = "manage",
  bucket: defaultBucket = "site-images" 
}: MediaLibraryProps) => {
  const queryClient = useQueryClient();
  const [selectedBucket, setSelectedBucket] = useState(defaultBucket);
  const [searchTerm, setSearchTerm] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Fetch files from bucket
  const { data: files, isLoading } = useQuery({
    queryKey: ["media-library", selectedBucket],
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(selectedBucket)
        .list("", {
          limit: 500,
          sortBy: { column: "created_at", order: "desc" },
        });

      if (error) throw error;

      // Get public URLs for each file
      const filesWithUrls = await Promise.all(
        (data || [])
          .filter((file) => file.name !== ".emptyFolderPlaceholder")
          .map(async (file) => {
            const { data: urlData } = supabase.storage
              .from(selectedBucket)
              .getPublicUrl(file.name);
            
            return {
              ...file,
              url: urlData.publicUrl,
            } as MediaFile;
          })
      );

      return filesWithUrls;
    },
  });

  // Upload mutation with HEIC support
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // Process file (converts HEIC to JPEG if needed)
      const processedFile = await processFileForUpload(file);
      const fileName = `${Date.now()}-${processedFile.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      
      const { error } = await supabase.storage
        .from(selectedBucket)
        .upload(fileName, processedFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) throw error;
      return fileName;
    },
    onSuccess: () => {
      toast.success("Fichier uploadé avec succès");
      queryClient.invalidateQueries({ queryKey: ["media-library", selectedBucket] });
    },
    onError: (error: any) => {
      toast.error(`Erreur lors de l'upload: ${error.message}`);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (fileName: string) => {
      const { error } = await supabase.storage
        .from(selectedBucket)
        .remove([fileName]);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fichier supprimé");
      queryClient.invalidateQueries({ queryKey: ["media-library", selectedBucket] });
      setSelectedFile(null);
      setPreviewOpen(false);
    },
    onError: (error: any) => {
      toast.error(`Erreur lors de la suppression: ${error.message}`);
    },
  });

  // Handle file upload
  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setUploading(true);
    
    for (let i = 0; i < selectedFiles.length; i++) {
      await uploadMutation.mutateAsync(selectedFiles[i]);
    }
    
    setUploading(false);
    e.target.value = "";
  }, [uploadMutation]);

  // Handle drag and drop
  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const droppedFiles = e.dataTransfer.files;
    if (!droppedFiles || droppedFiles.length === 0) return;

    setUploading(true);
    
    for (let i = 0; i < droppedFiles.length; i++) {
      await uploadMutation.mutateAsync(droppedFiles[i]);
    }
    
    setUploading(false);
  }, [uploadMutation]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Copy URL to clipboard
  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("URL copiée dans le presse-papiers");
  };

  // Filter files
  const filteredFiles = files?.filter((file) =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Convert files to lightbox format
  const lightboxImages: LightboxImage[] = useMemo(() => {
    return (filteredFiles || []).map(file => ({
      url: file.url,
      title: file.name,
    }));
  }, [filteredFiles]);

  const handleSelect = (file: MediaFile, index: number) => {
    if (mode === "select" && onSelect) {
      onSelect(file.url);
    } else {
      // Open lightbox for viewing
      setLightboxIndex(index);
      setLightboxOpen(true);
      setSelectedFile(file);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header avec filtres */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <Label>Bucket</Label>
          <Select value={selectedBucket} onValueChange={setSelectedBucket}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUCKETS.map((bucket) => (
                <SelectItem key={bucket.id} value={bucket.id}>
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" />
                    {bucket.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Label>Recherche</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un fichier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {/* Zone d'upload */}
      <Card
        className="border-dashed border-2 hover:border-primary transition-colors cursor-pointer"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Upload className="h-10 w-10 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-2">
            Glissez-déposez des fichiers ici ou
          </p>
          <Label htmlFor="file-upload">
            <Button variant="outline" disabled={uploading} asChild>
              <span>
                {uploading ? "Upload en cours..." : "Parcourir"}
              </span>
            </Button>
          </Label>
          <Input
            id="file-upload"
            type="file"
            multiple
            accept="image/*,.heic,.heif"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{filteredFiles?.length || 0} fichier(s)</span>
        <Badge variant="outline">{selectedBucket}</Badge>
      </div>

      {/* Grille de fichiers */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(12)].map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      ) : filteredFiles && filteredFiles.length > 0 ? (
        <ScrollArea className="h-[500px]">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 p-1">
            {filteredFiles.map((file, index) => (
              <Card
                key={file.id}
                className={`group cursor-pointer overflow-hidden hover:ring-2 hover:ring-primary transition-all ${
                  mode === "select" ? "hover:scale-105" : ""
                }`}
                onClick={() => handleSelect(file, index)}
              >
                <div className="aspect-square relative bg-muted">
                  <img
                    src={file.url}
                    alt={file.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/placeholder.svg";
                    }}
                  />
                  {mode === "select" && (
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Check className="h-8 w-8 text-white" />
                    </div>
                  )}
                </div>
                <CardContent className="p-2">
                  <p className="text-xs truncate" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatSize(file.metadata?.size || 0)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Aucun fichier trouvé</p>
          </CardContent>
        </Card>
      )}

      {/* Dialog de prévisualisation */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              {selectedFile?.name}
            </DialogTitle>
            <DialogDescription>
              Prévisualisation et actions
            </DialogDescription>
          </DialogHeader>

          {selectedFile && (
            <div className="space-y-4">
              <div className="relative bg-muted rounded-lg overflow-hidden">
                <img
                  src={selectedFile.url}
                  alt={selectedFile.name}
                  className="w-full max-h-[400px] object-contain"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <FileType className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedFile.metadata?.mimetype || "image"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {format(parseISO(selectedFile.created_at), "dd MMM yyyy", { locale: fr })}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Input value={selectedFile.url} readOnly className="flex-1 text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyUrl(selectedFile.url)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex justify-between">
                {onSelect && (
                  <Button onClick={() => {
                    onSelect(selectedFile.url);
                    setPreviewOpen(false);
                  }}>
                    <Check className="h-4 w-4 mr-2" />
                    Sélectionner
                  </Button>
                )}

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Supprimer
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                      <AlertDialogDescription>
                        Cette action est irréversible. Le fichier sera définitivement supprimé.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate(selectedFile.name)}
                        className="bg-destructive text-destructive-foreground"
                      >
                        Supprimer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Lightbox for image viewing */}
      <ImageLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />
    </div>
  );
};

export default MediaLibrary;
