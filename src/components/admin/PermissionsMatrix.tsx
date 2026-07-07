import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { useRoles } from "@/hooks/useRoles";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

import { logger } from "@/lib/logger";
const RESOURCES = [
  { id: 'membres', label: 'Membres' },
  { id: 'cotisations', label: 'Cotisations' },
  { id: 'epargnes', label: 'Épargnes' },
  { id: 'reunions', label: 'Réunions' },
  { id: 'prets', label: 'Prêts' },
  { id: 'aides', label: 'Aides' },
  { id: 'sanctions', label: 'Sanctions' },
  { id: 'sport_e2d', label: 'Sport E2D' },
  { id: 'sport_phoenix', label: 'Sport Phoenix' },
  { id: 'donations', label: 'Dons' },
  { id: 'site', label: 'Site Web (CMS)' },
  { id: 'configuration', label: 'Configuration' },
];

const PERMISSIONS = [
  { id: 'create', label: 'Créer' },
  { id: 'read', label: 'Lire' },
  { id: 'update', label: 'Modifier' },
  { id: 'delete', label: 'Supprimer' },
];

interface PermissionsMatrixProps {
  roleId: string;
}

export const PermissionsMatrix = ({ roleId }: PermissionsMatrixProps) => {
  const { useRolePermissions, updateRolePermission } = useRoles();
  const { data: permissions, isLoading } = useRolePermissions(roleId);
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<Record<string, 'success' | 'error' | null>>({});

  const hasPermission = (resource: string, permission: string) => {
    return permissions?.some(
      p => p.resource === resource && p.permission === permission && p.granted
    ) || false;
  };

  const handleToggle = async (resource: string, permission: string, granted: boolean) => {
    const cellKey = `${resource}-${permission}`;
    setSavingCell(cellKey);
    setSaveStatus(prev => ({ ...prev, [cellKey]: null }));
    
    try {
      await updateRolePermission.mutateAsync({ roleId, resource, permission, granted });
      setSaveStatus(prev => ({ ...prev, [cellKey]: 'success' }));
      // Clear success status after 2 seconds
      setTimeout(() => {
        setSaveStatus(prev => ({ ...prev, [cellKey]: null }));
      }, 2000);
    } catch (error: unknown) {
      logger.error('Erreur sauvegarde permission:', error);
      setSaveStatus(prev => ({ ...prev, [cellKey]: 'error' }));
      // Keep error status visible longer
      setTimeout(() => {
        setSaveStatus(prev => ({ ...prev, [cellKey]: null }));
      }, 5000);
    } finally {
      setSavingCell(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <p className="text-muted-foreground">Chargement des permissions...</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">Ressource</TableHead>
            {PERMISSIONS.map(perm => (
              <TableHead key={perm.id} className="text-center">
                {perm.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {RESOURCES.map(resource => (
            <TableRow key={resource.id}>
              <TableCell className="font-medium">{resource.label}</TableCell>
              {PERMISSIONS.map(perm => {
                const cellKey = `${resource.id}-${perm.id}`;
                const isSaving = savingCell === cellKey;
                const status = saveStatus[cellKey];
                
                return (
                  <TableCell key={perm.id} className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : (
                        <Checkbox
                          id={cellKey}
                          checked={hasPermission(resource.id, perm.id)}
                          onCheckedChange={(checked) => 
                            handleToggle(resource.id, perm.id, checked as boolean)
                          }
                          disabled={updateRolePermission.isPending}
                        />
                      )}
                      {status === 'success' && (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      )}
                      {status === 'error' && (
                        <XCircle className="h-3 w-3 text-red-500" />
                      )}
                      <Label 
                        htmlFor={cellKey}
                        className="sr-only"
                      >
                        {`${perm.label} ${resource.label}`}
                      </Label>
                    </div>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
