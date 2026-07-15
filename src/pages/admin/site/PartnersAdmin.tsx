import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, Plus, Pencil, Trash2, ExternalLink } from "lucide-react";
import { useSitePartners, useCreatePartner, useUpdatePartner, useDeletePartner } from "@/hooks/useSiteContent";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import MediaUploader from "@/components/admin/MediaUploader";
import { partnerSchema, type PartnerFormValues } from "@/lib/validation/site-schemas";

const FieldError = ({ msg }: { msg?: string }) =>
  msg ? <p className="text-xs text-destructive mt-1">{msg}</p> : null;

export default function PartnersAdmin() {
  const { data: partners, isLoading } = useSitePartners();
  const createPartner = useCreatePartner();
  const updatePartner = useUpdatePartner();
  const deletePartner = useDeletePartner();
  const [open, setOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<unknown>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<PartnerFormValues>({ resolver: zodResolver(partnerSchema) });

  const onSubmit = (data: PartnerFormValues) => {
    if (editingPartner) {
      updatePartner.mutate({ ...data, id: editingPartner.id });
    } else {
      createPartner.mutate(data);
    }
    setOpen(false);
    reset();
    setEditingPartner(null);
  };

  const handleEdit = (partner: unknown) => {
    setEditingPartner(partner);
    reset({
      nom: partner.nom ?? "",
      logo_url: partner.logo_url ?? "",
      site_web: partner.site_web ?? "",
      description: partner.description ?? "",
      ordre: partner.ordre ?? 0,
      media_source: partner.media_source ?? "",
    });
    setOpen(true);
  };

  const handleDelete = (id: string) => {
    setPendingDeleteId(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (pendingDeleteId) {
      deletePartner.mutate(pendingDeleteId);
    }
    setShowDeleteConfirm(false);
    setPendingDeleteId(null);
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
          <h1 className="text-2xl sm:text-3xl font-bold">Gestion des Partenaires</h1>
          <p className="text-muted-foreground">
            Gérez les partenaires de l'association
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { reset(); setEditingPartner(null); }}>
              <Plus className="w-4 h-4 mr-2" />
              Nouveau Partenaire
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingPartner ? "Modifier" : "Créer"} un partenaire
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nom">Nom du partenaire</Label>
                <Input id="nom" {...register("nom")} />
                <FieldError msg={errors.nom?.message} />
              </div>
              <MediaUploader
                bucket="site-partners"
                accept="image/*"
                currentUrl={editingPartner?.logo_url}
                onUrlChange={(url, source) => {
                  setValue("logo_url", url);
                  setValue("media_source", source);
                }}
                label="Logo du partenaire"
                maxSizeMB={5}
              />
              <FieldError msg={errors.logo_url?.message} />
              <div className="space-y-2">
                <Label htmlFor="site_web">Site web</Label>
                <Input id="site_web" type="url" {...register("site_web")} />
                <FieldError msg={errors.site_web?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" {...register("description")} />
                <FieldError msg={errors.description?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ordre">Ordre d'affichage</Label>
                <Input id="ordre" type="number" defaultValue={0} {...register("ordre")} />
                <FieldError msg={errors.ordre?.message} />
              </div>
              <div className="flex justify-end gap-4">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={createPartner.isPending || updatePartner.isPending}>
                  {(createPartner.isPending || updatePartner.isPending) && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  {editingPartner ? "Mettre à jour" : "Créer"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Liste des partenaires</CardTitle>
          <CardDescription>
            {partners?.length || 0} partenaire(s) actif(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Logo</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Site web</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partners?.map((partner) => (
                <TableRow key={partner.id}>
                  <TableCell>
                    <Avatar>
                      <AvatarImage src={partner.logo_url} alt={partner.nom} />
                      <AvatarFallback>{partner.nom[0]}</AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">{partner.nom}</TableCell>
                  <TableCell>
                    {partner.site_web && (
                      <a
                        href={partner.site_web}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        Visiter
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {partner.description || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Modifier le partenaire ${partner.nom}`}
                        onClick={() => handleEdit(partner)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Supprimer le partenaire ${partner.nom}`}
                        onClick={() => handleDelete(partner.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Voulez-vous vraiment supprimer ce partenaire ?
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
