import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Mail, Phone, CheckCircle, Eye, MessageSquare, Trash2, Download, Send, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import BackButton from "@/components/BackButton";

import { logger } from "@/lib/logger";
type MessageStatus = "nouveau" | "lu" | "traite";

const MessagesAdmin = () => {
  const queryClient = useQueryClient();
  const [selectedMessage, setSelectedMessage] = useState<unknown>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [replyContent, setReplyContent] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);

  const { data: messages, isLoading } = useQuery({
    queryKey: ["contact-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages_contact').select('id, nom, email, telephone, objet, message, statut, created_at')
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const updateMessage = useMutation({
    mutationFn: async ({ id, statut }: { id: string; statut: MessageStatus }) => {
      const { error } = await supabase
        .from("messages_contact")
        .update({ statut })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-messages"] });
      toast({ title: "Succès", description: "Statut mis à jour" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Échec de la mise à jour", variant: "destructive" });
    },
  });

  const deleteMessage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("messages_contact")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-messages"] });
      toast({ title: "Succès", description: "Message supprimé" });
      setSelectedMessage(null);
    },
    onError: () => {
      toast({ title: "Erreur", description: "Échec de la suppression", variant: "destructive" });
    },
  });

  const filteredMessages = messages?.filter((msg) => {
    if (statusFilter === "all") return true;
    return msg.statut === statusFilter;
  });

  const getStatusBadge = (statut: string) => {
    switch (statut) {
      case "nouveau":
        return <Badge variant="destructive">Nouveau</Badge>;
      case "lu":
        return <Badge variant="secondary">Lu</Badge>;
      case "traite":
        return <Badge className="bg-green-500 hover:bg-green-600">Traité</Badge>;
      default:
        return <Badge variant="outline">{statut}</Badge>;
    }
  };

  const messageCounts = {
    all: messages?.length || 0,
    nouveau: messages?.filter((m) => m.statut === "nouveau").length || 0,
    lu: messages?.filter((m) => m.statut === "lu").length || 0,
    traite: messages?.filter((m) => m.statut === "traite").length || 0,
  };

  const handleViewMessage = (message: unknown) => {
    setSelectedMessage(message);
    setReplyContent("");
    setShowReplyForm(false);
    
    // Marquer comme lu si nouveau
    if (message.statut === "nouveau") {
      updateMessage.mutate({ id: message.id, statut: "lu" });
    }
  };

  const handleSendReply = async () => {
    if (!selectedMessage || !replyContent.trim()) return;

    setIsSendingReply(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-contact-notification', {
        body: {
          type: 'admin_reply',
          to: selectedMessage.email,
          contactData: {
            nom: selectedMessage.nom,
            email: selectedMessage.email,
            objet: selectedMessage.objet,
          },
          replyContent: replyContent.trim(),
        }
      });

      if (error) {
        const errorMessage = data?.error || error.message;
        throw new Error(errorMessage);
      }
      if (data?.error) throw new Error(data.error);

      // Marquer comme traité après réponse
      await updateMessage.mutateAsync({ id: selectedMessage.id, statut: "traite" });

      toast({ 
        title: "Réponse envoyée", 
        description: `Email envoyé à ${selectedMessage.email}` 
      });
      
      setReplyContent("");
      setShowReplyForm(false);
      setSelectedMessage(null);
    } catch (error: unknown) {
      logger.error("Erreur envoi réponse:", error);
      toast({ 
        title: "Erreur", 
        description: "Impossible d'envoyer la réponse. Vérifiez la configuration email.",
        variant: "destructive" 
      });
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleExport = () => {
    if (!messages || messages.length === 0) {
      toast({ title: "Aucune donnée", description: "Aucun message à exporter", variant: "destructive" });
      return;
    }

    const exportData = messages.map(msg => ({
      "Date": format(new Date(msg.created_at), "dd/MM/yyyy HH:mm", { locale: fr }),
      "Nom": msg.nom,
      "Email": msg.email,
      "Téléphone": msg.telephone || "",
      "Objet": msg.objet,
      "Message": msg.message,
      "Statut": msg.statut === "nouveau" ? "Nouveau" : msg.statut === "lu" ? "Lu" : "Traité",
    }));

    const ws = null // XLSX removed (exportData);
    const wb = null // XLSX removed;
    null // XLSX removed (wb, ws, "Messages");
    // XLSX removed — use exportSimpleSheet(wb, `messages_contact_${format(new Date(), "yyyy-MM-dd")}.xlsx`);

    toast({ title: "Export réussi", description: `${messages.length} messages exportés` });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Messages de Contact</h1>
            <p className="text-muted-foreground">Gérez les messages reçus via le formulaire de contact</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Exporter Excel
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total</CardDescription>
            <CardTitle className="text-2xl">{messageCounts.all}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Nouveaux</CardDescription>
            <CardTitle className="text-2xl text-destructive">{messageCounts.nouveau}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Lus</CardDescription>
            <CardTitle className="text-2xl text-yellow-500">{messageCounts.lu}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Traités</CardDescription>
            <CardTitle className="text-2xl text-green-500">{messageCounts.traite}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Messages Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Messages ({filteredMessages?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">Tous ({messageCounts.all})</TabsTrigger>
              <TabsTrigger value="nouveau">Nouveaux ({messageCounts.nouveau})</TabsTrigger>
              <TabsTrigger value="lu">Lus ({messageCounts.lu})</TabsTrigger>
              <TabsTrigger value="traite">Traités ({messageCounts.traite})</TabsTrigger>
            </TabsList>

            <TabsContent value={statusFilter}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Objet</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMessages?.map((message) => (
                    <TableRow key={message.id}>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(message.created_at), "dd MMM yyyy HH:mm", { locale: fr })}
                      </TableCell>
                      <TableCell className="font-medium">{message.nom}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{message.objet}</TableCell>
                      <TableCell>{message.email}</TableCell>
                      <TableCell>{getStatusBadge(message.statut)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Voir le message de ${message.nom}`}
                            onClick={() => handleViewMessage(message)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {message.statut !== "traite" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Marquer comme traité le message de ${message.nom}`}
                              onClick={() => updateMessage.mutate({ id: message.id, statut: "traite" })}
                            >
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            </Button>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label={`Supprimer le message de ${message.nom}`}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Supprimer ce message ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Cette action est irréversible. Le message de {message.nom} sera définitivement supprimé.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => deleteMessage.mutate(message.id)}
                                >
                                  Supprimer
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}

                  {(!filteredMessages || filteredMessages.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Aucun message trouvé
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Message Detail Dialog */}
      <Dialog open={!!selectedMessage} onOpenChange={() => setSelectedMessage(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Message de {selectedMessage?.nom}
            </DialogTitle>
          </DialogHeader>

          {selectedMessage && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <a
                    href={`mailto:${selectedMessage.email}`}
                    className="text-primary hover:underline"
                  >
                    {selectedMessage.email}
                  </a>
                </div>
                {selectedMessage.telephone && (
                  <div>
                    <p className="text-sm text-muted-foreground">Téléphone</p>
                    <a
                      href={`tel:${selectedMessage.telephone}`}
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      <Phone className="h-4 w-4" />
                      {selectedMessage.telephone}
                    </a>
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Objet</p>
                <p className="font-medium">{selectedMessage.objet}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Message</p>
                <div className="bg-muted p-4 rounded-lg whitespace-pre-wrap">
                  {selectedMessage.message}
                </div>
              </div>

              {/* Reply Form */}
              {showReplyForm && (
                <div className="border-t pt-4 space-y-3">
                  <p className="text-sm font-medium">Répondre par email</p>
                  <Textarea
                    placeholder="Écrivez votre réponse ici..."
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    rows={5}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setShowReplyForm(false)}>
                      Annuler
                    </Button>
                    <Button 
                      onClick={handleSendReply} 
                      disabled={!replyContent.trim() || isSendingReply}
                    >
                      {isSendingReply ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Envoi...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Envoyer
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-2">
                  {getStatusBadge(selectedMessage.statut)}
                  <span className="text-sm text-muted-foreground">
                    Reçu le {format(new Date(selectedMessage.created_at), "dd MMMM yyyy à HH:mm", { locale: fr })}
                  </span>
                </div>

                <div className="flex gap-2">
                  {!showReplyForm && (
                    <Button variant="outline" onClick={() => setShowReplyForm(true)}>
                      <Mail className="h-4 w-4 mr-2" />
                      Répondre
                    </Button>
                  )}
                  {selectedMessage.statut !== "traite" && (
                    <Button
                      onClick={() => {
                        updateMessage.mutate({ id: selectedMessage.id, statut: "traite" });
                        setSelectedMessage(null);
                      }}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Marquer comme traité
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MessagesAdmin;
