import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getFullEmailConfig, sendEmail, validateFullEmailConfig } from "../_shared/email-utils.ts";
import { requirePrivilegedUser } from "../_shared/auth-check.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://e2d-pro.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReminderRequest {
  testMode?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authError = await requirePrivilegedUser(req, corsHeaders);
    if (authError) return authError;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Charger la configuration email complète
    const emailConfig = await getFullEmailConfig();
    
    // Valider la configuration
    const validation = validateFullEmailConfig(emailConfig);
    if (!validation.valid) {
      console.error("Configuration email invalide:", validation.error);
      return new Response(
        JSON.stringify({ error: "Configuration manquante", message: validation.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { testMode = false }: ReminderRequest = await req.json().catch(() => ({}));

    console.log(`Envoi de rappels pour cotisations impayées via ${emailConfig.service}. Mode test: ${testMode}`);

    // Récupérer la configuration des notifications
    const { data: config } = await supabase
      .from("notifications_config")
      .select("actif, delai_jours")
      .eq("type_notification", "rappel_cotisation")
      .single();

    if (!config?.actif) {
      console.log("Rappels de cotisations désactivés");
      return new Response(
        JSON.stringify({ success: true, message: "Rappels désactivés", emailsSent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const delaiJours = config.delai_jours || 7;
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - delaiJours);
    const dateLimitStr = dateLimit.toISOString().split("T")[0];

    // Récupérer les cotisations impayées avec réunion passée depuis X jours
    const { data: cotisationsImpayees, error: cotisationsError } = await supabase
      .from("cotisations")
      .select(`
        id,
        montant,
        statut,
        membre_id,
        reunion_id,
        type_cotisation_id,
        membres!inner(id, nom, prenom, email, statut),
        reunions!inner(id, date_reunion),
        cotisations_types(id, nom)
      `)
      .in("statut", ["impaye", "partiel"])
      .lt("reunions.date_reunion", dateLimitStr)
      .eq("membres.statut", "actif")
      .not("membres.email", "is", null);

    if (cotisationsError) {
      console.error("Erreur récupération cotisations:", cotisationsError);
      throw cotisationsError;
    }

    if (!cotisationsImpayees || cotisationsImpayees.length === 0) {
      console.log("Aucune cotisation impayée trouvée");
      return new Response(
        JSON.stringify({ success: true, message: "Aucune cotisation impayée", emailsSent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Grouper par membre pour envoyer un seul email par membre
    const cotisationsParMembre: Record<string, any[]> = {};
    for (const cotisation of cotisationsImpayees) {
      const membreId = cotisation.membre_id;
      if (!cotisationsParMembre[membreId]) {
        cotisationsParMembre[membreId] = [];
      }
      cotisationsParMembre[membreId].push(cotisation);
    }

    let emailsSent = 0;
    let emailsErrors = 0;
    const errors: string[] = [];

    for (const [membreId, cotisations] of Object.entries(cotisationsParMembre)) {
      const firstCot = cotisations[0] as { membres?: { email?: string; nom?: string; prenom?: string }; [k: string]: unknown };
      const membre = firstCot.membres;
      if (!membre?.email) continue;

      const totalDu = cotisations.reduce((sum, c) => sum + (c.montant || 0), 0);
      
      const cotisationsHtml = cotisations.map((c: { reunions?: { date_reunion?: string }; cotisations_types?: { nom?: string }; montant?: number; statut?: string }) => {
        const dateReunion = new Date(c.reunions.date_reunion).toLocaleDateString("fr-FR");
        const typeName = c.cotisations_types?.nom || "Cotisation";
        return `<li>${typeName} - Réunion du ${dateReunion} : ${c.montant.toLocaleString("fr-FR")} FCFA (${c.statut})</li>`;
      }).join("");

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
            .alert { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .total { font-size: 24px; font-weight: bold; color: #d97706; text-align: center; margin: 15px 0; }
            ul { background: white; padding: 15px 30px; border-radius: 8px; }
            .footer { text-align: center; padding: 15px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>💰 Rappel de Cotisation E2D</h1>
            </div>
            <div class="content">
              <p>Bonjour ${membre.prenom} ${membre.nom},</p>
              
              <div class="alert">
                <strong>⚠️ Rappel :</strong> Vous avez des cotisations en attente de paiement.
              </div>
              
              <p><strong>Cotisations concernées :</strong></p>
              <ul>${cotisationsHtml}</ul>
              
              <div class="total">Total dû : ${totalDu.toLocaleString("fr-FR")} FCFA</div>
              
              <p>Nous vous invitons à régulariser votre situation lors de la prochaine réunion ou en contactant le trésorier.</p>
              
              <p>Cordialement,<br>L'équipe E2D</p>
            </div>
            <div class="footer">
              <p>Ce message a été envoyé automatiquement. Merci de ne pas y répondre directement.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      if (testMode) {
        console.log(`[TEST] Email préparé pour ${membre.email} - ${cotisations.length} cotisation(s)`);
        emailsSent++;
        continue;
      }

      try {
        // Envoyer via le service configuré
        const result = await sendEmail(emailConfig, {
          to: membre.email,
          subject: `Rappel : Cotisations impayées - ${totalDu.toLocaleString("fr-FR")} FCFA`,
          html: emailHtml,
        });

        if (!result.success) {
          console.error(`Erreur envoi email à ${membre.email}:`, result.error);
          errors.push(`${membre.email}: ${result.error}`);
          emailsErrors++;
        } else {
          console.log(`Email envoyé à ${membre.email} via ${emailConfig.service}`);
          emailsSent++;

          // Enregistrer dans l'historique
          await supabase.from("notifications_historique").insert({
            type_notification: "rappel_cotisation",
            destinataire_email: membre.email,
            sujet: `Rappel : Cotisations impayées - ${totalDu.toLocaleString("fr-FR")} FCFA`,
            contenu: emailHtml,
            statut: "envoye",
            variables_utilisees: { membre_id: membreId, cotisations_count: cotisations.length, total_du: totalDu }
          });
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 600));
      } catch (emailErr: any) {
        console.error(`Exception envoi email à ${membre.email}:`, emailErr);
        errors.push(`${membre.email}: ${emailErr.message}`);
        emailsErrors++;
      }
    }

    console.log(`Résumé: ${emailsSent} emails envoyés via ${emailConfig.service}, ${emailsErrors} erreurs`);

    return new Response(
      JSON.stringify({
        success: true,
        emailsSent,
        emailsErrors,
        membresCount: Object.keys(cotisationsParMembre).length,
        cotisationsCount: cotisationsImpayees.length,
        service: emailConfig.service,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Erreur dans send-cotisation-reminders:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
