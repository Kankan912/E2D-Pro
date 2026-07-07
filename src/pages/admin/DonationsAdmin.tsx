import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/admin/StatCard";
import { DonationsTable } from "@/components/admin/DonationsTable";
import { useDonations, useDonationStats } from "@/hooks/useDonations";
import { DollarSign, TrendingUp, Users, BarChart3, Loader2, RefreshCw, Settings, ExternalLink, XCircle, Smartphone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { chartColors, tooltipStyles } from "@/lib/rechartsConfig";
import { formatFCFA } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";

export default function DonationsAdmin() {
  const { toast } = useToast();
  const { userRole } = useAuth();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    paymentMethod: "all",
    paymentStatus: "all",
  });

  const { data: donations, isLoading: donationsLoading } = useDonations(filters);
  const { data: stats, isLoading: statsLoading } = useDonationStats("month");

  // Récupérer les abonnements récurrents
  const { data: recurringDonations = [] } = useQuery({
    queryKey: ['recurring-donations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('donations')
        .select('*')
        .eq('is_recurring', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Compter les Mobile Money en attente
  const pendingMomoCount = (donations || []).filter(
    (d) => (d.payment_method === 'orange_money' || d.payment_method === 'mtn_money') && d.payment_status === 'pending'
  ).length;

  // Récupérer les configs de paiement
  //
  // Phase 1-a (Task 9) — `payment_configs` is now admin-only (RLS policy
  // `payment_configs_admin_all` restricts ALL operations to
  // `administrateur` / `admin` / `super_admin`). This page is admin-only,
  // so the direct SELECT continues to work for admins and returns ALL
  // configs (active + inactive), which is what the admin UI needs.
  //
  // The `enabled` gate below ensures the query does NOT fire until the
  // `userRole` from `useAuth()` has resolved to an admin role. Without
  // this gate, the query would fire on mount (before `userRole` is loaded)
  // and return an empty array (RLS denies anon / non-admin) — the admin
  // would see no config for a brief moment. With the gate, the query only
  // fires once we're sure the user is an admin.
  //
  // Non-admins are kept out by the routing layer (`AdminRoute`); the gate
  // here is purely a UX safeguard against the brief pre-auth window.
  const ADMIN_ROLES = ["administrateur", "admin", "super_admin"];
  const { data: paymentConfigs = [] } = useQuery({
    queryKey: ['payment-configs'],
    enabled: ADMIN_ROLES.includes(userRole ?? ""),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_configs')
        .select('*');
      if (error) throw error;
      return data;
    }
  });

  // Mutation pour annuler un abonnement
  const cancelSubscriptionMutation = useMutation({
    mutationFn: async (donationId: string) => {
      const { error } = await supabase
        .from('donations')
        .update({ payment_status: 'cancelled', is_recurring: false })
        .eq('id', donationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-donations'] });
      toast({ title: "Abonnement annulé avec succès" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible d'annuler l'abonnement", variant: "destructive" });
    }
  });

  // Mutations Mobile Money
  const validateMomoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('donations')
        .update({ payment_status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donations'] });
      toast({ title: "✅ Paiement Mobile Money validé" });
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const rejectMomoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('donations')
        .update({ payment_status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donations'] });
      toast({ title: "❌ Paiement Mobile Money rejeté" });
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const getDonationsChartData = () => {
    if (!donations) return [];
    
    const mois = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const now = new Date();
    
    return mois.map((m, i) => {
      const monthStart = new Date(now.getFullYear(), i, 1);
      const monthEnd = new Date(now.getFullYear(), i + 1, 0);
      
      const montantMois = donations
        .filter(d => {
          const date = new Date(d.created_at);
          return date >= monthStart && date <= monthEnd;
        })
        .reduce((sum, d) => sum + parseFloat(d.amount.toString()), 0);

      return {
        mois: m,
        montant: montantMois
      };
    });
  };

  const activeSubscriptions = recurringDonations.filter(d => d.payment_status === 'completed');
  const monthlyRecurringTotal = activeSubscriptions
    .filter(d => d.recurring_frequency === 'monthly')
    .reduce((sum, d) => sum + parseFloat(d.amount.toString()), 0);

  const getFrequencyLabel = (freq: string | null) => {
    switch (freq) {
      case 'monthly': return 'Mensuel';
      case 'yearly': return 'Annuel';
      default: return freq || '-';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-600">Actif</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">Annulé</Badge>;
      case 'pending':
        return <Badge variant="outline">En attente</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (donationsLoading || statsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Gestion des Dons</h1>
        <p className="text-muted-foreground mt-1">
          Administration et suivi de tous les dons reçus
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="donations">Liste des dons</TabsTrigger>
          <TabsTrigger value="recurring">Abonnements récurrents</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {pendingMomoCount > 0 && (
            <div className="flex items-center justify-between p-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="font-semibold text-amber-800 dark:text-amber-200">
                    {pendingMomoCount} paiement{pendingMomoCount > 1 ? "s" : ""} Mobile Money en attente
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Vérifiez les transactions Orange Money / MTN MoMo à valider
                  </p>
                </div>
              </div>
              <Link to="/dashboard/admin/donations/mobile-money">
                <Button size="sm" variant="outline" className="border-amber-400 text-amber-800 hover:bg-amber-100">
                  Réconciliation MoMo →
                </Button>
              </Link>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total du mois"
              value={formatFCFA(stats?.currentMonth?.total || 0)}
              icon={DollarSign}
              trend={stats?.currentMonth?.trend || 0}
              trendLabel="vs mois dernier"
            />
            <StatCard
              title="Total de l'année"
              value={formatFCFA(stats?.currentYear?.total || 0)}
              icon={TrendingUp}
              trend={stats?.currentYear?.trend || 0}
              trendLabel="vs année dernière"
            />
            <StatCard
              title="Nombre de donateurs"
              value={stats?.currentMonth?.donors || 0}
              icon={Users}
              description={`${stats?.currentMonth?.newDonors || 0} nouveaux ce mois`}
            />
            <StatCard
              title="Mobile Money en attente"
              value={pendingMomoCount}
              icon={Smartphone}
              description={pendingMomoCount > 0 ? "⚠️ À valider manuellement" : "Aucune en attente"}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Évolution des dons</CardTitle>
              <CardDescription>Montants reçus sur 12 mois</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={getDonationsChartData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mois" />
                  <YAxis />
                  <Tooltip {...tooltipStyles} />
                  <Area 
                    type="monotone" 
                    dataKey="montant" 
                    stroke={chartColors.blue} 
                    fill={chartColors.blue} 
                    fillOpacity={0.3}
                    name="Montant (FCFA)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="donations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Filtres</CardTitle>
              <CardDescription>Filtrer et rechercher dans les dons</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <Input placeholder="Rechercher..." />
                <Select
                  value={filters.paymentMethod}
                  onValueChange={(value) =>
                    setFilters({ ...filters, paymentMethod: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Méthode de paiement" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    <SelectItem value="stripe">Stripe</SelectItem>
                    <SelectItem value="paypal">PayPal</SelectItem>
                    <SelectItem value="bank_transfer">Virement</SelectItem>
                    <SelectItem value="helloasso">HelloAsso</SelectItem>
                    <SelectItem value="orange_money">🟠 Orange Money</SelectItem>
                    <SelectItem value="mtn_money">🟡 MTN MoMo</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={filters.paymentStatus}
                  onValueChange={(value) =>
                    setFilters({ ...filters, paymentStatus: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="completed">Complété</SelectItem>
                    <SelectItem value="pending">En attente</SelectItem>
                    <SelectItem value="failed">Échoué</SelectItem>
                    <SelectItem value="refunded">Remboursé</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() => setFilters({ paymentMethod: "all", paymentStatus: "all" })}
                >
                  Réinitialiser
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Liste des dons</CardTitle>
              <CardDescription>
                {donations?.length || 0} don(s) trouvé(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DonationsTable
                donations={donations || []}
                onValidate={(id) => validateMomoMutation.mutate(id)}
                onReject={(id) => rejectMomoMutation.mutate(id)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recurring" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              title="Abonnements actifs"
              value={activeSubscriptions.length}
              icon={RefreshCw}
              description="Donateurs récurrents"
            />
            <StatCard
              title="Revenus mensuels récurrents"
              value={formatFCFA(monthlyRecurringTotal)}
              icon={TrendingUp}
              description="Montant mensuel garanti"
            />
            <StatCard
              title="Total abonnements"
              value={recurringDonations.length}
              icon={Users}
              description="Incluant les annulés"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Abonnements récurrents</CardTitle>
              <CardDescription>
                Gestion des dons récurrents - {activeSubscriptions.length} abonnement(s) actif(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recurringDonations.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Aucun abonnement récurrent enregistré
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Donateur</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Fréquence</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Depuis</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recurringDonations.map((donation) => (
                      <TableRow key={donation.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{donation.donor_name}</p>
                            <p className="text-sm text-muted-foreground">{donation.donor_email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{formatFCFA(donation.amount)}</TableCell>
                        <TableCell>{getFrequencyLabel(donation.recurring_frequency)}</TableCell>
                        <TableCell>{getStatusBadge(donation.payment_status)}</TableCell>
                        <TableCell>
                          {format(new Date(donation.created_at), 'dd/MM/yyyy', { locale: fr })}
                        </TableCell>
                        <TableCell>
                          {donation.payment_status === 'completed' && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive">
                                  <XCircle className="w-4 h-4 mr-1" />
                                  Annuler
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Annuler l'abonnement ?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Cette action annulera l'abonnement récurrent de {donation.donor_name}. 
                                    Le donateur ne sera plus prélevé automatiquement.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => cancelSubscriptionMutation.mutate(donation.id)}
                                    className="bg-destructive text-destructive-foreground"
                                  >
                                    Confirmer l'annulation
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Méthodes de paiement actives
              </CardTitle>
              <CardDescription>
                Gérez les méthodes de paiement disponibles pour les dons
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {['stripe', 'paypal', 'helloasso', 'bank_transfer'].map((provider) => {
                  const config = paymentConfigs.find(c => c.provider === provider);
                  const isActive = config?.is_active || false;
                  const providerLabels: Record<string, string> = {
                    stripe: 'Stripe (Carte bancaire)',
                    paypal: 'PayPal',
                    helloasso: 'HelloAsso',
                    bank_transfer: 'Virement bancaire'
                  };
                  
                  return (
                    <div key={provider} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant={isActive ? "default" : "secondary"}>
                          {isActive ? 'Actif' : 'Inactif'}
                        </Badge>
                        <span className="font-medium">{providerLabels[provider]}</span>
                      </div>
                      {!config && (
                        <span className="text-sm text-muted-foreground">Non configuré</span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 border-t">
                <Link to="/admin/paiements">
                  <Button variant="outline" className="w-full">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Configurer les méthodes de paiement
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Paramètres des dons</CardTitle>
              <CardDescription>
                Configuration générale pour les dons
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Autoriser les dons récurrents</Label>
                  <p className="text-sm text-muted-foreground">
                    Permettre aux donateurs de configurer des dons automatiques
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="space-y-2">
                <Label>Montants suggérés (FCFA)</Label>
                <div className="flex gap-2 flex-wrap">
                  {[5000, 10000, 25000, 50000, 100000].map((amount) => (
                    <Badge key={amount} variant="outline" className="text-sm">
                      {amount.toLocaleString('fr-FR')} FCFA
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Ces montants sont affichés comme suggestions sur le formulaire de don
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
