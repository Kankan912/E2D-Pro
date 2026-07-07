import type { PaymentMethod, DonationCurrency } from "@/types/donations";

export const PRESET_AMOUNTS = [
  { value: 1000, label: "1 000 FCFA", badge: "Supporter" },
  { value: 5000, label: "5 000 FCFA", badge: "Contributeur" },
  { value: 10000, label: "10 000 FCFA", badge: "Bienfaiteur" },
  { value: 25000, label: "25 000 FCFA", badge: "Mécène" },
  { value: 50000, label: "50 000 FCFA", badge: "Grand Mécène" },
];

export const ADHESION_TARIFS = {
  e2d: { amount: 20, label: "Adhésion E2D" },
  phoenix: { amount: 30, label: "Adhésion Phoenix" },
  both: { amount: 45, label: "Adhésion E2D + Phoenix" },
};

export const CURRENCIES: { value: DonationCurrency; label: string; symbol: string }[] = [
  { value: 'FCFA', label: 'Franc CFA', symbol: 'FCFA' },
  { value: 'EUR', label: 'Euro', symbol: '€' },
  { value: 'USD', label: 'Dollar US', symbol: '$' },
  { value: 'GBP', label: 'Livre Sterling', symbol: '£' },
  { value: 'CAD', label: 'Dollar Canadien', symbol: 'CA$' },
  { value: 'CHF', label: 'Franc Suisse', symbol: 'CHF' },
];

export function formatAmount(amount: number, currency: DonationCurrency = 'FCFA'): string {
  const currencyData = CURRENCIES.find(c => c.value === currency);
  return `${amount.toLocaleString('fr-FR')} ${currencyData?.symbol || 'FCFA'}`;
}

export function getPaymentMethodLabel(method: PaymentMethod): string {
  const labels: Record<PaymentMethod, string> = {
    stripe: 'Carte Bancaire (Stripe)',
    paypal: 'PayPal',
    helloasso: 'HelloAsso',
    bank_transfer: 'Virement Bancaire',
    orange_money: 'Orange Money',
    mtn_money: 'MTN Mobile Money',
  };
  return labels[method];
}

export function getPaymentMethodIcon(method: PaymentMethod): string {
  const icons: Record<PaymentMethod, string> = {
    stripe: '💳',
    paypal: '🅿️',
    helloasso: '🇫🇷',
    bank_transfer: '🏦',
    orange_money: '🟠',
    mtn_money: '🟡',
  };
  return icons[method];
}