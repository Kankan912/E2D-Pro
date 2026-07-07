import { useState, useEffect } from "react";
import { CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import BackButton from "@/components/BackButton";
import PaymentConfigTabs, { type ConnectionStatus } from "./_components/PaymentConfigTabs";


import { logger } from "@/lib/logger";
interface PaymentConfig {
  id: string;
  provider: string;
  is_active: boolean;
  config_data: unknown;
  updated_at?: string;
}




export default function PaymentConfigAdmin() {
  const [configs, setConfigs] = useState<PaymentConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSecrets, setShowSecrets] = useState<{ [key: string]: boolean }>({});
  const [connectionStatus, setConnectionStatus] = useState<{ [key: string]: ConnectionStatus }>({
    stripe: { status: 'idle' },
    paypal: { status: 'idle' },
    helloasso: { status: 'idle' },
    bank_transfer: { status: 'idle' },
    orange_money: { status: 'idle' },
    mtn_money: { status: 'idle' },
  });
  const { toast } = useToast();

  const [stripeConfig, setStripeConfig] = useState({
    public_key: "",
    secret_key: "",
    webhook_secret: ""
  });

  const [paypalConfig, setPaypalConfig] = useState({
    client_id: "",
    client_secret: "",
    mode: "sandbox"
  });

  const [helloassoConfig, setHelloassoConfig] = useState({
    client_id: "",
    client_secret: "",
    organization_slug: "",
    mode: "sandbox"
  });

  const [virementConfig, setVirementConfig] = useState({
    bank_name: "",
    account_holder: "",
    iban: "",
    bic: "",
    instructions: ""
  });

  const [orangeMoneyConfig, setOrangeMoneyConfig] = useState({
    mobile_number: "",
    account_name: "",
    instructions: ""
  });

  const [mtnMoneyConfig, setMtnMoneyConfig] = useState({
    mobile_number: "",
    account_name: "",
    instructions: ""
  });

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_configs')
        .select('*');

      if (error) throw error;
      setConfigs(data || []);

      data?.forEach((config) => {
        const configData = config.config_data as Record<string, unknown>;
        if (config.provider === 'stripe' && configData) {
          setStripeConfig({
            public_key: (configData.public_key as string) || "",
            secret_key: (configData.secret_key as string) || "",
            webhook_secret: (configData.webhook_secret as string) || ""
          });
        } else if (config.provider === 'paypal' && configData) {
          setPaypalConfig({
            client_id: (configData.client_id as string) || "",
            client_secret: (configData.client_secret as string) || "",
            mode: (configData.mode as string) || "sandbox"
          });
        } else if (config.provider === 'helloasso' && configData) {
          setHelloassoConfig({
            client_id: (configData.client_id as string) || "",
            client_secret: (configData.client_secret as string) || "",
            organization_slug: (configData.organization_slug as string) || "",
            mode: (configData.mode as string) || "sandbox"
          });
        } else if (config.provider === 'bank_transfer' && configData) {
          setVirementConfig({
            bank_name: (configData.bank_name as string) || "",
            account_holder: (configData.account_holder as string) || "",
            iban: (configData.iban as string) || "",
            bic: (configData.bic as string) || "",
            instructions: (configData.instructions as string) || ""
          });
        } else if (config.provider === 'orange_money' && configData) {
          setOrangeMoneyConfig({
            mobile_number: (configData.mobile_number as string) || "",
            account_name: (configData.account_name as string) || "",
            instructions: (configData.instructions as string) || ""
          });
        } else if (config.provider === 'mtn_money' && configData) {
          setMtnMoneyConfig({
            mobile_number: (configData.mobile_number as string) || "",
            account_name: (configData.account_name as string) || "",
            instructions: (configData.instructions as string) || ""
          });
        }
      });
    } catch (error: unknown) {
      logger.error('Erreur chargement configs:', error);
    }
  };

  // Test de connexion simulé (dans un vrai cas, on appellerait une edge function)
  const testConnection = async (provider: string) => {
    setConnectionStatus(prev => ({
      ...prev,
      [provider]: { status: 'testing' }
    }));

    // Simuler un délai de test
    await new Promise(resolve => setTimeout(resolve, 1500));

    let success = false;
    let message = "";

    switch (provider) {
      case 'stripe':
        if (stripeConfig.public_key && stripeConfig.secret_key) {
          // Vérifier le format des clés
          success = stripeConfig.public_key.startsWith('pk_') && stripeConfig.secret_key.startsWith('sk_');
          message = success ? "Clés Stripe valides" : "Format de clé invalide (pk_/sk_)";
        } else {
          message = "Clés manquantes";
        }
        break;
      
      case 'paypal':
        if (paypalConfig.client_id && paypalConfig.client_secret) {
          success = paypalConfig.client_id.length > 10 && paypalConfig.client_secret.length > 10;
          message = success ? "Credentials PayPal valides" : "Credentials invalides";
        } else {
          message = "Client ID ou Secret manquant";
        }
        break;
      
      case 'helloasso':
        if (helloassoConfig.client_id && helloassoConfig.client_secret && helloassoConfig.organization_slug) {
          success = true;
          message = "Configuration HelloAsso valide";
        } else {
          message = "Configuration incomplète";
        }
        break;
      
      case 'bank_transfer':
        if (virementConfig.iban && virementConfig.bic) {
          // Vérifier le format IBAN basique
          success = virementConfig.iban.replace(/\s/g, '').length >= 14;
          message = success ? "Coordonnées bancaires valides" : "Format IBAN invalide";
        } else {
          message = "IBAN ou BIC manquant";
        }
        break;
    }

    setConnectionStatus(prev => ({
      ...prev,
      [provider]: { 
        status: success ? 'success' : 'error',
        message,
        lastTested: new Date()
      }
    }));

    toast({
      title: success ? "Test réussi" : "Échec du test",
      description: message,
      variant: success ? "default" : "destructive"
    });
  };




  const handleSaveStripe = async () => {
    setLoading(true);
    try {
      const existingConfig = configs.find(c => c.provider === 'stripe');
      
      if (existingConfig) {
        const { error } = await supabase
          .from('payment_configs')
          .update({
            config_data: stripeConfig,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingConfig.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('payment_configs')
          .insert({
            provider: 'stripe',
            config_data: stripeConfig,
            is_active: false
          });

        if (error) throw error;
      }

      toast({ title: "Configuration Stripe enregistrée" });
      fetchConfigs();
    } catch (error: unknown) {
      logger.error('Erreur sauvegarde Stripe:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer la configuration Stripe",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSavePayPal = async () => {
    setLoading(true);
    try {
      const existingConfig = configs.find(c => c.provider === 'paypal');
      
      if (existingConfig) {
        const { error } = await supabase
          .from('payment_configs')
          .update({
            config_data: paypalConfig,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingConfig.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('payment_configs')
          .insert({
            provider: 'paypal',
            config_data: paypalConfig,
            is_active: false
          });

        if (error) throw error;
      }

      toast({ title: "Configuration PayPal enregistrée" });
      fetchConfigs();
    } catch (error: unknown) {
      logger.error('Erreur sauvegarde PayPal:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer la configuration PayPal",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveHelloAsso = async () => {
    setLoading(true);
    try {
      const existingConfig = configs.find(c => c.provider === 'helloasso');
      
      if (existingConfig) {
        const { error } = await supabase
          .from('payment_configs')
          .update({
            config_data: helloassoConfig,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingConfig.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('payment_configs')
          .insert({
            provider: 'helloasso',
            config_data: helloassoConfig,
            is_active: false
          });

        if (error) throw error;
      }

      toast({ title: "Configuration HelloAsso enregistrée" });
      fetchConfigs();
    } catch (error: unknown) {
      logger.error('Erreur sauvegarde HelloAsso:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer la configuration HelloAsso",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVirement = async () => {
    setLoading(true);
    try {
      const existingConfig = configs.find(c => c.provider === 'bank_transfer');
      
      if (existingConfig) {
        const { error } = await supabase
          .from('payment_configs')
          .update({
            config_data: virementConfig,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingConfig.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('payment_configs')
          .insert({
            provider: 'bank_transfer',
            config_data: virementConfig,
            is_active: false
          });

        if (error) throw error;
      }

      toast({ title: "Coordonnées bancaires enregistrées" });
      fetchConfigs();
    } catch (error: unknown) {
      logger.error('Erreur sauvegarde virement:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer les coordonnées bancaires",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMobileMoney = async (provider: 'orange_money' | 'mtn_money') => {
    setLoading(true);
    const config = provider === 'orange_money' ? orangeMoneyConfig : mtnMoneyConfig;
    const label = provider === 'orange_money' ? 'Orange Money' : 'MTN Mobile Money';
    try {
      const existingConfig = configs.find(c => c.provider === provider);
      if (existingConfig) {
        const { error } = await supabase
          .from('payment_configs')
          .update({ config_data: config, updated_at: new Date().toISOString() })
          .eq('id', existingConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('payment_configs')
          .insert({ provider, config_data: config, is_active: false });
        if (error) throw error;
      }
      toast({ title: `Configuration ${label} enregistrée` });
      fetchConfigs();
    } catch (error: unknown) {
      logger.error(`Erreur sauvegarde ${label}:`, error);
      toast({ title: "Erreur", description: `Impossible d'enregistrer la configuration ${label}`, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('payment_configs')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) throw error;
      fetchConfigs();
      toast({ title: `Configuration ${!isActive ? 'activée' : 'désactivée'}` });
    } catch (error: unknown) {
      logger.error('Erreur toggle:', error);
    }
  };

  const formatIBAN = (value: string) => {
    const cleaned = value.replace(/\s/g, "").toUpperCase();
    const formatted = cleaned.match(/.{1,4}/g)?.join(" ") || cleaned;
    return formatted;
  };

  const isActive = (provider: string) => {
    return configs.find(c => c.provider === provider)?.is_active || false;
  };

  const getConfigId = (provider: string) => {
    return configs.find(c => c.provider === provider)?.id;
  };

  return (
    <div className="container mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <BackButton />
          <h1 className="text-2xl sm:text-3xl font-bold mt-4 flex items-center gap-2">
            <CreditCard className="h-8 w-8" />
            Configuration des Paiements
          </h1>
          <p className="text-muted-foreground mt-2">
            Gérer les configurations Stripe, PayPal, HelloAsso et virement bancaire
          </p>
        </div>
      </div>

      <PaymentConfigTabs
        loading={loading}
        showSecrets={showSecrets}
        setShowSecrets={setShowSecrets}
        connectionStatus={connectionStatus}
        testConnection={testConnection}
        isActive={isActive}
        getConfigId={getConfigId}
        toggleActive={toggleActive}
        formatIBAN={formatIBAN}
        stripeConfig={stripeConfig}
        setStripeConfig={setStripeConfig}
        handleSaveStripe={handleSaveStripe}
        paypalConfig={paypalConfig}
        setPaypalConfig={setPaypalConfig}
        handleSavePayPal={handleSavePayPal}
        helloassoConfig={helloassoConfig}
        setHelloassoConfig={setHelloassoConfig}
        handleSaveHelloAsso={handleSaveHelloAsso}
        virementConfig={virementConfig}
        setVirementConfig={setVirementConfig}
        handleSaveVirement={handleSaveVirement}
        orangeMoneyConfig={orangeMoneyConfig}
        setOrangeMoneyConfig={setOrangeMoneyConfig}
        mtnMoneyConfig={mtnMoneyConfig}
        setMtnMoneyConfig={setMtnMoneyConfig}
        handleSaveMobileMoney={handleSaveMobileMoney}
      />
    </div>
  );
}
