import { CreditCard, DollarSign, Building2, Heart, Smartphone } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PaymentConfig } from "@/types/donations";

/**
 * PaymentMethodTabs (Phase 3-d / Task 19 — Fix 1)
 *
 * AVANT : le composant utilisait `<Tabs>` + `<TabsList>` + `<TabsTrigger>`
 * mais `<TabsContent>` n'ÉTAIT JAMAIS RENDU. Les enfants (children) étaient
 * passés comme `<div>` bruts sous le TabsList, donc TOUS les panneaux
 * (Virement, Orange Money, MTN, Stripe, etc.) s'affichaient simultanément
 * quel que soit l'onglet sélectionné. Le tab UI était purement cosmétique.
 * (Task 4 P0 #1)
 *
 * APRÈS : le composant est désormais CONTROLÉ (props `value` + `onValueChange`)
 * et chaque panneau est rendu via `<TabsContent value={provider}>`. Seul le
 * panneau actif est monté dans le DOM. Le parent `Don.tsx` peut ainsi
 * connaître la méthode sélectionnée (pour désactiver le bouton de submit,
 * adapter le message du succès modal, etc.).
 *
 * API : le parent passe une fonction `renderPanel(config)` qui retourne le
 * ReactNode à afficher pour chaque méthode active. Cela permet à `Don.tsx`
 * de garder la logique métier (BankTransferInfo vs MobileMoneyInfo vs
 * DisabledPaymentMethod) tout en déléguant le switching visuel à ce composant.
 */
interface PaymentMethodTabsProps {
  activeConfigs: PaymentConfig[];
  /** Valeur courante de l'onglet (provider). */
  value: string;
  /** Callback appelé quand l'utilisateur change d'onglet. */
  onValueChange: (value: string) => void;
  /**
   * Rendu du panneau pour chaque config active. Le parent décide quoi afficher
   * (BankTransferInfo, MobileMoneyInfo, DisabledPaymentMethod, etc.).
   */
  renderPanel: (config: PaymentConfig) => React.ReactNode;
}

const PaymentMethodTabs = ({
  activeConfigs,
  value,
  onValueChange,
  renderPanel,
}: PaymentMethodTabsProps) => {
  const getIcon = (provider: string) => {
    switch (provider) {
      case 'stripe':
        return <CreditCard className="w-4 h-4" />;
      case 'paypal':
        return <DollarSign className="w-4 h-4" />;
      case 'helloasso':
        return <Heart className="w-4 h-4" />;
      case 'bank_transfer':
        return <Building2 className="w-4 h-4" />;
      case 'orange_money':
        return <span className="text-base leading-none">🟠</span>;
      case 'mtn_money':
        return <span className="text-base leading-none">🟡</span>;
      default:
        return <Smartphone className="w-4 h-4" />;
    }
  };

  const getLabel = (provider: string) => {
    switch (provider) {
      case 'stripe':
        return 'Carte bancaire';
      case 'paypal':
        return 'PayPal';
      case 'helloasso':
        return 'HelloAsso';
      case 'bank_transfer':
        return 'Virement';
      case 'orange_money':
        return 'Orange Money';
      case 'mtn_money':
        return 'MTN MoMo';
      default:
        return provider;
    }
  };

  if (activeConfigs.length === 0) {
    return (
      <div className="text-center py-12 bg-muted/50 rounded-lg">
        <p className="text-muted-foreground">
          Aucune méthode de paiement n'est actuellement configurée.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Veuillez contacter l'administrateur.
        </p>
      </div>
    );
  }

  // Sécurité : si `value` ne correspond à aucune config (ex: au premier rendu
  // avant que le parent n'ait initialisé), on fallback sur la première config.
  // Radix Tabs lèverait une erreur sinon (aucun TabsTrigger actif).
  const effectiveValue = activeConfigs.some((c) => c.provider === value)
    ? value
    : activeConfigs[0].provider;

  return (
    <Tabs value={effectiveValue} onValueChange={onValueChange} className="w-full">
      <TabsList
        className="grid w-full"
        style={{ gridTemplateColumns: `repeat(${activeConfigs.length}, 1fr)` }}
      >
        {activeConfigs.map((config) => (
          <TabsTrigger
            key={config.provider}
            value={config.provider}
            className="flex items-center gap-2"
          >
            {getIcon(config.provider)}
            <span className="hidden sm:inline">{getLabel(config.provider)}</span>
          </TabsTrigger>
        ))}
      </TabsList>
      {activeConfigs.map((config) => (
        <TabsContent key={config.provider} value={config.provider} className="pt-6">
          {renderPanel(config)}
        </TabsContent>
      ))}
    </Tabs>
  );
};

export default PaymentMethodTabs;
