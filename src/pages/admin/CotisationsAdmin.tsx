import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Receipt } from "lucide-react";
import CotisationsTab from "@/pages/reunions/components/CotisationsTab";
import type { Reunion } from "@/pages/reunions/types";

const CotisationsAdmin = () => {
  const [selectedReunion, setSelectedReunion] = useState<Reunion | null>(null);

  const { data: reunions = [] } = useQuery({
    queryKey: ["reunions-cotisations-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reunions")
        .select("id, sujet, date_reunion, statut, ordre_du_jour, lieu_description, compte_rendu_url, lieu_membre_id, beneficiaire_id")
        .order("date_reunion", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Reunion[];
    },
    staleTime: 60 * 1000,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <Receipt className="h-7 w-7 text-primary" />
          Cotisations
        </h1>
        <p className="text-muted-foreground mt-1">
          Saisie des cotisations par réunion et suivi annuel.
        </p>
      </div>

      <CotisationsTab
        reunions={reunions}
        selectedReunion={selectedReunion}
        onSelectReunion={setSelectedReunion}
      />
    </div>
  );
};

export default CotisationsAdmin;
