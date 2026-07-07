import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Users } from "lucide-react";
import ReunionPresencesManager from "@/components/ReunionPresencesManager";
import type { Reunion } from "../types";

interface PresencesTabProps {
  reunions: Reunion[];
  selectedReunion: Reunion | null;
  setSelectedReunion: (r: Reunion) => void;
}

export default function PresencesTab({ reunions, selectedReunion, setSelectedReunion }: PresencesTabProps) {
  return (
    <>
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5" />
            <h3 className="font-semibold">Sélectionner une réunion</h3>
          </div>
          <div className="space-y-2">
            {reunions.slice(0, 10).map(reunion => (
              <Button key={reunion.id} variant={selectedReunion?.id === reunion.id ? "default" : "outline"} size="sm" onClick={() => setSelectedReunion(reunion)} className="w-full justify-start">
                <Calendar className="w-4 h-4 mr-2" />
                {new Date(reunion.date_reunion).toLocaleDateString('fr-FR')} - {reunion.ordre_du_jour}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
      {selectedReunion ? (
        <ReunionPresencesManager reunionId={selectedReunion.id} />
      ) : (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Sélectionnez une réunion pour gérer les présences</CardContent></Card>
      )}
    </>
  );
}
