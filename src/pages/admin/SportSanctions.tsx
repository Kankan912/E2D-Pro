import { Shield, Plus } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import BackButton from "@/components/BackButton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatFCFA } from "@/lib/utils";

const sanctionSchema = z.object({
  membre_id: z.string().min(1, "Membre requis"),
  type_sanction_id: z.string().min(1, "Type requis"),
  date_sanction: z.string().min(1, "Date requise"),
  montant: z.number().min(0),
  statut: z.string(),
  motif: z.string().optional(),
  contexte_sanction: z.string().optional(),
});

type SanctionFormData = z.infer<typeof sanctionSchema>;

export default function SportSanctions() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();

  const { data: sanctions, isLoading } = useQuery({
    queryKey: ["sanctions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sanctions")
        .select(`
          *,
          membre:membres(nom, prenom),
          type:sanctions_types(nom, montant)
        `)
        .order("date_sanction", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: membres } = useQuery({
    queryKey: ["membres-actifs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membres")
        .select("id, nom, prenom")
        .eq("statut", "actif")
        .order("nom");
      if (error) throw error;
      return data;
    },
  });

  const { data: typesSanctions } = useQuery({
    queryKey: ["sanctions-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sanctions_types")
        .select("*")
        .order("nom");
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<SanctionFormData>({
    resolver: zodResolver(sanctionSchema),
    defaultValues: {
      membre_id: "",
      type_sanction_id: "",
      date_sanction: new Date().toISOString().split("T")[0],
      montant: 0,
      statut: "en_attente",
      motif: "",
      contexte_sanction: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: SanctionFormData) => {
      const { error } = await supabase.from("sanctions").insert([{
        membre_id: data.membre_id,
        type_sanction_id: data.type_sanction_id,
        date_sanction: data.date_sanction,
        montant: data.montant,
        statut: data.statut,
        motif: data.motif || "",
        contexte_sanction: data.contexte_sanction || "",
        montant_paye: 0,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sanctions"] });
      toast({ title: "Sanction créée avec succès" });
      setShowForm(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: SanctionFormData) => {
    createMutation.mutate(data);
  };

  return (
    <div className="container mx-auto space-y-6">
      <BackButton />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-bold">Sanctions Sportives</h1>
        </div>
        {hasPermission('sanctions', 'create') && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle Sanction
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Liste des Sanctions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Chargement...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Membre</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sanctions?.map((sanction) => (
                  <TableRow key={sanction.id}>
                    <TableCell>{new Date(sanction.date_sanction).toLocaleDateString()}</TableCell>
                    <TableCell>{sanction.membre?.nom} {sanction.membre?.prenom}</TableCell>
                    <TableCell>{sanction.type?.nom}</TableCell>
                    <TableCell>{formatFCFA(sanction.montant)}</TableCell>
                    <TableCell>
                      <Badge variant={sanction.statut === "paye" ? "default" : "secondary"}>
                        {sanction.statut}
                      </Badge>
                    </TableCell>
                    <TableCell>{sanction.motif || sanction.contexte_sanction}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle Sanction</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="membre_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Membre</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un membre" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {membres?.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.nom} {m.prenom}
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
                name="type_sanction_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type de Sanction</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                        const type = typesSanctions?.find(t => t.id === value);
                        if (type) form.setValue("montant", type.montant || 0);
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {typesSanctions?.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.nom} ({formatFCFA(t.montant || 0)})
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
                name="date_sanction"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
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
                      <Input 
                        type="number" 
                        min={0} 
                        {...field} 
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="statut"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Statut</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="en_attente">En attente</SelectItem>
                        <SelectItem value="paye">Payé</SelectItem>
                        <SelectItem value="annule">Annulé</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="motif"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Motif</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Création..." : "Créer"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
