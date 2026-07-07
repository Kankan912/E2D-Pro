import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { formatFCFA } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const MyDonations = () => {
  const { user } = useAuth();

  const { data: donations, isLoading } = useQuery({
    queryKey: ["my-donations", user?.email],
    queryFn: async () => {
      if (!user?.email) return [];

      const { data, error } = await supabase
        .from("donations")
        .select("*")
        .eq("donor_email", user.email)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.email,
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      completed: "default",
      pending: "secondary",
      failed: "destructive",
    };

    const labels: Record<string, string> = {
      completed: "Complété",
      pending: "En attente",
      failed: "Échoué",
    };

    return (
      <Badge variant={variants[status] || "secondary"}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      stripe: "Carte bancaire (Stripe)",
      paypal: "PayPal",
      helloasso: "HelloAsso",
      bank_transfer: "Virement bancaire",
    };

    return labels[method] || method;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const totalDonations = donations?.reduce((sum, d) => sum + Number(d.amount), 0) || 0;
  const completedDonations = donations?.filter((d) => d.payment_status === "completed") || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Mes Dons</h1>
        <p className="text-muted-foreground mt-2">
          Historique de vos contributions
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total des dons</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatFCFA(totalDonations)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Tous statuts confondus
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dons complétés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedDonations.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Paiements confirmés
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total dons</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{donations?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Nombre de transactions
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historique des dons</CardTitle>
          <CardDescription>
            Liste de tous vos dons effectués
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!donations || donations.length === 0 ? (
            <div className="text-center py-12">
              <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Vous n'avez pas encore effectué de don
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {donations.map((donation) => (
                <div
                  key={donation.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-lg">
                        {formatFCFA(Number(donation.amount))}
                      </p>
                      {getStatusBadge(donation.payment_status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {getPaymentMethodLabel(donation.payment_method)}
                    </p>
                    {donation.donor_message && (
                      <p className="text-sm text-muted-foreground italic">
                        "{donation.donor_message}"
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {format(new Date(donation.created_at), "PPP", { locale: fr })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(donation.created_at), "p", { locale: fr })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MyDonations;
