import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useCreateCaisseOperation, CAISSE_CATEGORIES } from "@/hooks/useCaisse";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const formSchema = z.object({
  type_operation: z.enum(["entree", "sortie"]),
  montant: z.coerce.number().min(1, "Le montant doit être supérieur à 0"),
  libelle: z.string().min(3, "Le libellé doit contenir au moins 3 caractères"),
  categorie: z.string().default("autre"),
  beneficiaire_id: z.string().optional(),
  exercice_id: z.string().optional(),
  reunion_id: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface CaisseOperationFormProps {
  open: boolean;
  onClose: () => void;
}

export const CaisseOperationForm = ({ open, onClose }: CaisseOperationFormProps) => {
  const { user } = useAuth();
  const createMutation = useCreateCaisseOperation();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type_operation: "entree",
      montant: 0,
      libelle: "",
      categorie: "autre",
      notes: "",
    },
  });

  // Récupérer le membre courant
  const { data: currentMembre } = useQuery({
    queryKey: ["current-membre", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("membres")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // Récupérer les membres actifs
  const { data: membres } = useQuery({
    queryKey: ["membres-actifs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("membres")
        .select("id, nom, prenom")
        .eq("statut", "actif")
        .order("nom");
      return data || [];
    },
  });

  // Récupérer les exercices
  const { data: exercices } = useQuery({
    queryKey: ["exercices"],
    queryFn: async () => {
      const { data } = await supabase
        .from("exercices")
        .select("id, nom")
        .order("date_debut", { ascending: false });
      return data || [];
    },
  });

  // Récupérer les réunions récentes
  const { data: reunions } = useQuery({
    queryKey: ["reunions-recentes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("reunions")
        .select("id, sujet, date_reunion")
        .order("date_reunion", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  const onSubmit = async (data: FormData) => {
    if (!currentMembre?.id) {
      return;
    }

    await createMutation.mutateAsync({
      type_operation: data.type_operation,
      montant: data.montant,
      libelle: data.libelle,
      categorie: data.categorie,
      operateur_id: currentMembre.id,
      beneficiaire_id: data.beneficiaire_id || null,
      exercice_id: data.exercice_id || null,
      reunion_id: data.reunion_id || null,
      notes: data.notes || null,
      date_operation: new Date().toISOString().split("T")[0],
    });

    form.reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nouvelle opération de caisse</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type_operation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type d'opération</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez le type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="entree">Entrée (crédit)</SelectItem>
                      <SelectItem value="sortie">Sortie (débit)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="montant"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Montant (FCFA)</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="libelle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Libellé</FormLabel>
                  <FormControl>
                    <Input placeholder="Description de l'opération" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="categorie"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Catégorie</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez la catégorie" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(CAISSE_CATEGORIES).map(([key, val]) => (
                        <SelectItem key={key} value={key}>
                          {val.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="beneficiaire_id"
              render={({ field }) => (
            <FormItem>
                  <FormLabel>Membre concerné (optionnel)</FormLabel>
                  <Select onValueChange={(val) => field.onChange(val === "none" ? undefined : val)} value={field.value || "none"}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez un membre" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Aucun</SelectItem>
                      {membres?.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.prenom} {m.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="exercice_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Exercice (optionnel)</FormLabel>
                    <Select onValueChange={(val) => field.onChange(val === "none" ? undefined : val)} value={field.value || "none"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Exercice" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Aucun</SelectItem>
                        {exercices?.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.nom}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reunion_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Réunion (optionnel)</FormLabel>
                    <Select onValueChange={(val) => field.onChange(val === "none" ? undefined : val)} value={field.value || "none"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Réunion" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Aucune</SelectItem>
                        {reunions?.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.sujet}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Informations complémentaires..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Annuler
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
