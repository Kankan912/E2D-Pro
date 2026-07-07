import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useMatchCompteRendu, CompteRenduFormData } from '@/hooks/useMatchCompteRendu';
import { Loader2, Save, FileText, Cloud, Users, Flag, Award } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const compteRenduSchema = z.object({
  resume: z.string().optional(),
  faits_marquants: z.string().optional(),
  score_mi_temps: z.string().max(10).optional(),
  conditions_jeu: z.string().optional(),
  arbitrage_commentaire: z.string().optional(),
  ambiance: z.string().optional(),
});

interface CompteRenduMatchFormProps {
  matchId: string;
  onSaved?: () => void;
}

export function CompteRenduMatchForm({ matchId, onSaved }: CompteRenduMatchFormProps) {
  const { compteRendu, isLoading, saveCompteRendu, isSaving } = useMatchCompteRendu(matchId);

  const form = useForm<CompteRenduFormData>({
    resolver: zodResolver(compteRenduSchema),
    defaultValues: {
      resume: '',
      faits_marquants: '',
      score_mi_temps: '',
      conditions_jeu: '',
      arbitrage_commentaire: '',
      ambiance: '',
    },
  });

  useEffect(() => {
    if (compteRendu) {
      form.reset({
        resume: compteRendu.resume || '',
        faits_marquants: compteRendu.faits_marquants || '',
        score_mi_temps: compteRendu.score_mi_temps || '',
        conditions_jeu: compteRendu.conditions_jeu || '',
        arbitrage_commentaire: compteRendu.arbitrage_commentaire || '',
        ambiance: compteRendu.ambiance || '',
      });
    }
  }, [compteRendu, form]);

  const onSubmit = (data: CompteRenduFormData) => {
    saveCompteRendu(data, {
      onSuccess: () => onSaved?.(),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Résumé du match
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="resume"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="Décrivez le déroulement général du match..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="h-4 w-4" />
                Faits marquants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="faits_marquants"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="Buts, actions décisives, moments clés..."
                        className="min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Flag className="h-4 w-4" />
                Score mi-temps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="score_mi_temps"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="Ex: 1-0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Cloud className="h-4 w-4" />
                Conditions de jeu
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="conditions_jeu"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="Météo, état du terrain..."
                        className="min-h-[60px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Ambiance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="ambiance"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="Ambiance des supporters, fair-play..."
                        className="min-h-[60px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Commentaire sur l'arbitrage</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="arbitrage_commentaire"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="Observations sur l'arbitrage (optionnel)..."
                      className="min-h-[60px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Enregistrer le compte rendu
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
