import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, Gift } from "lucide-react";
import BeneficiairesReunionWidget from "@/components/BeneficiairesReunionWidget";
import CalendrierBeneficiairesManager from "@/components/config/CalendrierBeneficiairesManager";
import type { Reunion } from "../types";

interface BeneficiairesTabProps {
  reunions: Reunion[];
  selectedReunion: Reunion | null;
  setSelectedReunion: (r: Reunion) => void;
}

export default function BeneficiairesTab({ reunions, selectedReunion, setSelectedReunion }: BeneficiairesTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Sélectionner une réunion
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {reunions.slice(0, 8).map(reunion => (
              <Button key={reunion.id} variant={selectedReunion?.id === reunion.id ? "default" : "outline"} size="sm" onClick={() => setSelectedReunion(reunion)} className="justify-start h-auto py-2">
                <div className="flex flex-col items-start w-full">
                  <span className="font-medium">{new Date(reunion.date_reunion).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {reunion.statut === 'terminee' ? 'Clôturée' : reunion.statut === 'planifie' ? 'Planifiée' : 'En cours'}
                  </span>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedReunion ? (
        <BeneficiairesReunionWidget reunionId={selectedReunion.id} reunionDate={selectedReunion.date_reunion} isReadOnly={selectedReunion.statut === 'terminee'} />
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Gift className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Sélectionnez une réunion pour gérer les bénéficiaires</p>
          </CardContent>
        </Card>
      )}

      <CalendrierBeneficiairesManager />
    </div>
  );
}
