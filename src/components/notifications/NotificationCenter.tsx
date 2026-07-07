import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAlertesGlobales } from "@/hooks/useAlertesGlobales";
import {
  useInAppNotifications,
  useMarkAllNotificationsRead,
} from "@/hooks/useInAppNotifications";
import { NotificationItem } from "./NotificationItem";
import { NotificationItemPersonal } from "./NotificationItemPersonal";
import { useState } from "react";

export const NotificationCenter = () => {
  const { alertes, nombreCritiques } = useAlertesGlobales();
  const { notifications, unreadCount } = useInAppNotifications(30);
  const markAll = useMarkAllNotificationsRead();
  const [open, setOpen] = useState(false);

  const totalBadge = unreadCount + nombreCritiques;
  const hasAnyContent = notifications.length > 0 || alertes.length > 0;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {totalBadge > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center p-0 text-xs"
            >
              {totalBadge > 9 ? "9+" : totalBadge}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-96">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span className="font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={markAll.isPending}
              onClick={() => markAll.mutate()}
            >
              Tout marquer lu
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {!hasAnyContent ? (
          <div className="py-8 text-center">
            <CheckCheck className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">Aucune notification</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Tout est en ordre !
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[440px]">
            <div className="p-2 space-y-3">
              {notifications.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1">
                    Mes notifications
                  </p>
                  {notifications.map((n) => (
                    <NotificationItemPersonal
                      key={n.id}
                      notification={n}
                      onNavigate={() => setOpen(false)}
                    />
                  ))}
                </div>
              )}
              {alertes.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1">
                    Alertes système
                  </p>
                  {alertes.map((alerte) => (
                    <NotificationItem
                      key={alerte.id}
                      alerte={alerte}
                      onClose={() => setOpen(false)}
                    />
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
