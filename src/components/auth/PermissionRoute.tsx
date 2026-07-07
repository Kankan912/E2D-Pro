import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Loader2 } from "lucide-react";

interface PermissionRouteProps {
  children: ReactNode;
  resource: string;
  permission: string;
  fallback?: string;
}

export const PermissionRoute = ({ 
  children, 
  resource, 
  permission, 
  fallback = "/dashboard" 
}: PermissionRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { hasPermission, isLoading: permLoading } = usePermissions();

  if (authLoading || permLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !hasPermission(resource, permission)) {
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
};
