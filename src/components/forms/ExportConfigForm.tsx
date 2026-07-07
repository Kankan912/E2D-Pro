import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const exportSchema = z.object({
  nom: z.string().min(1, "Nom requis"),
  type: z.string().min(1, "Type requis"),
  format: z.string().min(1, "Format requis"),
  frequence: z.string().min(1, "Fréquence requise"),
  actif: z.boolean()
});

type ExportFormData = z.infer<typeof exportSchema>;

interface ExportConfigFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  initialData?: any;
}

export default function ExportConfigForm({ open, onClose, onSubmit, initialData }: ExportConfigFormProps) {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<ExportFormData>({
    resolver: zodResolver(exportSchema),
    defaultValues: initialData || {
      actif: true
    }
  });

  const typeExport = watch("type");
  const format = watch("format");
  const frequence = watch("frequence");
  const actif = watch("actif");

  const handleFormSubmit = (data: ExportFormData) => {
    onSubmit({
      ...data,
      configuration: {},
      dernier_export: null,
      prochain_export: null
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initialData ? "Modifier l'export" : "Nouvel export programmé"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div>
            <Label>Nom de l'export *</Label>
            <Input {...register("nom")} placeholder="Ex: Export membres mensuel" />
            {errors.nom && <p className="text-sm text-destructive mt-1">{errors.nom.message}</p>}
          </div>

          <div>
            <Label>Type de données *</Label>
            <Select value={typeExport} onValueChange={(val) => setValue("type", val)}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="membres">Membres</SelectItem>
                <SelectItem value="finances">Finances</SelectItem>
                <SelectItem value="matchs">Matchs</SelectItem>
                <SelectItem value="cotisations">Cotisations</SelectItem>
                <SelectItem value="epargnes">Épargnes</SelectItem>
              </SelectContent>
            </Select>
            {errors.type && <p className="text-sm text-destructive mt-1">{errors.type.message}</p>}
          </div>

          <div>
            <Label>Format *</Label>
            <Select value={format} onValueChange={(val) => setValue("format", val)}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
              </SelectContent>
            </Select>
            {errors.format && <p className="text-sm text-destructive mt-1">{errors.format.message}</p>}
          </div>

          <div>
            <Label>Fréquence *</Label>
            <Select value={frequence} onValueChange={(val) => setValue("frequence", val)}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quotidien">Quotidien</SelectItem>
                <SelectItem value="hebdomadaire">Hebdomadaire</SelectItem>
                <SelectItem value="mensuel">Mensuel</SelectItem>
                <SelectItem value="trimestriel">Trimestriel</SelectItem>
                <SelectItem value="annuel">Annuel</SelectItem>
              </SelectContent>
            </Select>
            {errors.frequence && <p className="text-sm text-destructive mt-1">{errors.frequence.message}</p>}
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={actif}
              onCheckedChange={(checked) => setValue("actif", checked)}
            />
            <Label>Export actif</Label>
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit">
              {initialData ? "Modifier" : "Créer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
