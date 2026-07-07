import { useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCircle2,
  XCircle,
  Wallet,
  Ban,
  Clock,
  AlertCircle,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { InAppNotification } from "@/hooks/useInAppNotifications";
import { useMarkNotificationRead } from "@/hooks/useInAppNotifications";

interface Props {
  notification: InAppNotification;
  onNavigate?: () => void;
}

const iconByType: Record<string, typeof Bell> = {
  loan_request_submitted: FileText,
  loan_validated: CheckCircle2,
  loan_rejected: XCircle,
  loan_disbursed: Wallet,
  loan_cancelled: Ban,
  loan_due_soon: Clock,
  loan_overdue: AlertCircle,
  sanction_created: Ban,
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `il y a ${d} j`;
  return new Date(iso).toLocaleDateString("fr-FR");
}

export const NotificationItemPersonal = ({ notification, onNavigate }: Props) => {
  const navigate = useNavigate();
  const markRead = useMarkNotificationRead();
  const Icon = iconByType[notification.type] ?? Bell;
  const unread = !notification.read_at;

  const handleClick = () => {
    if (unread) markRead.mutate(notification.id);
    if (notification.link) {
      navigate(notification.link);
      onNavigate?.();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "w-full text-left flex items-start gap-3 p-3 rounded-lg border transition-colors",
        unread
          ? "bg-primary/5 border-primary/20 hover:bg-primary/10"
          : "bg-muted/30 border-transparent hover:bg-muted/60",
      )}
    >
      <div
        className={cn(
          "mt-0.5 shrink-0",
          unread ? "text-primary" : "text-muted-foreground",
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              "text-sm truncate",
              unread ? "font-semibold" : "font-medium",
            )}
          >
            {notification.title}
          </span>
          {unread && (
            <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
          )}
        </div>
        {notification.body && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
            {notification.body}
          </p>
        )}
        <p className="text-[11px] text-muted-foreground/70 mt-1">
          {timeAgo(notification.created_at)}
        </p>
      </div>
    </button>
  );
};
