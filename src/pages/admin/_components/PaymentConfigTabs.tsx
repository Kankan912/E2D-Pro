import { CreditCard, Save, Eye, EyeOff, Heart, Landmark, Building2, CheckCircle, XCircle, Loader2, Wifi } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface StripeConfig { public_key: string; secret_key: string; webhook_secret: string; }
export interface PayPalConfig { client_id: string; client_secret: string; mode: string; }
export interface HelloAssoConfig { client_id: string; client_secret: string; organization_slug: string; mode: string; }
export interface VirementConfig { bank_name: string; account_holder: string; iban: string; bic: string; instructions: string; }
export interface MobileMoneyConfig { mobile_number: string; account_name: string; instructions: string; }

export interface ConnectionStatus {
  status: 'idle' | 'testing' | 'success' | 'error';
  message?: string;
  lastTested?: Date;
}

interface Props {
  loading: boolean;
  showSecrets: Record<string, boolean>;
  setShowSecrets: (v: Record<string, boolean>) => void;
  connectionStatus: Record<string, ConnectionStatus>;
  testConnection: (provider: string) => void;
  isActive: (provider: string) => boolean;
  getConfigId: (provider: string) => string | undefined;
  toggleActive: (id: string, isActive: boolean) => void;
  formatIBAN: (v: string) => string;
  stripeConfig: StripeConfig;
  setStripeConfig: (v: StripeConfig) => void;
  handleSaveStripe: () => void;
  paypalConfig: PayPalConfig;
  setPaypalConfig: (v: PayPalConfig) => void;
  handleSavePayPal: () => void;
  helloassoConfig: HelloAssoConfig;
  setHelloassoConfig: (v: HelloAssoConfig) => void;
  handleSaveHelloAsso: () => void;
  virementConfig: VirementConfig;
  setVirementConfig: (v: VirementConfig) => void;
  handleSaveVirement: () => void;
  orangeMoneyConfig: MobileMoneyConfig;
  setOrangeMoneyConfig: (v: MobileMoneyConfig) => void;
  mtnMoneyConfig: MobileMoneyConfig;
  setMtnMoneyConfig: (v: MobileMoneyConfig) => void;
  handleSaveMobileMoney: (provider: 'orange_money' | 'mtn_money') => void;
}

function getConnectionBadge(status: ConnectionStatus) {
  switch (status.status) {
    case 'testing': return <Badge variant="outline"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Test...</Badge>;
    case 'success': return <Badge className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" /> Connecté</Badge>;
    case 'error': return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Erreur</Badge>;
    default: return null;
  }
}

