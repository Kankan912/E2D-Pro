import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, FileText } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
}

function StatCard({ title, value, icon: Icon, color = "primary" }: StatCardProps) {
  return (
    <Card className="transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 text-${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

interface ReunionStatCardsProps {
  reunionsPlanifiees: number;
  reunionsEnCours: number;
  reunionsTerminees: number;
  reunionsMois: number;
}

export default function ReunionStatCards({ reunionsPlanifiees, reunionsEnCours, reunionsTerminees, reunionsMois }: ReunionStatCardsProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <StatCard title="Planifiées" value={reunionsPlanifiees} icon={Calendar} color="secondary" />
      <StatCard title="En Cours" value={reunionsEnCours} icon={Users} color="warning" />
      <StatCard title="Terminées" value={reunionsTerminees} icon={FileText} color="success" />
      <StatCard title="Ce Mois" value={reunionsMois} icon={Calendar} color="primary" />
    </div>
  );
}
