import { useCallback, useState, useRef, useMemo } from 'react';
import { useMatchMedias, MatchMedia } from '@/hooks/useMatchMedias';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Upload, Trash2, ImageIcon, Video, Loader2, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ImageLightbox, LightboxImage } from '@/components/ui/image-lightbox';

interface MatchMediaManagerProps {
  matchId: string;
  readOnly?: boolean;
}

export function MatchMediaManager({ matchId, readOnly = false }: MatchMediaManagerProps) {
  const { medias, isLoading, uploadMedia, updateLegende, deleteMedia, isUploading, isDeleting } = useMatchMedias(matchId);
  const [isDragging, setIsDragging] = useState(false);
  const [editingMedia, setEditingMedia] = useState<MatchMedia | null>(null);
  const [legendeInput, setLegendeInput] = useState('');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!readOnly) setIsDragging(true);
  }, [readOnly]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (readOnly) return;

    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => {
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        uploadMedia({ file });
      }
    });
  }, [readOnly, uploadMedia]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      uploadMedia({ file });
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleEditLegende = (media: MatchMedia) => {
    setEditingMedia(media);
    setLegendeInput(media.legende || '');
  };

  const handleSaveLegende = () => {
    if (editingMedia) {
      updateLegende({ id: editingMedia.id, legende: legendeInput });
      setEditingMedia(null);
      setLegendeInput('');
    }
  };

  // Convert medias to lightbox format
  const lightboxImages: LightboxImage[] = useMemo(() => {
    return medias.map(media => ({
      url: media.url,
      title: media.legende || undefined,
      isVideo: media.type === 'video',
    }));
  }, [medias]);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Zone d'upload */}
      {!readOnly && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
            isDragging 
              ? "border-primary bg-primary/5" 
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,.heic,.heif"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="flex flex-col items-center gap-2">
            {isUploading ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Upload en cours...</p>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Glissez-déposez des images ou vidéos ici
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Parcourir les fichiers
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Grille des médias */}
      {medias.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          Aucun média pour ce match
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {medias.map((media, index) => (
            <Card key={media.id} className="overflow-hidden group relative">
              <CardContent className="p-0">
                <div 
                  className="aspect-square relative cursor-pointer"
                  onClick={() => openLightbox(index)}
                >
                  {media.type === 'image' ? (
                    <img
                      src={media.url}
                      alt={media.legende || 'Photo du match'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <Video className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  
                  {/* Overlay avec icône */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    {media.type === 'image' ? (
                      <ImageIcon className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    ) : (
                      <Video className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </div>

                {/* Légende */}
                {media.legende && (
                  <p className="text-xs text-muted-foreground p-2 truncate">
                    {media.legende}
                  </p>
                )}

                {/* Actions */}
                {!readOnly && (
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditLegende(media);
                      }}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          variant="destructive"
                          className="h-8 w-8"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer ce média ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Cette action est irréversible.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMedia(media.id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            {isDeleting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              'Supprimer'
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal édition légende */}
      <Dialog open={!!editingMedia} onOpenChange={() => setEditingMedia(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la légende</DialogTitle>
          </DialogHeader>
          <Input
            value={legendeInput}
            onChange={(e) => setLegendeInput(e.target.value)}
            placeholder="Entrez une légende..."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMedia(null)}>
              Annuler
            </Button>
            <Button onClick={handleSaveLegende}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox pour prévisualisation */}
      <ImageLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />
    </div>
  );
}
