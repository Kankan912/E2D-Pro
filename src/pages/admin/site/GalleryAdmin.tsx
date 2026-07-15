import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, Plus, Pencil, Trash2, Image as ImageIcon, Video, FolderPlus, Folder, Upload } from "lucide-react";
import { useSiteGallery, useCreateGalleryItem, useUpdateGalleryItem, useDeleteGalleryItem, useSiteGalleryAlbums, useCreateGalleryAlbum, useUpdateGalleryAlbum, useDeleteGalleryAlbum } from "@/hooks/useSiteContent";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import MediaUploader from "@/components/admin/MediaUploader";
import { toast } from "sonner";
import { uploadFile } from "@/lib/storage-utils";
import { gallerySchema, galleryAlbumSchema, type GalleryFormValues, type GalleryAlbumFormValues } from "@/lib/validation/site-schemas";

import { logger } from "@/lib/logger";

const FieldError = ({ msg }: { msg?: string }) =>
  msg ? <p className="text-xs text-destructive mt-1">{msg}</p> : null;
export default function GalleryAdmin() {
  const { data: gallery, isLoading } = useSiteGallery();
  const { data: albums, isLoading: albumsLoading } = useSiteGalleryAlbums();
  const createItem = useCreateGalleryItem();
  const updateItem = useUpdateGalleryItem();
  const deleteItem = useDeleteGalleryItem();
  const createAlbum = useCreateGalleryAlbum();
  const updateAlbum = useUpdateGalleryAlbum();
  const deleteAlbum = useDeleteGalleryAlbum();
  
  const [open, setOpen] = useState(false);
  const [albumOpen, setAlbumOpen] = useState(false);
  const [multiUploadOpen, setMultiUploadOpen] = useState(false);
  const [multiUploadAlbumId, setMultiUploadAlbumId] = useState<string | null>(null);
  const [isMultiUploading, setIsMultiUploading] = useState(false);
  const [editingItem, setEditingItem] = useState<unknown>(null);
  const [editingAlbum, setEditingAlbum] = useState<unknown>(null);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>("none");
  const [showDeleteItemConfirm, setShowDeleteItemConfirm] = useState(false);
  const [pendingDeleteItemId, setPendingDeleteItemId] = useState<string | null>(null);
  const [showDeleteAlbumConfirm, setShowDeleteAlbumConfirm] = useState(false);
  const [pendingDeleteAlbumId, setPendingDeleteAlbumId] = useState<string | null>(null);
  const multiUploadRef = useRef<HTMLInputElement>(null);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<GalleryFormValues>({
    resolver: zodResolver(gallerySchema),
    defaultValues: { categorie: "Photo", ordre: 0 },
  });
  const {
    register: registerAlbum,
    handleSubmit: handleSubmitAlbum,
    reset: resetAlbum,
    setValue: setValueAlbum,
    formState: { errors: albumErrors },
  } = useForm<GalleryAlbumFormValues>({ resolver: zodResolver(galleryAlbumSchema) });
  const watchCategorie = watch("categorie", "Photo");

  const photos = gallery?.filter(item => item.categorie === "Photo") || [];
  const videos = gallery?.filter(item => item.categorie === "Vidéo") || [];

  // Group photos by album
  const groupedPhotos = photos.reduce((acc, photo) => {
    const albumId = photo.album_id || "sans-album";
    if (!acc[albumId]) acc[albumId] = [];
    acc[albumId].push(photo);
    return acc;
  }, {} as Record<string, typeof photos>);

  const onSubmit = (data: GalleryFormValues) => {
    const payload = {
      ...data,
      album_id: selectedAlbumId === "none" ? null : selectedAlbumId,
    };

    if (editingItem) {
      updateItem.mutate({ ...payload, id: editingItem.id });
    } else {
      createItem.mutate(payload);
    }
    setOpen(false);
    reset();
    setEditingItem(null);
    setSelectedAlbumId("none");
  };

  const onSubmitAlbum = (data: GalleryAlbumFormValues) => {
    if (editingAlbum) {
      updateAlbum.mutate({ ...data, id: editingAlbum.id }, {
        onSuccess: () => toast.success("Album mis à jour"),
      });
    } else {
      createAlbum.mutate(data, {
        onSuccess: () => toast.success("Album créé"),
      });
    }
    setAlbumOpen(false);
    resetAlbum();
    setEditingAlbum(null);
  };

  const handleEdit = (item: unknown) => {
    setEditingItem(item);
    setSelectedAlbumId(item.album_id || "none");
    reset({
      titre: item.titre ?? "",
      categorie: item.categorie === "Vidéo" ? "Vidéo" : "Photo",
      ordre: item.ordre ?? 0,
      image_url: item.image_url ?? "",
      video_url: item.video_url ?? "",
      media_source: item.media_source ?? "",
    });
    setOpen(true);
  };

  const handleEditAlbum = (album: unknown) => {
    setEditingAlbum(album);
    resetAlbum({
      titre: album.titre ?? "",
      description: album.description ?? "",
      ordre: album.ordre ?? 0,
      cover_image_url: album.cover_image_url ?? "",
    });
    setAlbumOpen(true);
  };

  const handleDelete = (id: string) => {
    setPendingDeleteItemId(id);
    setShowDeleteItemConfirm(true);
  };

  const confirmDeleteItem = () => {
    if (pendingDeleteItemId) {
      deleteItem.mutate(pendingDeleteItemId);
    }
    setShowDeleteItemConfirm(false);
    setPendingDeleteItemId(null);
  };

  const handleDeleteAlbum = (id: string) => {
    setPendingDeleteAlbumId(id);
    setShowDeleteAlbumConfirm(true);
  };

  const confirmDeleteAlbum = () => {
    if (pendingDeleteAlbumId) {
      deleteAlbum.mutate(pendingDeleteAlbumId, {
        onSuccess: () => toast.success("Album supprimé")
      });
    }
    setShowDeleteAlbumConfirm(false);
    setPendingDeleteAlbumId(null);
  };

  // Multi-upload handler
  const handleMultiUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !multiUploadAlbumId) return;

    setIsMultiUploading(true);
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        // Upload file to storage
        const url = await uploadFile("site-gallery", file);
        
        // Create gallery item
        await new Promise<void>((resolve, reject) => {
          createItem.mutate({
            titre: file.name.split('.').slice(0, -1).join('.') || file.name,
            categorie: "Photo",
            image_url: url,
            album_id: multiUploadAlbumId,
            ordre: i,
          }, {
            onSuccess: () => resolve(),
            onError: (err) => reject(err),
          });
        });
        
        successCount++;
      } catch (error: unknown) {
        logger.error("Error uploading file:", error);
        errorCount++;
      }
    }

    setIsMultiUploading(false);
    setMultiUploadOpen(false);
    setMultiUploadAlbumId(null);
    
    if (multiUploadRef.current) {
      multiUploadRef.current.value = "";
    }

    if (successCount > 0) {
      toast.success(`${successCount} image(s) ajoutée(s) avec succès`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} erreur(s) lors de l'upload`);
    }
  };

  const openMultiUpload = (albumId: string) => {
    setMultiUploadAlbumId(albumId);
    setMultiUploadOpen(true);
  };

  const getAlbumName = (albumId: string | null) => {
    if (!albumId) return "Sans album";
    const album = albums?.find(a => a.id === albumId);
    return album?.titre || "Album inconnu";
  };

  const getMediaCountForAlbum = (albumId: string) => {
    return gallery?.filter(item => item.album_id === albumId).length || 0;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Gestion de la Galerie</h1>
          <p className="text-muted-foreground">
            Gérez les photos, vidéos et albums de l'association
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { reset(); setEditingItem(null); setSelectedAlbumId("none"); }}>
              <Plus className="w-4 h-4 mr-2" />
              Ajouter un média
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? "Modifier" : "Ajouter"} un média
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="titre">Titre</Label>
                <Input id="titre" {...register("titre")} />
                <FieldError msg={errors.titre?.message} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="categorie">Catégorie</Label>
                  <select
                    id="categorie"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2"
                    {...register("categorie")}
                  >
                    <option value="Photo">Photo</option>
                    <option value="Vidéo">Vidéo</option>
                  </select>
                  <FieldError msg={errors.categorie?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ordre">Ordre d'affichage</Label>
                  <Input id="ordre" type="number" defaultValue={0} {...register("ordre")} />
                  <FieldError msg={errors.ordre?.message} />
                </div>
              </div>

              {/* Album Selection */}
              <div className="space-y-2">
                <Label>Album (optionnel)</Label>
                <Select value={selectedAlbumId} onValueChange={setSelectedAlbumId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un album" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun album</SelectItem>
                    {albums?.map(album => (
                      <SelectItem key={album.id} value={album.id}>
                        {album.titre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <MediaUploader
                bucket="site-gallery"
                accept={watchCategorie === "Photo" ? "image/*" : "video/*"}
                currentUrl={watchCategorie === "Photo" ? editingItem?.image_url : editingItem?.video_url}
                onUrlChange={(url, source) => {
                  if (watchCategorie === "Photo") {
                    setValue("image_url", url);
                    setValue("video_url", null);
                  } else {
                    setValue("video_url", url);
                    setValue("image_url", null);
                  }
                  setValue("media_source", source);
                }}
                label={watchCategorie === "Photo" ? "Image" : "Vidéo"}
                maxSizeMB={watchCategorie === "Photo" ? 5 : 20}
              />
              <FieldError msg={errors.image_url?.message || errors.video_url?.message} />
              <div className="flex justify-end gap-4">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={createItem.isPending || updateItem.isPending}>
                  {(createItem.isPending || updateItem.isPending) && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  {editingItem ? "Mettre à jour" : "Créer"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="photos">
        <TabsList>
          <TabsTrigger value="photos">
            <ImageIcon className="w-4 h-4 mr-2" />
            Photos ({photos.length})
          </TabsTrigger>
          <TabsTrigger value="videos">
            <Video className="w-4 h-4 mr-2" />
            Vidéos ({videos.length})
          </TabsTrigger>
          <TabsTrigger value="albums">
            <Folder className="w-4 h-4 mr-2" />
            Albums ({albums?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="photos">
          <Card>
            <CardHeader>
              <CardTitle>Photos</CardTitle>
              <CardDescription>{photos.length} photo(s) groupées par album</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {Object.entries(groupedPhotos).map(([albumId, albumPhotos]) => (
                <div key={albumId}>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Folder className="w-5 h-5 text-muted-foreground" />
                    {getAlbumName(albumId === "sans-album" ? null : albumId)}
                    <span className="text-sm font-normal text-muted-foreground">
                      ({albumPhotos.length})
                    </span>
                  </h3>
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
                    {albumPhotos.map((item) => (
                      <div key={item.id} className="relative group">
                        <div className="aspect-square bg-muted rounded-lg overflow-hidden">
                          {item.image_url && (
                            <img
                              src={item.image_url}
                              alt={item.titre}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                          <Button size="sm" variant="secondary" aria-label="Modifier cet élément" onClick={() => handleEdit(item)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="secondary" aria-label="Supprimer cet élément" onClick={() => handleDelete(item.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="mt-2 text-sm font-medium text-center truncate">{item.titre}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {photos.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Aucune photo. Cliquez sur "Ajouter un média" pour commencer.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="videos">
          <Card>
            <CardHeader>
              <CardTitle>Vidéos</CardTitle>
              <CardDescription>{videos.length} vidéo(s)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {videos.map((item) => (
                  <div key={item.id} className="relative group">
                    <div className="aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                      <Video className="w-12 h-12 text-muted-foreground" />
                    </div>
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                      <Button size="sm" variant="secondary" aria-label="Modifier cet élément" onClick={() => handleEdit(item)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="secondary" aria-label="Supprimer cet élément" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="mt-2 text-sm font-medium">{item.titre}</p>
                    {item.album_id && (
                      <p className="text-xs text-muted-foreground">{getAlbumName(item.album_id)}</p>
                    )}
                  </div>
                ))}
                {videos.length === 0 && (
                  <p className="col-span-full text-center text-muted-foreground py-8">
                    Aucune vidéo. Cliquez sur "Ajouter un média" pour commencer.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="albums">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Gestion des Albums</CardTitle>
                  <CardDescription>Organisez vos médias en albums</CardDescription>
                </div>
                <Dialog open={albumOpen} onOpenChange={setAlbumOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => { resetAlbum(); setEditingAlbum(null); }}>
                      <FolderPlus className="w-4 h-4 mr-2" />
                      Nouvel Album
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingAlbum ? "Modifier" : "Créer"} un album
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmitAlbum(onSubmitAlbum)} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="album-titre">Titre de l'album</Label>
                        <Input id="album-titre" {...registerAlbum("titre")} />
                        <FieldError msg={albumErrors.titre?.message} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="album-description">Description</Label>
                        <Textarea id="album-description" {...registerAlbum("description")} />
                        <FieldError msg={albumErrors.description?.message} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="album-ordre">Ordre d'affichage</Label>
                        <Input id="album-ordre" type="number" defaultValue={0} {...registerAlbum("ordre")} />
                        <FieldError msg={albumErrors.ordre?.message} />
                      </div>
                      <MediaUploader
                        bucket="site-gallery"
                        accept="image/*"
                        currentUrl={editingAlbum?.cover_image_url}
                        onUrlChange={(url) => setValueAlbum("cover_image_url", url)}
                        label="Image de couverture"
                        maxSizeMB={5}
                      />
                      <div className="flex justify-end gap-4">
                        <Button type="button" variant="outline" onClick={() => setAlbumOpen(false)}>
                          Annuler
                        </Button>
                        <Button type="submit" disabled={createAlbum.isPending || updateAlbum.isPending}>
                          {(createAlbum.isPending || updateAlbum.isPending) && (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          )}
                          {editingAlbum ? "Mettre à jour" : "Créer"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {albumsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {albums?.map(album => (
                    <Card key={album.id} className="overflow-hidden">
                      <div className="aspect-video bg-muted relative">
                        {album.cover_image_url ? (
                          <img 
                            src={album.cover_image_url} 
                            alt={album.titre}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Folder className="w-12 h-12 text-muted-foreground" />
                          </div>
                        )}
                        <div className="absolute top-2 right-2 bg-background/80 rounded-full px-2 py-1 text-xs font-medium">
                          {getMediaCountForAlbum(album.id)} média(s)
                        </div>
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-semibold">{album.titre}</h3>
                        {album.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {album.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-4">
                          <Button size="sm" variant="outline" onClick={() => openMultiUpload(album.id)}>
                            <Upload className="w-4 h-4 mr-1" />
                            Ajouter images
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleEditAlbum(album)}>
                            <Pencil className="w-4 h-4 mr-1" />
                            Modifier
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="text-destructive"
                            onClick={() => handleDeleteAlbum(album.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Supprimer
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {(!albums || albums.length === 0) && (
                    <p className="col-span-full text-center text-muted-foreground py-8">
                      Aucun album. Cliquez sur "Nouvel Album" pour créer votre premier album.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Multi-upload Dialog */}
      <Dialog open={multiUploadOpen} onOpenChange={setMultiUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter plusieurs images</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sélectionnez plusieurs images à ajouter à cet album. Les formats HEIC sont automatiquement convertis.
            </p>
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <input
                ref={multiUploadRef}
                type="file"
                multiple
                accept="image/*,.heic,.heif"
                onChange={handleMultiUpload}
                className="hidden"
                id="multi-upload"
              />
              {isMultiUploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Upload en cours...</p>
                </div>
              ) : (
                <label htmlFor="multi-upload" className="cursor-pointer">
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-muted-foreground" />
                    <p className="text-sm font-medium">Cliquez pour sélectionner des images</p>
                    <p className="text-xs text-muted-foreground">ou glissez-déposez</p>
                  </div>
                </label>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Item Confirmation */}
      <AlertDialog open={showDeleteItemConfirm} onOpenChange={setShowDeleteItemConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Voulez-vous vraiment supprimer cet élément ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteItem}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Album Confirmation */}
      <AlertDialog open={showDeleteAlbumConfirm} onOpenChange={setShowDeleteAlbumConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Voulez-vous vraiment supprimer cet album ? Les médias associés ne seront pas supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteAlbum}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
