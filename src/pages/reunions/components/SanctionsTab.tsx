import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, FileText } from "lucide-react";
import ReunionSanctionsManager from "@/components/ReunionSanctionsManager";
import type { Reunion } from "../types";

interface SanctionsTabProps {
  reunions: Reunion[];
  selectedReunion: Reunion | null;
  setSelectedReunion: (r: Reunion) => void;
}

export default function SanctionsTab({ reunions, selectedReunion, setSelectedReunion }: SanctionsTabProps) {
  return (
    <>
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5" />
            <h3 className="font-semibold">Sélectionner une réunion pour gérer les sanctions</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {reunions.slice(0, 12).map(reunion => (
              <Button key={reunion.id} variant={selectedReunion?.id === reunion.id ? "default" : "outline"} size="sm" onClick={() => setSelectedReunion(reunion)} className="justify-start truncate">
                <Calendar className="w-4 h-4 mr-2 flex-shrink-0" />
                <span className="truncate">{new Date(reunion.date_reunion).toLocaleDateString('fr-FR')}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
      {selectedReunion ? (
        <ReunionSanctionsManager reunionId={selectedReunion.id} />
      ) : (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Sélectionnez une réunion ci-dessus pour gérer les sanctions</CardContent></Card>
      )}
    </>
  );
}
