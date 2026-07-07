import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PresencesRecapMensuel from "@/components/PresencesRecapMensuel";
import PresencesRecapAnnuel from "@/components/PresencesRecapAnnuel";

export default function RecapitulatifsTab() {
  return (
    <Tabs defaultValue="mensuel" className="space-y-6">
      <TabsList>
        <TabsTrigger value="mensuel">Vue Mensuelle</TabsTrigger>
        <TabsTrigger value="annuel">Bilan Annuel</TabsTrigger>
      </TabsList>
      <TabsContent value="mensuel"><PresencesRecapMensuel /></TabsContent>
      <TabsContent value="annuel"><PresencesRecapAnnuel /></TabsContent>
    </Tabs>
  );
}
