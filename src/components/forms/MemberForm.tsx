import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Member } from "@/hooks/useMembers";
import { useRoles } from "@/hooks/useRoles";
import { supabase } from "@/integrations/supabase/client";
import { useState, useRef, useEffect } from "react";
import { Upload, User, Loader2, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";

import { logger } from "@/lib/logger";
const memberSchema = z.object({
  nom: z.string().min(2, "Nom requis"),
  prenom: z.string().min(2, "Prénom requis"),
  telephone: z.string().min(1, "Téléphone requis"),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  statut: z.enum(["actif", "inactif", "suspendu"]),
  est_membre_e2d: z.boolean(),
  est_adherent_phoenix: z.boolean(),
  equipe_e2d: z.string().optional(),
  equipe_phoenix: z.string().optional(),
  equipe_jaune_rouge: z.enum(["Jaune", "Rouge", "none"]).optional(),
  fonction: z.string().optional(),
  photo_url: z.string().optional(),
  role_id: z.string().optional(),
});

type MemberFormData = z.infer<typeof memberSchema>;

interface MemberFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: Member | null;
  onSubmit: (data: MemberFormData) => void;
  isLoading?: boolean;
}

// Fonction pour formater le nom du rôle
const formatRoleName = (name: string): string => {
  const roleLabels: Record<string, string> = {
    'administrateur': 'Administrateur',
    'admin': 'Administrateur', // compat anciens libellés (aucun en base — vérifié Lot C)
    'president': 'Président',
    'vice_president': 'Vice-Président',
    'secretaire_general': 'Secrétaire Général',
    'secretaire_adjoint': 'Secrétaire Adjoint',
    'tresorier': 'Trésorier',
    'tresorier_adjoint': 'Trésorier Adjoint',
    'commissaire_comptes': 'Commissaire aux Comptes',
    'responsable_sport': 'Responsable Sport',
    'responsable_communication': 'Responsable Communication',
    'membre': 'Membre',
    'user': 'Utilisateur',
    'moderator': 'Modérateur',
  };
  return roleLabels[name.toLowerCase()] || name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' ');
};

