import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import {
  FileSpreadsheet, FileText, TrendingUp, TrendingDown,
  DollarSign, HandCoins, AlertTriangle, PiggyBank, Wallet
} from "lucide-react";
import { format, parseISO } from "date-fns";
import type { PretWithJoins } from "@/types/supabase-joins";

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

interface Stats {
  cotisationsStats: { total: number; paye: number; impaye: number; partiel: number; tauxRecouvrement: number; chartData: { name: string; value: number }[] } | null;
  pretsStats: { encours: number; rembourses: number; enRetard: number; totalEncours: number; totalRembourse: number; interetsPercus: number } | null;
  sanctionsStats: { total: number; paye: number; impaye: number; count: number } | null;
  epargnesStats: { total: number; count: number; chartData: { name: string; value: number }[] } | null;
  caisseStats: { entrees: number; sorties: number; solde: number; chartData: { name: string; entrees: number; sorties: number }[] } | null;
  prets: PretWithJoins[] | undefined;
  formatMembre: (m: { prenom: string; nom: string } | null) => string;
  exportPDF: (type: string) => void;
  exportExcel: (type: string) => void;
}

export default function RapportsTabsContent(props: Stats) {
  const { cotisationsStats, pretsStats, sanctionsStats, epargnesStats, caisseStats, prets, formatMembre, exportPDF, exportExcel } = props;
  return (
  <Tabs defaultValue="cotisations" className="space-y-6">
    <TabsList className="grid w-full grid-cols-5">
      <TabsTrigger value="cotisations" className="flex items-center gap-2">
        <DollarSign className="h-4 w-4" />
        Cotisations
      </TabsTrigger>
      <TabsTrigger value="prets" className="flex items-center gap-2">
        <HandCoins className="h-4 w-4" />
        Prêts
      </TabsTrigger>
      <TabsTrigger value="sanctions" className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        Sanctions
      </TabsTrigger>
      <TabsTrigger value="epargnes" className="flex items-center gap-2">
        <PiggyBank className="h-4 w-4" />
        Épargnes
      </TabsTrigger>
      <TabsTrigger value="caisse" className="flex items-center gap-2">
        <Wallet className="h-4 w-4" />
        Caisse
      </TabsTrigger>
    </TabsList>

    {/* Tab Cotisations */}
    <TabsContent value="cotisations" className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => exportPDF("cotisations")}>
          <FileText className="h-4 w-4 mr-2" />
          PDF
        </Button>
        <Button variant="outline" size="sm" onClick={() => exportExcel("cotisations")}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Excel
        </Button>
      </div>

      {cotisationsStats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total attendu</CardDescription>
                <CardTitle className="text-2xl">{cotisationsStats.total.toLocaleString("fr-FR")} FCFA</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Payé</CardDescription>
                <CardTitle className="text-2xl text-green-600">{cotisationsStats.paye.toLocaleString("fr-FR")} FCFA</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Impayé</CardDescription>
                <CardTitle className="text-2xl text-red-600">{cotisationsStats.impaye.toLocaleString("fr-FR")} FCFA</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Taux de recouvrement</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2">
                  {cotisationsStats.tauxRecouvrement.toFixed(1)}%
                  {cotisationsStats.tauxRecouvrement >= 80 ? (
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-600" />
                  )}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {cotisationsStats.chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Répartition par type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={cotisationsStats.chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {cotisationsStats.chartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `${value.toLocaleString("fr-FR")} FCFA`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </TabsContent>

    {/* Tab Prêts */}
    <TabsContent value="prets" className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => exportPDF("prets")}>
          <FileText className="h-4 w-4 mr-2" />
          PDF
        </Button>
        <Button variant="outline" size="sm" onClick={() => exportExcel("prets")}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Excel
        </Button>
      </div>

      {pretsStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Prêts en cours</CardDescription>
              <CardTitle className="text-2xl">
                {pretsStats.encours}
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({pretsStats.totalEncours.toLocaleString("fr-FR")} FCFA)
                </span>
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Prêts en retard</CardDescription>
              <CardTitle className="text-2xl text-red-600">{pretsStats.enRetard}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Intérêts perçus</CardDescription>
              <CardTitle className="text-2xl text-green-600">
                {pretsStats.interetsPercus.toLocaleString("fr-FR")} FCFA
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {prets && prets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Détail des prêts</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Membre</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Reste</TableHead>
                  <TableHead>Échéance</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prets.slice(0, 10).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {formatMembre(p.membres)}
                    </TableCell>
                    <TableCell>{(p.montant || 0).toLocaleString("fr-FR")} FCFA</TableCell>
                    <TableCell>
                      {((p.montant_total_du || p.montant) - (p.montant_paye || 0)).toLocaleString("fr-FR")} FCFA
                    </TableCell>
                    <TableCell>{format(parseISO(p.echeance), "dd/MM/yyyy")}</TableCell>
                    <TableCell>
                      <Badge variant={p.statut === "rembourse" ? "default" : p.statut === "en_cours" ? "secondary" : "destructive"}>
                        {p.statut}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </TabsContent>

    {/* Tab Sanctions */}
    <TabsContent value="sanctions" className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => exportPDF("sanctions")}>
          <FileText className="h-4 w-4 mr-2" />
          PDF
        </Button>
        <Button variant="outline" size="sm" onClick={() => exportExcel("sanctions")}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Excel
        </Button>
      </div>

      {sanctionsStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total sanctions</CardDescription>
              <CardTitle className="text-2xl">{sanctionsStats.count}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Montant total</CardDescription>
              <CardTitle className="text-2xl">{sanctionsStats.total.toLocaleString("fr-FR")} FCFA</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Payé</CardDescription>
              <CardTitle className="text-2xl text-green-600">{sanctionsStats.paye.toLocaleString("fr-FR")} FCFA</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Impayé</CardDescription>
              <CardTitle className="text-2xl text-red-600">{sanctionsStats.impaye.toLocaleString("fr-FR")} FCFA</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}
    </TabsContent>

    {/* Tab Épargnes */}
    <TabsContent value="epargnes" className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => exportPDF("epargnes")}>
          <FileText className="h-4 w-4 mr-2" />
          PDF
        </Button>
        <Button variant="outline" size="sm" onClick={() => exportExcel("epargnes")}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Excel
        </Button>
      </div>

      {epargnesStats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total épargné</CardDescription>
                <CardTitle className="text-2xl text-green-600">
                  {epargnesStats.total.toLocaleString("fr-FR")} FCFA
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Nombre de dépôts</CardDescription>
                <CardTitle className="text-2xl">{epargnesStats.count}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {epargnesStats.chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top 10 épargnants</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={epargnesStats.chartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                      <YAxis dataKey="name" type="category" width={120} />
                      <Tooltip formatter={(value: number) => `${value.toLocaleString("fr-FR")} FCFA`} />
                      <Bar dataKey="value" fill="#22c55e" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </TabsContent>

    {/* Tab Caisse */}
    <TabsContent value="caisse" className="space-y-4">
      {caisseStats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total entrées</CardDescription>
                <CardTitle className="text-2xl text-green-600">
                  +{caisseStats.entrees.toLocaleString("fr-FR")} FCFA
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total sorties</CardDescription>
                <CardTitle className="text-2xl text-red-600">
                  -{caisseStats.sorties.toLocaleString("fr-FR")} FCFA
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Solde période</CardDescription>
                <CardTitle className={`text-2xl ${caisseStats.solde >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {caisseStats.solde >= 0 ? "+" : ""}{caisseStats.solde.toLocaleString("fr-FR")} FCFA
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {caisseStats.chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Mouvements par catégorie</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={caisseStats.chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value: number) => `${value.toLocaleString("fr-FR")} FCFA`} />
                      <Legend />
                      <Bar dataKey="entrees" fill="#22c55e" name="Entrées" />
                      <Bar dataKey="sorties" fill="#ef4444" name="Sorties" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </TabsContent>
  </Tabs>
  );
}
