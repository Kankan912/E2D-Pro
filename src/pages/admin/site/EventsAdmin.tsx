import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, Plus, Pencil, Trash2, Calendar, Clock, MapPin, Settings, Image } from "lucide-react";
import { useSiteEvents, useCreateEvent, useUpdateEvent, useDeleteEvent, useSiteEventsCarouselConfig, useUpdateEventsCarouselConfig, useSiteGalleryAlbums } from "@/hooks/useSiteContent";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import MediaUploader from "@/components/admin/MediaUploader";
import { toast } from "sonner";
import { eventSchema, type EventFormValues } from "@/lib/validation/site-schemas";

const FieldError = ({ msg }: { msg?: string }) =>
  msg ? <p className="text-xs text-destructive mt-1">{msg}</p> : null;

export default function EventsAdmin() {
  const { data: events, isLoading } = useSiteEvents();
  const { data: carouselConfig, isLoading: configLoading } = useSiteEventsCarouselConfig();
  const { data: galleryAlbums = [] } = useSiteGalleryAlbums();
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();
  const updateCarouselConfig = useUpdateEventsCarouselConfig();
  
  const [open, setOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<EventFormValues>({ resolver: zodResolver(eventSchema) });

  // Carousel config state
  const [autoPlay, setAutoPlay] = useState(true);
  const [interval, setInterval] = useState(5000);
  const [showArrows, setShowArrows] = useState(true);
  const [showIndicators, setShowIndicators] = useState(true);

  useEffect(() => {
    if (carouselConfig) {
      setAutoPlay(carouselConfig.auto_play ?? true);
      setInterval(carouselConfig.interval ?? 5000);
      setShowArrows(carouselConfig.show_arrows ?? true);
      setShowIndicators(carouselConfig.show_indicators ?? true);
    }
  }, [carouselConfig]);

  const onSubmit = (data: EventFormValues) => {
    const payload = { ...data, album_id: data.album_id || null };
    if (editingEvent) {
      updateEvent.mutate({ ...payload, id: editingEvent.id });
    } else {
      createEvent.mutate(payload);
    }
    setOpen(false);
    reset();
    setEditingEvent(null);
  };

  const handleEdit = (event: any) => {
    setEditingEvent(event);
    reset({
      titre: event.titre ?? "",
      type: event.type ?? "",
      date: event.date ?? "",
      heure: event.heure ?? "",
      lieu: event.lieu ?? "",
      image_url: event.image_url ?? "",
      media_source: event.media_source ?? "",
      description: event.description ?? "",
      ordre: event.ordre ?? 0,
      album_id: event.album_id ?? "",
    });
    setOpen(true);
  };

  const handleDelete = (id: string) => {
    setPendingDeleteId(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (pendingDeleteId) {
      deleteEvent.mutate(pendingDeleteId);
    }
    setShowDeleteConfirm(false);
    setPendingDeleteId(null);
  };

  const saveCarouselConfig = () => {
    if (carouselConfig) {
      updateCarouselConfig.mutate({
        id: carouselConfig.id,
        auto_play: autoPlay,
        interval: interval,
        show_arrows: showArrows,
        show_indicators: showIndicators
      }, {
        onSuccess: () => toast.success("Configuration du carousel sauvegardée")
      });
    }
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
          <h1 className="text-2xl sm:text-3xl font-bold">Gestion des Événements</h1>
          <p className="text-muted-foreground">
            Gérez les événements à venir de l'association
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { reset(); setEditingEvent(null); }}>
              <Plus className="w-4 h-4 mr-2" />
              Nouvel Événement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingEvent ? "Modifier" : "Créer"} un événement
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
                  <Label htmlFor="type">Type</Label>
                  <Input id="type" placeholder="Match, Tournoi, Entraînement" {...register("type")} />
                  <FieldError msg={errors.type?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ordre">Ordre d'affichage</Label>
                  <Input id="ordre" type="number" defaultValue={0} {...register("ordre")} />
                  <FieldError msg={errors.ordre?.message} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input id="date" type="date" {...register("date")} />
                  <FieldError msg={errors.date?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="heure">Heure</Label>
                  <Input id="heure" type="time" {...register("heure")} />
                  <FieldError msg={errors.heure?.message} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lieu">Lieu</Label>
                <Input id="lieu" {...register("lieu")} />
                <FieldError msg={errors.lieu?.message} />
              </div>
              <MediaUploader
                bucket="site-events"
                accept="image/*"
                currentUrl={editingEvent?.image_url}
                onUrlChange={(url, source) => {
                  setValue("image_url", url);
                  setValue("media_source", source);
                }}
                label="Image de l'événement"
                maxSizeMB={5}
              />
              <FieldError msg={errors.image_url?.message} />
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" {...register("description")} />
                <FieldError msg={errors.description?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="album_id" className="flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  Lier à un album galerie (optionnel)
                </Label>
                <select
                  id="album_id"
                  {...register("album_id")}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Aucun album lié</option>
                  {(galleryAlbums as any[]).map((album: any) => (
                    <option key={album.id} value={album.id}>{album.titre}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">L'album sera affiché sur la page détail de l'événement.</p>
              </div>
              <div className="flex justify-end gap-4">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={createEvent.isPending || updateEvent.isPending}>
                  {(createEvent.isPending || updateEvent.isPending) && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  {editingEvent ? "Mettre à jour" : "Créer"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="events">
        <TabsList>
          <TabsTrigger value="events">
            <Calendar className="w-4 h-4 mr-2" />
            Événements
          </TabsTrigger>
          <TabsTrigger value="carousel">
            <Settings className="w-4 h-4 mr-2" />
            Paramètres Carousel
          </TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Liste des événements</CardTitle>
              <CardDescription>
                {events?.length || 0} événement(s) actif(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Événement</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date & Heure</TableHead>
                    <TableHead>Lieu</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events?.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <div className="font-medium">{event.titre}</div>
                        {event.description && (
                          <p className="text-sm text-muted-foreground truncate max-w-xs">
                            {event.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge>{event.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(event.date), "dd MMM yyyy", { locale: fr })}
                          </div>
                          {event.heure && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {event.heure}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="w-3 h-3" />
                          {event.lieu}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Modifier l'événement ${event.titre}`}
                            onClick={() => handleEdit(event)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Supprimer l'événement ${event.titre}`}
                            onClick={() => handleDelete(event.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!events || events.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Aucun événement. Cliquez sur "Nouvel Événement" pour en créer un.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="carousel" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuration du Carousel</CardTitle>
              <CardDescription>
                Personnalisez l'affichage du carousel d'événements sur la page d'accueil
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {configLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <>
                  <div className="grid gap-6">
                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div>
                        <Label className="text-base">Défilement automatique</Label>
                        <p className="text-sm text-muted-foreground">
                          Active le défilement automatique des événements
                        </p>
                      </div>
                      <Switch 
                        checked={autoPlay} 
                        onCheckedChange={setAutoPlay}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div>
                        <Label className="text-base">Intervalle (ms)</Label>
                        <p className="text-sm text-muted-foreground">
                          Durée entre chaque slide (2000-8000ms)
                        </p>
                      </div>
                      <Input 
                        type="number" 
                        min={2000}
                        max={8000}
                        step={500}
                        className="w-28"
                        value={interval}
                        onChange={(e) => setInterval(Number(e.target.value))}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div>
                        <Label className="text-base">Afficher les flèches</Label>
                        <p className="text-sm text-muted-foreground">
                          Affiche les boutons précédent/suivant
                        </p>
                      </div>
                      <Switch 
                        checked={showArrows} 
                        onCheckedChange={setShowArrows}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div>
                        <Label className="text-base">Afficher les indicateurs</Label>
                        <p className="text-sm text-muted-foreground">
                          Affiche les points de navigation en bas
                        </p>
                      </div>
                      <Switch 
                        checked={showIndicators} 
                        onCheckedChange={setShowIndicators}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t">
                    <Button 
                      onClick={saveCarouselConfig}
                      disabled={updateCarouselConfig.isPending}
                    >
                      {updateCarouselConfig.isPending && (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      )}
                      Sauvegarder la configuration
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Voulez-vous vraiment supprimer cet événement ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
