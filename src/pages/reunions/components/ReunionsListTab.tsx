import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, Search, MapPin, Clock, FileText, Users, Edit, Trash2, Plus, Lock, Mail, Unlock } from "lucide-react";
import CompteRenduActions from "@/components/CompteRenduActions";
import { usePermissions } from "@/hooks/usePermissions";
import type { Reunion } from "../types";

interface ReunionsListTabProps {
  filteredReunions: Reunion[];
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  getMemberName: (id: string | undefined | null) => string | null;
  handleEdit: (r: Reunion) => void;
  handleDelete: (id: string) => void;
  handleCompteRendu: (r: Reunion) => void;
  handleViewCompteRendu: (r: Reunion) => void;
  setSelectedReunion: (r: Reunion) => void;
  setShowCompteRenduForm: (v: boolean) => void;
  setShowNotifierModal: (v: boolean) => void;
  setShowReouvrirModal: (v: boolean) => void;
  loadReunions: () => Promise<void>;
}

function getStatutBadge(statut: string, tauxPresence?: number) {
  switch (statut) {
    case 'planifie':
      return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Planifiée</Badge>;
    case 'en_cours':
      return <Badge className="bg-warning text-warning-foreground"><Users className="w-3 h-3 mr-1" />En cours</Badge>;
    case 'terminee':
      return (
        <div className="flex items-center gap-2">
          <Badge className="bg-success text-success-foreground font-semibold"><Lock className="w-3 h-3 mr-1" />Clôturée</Badge>
          {tauxPresence !== undefined && tauxPresence !== null && (
            <Badge variant={tauxPresence >= 75 ? 'default' : tauxPresence >= 50 ? 'secondary' : 'destructive'} className="text-xs">
              {tauxPresence}%
            </Badge>
          )}
        </div>
      );
    case 'annulee':
      return <Badge variant="destructive">Annulée</Badge>;
    default:
      return <Badge variant="outline">{statut}</Badge>;
  }
}

export default function ReunionsListTab({
  filteredReunions, searchTerm, setSearchTerm, getMemberName,
  handleEdit, handleDelete, handleCompteRendu, handleViewCompteRendu,
  setSelectedReunion, setShowCompteRenduForm, setShowNotifierModal, setShowReouvrirModal,
  loadReunions,
}: ReunionsListTabProps) {
  const { hasPermission } = usePermissions();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Calendrier des Réunions
          </CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher..." className="pl-10 w-64" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Heure</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Membre hôte</TableHead>
                <TableHead>Bénéficiaire</TableHead>
                <TableHead>Ordre du jour</TableHead>
                <TableHead>Lieu</TableHead>
                <TableHead>Compte-rendu</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReunions.map((reunion) => (
                <TableRow key={reunion.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">
                    <div>
                      <p className="font-semibold">{new Date(reunion.date_reunion).toLocaleDateString('fr-FR')}</p>
                      <p className="text-sm text-muted-foreground">{new Date(reunion.date_reunion).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </TableCell>
                  <TableCell>{getStatutBadge(reunion.statut, reunion.taux_presence)}</TableCell>
                  <TableCell>
                    {reunion.lieu_membre_id ? (
                      <span className="text-sm">{getMemberName(reunion.lieu_membre_id) || 'Non défini'}</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">Non défini</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {reunion.beneficiaire_id ? (
                      <span className="text-sm">{getMemberName(reunion.beneficiaire_id) || 'Non défini'}</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">Non défini</span>
                    )}
                  </TableCell>
                  <TableCell><p className="text-sm">{reunion.ordre_du_jour || "Non défini"}</p></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      {reunion.lieu_description && <p className="text-sm">{reunion.lieu_description}</p>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {reunion.compte_rendu_url ? (
                      reunion.compte_rendu_url === 'generated' ? (
                        <div className="flex gap-2">
                          <Badge className="bg-success text-success-foreground"><FileText className="w-3 h-3 mr-1" />Disponible</Badge>
                          <Button variant="outline" size="sm" onClick={() => handleViewCompteRendu(reunion)}><FileText className="w-4 h-4" /></Button>
                          <Button variant="outline" size="sm" onClick={() => { setSelectedReunion(reunion); setShowCompteRenduForm(true); }}><Edit className="w-4 h-4" /></Button>
                          {reunion.statut === 'terminee' && (
                            <CompteRenduActions reunion={reunion} onSuccess={loadReunions} />
                          )}
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleViewCompteRendu(reunion)}><FileText className="w-4 h-4 mr-1" />Voir</Button>
                          <Button variant="outline" size="sm" onClick={() => { setSelectedReunion(reunion); setShowCompteRenduForm(true); }}><Edit className="w-4 h-4" /></Button>
                        </div>
                      )
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => handleCompteRendu(reunion)} className="text-primary"><Plus className="w-4 h-4 mr-1" />Ajouter</Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2 flex-wrap">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(reunion)} disabled={reunion.statut === 'terminee'} title={reunion.statut === 'terminee' ? 'Réunion clôturée - Modifications bloquées' : 'Modifier'}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(reunion.id)} className="text-destructive hover:bg-destructive/10" disabled={reunion.statut === 'terminee'} title={reunion.statut === 'terminee' ? 'Réunion clôturée - Suppression bloquée' : 'Supprimer'}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      {reunion.statut !== 'terminee' && hasPermission('reunions', 'update') && (
                        <Button variant="outline" size="sm" onClick={() => { setSelectedReunion(reunion); setShowNotifierModal(true); }} title="Notifier sans clôturer" className="text-primary">
                          <Mail className="w-4 h-4" />
                        </Button>
                      )}
                      {reunion.statut === 'terminee' && hasPermission('reunions', 'update') && (
                        <Button variant="outline" size="sm" onClick={() => { setSelectedReunion(reunion); setShowReouvrirModal(true); }} title="Rouvrir la réunion" className="text-warning hover:bg-warning/10">
                          <Unlock className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredReunions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? "Aucune réunion trouvée" : "Aucune réunion planifiée"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
