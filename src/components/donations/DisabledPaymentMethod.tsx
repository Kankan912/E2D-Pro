import { CreditCard, DollarSign, Heart, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { PaymentMethod } from "@/types/donations";

/**
 * DisabledPaymentMethod (Phase 3-d / Task 19 — Fix 4)
 *
 * Affiche un panneau "Bientôt disponible" pour les méthodes de paiement
 * Stripe / PayPal / HelloAsso qui ne sont PAS réellement intégrées sur le
 * formulaire public (cf. Task 5 P0 #4 : l'RLS INSERT force
 * `payment_status='pending'`, donc un INSERT `completed` pour Stripe serait
 * silencieusement rejeté ; et même si l'RLS était retiré, on ne peut pas
 * faux-confirmer un paiement carte — c'est trompeur et légalement risqué).
 *
 * Le bouton est visuellement désactivé (cursor-not-allowed, opacity réduite)
 * et un message clair indique à l'utilisateur d'utiliser le virement ou
 * Mobile Money à la place. Aucun INSERT n'est déclenché.
 *
 * TODO (phase future) : implémenter réellement Stripe (Payment Intents via
 * Edge Function + webhook), PayPal (Orders API v2 + webhook), HelloAsso
 * (redirect OAuth + webhook). Cela nécessite :
 *   1. Edge Function de création de Payment Intent (Stripe) / Order (PayPal)
 *      qui retourne le client secret / order ID.
 *   2. Webhook handlers côté Supabase Edge Function pour confirmer le
 *      paiement et updater `donations.payment_status` à `completed`.
 *   3. RLS INSERT assouplie pour autoriser `payment_status='completed'`
 *      uniquement quand `stripe_payment_id` / `paypal_transaction_id` /
 *      `helloasso_payment_id` est non-null (preuve de paiement).
 */
interface DisabledPaymentMethodProps {
  method: Extract<PaymentMethod, 'stripe' | 'paypal' | 'helloasso'>;
}

const METHOD_META: Record<
  DisabledPaymentMethodProps['method'],
  { label: string; icon: typeof CreditCard; color: string }
> = {
  stripe: {
    label: 'Payer par carte (Stripe)',
    icon: CreditCard,
    color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
  },
  paypal: {
    label: 'Payer avec PayPal',
    icon: DollarSign,
    color: 'text-blue-600 bg-blue-50 border-blue-200',
  },
  helloasso: {
    label: 'Don via HelloAsso',
    icon: Heart,
    color: 'text-pink-600 bg-pink-50 border-pink-200',
  },
};

const DisabledPaymentMethod = ({ method }: DisabledPaymentMethodProps) => {
  const meta = METHOD_META[method];
  const Icon = meta.icon;

  return (
    <div className="space-y-4">
      <Card className={`p-6 border-2 border-dashed ${meta.color}`}>
        <div className="flex flex-col items-center text-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-white/60 flex items-center justify-center">
              <Icon className="w-5 h-5" />
            </div>
            <h3 className="font-semibold">{meta.label}</h3>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-white/60">
            <Lock className="w-3 h-3" />
            <span>Bientôt disponible</span>
          </div>

          <p className="text-sm text-foreground/80 max-w-md">
            Le paiement par carte sera disponible prochainement.
            Merci d'utiliser le virement bancaire ou Mobile Money pour votre don.
          </p>

          <Button
            type="button"
            disabled
            className="w-full sm:w-auto cursor-not-allowed opacity-60"
            aria-disabled="true"
          >
            <Icon className="w-4 h-4 mr-2" />
            {meta.label}
          </Button>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Cette méthode de paiement est en cours d'intégration technique
        (gestion des webhooks de confirmation, sécurisation des clés API).
      </p>
    </div>
  );
};

export default DisabledPaymentMethod;
