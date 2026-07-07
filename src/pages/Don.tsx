import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, TrendingUp, Users, CheckCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import SEOHead from "@/components/SEOHead";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import DonationAmountSelector from "@/components/donations/DonationAmountSelector";
import PaymentMethodTabs from "@/components/donations/PaymentMethodTabs";
import BankTransferInfo from "@/components/donations/BankTransferInfo";
import MobileMoneyInfo from "@/components/donations/MobileMoneyInfo";
import DonationSuccessModal from "@/components/donations/DonationSuccessModal";
import type { PaymentConfig, DonationCurrency } from "@/types/donations";

import { logger } from "@/lib/logger";
const Don = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activeConfigs, setActiveConfigs] = useState<PaymentConfig[]>([]);
  const [amount, setAmount] = useState(25);
  const [currency, setCurrency] = useState<DonationCurrency>('FCFA');
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<'monthly' | 'yearly'>('monthly');
  const [donorName, setDonorName] = useState("");
  const [donorEmail, setDonorEmail] = useState("");
  const [donorPhone, setDonorPhone] = useState("");
  const [donorMessage, setDonorMessage] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [completedDonationId, setCompletedDonationId] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<string>("bank_transfer");

  useEffect(() => {
    fetchPaymentConfigs();
  }, []);

  const fetchPaymentConfigs = async () => {
    try {
      // Phase 1-a (Task 9) — `payment_configs` is now admin-only (RLS policy
      // `payment_configs_admin_all`). Non-admin users can no longer SELECT it
      // directly. We use the new `get_active_payment_config_public()` RPC
      // (SECURITY DEFINER) which returns the active configs with secrets
      // stripped from `config_data`.
      //
      // The RPC is declared `RETURNS TABLE (id, provider, is_active, config_data)`
      // so `supabase.rpc(...)` returns an ARRAY of rows. We cast to the
      // existing `PaymentConfig[]` shape (created_at/updated_at are absent
      // from the RPC output but are not used by this page or its children —
      // only `provider` and `config_data` are accessed).
      const { data, error } = await supabase.rpc(
        'get_active_payment_config_public' as never,
      );

      if (error) throw error;

      // `data` may be null/empty array if no active config exists. The
      // `PaymentMethodTabs` component already renders a friendly empty-state
      // ("Aucune méthode de paiement n'est actuellement configurée") when
      // `activeConfigs` is empty, so we just coerce to [].
      const rows = (Array.isArray(data) ? data : data ? [data] : []) as unknown as Array<{
        id: string;
        provider: PaymentConfig['provider'];
        is_active: boolean;
        config_data: PaymentConfig['config_data'];
      }>;
      setActiveConfigs(rows as PaymentConfig[]);
    } catch (error: unknown) {
      logger.error('Error fetching payment configs:', error);
      toast({
        title: "Erreur",
        description: "Aucun moyen de paiement configuré",
        variant: "destructive",
      });
      // Defensive: make sure the UI shows the empty-state if the fetch fails.
      setActiveConfigs([]);
    }
  };

  const handleDonationSubmit = async (paymentMethod: string, mobileReference?: string) => {
    if (!donorName || !donorEmail) {
      toast({
        title: "Informations manquantes",
        description: "Veuillez remplir tous les champs requis",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const isMobileMoney = paymentMethod === 'orange_money' || paymentMethod === 'mtn_money';
      const isManual = paymentMethod === 'bank_transfer' || isMobileMoney;

      const { data, error } = await supabase
        .from('donations')
        .insert([
          {
            donor_name: donorName,
            donor_email: donorEmail,
            donor_phone: donorPhone,
            amount,
            currency,
            payment_method: paymentMethod,
            payment_status: isManual ? 'pending' : 'completed',
            is_recurring: isRecurring,
            recurring_frequency: isRecurring ? frequency : null,
            donor_message: donorMessage,
            bank_transfer_reference: mobileReference || null,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setCompletedDonationId(data.id);
      setSelectedMethod(paymentMethod);
      setShowSuccessModal(true);

      toast({
        title: "Don enregistré !",
        description: "Merci pour votre générosité",
      });
    } catch (error: unknown) {
      logger.error('Error submitting donation:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer le don",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    { icon: Users, value: "500+", label: "Membres soutenus" },
    { icon: TrendingUp, value: "50+", label: "Projets réalisés" },
    { icon: Heart, value: "10 ans", label: "D'engagement" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead 
        title="Faire un Don | Association E2D"
        description="Soutenez l'Association E2D avec votre don. Contribuez au développement sportif et solidaire de notre communauté."
        keywords="don association, soutenir E2D, donation, solidarité, football camerounais"
      />
      <Navbar />
      
      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-gradient-to-br from-primary to-secondary text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-8 text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour à l'accueil
          </Button>

          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              Soutenez l'Association E2D
            </h1>
            <p className="text-xl text-white/90 mb-8">
              Votre générosité nous permet de continuer notre mission auprès de la communauté
            </p>

            {/* Stats */}
            <div className="grid md:grid-cols-3 gap-6 mt-12">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <div key={index} className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                    <Icon className="w-8 h-8 mx-auto mb-3" />
                    <div className="text-2xl sm:text-3xl font-bold mb-1">{stat.value}</div>
                    <div className="text-white/80">{stat.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <div className="grid lg:grid-cols-5 gap-8">
            {/* Donation Form */}
            <div className="lg:col-span-3">
              <Card>
                <CardHeader>
                  <CardTitle>Faire un don</CardTitle>
                  <CardDescription>
                    Choisissez le montant et la méthode de paiement
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                  {/* Amount Selector */}
                  <DonationAmountSelector
                    amount={amount}
                    setAmount={setAmount}
                    isRecurring={isRecurring}
                    setIsRecurring={setIsRecurring}
                    frequency={frequency}
                    setFrequency={setFrequency}
                    currency={currency}
                    setCurrency={setCurrency}
                  />

                  {/* Donor Information */}
                  <div className="space-y-4">
                    <h3 className="font-semibold">Vos informations</h3>
                    
                    <div>
                      <Label htmlFor="donor-name">Nom complet *</Label>
                      <Input
                        id="donor-name"
                        value={donorName}
                        onChange={(e) => setDonorName(e.target.value)}
                        placeholder="Alex FOTSO"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="donor-email">Email *</Label>
                      <Input
                        id="donor-email"
                        type="email"
                        value={donorEmail}
                        onChange={(e) => setDonorEmail(e.target.value)}
                        placeholder="alex.fotso@exemple.com"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="donor-phone">Téléphone (optionnel)</Label>
                      <Input
                        id="donor-phone"
                        type="tel"
                        value={donorPhone}
                        onChange={(e) => setDonorPhone(e.target.value)}
                        placeholder="+237 XXX XXX XXX"
                      />
                    </div>

                    <div>
                      <Label htmlFor="donor-message">Message (optionnel)</Label>
                      <Textarea
                        id="donor-message"
                        value={donorMessage}
                        onChange={(e) => setDonorMessage(e.target.value)}
                        placeholder="Un message pour nous..."
                        rows={3}
                      />
                    </div>
                  </div>

                  {/* Payment Methods */}
                  <div className="space-y-4">
                    <h3 className="font-semibold">Méthode de paiement</h3>
                    <PaymentMethodTabs activeConfigs={activeConfigs}>
                      {activeConfigs.map((config) => (
                        <div key={config.provider} className="py-6">
                          {config.provider === 'bank_transfer' ? (
                            <BankTransferInfo
                              config={config}
                              donorEmail={donorEmail}
                              onNotificationSent={() => handleDonationSubmit('bank_transfer')}
                            />
                          ) : config.provider === 'orange_money' || config.provider === 'mtn_money' ? (
                            <MobileMoneyInfo
                              config={config}
                              donorName={donorName}
                              donorEmail={donorEmail}
                              amount={amount}
                              currency={currency}
                              onConfirm={(reference) => handleDonationSubmit(config.provider, reference)}
                              loading={loading}
                            />
                          ) : (
                            <div className="text-center py-8">
                              <p className="text-muted-foreground mb-4">
                                Paiement {config.provider} à venir
                              </p>
                              <Button
                                onClick={() => handleDonationSubmit(config.provider)}
                                disabled={loading || amount <= 0}
                              >
                                {loading ? "Traitement..." : "Confirmer le don"}
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </PaymentMethodTabs>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-2 space-y-6">
              {/* Transparency Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" />
                    Transparence
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Projets sportifs</span>
                    <span className="font-medium">60%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Équipements</span>
                    <span className="font-medium">25%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Formation</span>
                    <span className="font-medium">10%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Administration</span>
                    <span className="font-medium">5%</span>
                  </div>
                </CardContent>
              </Card>

              {/* Info Card */}
              <Card className="bg-secondary/10 border-secondary/20">
                <CardHeader>
                  <CardTitle className="text-lg">Votre soutien compte</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <p>✓ Reçu fiscal automatique</p>
                  <p>✓ Paiement 100% sécurisé</p>
                  <p>✓ Annulation possible à tout moment</p>
                  <p>✓ Suivi de l'utilisation des fonds</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <DonationSuccessModal
        isOpen={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          navigate("/");
        }}
        donationId={completedDonationId}
        amount={amount}
        currency={currency}
        method={selectedMethod as any}
        isRecurring={isRecurring}
        donorName={donorName}
        donorEmail={donorEmail}
      />

      <Footer />
    </div>
  );
};

export default Don;
