import { useState } from "react";
import { Mail, MapPin, Phone, Facebook, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useSiteConfig } from "@/hooks/useSiteContent";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { logger } from "@/lib/logger";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// Schéma de validation Zod
const contactSchema = z.object({
  nom: z.string()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(100, "Le nom ne doit pas dépasser 100 caractères"),
  email: z.string()
    .email("Veuillez entrer une adresse email valide")
    .max(255, "L'email ne doit pas dépasser 255 caractères"),
  telephone: z.string()
    .max(20, "Le numéro de téléphone ne doit pas dépasser 20 caractères")
    .optional()
    .or(z.literal("")),
  objet: z.string()
    .min(5, "L'objet doit contenir au moins 5 caractères")
    .max(200, "L'objet ne doit pas dépasser 200 caractères"),
  message: z.string()
    .min(20, "Le message doit contenir au moins 20 caractères")
    .max(2000, "Le message ne doit pas dépasser 2000 caractères"),
});

type ContactFormData = z.infer<typeof contactSchema>;

const Contact = () => {
  const { toast } = useToast();
  const { data: config, isLoading } = useSiteConfig();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      nom: "",
      email: "",
      telephone: "",
      objet: "",
      message: "",
    },
  });

  const getConfigValue = (key: string) => {
    return config?.find(c => c.cle === key)?.valeur || '';
  };

  const sendNotificationEmail = async (formData: ContactFormData) => {
    try {
      const adminEmail = getConfigValue('site_email') || 'admin@e2d.com';
      
      // Envoi notification à l'admin
      await supabase.functions.invoke('send-contact-notification', {
        body: {
          type: 'admin_notification',
          to: adminEmail,
          contactData: {
            nom: formData.nom,
            email: formData.email,
            telephone: formData.telephone || 'Non renseigné',
            objet: formData.objet,
            message: formData.message,
          }
        }
      });

      // Envoi confirmation au visiteur
      await supabase.functions.invoke('send-contact-notification', {
        body: {
          type: 'visitor_confirmation',
          to: formData.email,
          contactData: {
            nom: formData.nom,
            objet: formData.objet,
          }
        }
      });
    } catch (error: unknown) {
      // Log mais ne pas bloquer - le message est déjà enregistré
      logger.warn("Erreur envoi email notification:", error);
    }
  };

  const onSubmit = async (formData: ContactFormData) => {
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("messages_contact")
        .insert({
          nom: formData.nom,
          email: formData.email,
          telephone: formData.telephone || null,
          objet: formData.objet,
          message: formData.message,
          statut: "nouveau",
        });

      if (error) throw error;

      // Envoi des emails de notification (non bloquant)
      sendNotificationEmail(formData);

      toast({
        title: "Message envoyé !",
        description: "Nous vous répondrons dans les plus brefs délais. Un email de confirmation vous a été envoyé.",
      });

      form.reset();
    } catch (error: unknown) {
      logger.error("Erreur envoi message:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue. Veuillez réessayer.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const contactInfo = [
    {
      icon: Mail,
      title: "Email",
      value: getConfigValue('site_email'),
      href: `mailto:${getConfigValue('site_email')}`
    },
    {
      icon: Phone,
      title: "Téléphone",
      value: getConfigValue('site_telephone'),
      href: `tel:${getConfigValue('site_telephone').replace(/\s/g, '')}`
    },
    {
      icon: MapPin,
      title: "Localisation",
      value: getConfigValue('site_adresse'),
      href: "#"
    },
    {
      icon: Facebook,
      title: "Facebook",
      value: "Phoenix KMRA",
      href: getConfigValue('facebook_url')
    }
  ];

  if (isLoading) {
    return (
      <section id="contact" className="py-20 lg:py-32 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Skeleton className="h-10 w-64 mx-auto mb-4" />
            <Skeleton className="h-6 w-96 mx-auto" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="contact" className="py-20 lg:py-32 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 animate-in fade-in slide-in-from-bottom duration-700">
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-secondary/10 text-secondary text-sm font-semibold mb-4">
            Contactez-nous
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Rejoignez l'Aventure E2D
          </h2>
          <p className="text-lg text-muted-foreground">
            Que vous souhaitiez adhérer, devenir partenaire, ou simplement en savoir plus, 
            nous sommes à votre écoute !
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
          {/* Contact Form */}
          <div className="bg-card rounded-2xl p-8 shadow-soft border border-border animate-in fade-in slide-in-from-left duration-700 delay-200">
            <h3 className="text-2xl font-bold text-foreground mb-6">Envoyez-nous un Message</h3>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="nom"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom complet *</FormLabel>
                        <FormControl>
                          <Input placeholder="Votre nom" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="telephone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Téléphone</FormLabel>
                        <FormControl>
                          <Input type="tel" placeholder="+237 XXX XXXX XXX" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="alex.fotso@exemple.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="objet"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Objet *</FormLabel>
                      <FormControl>
                        <Input placeholder="Objet de votre message" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Message *</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Parlez-nous de votre projet ou de vos questions..."
                          rows={5}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit"
                  className="w-full bg-secondary hover:bg-secondary/90 text-white transition-all duration-300"
                  size="lg"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    "Envoyer le Message"
                  )}
                </Button>
              </form>
            </Form>
          </div>

          {/* Contact Info */}
          <div className="space-y-6 animate-in fade-in slide-in-from-right duration-700 delay-300">
            <div className="bg-gradient-to-br from-primary to-primary/90 rounded-2xl p-8 text-white">
              <h3 className="text-2xl font-bold mb-6">Informations de Contact</h3>
              <div className="space-y-6">
                {contactInfo.map((info, index) => {
                  const Icon = info.icon;
                  return (
                    <a
                      key={index}
                      href={info.href}
                      target={info.href.startsWith("http") ? "_blank" : undefined}
                      rel={info.href.startsWith("http") ? "noopener noreferrer" : undefined}
                      className="flex items-start group cursor-pointer hover:translate-x-2 transition-transform duration-200"
                    >
                      <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center mr-4 flex-shrink-0 group-hover:bg-white/20 transition-colors">
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="font-semibold mb-1">{info.title}</div>
                        <div className="text-white/80">{info.value}</div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>

            {/* Quick Links */}
            <div className="bg-card rounded-2xl p-8 shadow-soft border border-border">
              <h3 className="text-xl font-bold text-foreground mb-4">Liens Rapides</h3>
              <div className="space-y-3">
                <Button 
                  variant="outline"
                  className="w-full justify-start hover:translate-x-1 transition-transform"
                  onClick={() => window.location.href = "/auth"}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Accès Portail Membre E2D Connect
                </Button>
                <Button 
                  variant="outline"
                  className="w-full justify-start hover:translate-x-1 transition-transform"
                  onClick={() => window.location.href = "/adhesion"}
                >
                  Formulaire d'Adhésion
                </Button>
                <Button 
                  variant="outline"
                  className="w-full justify-start hover:translate-x-1 transition-transform"
                  onClick={() => window.location.href = "/don"}
                >
                  Faire un Don
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