export default function PaymentConfigTabs(props: Props) {
  const {
    loading, showSecrets, setShowSecrets, connectionStatus, testConnection,
    isActive, getConfigId, toggleActive, formatIBAN,
    stripeConfig, setStripeConfig, handleSaveStripe,
    paypalConfig, setPaypalConfig, handleSavePayPal,
    helloassoConfig, setHelloassoConfig, handleSaveHelloAsso,
    virementConfig, setVirementConfig, handleSaveVirement,
    orangeMoneyConfig, setOrangeMoneyConfig,
    mtnMoneyConfig, setMtnMoneyConfig, handleSaveMobileMoney,
  } = props;

  return (
    <Tabs defaultValue="stripe" className="space-y-6">
      <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
        <TabsTrigger value="stripe" className="flex items-center gap-1 text-xs sm:text-sm">
          <CreditCard className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Stripe</span>
          {isActive('stripe') && <Badge className="ml-1 bg-green-600 text-xs hidden lg:inline-flex">Actif</Badge>}
        </TabsTrigger>
        <TabsTrigger value="paypal" className="flex items-center gap-1 text-xs sm:text-sm">
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">PayPal</span>
          {isActive('paypal') && <Badge className="ml-1 bg-green-600 text-xs hidden lg:inline-flex">Actif</Badge>}
        </TabsTrigger>
        <TabsTrigger value="helloasso" className="flex items-center gap-1 text-xs sm:text-sm">
          <Heart className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">HelloAsso</span>
          {isActive('helloasso') && <Badge className="ml-1 bg-green-600 text-xs hidden lg:inline-flex">Actif</Badge>}
        </TabsTrigger>
        <TabsTrigger value="virement" className="flex items-center gap-1 text-xs sm:text-sm">
          <Landmark className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Virement</span>
          {isActive('bank_transfer') && <Badge className="ml-1 bg-green-600 text-xs hidden lg:inline-flex">Actif</Badge>}
        </TabsTrigger>
        <TabsTrigger value="orange_money" className="flex items-center gap-1 text-xs sm:text-sm">
          <span className="text-base leading-none shrink-0">🟠</span>
          <span className="hidden sm:inline">Orange</span>
          {isActive('orange_money') && <Badge className="ml-1 bg-green-600 text-xs hidden lg:inline-flex">Actif</Badge>}
        </TabsTrigger>
        <TabsTrigger value="mtn_money" className="flex items-center gap-1 text-xs sm:text-sm">
          <span className="text-base leading-none shrink-0">🟡</span>
          <span className="hidden sm:inline">MTN</span>
          {isActive('mtn_money') && <Badge className="ml-1 bg-green-600 text-xs hidden lg:inline-flex">Actif</Badge>}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="stripe">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" />Configuration Stripe</CardTitle>
                  <CardDescription>Clés API et paramètres de connexion Stripe pour les paiements par carte</CardDescription>
                </div>
                {getConnectionBadge(connectionStatus['stripe'])}
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="stripe-active">Activer</Label>
                <Switch id="stripe-active" checked={isActive('stripe')} onCheckedChange={() => { const id = getConfigId('stripe'); if (id) toggleActive(id, isActive('stripe')); }} disabled={!getConfigId('stripe')} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Clé Publique</Label>
              <Input value={stripeConfig.public_key} onChange={(e) => setStripeConfig({ ...stripeConfig, public_key: e.target.value })} placeholder="pk_test_..." />
            </div>
            <div className="space-y-2">
              <Label>Clé Secrète</Label>
              <div className="relative">
                <Input type={showSecrets['stripe_secret'] ? 'text' : 'password'} value={stripeConfig.secret_key} onChange={(e) => setStripeConfig({ ...stripeConfig, secret_key: e.target.value })} placeholder="sk_test_..." />
                <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setShowSecrets({ ...showSecrets, stripe_secret: !showSecrets['stripe_secret'] })}>
                  {showSecrets['stripe_secret'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Webhook Secret</Label>
              <div className="relative">
                <Input type={showSecrets['stripe_webhook'] ? 'text' : 'password'} value={stripeConfig.webhook_secret} onChange={(e) => setStripeConfig({ ...stripeConfig, webhook_secret: e.target.value })} placeholder="whsec_..." />
                <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setShowSecrets({ ...showSecrets, stripe_webhook: !showSecrets['stripe_webhook'] })}>
                  {showSecrets['stripe_webhook'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveStripe} disabled={loading} className="flex-1"><Save className="w-4 h-4 mr-2" />{loading ? 'Enregistrement...' : 'Enregistrer'}</Button>
              <Button variant="outline" onClick={() => testConnection('stripe')} disabled={connectionStatus['stripe'].status === 'testing'}><Wifi className="w-4 h-4 mr-2" />Tester</Button>
            </div>
            {connectionStatus['stripe'].lastTested && (
              <p className="text-xs text-muted-foreground">Dernier test: {connectionStatus['stripe'].lastTested.toLocaleString('fr-FR')}{connectionStatus['stripe'].message && ` - ${connectionStatus['stripe'].message}`}</p>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="paypal">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />Configuration PayPal</CardTitle>
                  <CardDescription>Identifiants API PayPal pour accepter les paiements</CardDescription>
                </div>
                {getConnectionBadge(connectionStatus['paypal'])}
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="paypal-active">Activer</Label>
                <Switch id="paypal-active" checked={isActive('paypal')} onCheckedChange={() => { const id = getConfigId('paypal'); if (id) toggleActive(id, isActive('paypal')); }} disabled={!getConfigId('paypal')} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Client ID</Label>
              <Input value={paypalConfig.client_id} onChange={(e) => setPaypalConfig({ ...paypalConfig, client_id: e.target.value })} placeholder="Client ID PayPal" />
            </div>
            <div className="space-y-2">
              <Label>Client Secret</Label>
              <div className="relative">
                <Input type={showSecrets['paypal_secret'] ? 'text' : 'password'} value={paypalConfig.client_secret} onChange={(e) => setPaypalConfig({ ...paypalConfig, client_secret: e.target.value })} placeholder="Client Secret" />
                <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setShowSecrets({ ...showSecrets, paypal_secret: !showSecrets['paypal_secret'] })}>
                  {showSecrets['paypal_secret'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Mode</Label>
              <Select value={paypalConfig.mode} onValueChange={(value) => setPaypalConfig({ ...paypalConfig, mode: value })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner le mode" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox (Test)</SelectItem>
                  <SelectItem value="live">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSavePayPal} disabled={loading} className="flex-1"><Save className="w-4 h-4 mr-2" />{loading ? 'Enregistrement...' : 'Enregistrer'}</Button>
              <Button variant="outline" onClick={() => testConnection('paypal')} disabled={connectionStatus['paypal'].status === 'testing'}><Wifi className="w-4 h-4 mr-2" />Tester</Button>
            </div>
            {connectionStatus['paypal'].lastTested && (
              <p className="text-xs text-muted-foreground">Dernier test: {connectionStatus['paypal'].lastTested.toLocaleString('fr-FR')}{connectionStatus['paypal'].message && ` - ${connectionStatus['paypal'].message}`}</p>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="helloasso">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2"><Heart className="h-5 w-5" />Configuration HelloAsso</CardTitle>
                  <CardDescription>Intégration HelloAsso pour les dons et adhésions</CardDescription>
                </div>
                {getConnectionBadge(connectionStatus['helloasso'])}
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="helloasso-active">Activer</Label>
                <Switch id="helloasso-active" checked={isActive('helloasso')} onCheckedChange={() => { const id = getConfigId('helloasso'); if (id) toggleActive(id, isActive('helloasso')); }} disabled={!getConfigId('helloasso')} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Client ID</Label>
              <Input value={helloassoConfig.client_id} onChange={(e) => setHelloassoConfig({ ...helloassoConfig, client_id: e.target.value })} placeholder="Client ID HelloAsso" />
            </div>
            <div className="space-y-2">
              <Label>Client Secret</Label>
              <div className="relative">
                <Input type={showSecrets['helloasso_secret'] ? 'text' : 'password'} value={helloassoConfig.client_secret} onChange={(e) => setHelloassoConfig({ ...helloassoConfig, client_secret: e.target.value })} placeholder="Client Secret" />
                <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setShowSecrets({ ...showSecrets, helloasso_secret: !showSecrets['helloasso_secret'] })}>
                  {showSecrets['helloasso_secret'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Slug de l'organisation</Label>
              <Input value={helloassoConfig.organization_slug} onChange={(e) => setHelloassoConfig({ ...helloassoConfig, organization_slug: e.target.value })} placeholder="mon-association" />
            </div>
            <div className="space-y-2">
              <Label>Mode</Label>
              <Select value={helloassoConfig.mode} onValueChange={(value) => setHelloassoConfig({ ...helloassoConfig, mode: value })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner le mode" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox (Test)</SelectItem>
                  <SelectItem value="live">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveHelloAsso} disabled={loading} className="flex-1"><Save className="w-4 h-4 mr-2" />{loading ? 'Enregistrement...' : 'Enregistrer'}</Button>
              <Button variant="outline" onClick={() => testConnection('helloasso')} disabled={connectionStatus['helloasso'].status === 'testing'}><Wifi className="w-4 h-4 mr-2" />Tester</Button>
            </div>
            {connectionStatus['helloasso'].lastTested && (
              <p className="text-xs text-muted-foreground">Dernier test: {connectionStatus['helloasso'].lastTested.toLocaleString('fr-FR')}{connectionStatus['helloasso'].message && ` - ${connectionStatus['helloasso'].message}`}</p>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="virement">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2"><Landmark className="h-5 w-5" />Coordonnées Bancaires</CardTitle>
                  <CardDescription>Informations pour les paiements par virement bancaire</CardDescription>
                </div>
                {getConnectionBadge(connectionStatus['bank_transfer'])}
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="virement-active">Activer</Label>
                <Switch id="virement-active" checked={isActive('bank_transfer')} onCheckedChange={() => { const id = getConfigId('bank_transfer'); if (id) toggleActive(id, isActive('bank_transfer')); }} disabled={!getConfigId('bank_transfer')} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nom de la banque</Label>
                <Input value={virementConfig.bank_name} onChange={(e) => setVirementConfig({ ...virementConfig, bank_name: e.target.value })} placeholder="Banque Atlantique" />
              </div>
              <div className="space-y-2">
                <Label>Titulaire du compte</Label>
                <Input value={virementConfig.account_holder} onChange={(e) => setVirementConfig({ ...virementConfig, account_holder: e.target.value })} placeholder="ASSOCIATION E2D" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>IBAN</Label>
              <Input value={virementConfig.iban} onChange={(e) => setVirementConfig({ ...virementConfig, iban: formatIBAN(e.target.value) })} placeholder="CM21 1000 1000 0000 0000 0000 000" />
            </div>
            <div className="space-y-2">
              <Label>BIC / SWIFT</Label>
              <Input value={virementConfig.bic} onChange={(e) => setVirementConfig({ ...virementConfig, bic: e.target.value.toUpperCase() })} placeholder="BATLCMCX" />
            </div>
            <div className="space-y-2">
              <Label>Instructions supplémentaires</Label>
              <Textarea value={virementConfig.instructions} onChange={(e) => setVirementConfig({ ...virementConfig, instructions: e.target.value })} placeholder="Veuillez mentionner votre nom et le motif du virement..." rows={3} />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveVirement} disabled={loading} className="flex-1"><Save className="w-4 h-4 mr-2" />{loading ? 'Enregistrement...' : 'Enregistrer'}</Button>
              <Button variant="outline" onClick={() => testConnection('bank_transfer')} disabled={connectionStatus['bank_transfer'].status === 'testing'}><Wifi className="w-4 h-4 mr-2" />Vérifier</Button>
            </div>
            {connectionStatus['bank_transfer'].lastTested && (
              <p className="text-xs text-muted-foreground">Dernière vérification: {connectionStatus['bank_transfer'].lastTested.toLocaleString('fr-FR')}{connectionStatus['bank_transfer'].message && ` - ${connectionStatus['bank_transfer'].message}`}</p>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="orange_money">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><span className="text-2xl">🟠</span>Orange Money Cameroun</CardTitle>
                <CardDescription>Configuration du compte Orange Money pour recevoir les dons</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="orange-active">Activer</Label>
                <Switch id="orange-active" checked={isActive('orange_money')} onCheckedChange={() => { const id = getConfigId('orange_money'); if (id) toggleActive(id, isActive('orange_money')); }} disabled={!getConfigId('orange_money')} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Numéro Orange Money</Label>
                <Input value={orangeMoneyConfig.mobile_number} onChange={(e) => setOrangeMoneyConfig({ ...orangeMoneyConfig, mobile_number: e.target.value })} placeholder="+237 6XX XXX XXX" />
              </div>
              <div className="space-y-2">
                <Label>Nom du titulaire du compte</Label>
                <Input value={orangeMoneyConfig.account_name} onChange={(e) => setOrangeMoneyConfig({ ...orangeMoneyConfig, account_name: e.target.value })} placeholder="ASSOCIATION E2D" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Instructions de paiement (optionnel)</Label>
              <Textarea value={orangeMoneyConfig.instructions} onChange={(e) => setOrangeMoneyConfig({ ...orangeMoneyConfig, instructions: e.target.value })} placeholder="Composez *150# et suivez les instructions pour envoyer de l'argent..." rows={3} />
            </div>
            <Button onClick={() => handleSaveMobileMoney('orange_money')} disabled={loading} className="w-full sm:w-auto"><Save className="w-4 h-4 mr-2" />{loading ? 'Enregistrement...' : 'Enregistrer Orange Money'}</Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="mtn_money">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><span className="text-2xl">🟡</span>MTN Mobile Money</CardTitle>
                <CardDescription>Configuration du compte MTN MoMo pour recevoir les dons</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="mtn-active">Activer</Label>
                <Switch id="mtn-active" checked={isActive('mtn_money')} onCheckedChange={() => { const id = getConfigId('mtn_money'); if (id) toggleActive(id, isActive('mtn_money')); }} disabled={!getConfigId('mtn_money')} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Numéro MTN MoMo</Label>
                <Input value={mtnMoneyConfig.mobile_number} onChange={(e) => setMtnMoneyConfig({ ...mtnMoneyConfig, mobile_number: e.target.value })} placeholder="+237 6XX XXX XXX" />
              </div>
              <div className="space-y-2">
                <Label>Nom du titulaire du compte</Label>
                <Input value={mtnMoneyConfig.account_name} onChange={(e) => setMtnMoneyConfig({ ...mtnMoneyConfig, account_name: e.target.value })} placeholder="ASSOCIATION E2D" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Instructions de paiement (optionnel)</Label>
              <Textarea value={mtnMoneyConfig.instructions} onChange={(e) => setMtnMoneyConfig({ ...mtnMoneyConfig, instructions: e.target.value })} placeholder="Composez *126# et suivez les instructions pour envoyer de l'argent..." rows={3} />
            </div>
            <Button onClick={() => handleSaveMobileMoney('mtn_money')} disabled={loading} className="w-full sm:w-auto"><Save className="w-4 h-4 mr-2" />{loading ? 'Enregistrement...' : 'Enregistrer MTN MoMo'}</Button>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
