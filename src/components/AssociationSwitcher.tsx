import { useAssociation } from '@/hooks/useAssociation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2 } from 'lucide-react';

export function AssociationSwitcher() {
  const { isSuperAdmin, associations, associationId, switchAssociation } = useAssociation();
  if (!isSuperAdmin) return null;
  if (!associations || associations.length === 0) return null;
  return (
    <Select value={associationId ?? ''} onValueChange={switchAssociation}>
      <SelectTrigger className="w-[200px]">
        <Building2 className="h-4 w-4 mr-2" />
        <SelectValue placeholder="Sélectionner une association" />
      </SelectTrigger>
      <SelectContent>
        {associations.map((a: any) => (
          <SelectItem key={a.id} value={a.id}>{a.nom}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
