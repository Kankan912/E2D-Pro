import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const campagneSchema = z.object({
  nom: z.string().min(1, "Nom requis"),
  type_campagne: z.string().min(1, "Type requis"),
  template_sujet: z.string().min(1, "Sujet requis"),
  template_contenu: z.string().min(1, "Contenu requis"),
  description: z.string().optional()
});

type CampagneFormData = z.infer<typeof campagneSchema>;

interface NotificationCampagneFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  createdBy: string;
}

export default function NotificationCampagneForm({ open, onClose, onSubmit, createdBy }: NotificationCampagneFormProps) {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<CampagneFormData>({
    resolver: zodResolver(campagneSchema)
  });

  const typeCampagne = watch("type_campagne");

  const handleFormSubmit = (data: CampagneFormData) => {
    onSubmit({
      ...data,
      created_by: createdBy,
      statut: 'brouillon',
      destinataires: [],
      nb_destinataires: 0,
      nb_envoyes: 0,
      nb_erreurs: 0
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nouvelle campagne de notification</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div>
            <Label>Nom de la campagne *</Label>
            <Input {...register("nom")} placeholder="Ex: Rappel cotisations janvier" />
            {errors.nom && <p className="text-sm text-destructive mt-1">{errors.nom.message}</p>}
          </div>

          <div>
            <Label>Type de campagne *</Label>
            <Select value={typeCampagne} onValueChange={(val) => setValue("type_campagne", val)}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="email_sms">Email + SMS</SelectItem>
              </SelectContent>
            </Select>
            {errors.type_campagne && <p className="text-sm text-destructive mt-1">{errors.type_campagne.message}</p>}
          </div>

          <div>
            <Label>Description</Label>
            <Textarea {...register("description")} rows={2} placeholder="Description de la campagne" />
          </div>

          <div>
            <Label>Sujet du message *</Label>
            <Input {...register("template_sujet")} placeholder="Ex: Rappel de paiement" />
            {errors.template_sujet && <p className="text-sm text-destructive mt-1">{errors.template_sujet.message}</p>}
          </div>

          <div>
            <Label>Contenu du message *</Label>
            <Textarea
              {...register("template_contenu")}
              rows={6}
              placeholder="Bonjour {{nom}}, ceci est un rappel..."
            />
            <p className="text-xs text-muted-foreground mt-1">
              Variables disponibles: {`{{nom}}, {{prenom}}, {{email}}`}
            </p>
            {errors.template_contenu && <p className="text-sm text-destructive mt-1">{errors.template_contenu.message}</p>}
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit">Créer la campagne</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
