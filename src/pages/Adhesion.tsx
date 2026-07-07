import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield, Users, Trophy } from "lucide-react";
import Navbar from "@/components/Navbar";
import SEOHead from "@/components/SEOHead";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ADHESION_TARIFS } from "@/lib/payment-utils";
import logoE2D from "@/assets/logo-e2d.png";

import { logger } from "@/lib/logger";
const Adhesion = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nom: "",
    prenom: "",
    email: "",
    telephone: "",
    type_adhesion: "e2d" as 'e2d' | 'phoenix' | 'both',
    message: "",
    accepte_conditions: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.accepte_conditions) {
      toast({
        title: "Conditions non acceptées",
        description: "Veuillez accepter les conditions pour continuer",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const tarif = ADHESION_TARIFS[formData.type_adhesion];

      const { error } = await supabase
        .from('adhesions')
        .insert([
          {
            nom: formData.nom,
            prenom: formData.prenom,
            email: formData.email,
            telephone: formData.telephone,
            type_adhesion: formData.type_adhesion,
            montant_paye: tarif.amount,
            payment_method: 'pending',
            payment_status: 'pending',
            message: formData.message,
          },
        ]);

      if (error) throw error;

      toast({
        title: "Demande d'adhésion envoyée !",
        description: "Nous vous contacterons bientôt pour finaliser votre adhésion",
      });

      // Reset form
      setFormData({
        nom: "",
        prenom: "",
        email: "",
        telephone: "",
        type_adhesion: "e2d",
        message: "",
        accepte_conditions: false,
      });
    } catch (error: unknown) {
      logger.error('Error submitting adhesion:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer la demande d'adhésion",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const adhesionTypes = [
    {
      id: 'e2d' as const,
      title: "E2D",
      amount: ADHESION_TARIFS.e2d.amount,
      icon: Shield,
      features: [
        "Accès aux matchs E2D",
        "Participation aux assemblées générales",
        "Accès au portail membre",
        "Newsletter mensuelle",
      ],
    },
    {
      id: 'phoenix' as const,
      title: "Phoenix",
      amount: ADHESION_TARIFS.phoenix.amount,
      icon: Trophy,
      features: [
        "Accès aux entraînements Phoenix",
        "Participation aux compétitions",
        "Équipement sportif",
        "Suivi personnalisé",
      ],
    },
    {
      id: 'both' as const,
      title: "E2D + Phoenix",
      amount: ADHESION_TARIFS.both.amount,
      icon: Users,
      features: [
        "Tous les avantages E2D",
        "Tous les avantages Phoenix",
        "Tarif préférentiel",
        "Accès prioritaire aux événements",
      ],
      popular: true,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead 
        title="Devenir Membre | Association E2D"
        description="Rejoignez l'Association E2D ou le club Phoenix. Adhésion simple et rapide pour accéder à tous nos avantages."
        keywords="adhésion E2D, devenir membre, Phoenix football, inscription association"
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
            <img src={logoE2D} alt="Logo E2D" className="h-24 w-auto mx-auto mb-6" />
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              Devenez Membre
            </h1>
            <p className="text-xl text-white/90">
              Rejoignez notre communauté et participez à l'aventure sportive E2D
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          {/* Adhesion Types */}
          <div className="mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">Choisissez votre adhésion</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {adhesionTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <Card
                    key={type.id}
                    className={`relative cursor-pointer transition-all ${
                      formData.type_adhesion === type.id
                        ? 'border-primary ring-2 ring-primary'
                        : 'hover:border-primary/50'
                    } ${type.popular ? 'lg:scale-105' : ''}`}
                    onClick={() => setFormData({ ...formData, type_adhesion: type.id })}
                  >
                    {type.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-secondary text-white px-4 py-1 rounded-full text-sm font-semibold">
                        Populaire
                      </div>
                    )}
                    <CardHeader>
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                        <Icon className="w-6 h-6 text-primary" />
                      </div>
                      <CardTitle>{type.title}</CardTitle>
                      <CardDescription>
                        <span className="text-3xl font-bold text-primary">{type.amount} FCFA</span>
                        <span className="text-muted-foreground"> /an</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {type.features.map((feature, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <span className="text-primary mt-0.5">✓</span>
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Form */}
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Formulaire d'adhésion</CardTitle>
              <CardDescription>
                Remplissez vos informations pour finaliser votre adhésion
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="prenom">Prénom *</Label>
                    <Input
                      id="prenom"
                      value={formData.prenom}
                      onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="nom">Nom *</Label>
                    <Input
                      id="nom"
                      value={formData.nom}
                      onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="telephone">Téléphone *</Label>
                  <Input
                    id="telephone"
                    type="tel"
                    value={formData.telephone}
                    onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="message">Message (optionnel)</Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Parlez-nous de vos motivations..."
                    rows={4}
                  />
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="conditions"
                    checked={formData.accepte_conditions}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, accepte_conditions: checked as boolean })
                    }
                  />
                  <Label htmlFor="conditions" className="text-sm leading-relaxed cursor-pointer">
                    J'accepte les conditions d'adhésion et le règlement intérieur de l'association
                  </Label>
                </div>

                <div className="bg-primary/10 rounded-lg p-4 border border-primary/20">
                  <p className="text-center">
                    <span className="text-muted-foreground">Montant total : </span>
                    <span className="text-2xl font-bold text-primary">
                      {ADHESION_TARIFS[formData.type_adhesion].amount} FCFA
                    </span>
                  </p>
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? "Envoi en cours..." : "Soumettre ma demande d'adhésion"}
                </Button>

                <p className="text-sm text-muted-foreground text-center">
                  Vous recevrez un email avec les instructions de paiement
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Adhesion;