import { usePermissions } from "@/hooks/usePermissions";

export function usePretRequestPermissions() {
  const { hasPermission } = usePermissions();
  return {
    canCreate: hasPermission("prets_requests", "create"),
    canValidate: hasPermission("prets_requests", "validate"),
    canDisburse: hasPermission("prets_requests", "disburse"),
    canConfigure: hasPermission("prets_requests", "configure"),
  };
}
