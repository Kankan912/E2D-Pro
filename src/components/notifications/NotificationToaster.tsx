import { useInAppNotifications } from "@/hooks/useInAppNotifications";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

export function NotificationToaster() {
  const { notifications } = useInAppNotifications();
  return <SonnerToaster />;
}

export default NotificationToaster;
