import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getFullEmailConfig, sendEmail, validateFullEmailConfig } from "../_shared/email-utils.ts";
import { requirePrivilegedUser } from "../_shared/auth-check.ts";
import { notifyInApp } from "../_shared/in-app-notify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SanctionNotificationRequest {
  sanctionId: string;
  membreId: string;
  motif: string;
  montant: number;
  dateSanction?: string;
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

    const body: SanctionNotificationRequest = await req.json();
    const { sanctionId, membreId, motif, montant, dateSanction, testMode = false } = body;

    if (!membreId || !motif) {
      return new Response(
        JSON.stringify({ error: "Paramètres manquants", message: "membreId et motif sont requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Envoi de notification de sanction pour membre ${membreId} via ${emailConfig.service}. Mode test: ${testMode}`);

    // Vérifier si les notifications sont activées
    const { data: config } = await supabase
      .from("notifications_config")
      .select("actif")
      .eq("type_notification", "sanction_notification")
      .single();

    if (config && !config.actif) {
      console.log("Notifications de sanctions désactivées");
      return new Response(
        JSON.stringify({ success: true, message: "Notifications désactivées", emailSent: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Récupérer les informations du membre
    const { data: membre, error: membreError } = await supabase
      .from("membres")
      .select("id, nom, prenom, email, user_id")
      .eq("id", membreId)
      .single();

    if (membreError || !membre) {
      console.error("Membre non trouvé:", membreError);
      return new Response(
        JSON.stringify({ error: "Membre non trouvé" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!membre.email) {
      console.log("Membre sans email:", membreId);
      return new Response(
        JSON.stringify({ success: true, message: "Membre sans email", emailSent: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dateFormatted = dateSanction 
      ? new Date(dateSanction).toLocaleDateString("fr-FR") 
      : new Date().toLocaleDateString("fr-FR");

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .alert { background: #fef2f2; border: 1px solid #ef4444; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .detail-row { display: flex; justify-content: space-between; margin: 8px 0; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
          .montant { font-size: 28px; font-weight: bold; color: #dc2626; text-align: center; margin: 20px 0; }
          .footer { text-align: center; padding: 15px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Notification de Sanction</h1>
          </div>
          <div class="content">
            <p>Bonjour ${membre.prenom} ${membre.nom},</p>
            
            <div class="alert">
              <strong>Nous vous informons qu'une sanction a été enregistrée à votre encontre.</strong>
            </div>
            
            <div class="details">
              <div class="detail-row">
                <span><strong>📋 Motif :</strong></span>
                <span>${motif}</span>
              </div>
              <div class="detail-row">
                <span><strong>📅 Date :</strong></span>
                <span>${dateFormatted}</span>
              </div>
            </div>
            
            <div class="montant">Montant : ${montant.toLocaleString("fr-FR")} FCFA</div>
            
            <p>Cette sanction est applicable conformément au règlement intérieur de l'association E2D.</p>
            
            <p>Pour toute question ou réclamation, veuillez contacter le bureau de l'association.</p>
            
            <p>Cordialement,<br>Le Bureau E2D</p>
          </div>
          <div class="footer">
            <p>Ce message a été envoyé automatiquement suite à l'enregistrement d'une sanction.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    if (testMode) {
      console.log(`[TEST] Email préparé pour ${membre.email}`);
      return new Response(
        JSON.stringify({ success: true, message: "Mode test - email non envoyé", emailSent: false, testEmail: membre.email }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      // Envoyer via le service configuré
      const result = await sendEmail(emailConfig, {
        to: membre.email,
        subject: `Notification de sanction - ${motif}`,
        html: emailHtml,
      });

      if (!result.success) {
        console.error(`Erreur envoi email à ${membre.email}:`, result.error);
        return new Response(
          JSON.stringify({ success: false, error: result.error }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Email de sanction envoyé à ${membre.email} via ${emailConfig.service}`);

      // Notification in-app pour le membre sanctionné
      if (membre.user_id) {
        await notifyInApp({
          user_id: membre.user_id,
          type: "sanction_created",
          title: `Nouvelle sanction — ${motif}`,
          body: `${Math.floor(Number(montant)).toLocaleString("fr-FR")} FCFA • ${dateFormatted}`,
          link: "/dashboard/mes-sanctions",
          dedupe_key: sanctionId ? `sanction:${sanctionId}` : undefined,
          metadata: { sanction_id: sanctionId, motif, montant },
        }, supabase);
      }

      // Enregistrer dans l'historique
      await supabase.from("notifications_historique").insert({
        type_notification: "sanction_notification",
        destinataire_email: membre.email,
        sujet: `Notification de sanction - ${motif}`,
        contenu: emailHtml,
        statut: "envoye",
        variables_utilisees: { sanction_id: sanctionId, membre_id: membreId, motif, montant }
      });

      return new Response(
        JSON.stringify({ success: true, emailSent: true, email: membre.email, service: emailConfig.service }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (emailErr: any) {
      console.error(`Exception envoi email à ${membre.email}:`, emailErr);
      return new Response(
        JSON.stringify({ success: false, error: emailErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: any) {
    console.error("Erreur dans send-sanction-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
