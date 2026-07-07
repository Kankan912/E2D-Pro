import { ReactNode } from "react";
import { DashboardSidebar } from "./DashboardSidebar";
import { DashboardHeader } from "./DashboardHeader";
import { SidebarProvider } from "@/components/ui/sidebar";
import { NotificationToaster } from "@/components/notifications/NotificationToaster";
import { Breadcrumbs } from "@/components/Breadcrumbs";

interface DashboardLayoutProps {
  children: ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <DashboardSidebar />
        <div className="flex-1 flex flex-col">
          <DashboardHeader />
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            <Breadcrumbs />
            {children}
          </main>
        </div>
      </div>
      <NotificationToaster />
    </SidebarProvider>
  );
};
