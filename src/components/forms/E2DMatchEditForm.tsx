import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdateE2DMatch } from "@/hooks/useSport";
import { Globe, FileText, Save, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";
import { uploadFile } from "@/lib/storage-utils";
import { toast } from "@/hooks/use-toast";

const matchSchema = z.object({
  date_match: z.string().min(1, "Date requise"),
  equipe_adverse: z.string().min(2, "Adversaire requis"),
  lieu: z.string().optional(),
  score_e2d: z.number().min(0),
  score_adverse: z.number().min(0),
  type_match: z.string().optional(),
  heure_match: z.string().optional(),
  statut: z.string().optional(),
  statut_publication: z.enum(['brouillon', 'publie', 'archive']).default('brouillon'),
});

type MatchFormData = z.infer<typeof matchSchema>;

interface E2DMatchEditFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: unknown;
  onSuccess?: () => void;
}

export default function E2DMatchEditForm({ open, onOpenChange, match, onSuccess }: E2DMatchEditFormProps) {
  const updateMatch = useUpdateE2DMatch();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  
  const form = useForm<MatchFormData>({
    resolver: zodResolver(matchSchema),
    defaultValues: { 
      date_match: "", 
      equipe_adverse: "", 
      lieu: "domicile", 
      score_e2d: 0, 
      score_adverse: 0, 
      type_match: "amical",
      heure_match: "",
      statut: "planifie",
      statut_publication: "brouillon",
    },
  });

  useEffect(() => {
    if (match && open) {
      form.reset({
        date_match: match.date_match || "",
        equipe_adverse: match.equipe_adverse || "",
        lieu: match.lieu || "domicile",
        score_e2d: match.score_e2d ?? 0,
        score_adverse: match.score_adverse ?? 0,
        type_match: match.type_match || "amical",
        heure_match: match.heure_match || "",
        statut: match.statut || "planifie",
        statut_publication: match.statut_publication || "brouillon",
      });
      setLogoPreview(match.logo_equipe_adverse || null);
      setThumbnailPreview(match.image_url || null);
      setLogoFile(null);
      setThumbnailFile(null);
    }
  }, [match, open, form]);

  const handleFileSelect = (file: File | null, type: 'logo' | 'thumbnail') => {
    if (!file) return;
    const preview = URL.createObjectURL(file);
    if (type === 'logo') {
      setLogoFile(file);
      setLogoPreview(preview);
    } else {
      setThumbnailFile(file);
      setThumbnailPreview(preview);
    }
  };

  const clearFile = (type: 'logo' | 'thumbnail') => {
    if (type === 'logo') {
      setLogoFile(null);
      setLogoPreview(null);
    } else {
      setThumbnailFile(null);
      setThumbnailPreview(null);
    }
  };

  const onSubmit = async (data: MatchFormData) => {
    if (!match?.id) return;
    setUploading(true);
    try {
      let logoUrl: string | null = logoPreview;
      let imageUrl: string | null = thumbnailPreview;

      if (logoFile) {
        logoUrl = await uploadFile('sport-logos', logoFile, 'adversaires');
      }
      if (thumbnailFile) {
        imageUrl = await uploadFile('sport-logos', thumbnailFile, 'thumbnails');
      }

      await updateMatch.mutateAsync({
        id: match.id,
        date_match: data.date_match,
        equipe_adverse: data.equipe_adverse,
        lieu: data.lieu || "domicile",
        type_match: data.type_match || "amical",
        heure_match: data.heure_match || null,
        score_e2d: data.score_e2d,
        score_adverse: data.score_adverse,
        statut: data.statut || "planifie",
        statut_publication: data.statut_publication,
        logo_equipe_adverse: logoUrl,
        image_url: imageUrl,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (err: unknown) {
      toast({ title: "Erreur", description: "Erreur lors de la mise à jour", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const statutPublication = form.watch('statut_publication');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le Match E2D</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="date_match" render={({ field }) => (<FormItem><FormLabel>Date du Match</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="heure_match" render={({ field }) => (<FormItem><FormLabel>Heure</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="equipe_adverse" render={({ field }) => (<FormItem><FormLabel>Équipe Adverse</FormLabel><FormControl><Input placeholder="Nom de l'équipe" {...field} /></FormControl><FormMessage /></FormItem>)} />
            
            {/* Logo adversaire */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Logo équipe adverse</label>
              {logoPreview ? (
                <div className="flex items-center gap-3">
                  <img src={logoPreview} alt="Logo adversaire" className="h-16 w-16 object-contain rounded border bg-muted" />
                  <Button type="button" variant="ghost" size="sm" onClick={() => clearFile('logo')}><X className="h-4 w-4" /></Button>
                </div>
              ) : (
                <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground border border-dashed rounded-lg p-3">
                  <Upload className="h-4 w-4" />
                  Choisir un logo
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e.target.files?.[0] || null, 'logo')} />
                </label>
              )}
            </div>

            {/* Image miniature */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Image miniature du match</label>
              {thumbnailPreview ? (
                <div className="flex items-center gap-3">
                  <img src={thumbnailPreview} alt="Miniature" className="h-20 w-32 object-cover rounded border bg-muted" />
                  <Button type="button" variant="ghost" size="sm" onClick={() => clearFile('thumbnail')}><X className="h-4 w-4" /></Button>
                </div>
              ) : (
                <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground border border-dashed rounded-lg p-3">
                  <Upload className="h-4 w-4" />
                  Choisir une image
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e.target.files?.[0] || null, 'thumbnail')} />
                </label>
              )}
            </div>

            <FormField control={form.control} name="lieu" render={({ field }) => (<FormItem><FormLabel>Lieu</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="domicile">Domicile</SelectItem><SelectItem value="exterieur">Extérieur</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="type_match" render={({ field }) => (<FormItem><FormLabel>Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="amical">Amical</SelectItem><SelectItem value="championnat">Championnat</SelectItem><SelectItem value="coupe">Coupe</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="statut" render={({ field }) => (<FormItem><FormLabel>Statut du match</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="planifie">Planifié</SelectItem><SelectItem value="en_cours">En cours</SelectItem><SelectItem value="termine">Terminé</SelectItem><SelectItem value="annule">Annulé</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="score_e2d" render={({ field }) => (<FormItem><FormLabel>Buts E2D</FormLabel><FormControl><Input type="number" min={0} {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="score_adverse" render={({ field }) => (<FormItem><FormLabel>Buts Adverses</FormLabel><FormControl><Input type="number" min={0} {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            
            {/* Statut de publication */}
            <FormField 
              control={form.control} 
              name="statut_publication" 
              render={({ field }) => (
                <FormItem className="rounded-lg border p-4 bg-muted/30">
                  <FormLabel className="flex items-center gap-2">
                    {field.value === 'publie' ? <Globe className="h-4 w-4 text-green-600" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
                    Statut de publication
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="brouillon"><span className="flex items-center gap-2"><FileText className="h-4 w-4" />Brouillon (interne)</span></SelectItem>
                      <SelectItem value="publie"><span className="flex items-center gap-2"><Globe className="h-4 w-4 text-green-600" />Publié (visible sur le site)</span></SelectItem>
                      <SelectItem value="archive"><span className="flex items-center gap-2"><FileText className="h-4 w-4 text-orange-500" />Archivé (masqué)</span></SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {statutPublication === 'publie' 
                      ? "Ce match sera visible sur le site public dans la section événements."
                      : statutPublication === 'archive'
                        ? "Ce match est archivé et n'apparaît pas sur le site public."
                        : "Ce match reste en interne et n'apparaît pas sur le site public."
                    }
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )} 
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
              <Button type="submit" disabled={updateMatch.isPending || uploading}>
                <Save className="h-4 w-4 mr-1" />
                {uploading ? "Upload en cours..." : updateMatch.isPending ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
