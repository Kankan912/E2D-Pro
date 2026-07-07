import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { PRESET_AMOUNTS } from "@/lib/payment-utils";
import { DonationCurrency, CURRENCIES } from "@/types/donations";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DonationAmountSelectorProps {
  amount: number;
  setAmount: (amount: number) => void;
  isRecurring: boolean;
  setIsRecurring: (isRecurring: boolean) => void;
  frequency: 'monthly' | 'yearly';
  setFrequency: (frequency: 'monthly' | 'yearly') => void;
  currency: DonationCurrency;
  setCurrency: (currency: DonationCurrency) => void;
}

const DonationAmountSelector = ({
  amount,
  setAmount,
  isRecurring,
  setIsRecurring,
  frequency,
  setFrequency,
  currency,
  setCurrency,
}: DonationAmountSelectorProps) => {
  const [customAmount, setCustomAmount] = useState("");
  const currencySymbol = CURRENCIES.find(c => c.value === currency)?.symbol || '€';

  const handlePresetClick = (value: number) => {
    setAmount(value);
    setCustomAmount("");
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
      setAmount(numValue);
    }
  };

  return (
    <div className="space-y-6">
      {/* Currency Selector */}
      <div>
        <Label>Devise</Label>
        <Select value={currency} onValueChange={(val) => setCurrency(val as DonationCurrency)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((curr) => (
              <SelectItem key={curr.value} value={curr.value}>
                {curr.symbol} {curr.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Preset Amounts */}
      <div>
        <Label>Choisissez un montant</Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
          {PRESET_AMOUNTS.map((preset) => (
            <Button
              key={preset.value}
              type="button"
              variant={amount === preset.value && !customAmount ? "default" : "outline"}
              onClick={() => handlePresetClick(preset.value)}
              className="h-auto py-4 flex flex-col gap-1"
            >
              <span className="text-lg font-bold">{preset.value}{currencySymbol}</span>
              <Badge variant="secondary" className="text-xs">
                {preset.badge}
              </Badge>
            </Button>
          ))}
        </div>
      </div>

      {/* Custom Amount */}
      <div>
        <Label htmlFor="custom-amount">Ou entrez un montant personnalisé</Label>
        <div className="relative mt-2">
          <Input
            id="custom-amount"
            type="number"
            placeholder="0"
            value={customAmount}
            onChange={(e) => handleCustomAmountChange(e.target.value)}
            min="1"
            step="1"
            className="pr-12"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {currencySymbol}
          </span>
        </div>
      </div>

      {/* Recurring Toggle */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div className="space-y-0.5">
          <Label htmlFor="recurring">Don récurrent</Label>
          <p className="text-sm text-muted-foreground">
            Soutenez-nous régulièrement
          </p>
        </div>
        <Switch
          id="recurring"
          checked={isRecurring}
          onCheckedChange={setIsRecurring}
        />
      </div>

      {/* Frequency Selection */}
      {isRecurring && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant={frequency === 'monthly' ? "default" : "outline"}
            onClick={() => setFrequency('monthly')}
            className="flex-1"
          >
            Mensuel
          </Button>
          <Button
            type="button"
            variant={frequency === 'yearly' ? "default" : "outline"}
            onClick={() => setFrequency('yearly')}
            className="flex-1"
          >
            Annuel
          </Button>
        </div>
      )}

      {/* Summary */}
      {amount > 0 && (
        <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
          <p className="text-center">
            <span className="text-2xl font-bold text-primary">
              {amount}{currencySymbol}
            </span>
            {isRecurring && (
              <span className="text-muted-foreground ml-2">
                / {frequency === 'monthly' ? 'mois' : 'an'}
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
};

export default DonationAmountSelector;