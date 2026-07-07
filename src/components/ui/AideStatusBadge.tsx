/**
 * @module AideStatusBadge
 * Reusable badge component for aide status display.
 * Uses centralized constants for labels and colors.
 */
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  type AideStatut,
  AIDE_STATUT_LABELS,
  AIDE_STATUT_COLORS,
} from "@/lib/aide-constants";

interface AideStatusBadgeProps {
  statut: AideStatut | string;
  className?: string;
}

export default function AideStatusBadge({ statut, className }: AideStatusBadgeProps) {
  const knownStatut = statut as AideStatut;
  const label = AIDE_STATUT_LABELS[knownStatut] ?? statut;
  const colorClass = AIDE_STATUT_COLORS[knownStatut];

  return (
    <Badge
      className={cn(
        "inline-flex items-center w-fit",
        colorClass,
        className
      )}
    >
      {label}
    </Badge>
  );
}
