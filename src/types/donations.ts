export type PaymentMethod = 'stripe' | 'paypal' | 'helloasso' | 'bank_transfer' | 'orange_money' | 'mtn_money';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type RecurringFrequency = 'monthly' | 'yearly';
export type DonationCurrency = 'FCFA' | 'EUR' | 'USD' | 'GBP' | 'CAD' | 'CHF';

export const CURRENCIES: { value: DonationCurrency; label: string; symbol: string }[] = [
  { value: 'FCFA', label: 'Franc CFA', symbol: 'FCFA' },
  { value: 'EUR', label: 'Euro', symbol: '€' },
  { value: 'USD', label: 'Dollar US', symbol: '$' },
  { value: 'GBP', label: 'Livre Sterling', symbol: '£' },
  { value: 'CAD', label: 'Dollar Canadien', symbol: 'CA$' },
  { value: 'CHF', label: 'Franc Suisse', symbol: 'CHF' },
];

export interface PaymentConfig {
  id: string;
  provider: PaymentMethod;
  is_active: boolean;
  config_data: {
    // Stripe
    publishable_key?: string;
    // PayPal
    client_id?: string;
    // HelloAsso
    organization_slug?: string;
    campaign_url?: string;
    // Bank Transfer
    bank_name?: string;
    iban?: string;
    bic?: string;
    account_holder?: string;
    instructions?: string;
    // Mobile Money
    mobile_number?: string;
    account_name?: string;
    payment_code?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface Donation {
  id: string;
  donor_name: string;
  donor_email: string;
  donor_phone?: string;
  amount: number;
  currency: DonationCurrency;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  is_recurring: boolean;
  recurring_frequency?: RecurringFrequency;
  stripe_payment_id?: string;
  stripe_customer_id?: string;
  paypal_transaction_id?: string;
  helloasso_payment_id?: string;
  bank_transfer_reference?: string;
  transaction_metadata?: Record<string, any>;
  donor_message?: string;
  fiscal_receipt_sent: boolean;
  fiscal_receipt_url?: string;
  created_at: string;
  updated_at: string;
}

export interface RecurringDonation {
  id: string;
  donation_id: string;
  donor_email: string;
  amount: number;
  currency: DonationCurrency;
  frequency: RecurringFrequency;
  status: 'active' | 'paused' | 'cancelled';
  next_payment_date?: string;
  stripe_subscription_id?: string;
  paypal_subscription_id?: string;
  total_payments: number;
  last_payment_date?: string;
  created_at: string;
  updated_at: string;
}

export interface Adhesion {
  id: string;
  membre_id?: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  type_adhesion: 'e2d' | 'phoenix' | 'both';
  montant_paye: number;
  payment_method: PaymentMethod | 'pending';
  payment_status: PaymentStatus;
  payment_id?: string;
  message?: string;
  processed: boolean;
  created_at: string;
  updated_at: string;
}

export interface DonorInfo {
  name: string;
  email: string;
  phone?: string;
  message?: string;
}