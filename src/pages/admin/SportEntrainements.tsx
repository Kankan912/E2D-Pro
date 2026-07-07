import { Calendar } from "lucide-react";
import BackButton from "@/components/BackButton";
import PhoenixEntrainementsManager from "@/components/PhoenixEntrainementsManager";

export default function SportEntrainements() {
  return (
    <div className="container mx-auto space-y-6">
      <BackButton />
      <div className="flex items-center gap-2">
        <Calendar className="h-8 w-8 text-primary" />
        <h1 className="text-2xl sm:text-3xl font-bold">Gestion des Entraînements</h1>
      </div>
      <p className="text-muted-foreground">
        Planification et suivi des entraînements Phoenix
      </p>
      
      <PhoenixEntrainementsManager />
    </div>
  );
}