export default function MemberForm({ open, onOpenChange, member, onSubmit, isLoading }: MemberFormProps) {
  const { roles, isLoading: rolesLoading } = useRoles();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(member?.photo_url || null);
  const [currentRoleId, setCurrentRoleId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Récupérer le rôle actuel du membre si édition
  useQuery({
    queryKey: ['membre-role', member?.id],
    queryFn: async () => {
      if (!member?.id) return null;
      const { data, error } = await supabase
        .from('user_roles')
        .select('role_id')
        .eq('user_id', member.user_id || member.id)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setCurrentRoleId(data.role_id);
      }
      return data;
    },
    enabled: !!member?.id && open,
  });

  const form = useForm<MemberFormData>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      nom: "",
      prenom: "",
      telephone: "",
      email: "",
      statut: "actif",
      est_membre_e2d: false,
      est_adherent_phoenix: false,
      equipe_e2d: "",
      equipe_phoenix: "",
      equipe_jaune_rouge: "none",
      fonction: "none",
      photo_url: "",
      role_id: "",
    },
  });

  // Réinitialiser le formulaire quand le modal s'ouvre ou le membre change
  useEffect(() => {
    if (open) {
      if (member) {
        // Mode édition : pré-remplir avec les données du membre
        form.reset({
          nom: member.nom,
          prenom: member.prenom,
          telephone: member.telephone,
          email: member.email || "",
          statut: member.statut as "actif" | "inactif" | "suspendu",
          est_membre_e2d: member.est_membre_e2d || false,
          est_adherent_phoenix: member.est_adherent_phoenix || false,
          equipe_e2d: member.equipe_e2d || "",
          equipe_phoenix: member.equipe_phoenix || "",
          equipe_jaune_rouge: member.equipe_jaune_rouge === "Jaune" || member.equipe_jaune_rouge === "Rouge" ? member.equipe_jaune_rouge : "none",
          fonction: member.fonction || "none",
          photo_url: member.photo_url || "",
          role_id: currentRoleId || "",
        });
        setPreviewUrl(member.photo_url || null);
      } else {
        // Mode création : réinitialiser à vide
        form.reset({
          nom: "",
          prenom: "",
          telephone: "",
          email: "",
          statut: "actif",
          est_membre_e2d: false,
          est_adherent_phoenix: false,
          equipe_e2d: "",
          equipe_phoenix: "",
          equipe_jaune_rouge: "none",
          fonction: "none",
          photo_url: "",
          role_id: "",
        });
        setPreviewUrl(null);
        setCurrentRoleId(null);
      }
    }
  }, [open, member, form]);

  // Met à jour le role_id quand currentRoleId est chargé
  useEffect(() => {
    if (currentRoleId && open && member) {
      form.setValue('role_id', currentRoleId);
    }
  }, [currentRoleId, open, member, form]);

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Vérifier le type de fichier
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une image",
        variant: "destructive",
      });
      return;
    }

    // Vérifier la taille (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Erreur",
        description: "L'image ne doit pas dépasser 2 Mo",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `photos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('members-photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('members-photos')
        .getPublicUrl(filePath);

      form.setValue('photo_url', publicUrl);
      setPreviewUrl(publicUrl);
      
      toast({
        title: "Photo uploadée",
        description: "La photo a été téléchargée avec succès",
      });
    } catch (error: unknown) {
      logger.error('Erreur upload:', error);
      toast({
        title: "Erreur d'upload",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (data: MemberFormData) => {
    const cleanedData = {
      ...data,
      // La contrainte CHECK n'accepte que 'Jaune', 'Rouge' ou NULL
      equipe_jaune_rouge: data.equipe_jaune_rouge === 'none' ? null : data.equipe_jaune_rouge,
      equipe_e2d: data.equipe_e2d === 'none' ? null : data.equipe_e2d,
      equipe_phoenix: data.equipe_phoenix === 'none' ? null : data.equipe_phoenix,
      fonction: data.fonction === 'none' ? null : data.fonction,
    };
    onSubmit(cleanedData as MemberFormData);
    if (!member) {
      form.reset();
      setPreviewUrl(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{member ? "Modifier le Membre" : "Nouveau Membre"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Photo Upload Section */}
            <div className="flex flex-col items-center gap-3 pb-4 border-b">
              <Avatar className="h-24 w-24">
                <AvatarImage src={previewUrl || undefined} alt="Photo du membre" />
                <AvatarFallback className="bg-muted">
                  <User className="h-12 w-12 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoUpload}
                  accept="image/*"
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Chargement...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      {previewUrl ? "Changer la photo" : "Ajouter une photo"}
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">JPG, PNG - Max 2 Mo</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="nom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="prenom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prénom *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="telephone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="statut"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Statut *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="actif">Actif</SelectItem>
                        <SelectItem value="inactif">Inactif</SelectItem>
                        <SelectItem value="suspendu">Suspendu</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fonction"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fonction</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "none"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choisir une fonction" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Aucune fonction</SelectItem>
                        {rolesLoading ? (
                          <SelectItem value="loading" disabled>Chargement...</SelectItem>
                        ) : (
                          roles?.map((role) => (
                            <SelectItem key={role.id} value={role.name}>
                              {formatRoleName(role.name)}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-3 border p-4 rounded-lg">
              <h4 className="font-medium">Appartenance</h4>
              <FormField
                control={form.control}
                name="est_membre_e2d"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="!mt-0 cursor-pointer">Membre E2D</FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="est_adherent_phoenix"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="!mt-0 cursor-pointer">Adhérent Phoenix</FormLabel>
                  </FormItem>
                )}
              />
            </div>

            {form.watch("est_membre_e2d") && (
              <FormField
                control={form.control}
                name="equipe_e2d"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Équipe E2D</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "none"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choisir une équipe" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Non assigné</SelectItem>
                        <SelectItem value="Seniors">Seniors</SelectItem>
                        <SelectItem value="Vétérans">Vétérans</SelectItem>
                        <SelectItem value="Juniors">Juniors</SelectItem>
                        <SelectItem value="Féminines">Féminines</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {form.watch("est_adherent_phoenix") && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="equipe_phoenix"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Équipe Phoenix</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "none"}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Choisir une équipe" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Non assigné</SelectItem>
                          <SelectItem value="Seniors">Seniors</SelectItem>
                          <SelectItem value="Vétérans">Vétérans</SelectItem>
                          <SelectItem value="Mixte">Mixte</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="equipe_jaune_rouge"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Équipe Jaune/Rouge</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Choisir" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Non assigné</SelectItem>
                          <SelectItem value="Jaune">Jaune</SelectItem>
                          <SelectItem value="Rouge">Rouge</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Sélection du rôle système */}
            <div className="space-y-3 border p-4 rounded-lg border-primary/30 bg-primary/5">
              <h4 className="font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Rôle Système (Permissions)
              </h4>
              <FormField
                control={form.control}
                name="role_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rôle attribué</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || currentRoleId || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un rôle" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Aucun rôle</SelectItem>
                        {rolesLoading ? (
                          <SelectItem value="loading" disabled>Chargement...</SelectItem>
                        ) : (
                          roles?.map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                              {formatRoleName(role.name)}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Le rôle détermine les permissions d'accès au système
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={isLoading || uploading}>
                {isLoading ? "Enregistrement..." : member ? "Mettre à jour" : "Créer"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
