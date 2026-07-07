import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "lucide-react";
import { parseISO, isWithinInterval } from "date-fns";
import { exportRapportPDF, exportRapportExcel } from "@/lib/rapports-export";
import RapportsTabsContent from "./_components/RapportsTabsContent";
import type { CotisationWithJoins, PretWithJoins, SanctionWithJoins, EpargneWithJoins } from "@/types/supabase-joins";



const RapportsAdmin = () => {
  const [selectedExercice, setSelectedExercice] = useState<string>("all");
  const [dateDebut, setDateDebut] = useState<string>("");
  const [dateFin, setDateFin] = useState<string>("");

  // Fetch exercices
  const { data: exercices } = useQuery({
    queryKey: ["exercices-rapports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercices")
        .select("*")
        .order("date_debut", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch cotisations
  const { data: cotisations, isLoading: loadingCotisations } = useQuery({
    queryKey: ["rapports-cotisations", selectedExercice, dateDebut, dateFin],
    queryFn: async () => {
      let query = supabase
        .from("cotisations")
        .select(`
          id, montant, statut, date_paiement, created_at,
          membres(id, nom, prenom),
          cotisations_types(id, nom),
          exercice_id,
          reunion_id,
          reunions(date_reunion)
        `)
        .order("created_at", { ascending: false });

      if (selectedExercice !== "all") {
        query = query.eq("exercice_id", selectedExercice);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      const typed = (data || []) as unknown as CotisationWithJoins[];
      
      // Filtrage par date
      if (dateDebut || dateFin) {
        return typed.filter(c => {
          const date = c.date_paiement || c.created_at;
          if (!date) return true;
          const d = parseISO(date);
          if (dateDebut && dateFin) {
            return isWithinInterval(d, { start: parseISO(dateDebut), end: parseISO(dateFin) });
          } else if (dateDebut) {
            return d >= parseISO(dateDebut);
          } else if (dateFin) {
            return d <= parseISO(dateFin);
          }
          return true;
        });
      }
      return typed;
    },
  });

  // Fetch prêts
  const { data: prets, isLoading: loadingPrets } = useQuery({
    queryKey: ["rapports-prets", selectedExercice, dateDebut, dateFin],
    queryFn: async () => {
      let query = supabase
        .from("prets")
        .select(`
          id, montant, montant_paye, montant_total_du, statut, date_pret, echeance,
          taux_interet, interet_paye, capital_paye, reconductions,
          membres(id, nom, prenom)
        `)
        .order("date_pret", { ascending: false });

      if (selectedExercice !== "all") {
        query = query.eq("exercice_id", selectedExercice);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      const typed = (data || []) as unknown as PretWithJoins[];
      
      if (dateDebut || dateFin) {
        return typed.filter(p => {
          const d = parseISO(p.date_pret);
          if (dateDebut && dateFin) {
            return isWithinInterval(d, { start: parseISO(dateDebut), end: parseISO(dateFin) });
          } else if (dateDebut) {
            return d >= parseISO(dateDebut);
          } else if (dateFin) {
            return d <= parseISO(dateFin);
          }
          return true;
        });
      }
      return typed;
    },
  });

  // Fetch sanctions
  const { data: sanctions, isLoading: loadingSanctions } = useQuery({
    queryKey: ["rapports-sanctions", selectedExercice, dateDebut, dateFin],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reunions_sanctions")
        .select(`
          id,
          montant_amende,
          statut,
          motif,
          created_at,
          membre_id,
          membres(id, nom, prenom)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      const typed = (data || []) as unknown as SanctionWithJoins[];
      
      if (dateDebut || dateFin) {
        return typed.filter(s => {
          const d = parseISO(s.created_at);
          if (dateDebut && dateFin) {
            return isWithinInterval(d, { start: parseISO(dateDebut), end: parseISO(dateFin) });
          } else if (dateDebut) {
            return d >= parseISO(dateDebut);
          } else if (dateFin) {
            return d <= parseISO(dateFin);
          }
          return true;
        });
      }
      return typed;
    },
  });

  // Fetch épargnes
  const { data: epargnes, isLoading: loadingEpargnes } = useQuery({
    queryKey: ["rapports-epargnes", selectedExercice, dateDebut, dateFin],
    queryFn: async () => {
      let query = supabase
        .from("epargnes")
        .select(`
          id, montant, date_depot, statut,
          membres(id, nom, prenom)
        `)
        .order("date_depot", { ascending: false });

      if (selectedExercice !== "all") {
        query = query.eq("exercice_id", selectedExercice);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      const typed = (data || []) as unknown as EpargneWithJoins[];
      
      if (dateDebut || dateFin) {
        return typed.filter(e => {
          const d = parseISO(e.date_depot);
          if (dateDebut && dateFin) {
            return isWithinInterval(d, { start: parseISO(dateDebut), end: parseISO(dateFin) });
          } else if (dateDebut) {
            return d >= parseISO(dateDebut);
          } else if (dateFin) {
            return d <= parseISO(dateFin);
          }
          return true;
        });
      }
      return typed;
    },
  });

  // Fetch caisse operations
  const { data: caisseOps, isLoading: loadingCaisse } = useQuery({
    queryKey: ["rapports-caisse", selectedExercice, dateDebut, dateFin],
    queryFn: async () => {
      let query = supabase
        .from("fond_caisse_operations")
        .select(`
          id, montant, type_operation, categorie, libelle, date_operation
        `)
        .order("date_operation", { ascending: false });

      if (selectedExercice !== "all") {
        query = query.eq("exercice_id", selectedExercice);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      if (dateDebut || dateFin) {
        return data?.filter(op => {
          const d = parseISO(op.date_operation);
          if (dateDebut && dateFin) {
            return isWithinInterval(d, { start: parseISO(dateDebut), end: parseISO(dateFin) });
          } else if (dateDebut) {
            return d >= parseISO(dateDebut);
          } else if (dateFin) {
            return d <= parseISO(dateFin);
          }
          return true;
        });
      }
      return data;
    },
  });

  // Calculs agrégés pour cotisations
  const cotisationsStats = useMemo(() => {
    if (!cotisations) return null;
    
    const total = cotisations.reduce((sum, c) => sum + (c.montant || 0), 0);
    const paye = cotisations.filter(c => c.statut === "paye").reduce((sum, c) => sum + (c.montant || 0), 0);
    const partiel = cotisations.filter(c => c.statut === "partiel").reduce((sum, c) => sum + (c.montant || 0), 0);
    const impaye = cotisations.filter(c => c.statut === "impaye").reduce((sum, c) => sum + (c.montant || 0), 0);
    
    const parType = cotisations.reduce((acc: Record<string, number>, c) => {
      const type = c.cotisations_types?.nom || "Autre";
      acc[type] = (acc[type] || 0) + (c.montant || 0);
      return acc;
    }, {});

    const chartData = Object.entries(parType).map(([name, value]) => ({ name, value }));
    
    return { total, paye, partiel, impaye, tauxRecouvrement: total > 0 ? (paye / total * 100) : 0, chartData };
  }, [cotisations]);

  // Calculs agrégés pour prêts
  const pretsStats = useMemo(() => {
    if (!prets) return null;
    
    const encours = prets.filter(p => p.statut !== "rembourse");
    const rembourses = prets.filter(p => p.statut === "rembourse");
    const enRetard = prets.filter(p => p.statut !== "rembourse" && new Date(p.echeance) < new Date());
    
    const totalEncours = encours.reduce((sum, p) => sum + ((p.montant_total_du || p.montant) - (p.montant_paye || 0)), 0);
    const totalRembourse = rembourses.reduce((sum, p) => sum + (p.montant_paye || 0), 0);
    const interetsPercus = prets.reduce((sum, p) => sum + (p.interet_paye || 0), 0);
    
    return { 
      encours: encours.length, 
      rembourses: rembourses.length, 
      enRetard: enRetard.length,
      totalEncours,
      totalRembourse,
      interetsPercus
    };
  }, [prets]);

  // Calculs agrégés pour sanctions
  const sanctionsStats = useMemo(() => {
    if (!sanctions) return null;
    
    const total = sanctions.reduce((sum, s) => sum + (s.montant_amende || 0), 0);
    const paye = sanctions.filter(s => s.statut === "paye").reduce((sum, s) => sum + (s.montant_amende || 0), 0);
    const impaye = sanctions.filter(s => s.statut !== "paye").reduce((sum, s) => sum + (s.montant_amende || 0), 0);
    
    return { total, paye, impaye, count: sanctions.length };
  }, [sanctions]);

  // Calculs agrégés pour épargnes
  const epargnesStats = useMemo(() => {
    if (!epargnes) return null;
    
    const total = epargnes.reduce((sum, e) => sum + (e.montant || 0), 0);
    
    const parMembre = epargnes.reduce((acc: Record<string, number>, e) => {
      const key = e.membres ? `${e.membres.prenom} ${e.membres.nom}` : "Inconnu";
      acc[key] = (acc[key] || 0) + (e.montant || 0);
      return acc;
    }, {});
    
    const chartData = Object.entries(parMembre)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value }));
    
    return { total, count: epargnes.length, chartData };
  }, [epargnes]);

  // Calculs agrégés pour caisse
  const caisseStats = useMemo(() => {
    if (!caisseOps) return null;
    
    const entrees = caisseOps.filter(op => op.type_operation === "entree").reduce((sum, op) => sum + (op.montant || 0), 0);
    const sorties = caisseOps.filter(op => op.type_operation === "sortie").reduce((sum, op) => sum + (op.montant || 0), 0);
    
    const parCategorie = caisseOps.reduce((acc: Record<string, { entrees: number, sorties: number }>, op) => {
      const cat = op.categorie || "autre";
      if (!acc[cat]) acc[cat] = { entrees: 0, sorties: 0 };
      if (op.type_operation === "entree") {
        acc[cat].entrees += op.montant || 0;
      } else {
        acc[cat].sorties += op.montant || 0;
      }
      return acc;
    }, {});

    const chartData = Object.entries(parCategorie).map(([name, data]) => ({
      name,
      entrees: data.entrees,
      sorties: data.sorties
    }));
    
    return { entrees, sorties, solde: entrees - sorties, chartData };
  }, [caisseOps]);

  // Helper to format membre name from join
  const formatMembre = (membres: { prenom: string; nom: string } | null): string => {
    return membres ? `${membres.prenom} ${membres.nom}` : "-";
  };

  const getPeriode = () =>
    selectedExercice !== "all"
      ? exercices?.find(e => e.id === selectedExercice)?.nom
      : dateDebut && dateFin
        ? `${dateDebut} au ${dateFin}`
        : "Toutes périodes";

  const exportPDF = (type: string) =>
    exportRapportPDF(type, { cotisations, prets, sanctions, epargnes, periode: getPeriode() });

  const exportExcel = (type: string) =>
    exportRapportExcel(type, { cotisations, prets, sanctions, epargnes });


  const isLoading = loadingCotisations || loadingPrets || loadingSanctions || loadingEpargnes || loadingCaisse;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Rapports Financiers</h1>
          <p className="text-muted-foreground">Synthèse et export des données financières</p>
        </div>
      </div>

      {/* Filtres */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Filtres de période
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Exercice</Label>
              <Select value={selectedExercice} onValueChange={setSelectedExercice}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les exercices" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les exercices</SelectItem>
                  {exercices?.map((ex) => (
                    <SelectItem key={ex.id} value={ex.id}>
                      {ex.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date de début</Label>
              <Input 
                type="date" 
                value={dateDebut} 
                onChange={(e) => setDateDebut(e.target.value)} 
              />
            </div>
            <div>
              <Label>Date de fin</Label>
              <Input 
                type="date" 
                value={dateFin} 
                onChange={(e) => setDateFin(e.target.value)} 
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <RapportsTabsContent
          cotisationsStats={cotisationsStats}
          pretsStats={pretsStats}
          sanctionsStats={sanctionsStats}
          epargnesStats={epargnesStats}
          caisseStats={caisseStats}
          prets={prets}
          formatMembre={formatMembre}
          exportPDF={exportPDF}
          exportExcel={exportExcel}
        />
      )}
    </div>
  );
};

export default RapportsAdmin;
