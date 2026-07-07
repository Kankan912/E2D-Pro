import { useNavigate } from "react-router-dom";
import { AlertTriangle, Ban, Wallet, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Alerte } from "@/hooks/useAlertesGlobales";

interface NotificationItemProps {
  alerte: Alerte;
  onClose?: () => void;
}

const typeConfig = {
  pret_retard: {
    icon: AlertTriangle,
    label: 'Prêt',
  },
  sanction_impayee: {
    icon: Ban,
    label: 'Sanction',
  },
  caisse_bas: {
    icon: Wallet,
    label: 'Caisse',
  },
  reunion_proche: {
    icon: Calendar,
    label: 'Réunion',
  },
};

const niveauStyles = {
  danger: 'text-destructive bg-destructive/10 border-destructive/20',
  warning: 'text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-950/30 dark:border-orange-800',
  info: 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/30 dark:border-blue-800',
};

const badgeStyles = {
  danger: 'bg-destructive text-destructive-foreground',
  warning: 'bg-orange-500 text-white',
  info: 'bg-blue-500 text-white',
};

export const NotificationItem = ({ alerte, onClose }: NotificationItemProps) => {
  const navigate = useNavigate();
  const config = typeConfig[alerte.type];
  const Icon = config.icon;

  const handleClick = () => {
    if (alerte.lien) {
      navigate(alerte.lien);
      onClose?.();
    }
  };

  const formatRelativeDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      // Future date
      const futureDays = Math.abs(diffDays);
      if (futureDays === 0) return "Aujourd'hui";
      if (futureDays === 1) return "Demain";
      return `Dans ${futureDays} jours`;
    }

    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return "Hier";
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} semaines`;
    return `Il y a ${Math.floor(diffDays / 30)} mois`;
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:scale-[1.01]",
        niveauStyles[alerte.niveau]
      )}
    >
      <div className="mt-0.5">
        <Icon className="h-5 w-5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm truncate">{alerte.titre}</span>
          <Badge className={cn("text-xs shrink-0", badgeStyles[alerte.niveau])}>
            {config.label}
          </Badge>
        </div>

        <p className="text-xs opacity-80 line-clamp-2">
          {alerte.description}
        </p>

        <p className="text-xs opacity-60 mt-1">
          {formatRelativeDate(alerte.dateCreation)}
        </p>
      </div>
    </div>
  );
};
