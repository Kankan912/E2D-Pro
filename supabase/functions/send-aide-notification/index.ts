import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getFullEmailConfig, sendEmail, validateFullEmailConfig } from "../_shared/email-utils.ts";
import { requirePrivilegedUser } from "../_shared/auth-check.ts";
import { escapeHtml } from "../_shared/email-utils.ts";

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SendAideNotificationRequest {
  aide_id: string;
  association_id: string;
  type: AideNotificationType;
  recipient_id?: string;
}

type AideNotificationType =
  | "aide_soumise"
  | "aide_approuvee"
  | "aide_refusee"
  | "aide_payee"
  | "appel_de_fonds";

// ---------------------------------------------------------------------------
// Notification templates
// ---------------------------------------------------------------------------

interface NotificationTemplate {
  subject: string;
  heading: string;
  bodyHtml: (data: NotificationData) => string;
}

interface NotificationData {
  beneficiaireNom: string;
  beneficiairePrenom: string;
  montant: number;
  typeAide: string;
  dateAllocation: string;
  associationNom: string;
  commentaire?: string;
}

const NOTIFICATION_TEMPLATES: Record<AideNotificationType, NotificationTemplate> = {
  aide_soumise: {
    subject: (data) => `[E2D] Aide soumise : ${data.beneficiairePrenom} ${data.beneficiaireNom}`,
    heading: "Aide soumise pour validation",
    bodyHtml: (data) => `
      <p>Bonjour,</p>
      <p>Une nouvelle aide a été soumise pour validation :</p>
      <div class="info-box">
        <p><strong>Bénéficiaire :</strong> ${escapeHtml(data.beneficiairePrenom)} ${escapeHtml(data.beneficiaireNom)}</p>
        <p><strong>Type :</strong> ${escapeHtml(data.typeAide)}</p>
        <p><strong>Montant :</strong> ${data.montant.toLocaleString("fr-FR")} FCFA</p>
        <p><strong>Date :</strong> ${new Date(data.dateAllocation).toLocaleDateString("fr-FR")}</p>
      </div>
      <p>Merci de examiner cette demande dans les plus brefs délais.</p>
    `,
  },
  aide_approuvee: {
    subject: (data) => `[E2D] Aide approuvée : ${data.beneficiairePrenom} ${data.beneficiaireNom}`,
    heading: "Aide approuvée",
    bodyHtml: (data) => `
      <p>Bonjour ${escapeHtml(data.beneficiairePrenom)},</p>
      <p>Votre demande d'aide a été <strong>approuvée</strong>.</p>
      <div class="info-box">
        <p><strong>Type :</strong> ${escapeHtml(data.typeAide)}</p>
        <p><strong>Montant :</strong> ${data.montant.toLocaleString("fr-FR")} FCFA</p>
        <p><strong>Date :</strong> ${new Date(data.dateAllocation).toLocaleDateString("fr-FR")}</p>
      </div>
      <p>Le paiement sera effectué dans les meilleurs délais.</p>
    `,
  },
  aide_refusee: {
    subject: (data) => `[E2D] Aide refusée : ${data.beneficiairePrenom} ${data.beneficiaireNom}`,
    heading: "Aide refusée",
    bodyHtml: (data) => `
      <p>Bonjour ${escapeHtml(data.beneficiairePrenom)},</p>
      <p>Votre demande d'aide a été <strong>refusée</strong>.</p>
      <div class="info-box">
        <p><strong>Type :</strong> ${escapeHtml(data.typeAide)}</p>
        <p><strong>Montant :</strong> ${data.montant.toLocaleString("fr-FR")} FCFA</p>
        ${data.commentaire ? `<p><strong>Raison :</strong> ${escapeHtml(data.commentaire)}</p>` : ""}
      </div>
      <p>Vous pouvez soumettre une nouvelle demande si nécessaire.</p>
    `,
  },
  aide_payee: {
    subject: (data) => `[E2D] Aide payée : ${data.beneficiairePrenom} ${data.beneficiaireNom}`,
    heading: "Aide payée",
    bodyHtml: (data) => `
      <p>Bonjour ${escapeHtml(data.beneficiairePrenom)},</p>
      <p>Votre aide a été <strong>payée</strong> avec succès.</p>
      <div class="info-box">
        <p><strong>Type :</strong> ${escapeHtml(data.typeAide)}</p>
        <p><strong>Montant :</strong> ${data.montant.toLocaleString("fr-FR")} FCFA</p>
        <p><strong>Date :</strong> ${new Date(data.dateAllocation).toLocaleDateString("fr-FR")}</p>
      </div>
      <p>Nous vous remercions pour votre confiance.</p>
    `,
  },
  appel_de_fonds: {
    subject: (data) => `[E2D] Appel de fonds - ${escapeHtml(data.associationNom)}`,
    heading: "Appel de fonds",
    bodyHtml: (data) => `
      <p>Bonjour,</p>
      <p>Un nouvel appel de fonds a été créé.</p>
      <div class="info-box">
        <p><strong>Association :</strong> ${escapeHtml(data.associationNom)}</p>
        <p><strong>Montant :</strong> ${data.montant.toLocaleString("fr-FR")} FCFA</p>
        <p><strong>Date :</strong> ${new Date(data.dateAllocation).toLocaleDateString("fr-FR")}</p>
      </div>
      <p>Merci de traiter cette demande dans les plus brefs délais.</p>
    `,
  },
};

// Fix: subject is a function in the template, need to handle properly
const SUBJECT_TEMPLATES: Record<AideNotificationType, (data: NotificationData) => string> = {
  aide_soumise: (data) => `[E2D] Aide soumise : ${data.beneficiairePrenom} ${data.beneficiaireNom}`,
  aide_approuvee: (data) => `[E2D] Aide approuvée : ${data.beneficiairePrenom} ${data.beneficiaireNom}`,
  aide_refusee: (data) => `[E2D] Aide refusée : ${data.beneficiairePrenom} ${data.beneficiaireNom}`,
  aide_payee: (data) => `[E2D] Aide payée : ${data.beneficiairePrenom} ${data.beneficiaireNom}`,
  appel_de_fonds: (data) => `[E2D] Appel de fonds - ${data.associationNom}`,
};

// ---------------------------------------------------------------------------
// HTML wrapper
// ---------------------------------------------------------------------------

function buildEmailHtml(heading: string, bodyContent: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .header { background: #0B6B7C; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; max-width: 600px; margin: 0 auto; }
        .footer { background: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #666; }
        h1 { margin: 0; font-size: 22px; }
        .info-box { background: #e6f4f6; border-left: 4px solid #0B6B7C; padding: 15px; margin: 15px 0; border-radius: 0 8px 8px 0; }
        .info-box p { margin: 6px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>E2D Connect - Aides</h1>
      </div>
      <div class="content">
        <h2 style="color: #0B6B7C; border-bottom: 2px solid #0B6B7C; padding-bottom: 5px;">${heading}</h2>
        ${bodyContent}
      </div>
      <div class="footer">
        <p>Ce message a été envoyé automatiquement par E2D Connect.</p>
        <p>© ${new Date().getFullYear()} Ensemble pour le Développement de la Diaspora</p>
      </div>
    </body>
    </html>
  `;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ---- Auth check ----
    const authResponse = await requirePrivilegedUser(req, corsHeaders);
    if (authResponse) return authResponse;

    // Parse request body
    const body: SendAideNotificationRequest = await req.json();
    const { aide_id, association_id, type, recipient_id } = body;

    // Validate required fields
    if (!aide_id || !association_id || !type) {
      return new Response(
        JSON.stringify({ error: "Paramètres manquants: aide_id, association_id, type sont requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate notification type
    const validTypes: AideNotificationType[] = [
      "aide_soumise",
      "aide_approuvee",
      "aide_refusee",
      "aide_payee",
      "appel_de_fonds",
    ];
    if (!validTypes.includes(type)) {
      return new Response(
        JSON.stringify({ error: `Type de notification invalide: ${type}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-aide-notification] Processing: type=${type}, aide_id=${aide_id}, association_id=${association_id}`);

    // ---- Load email config ----
    const emailConfig = await getFullEmailConfig();
    const validation = validateFullEmailConfig(emailConfig);
    if (!validation.valid) {
      console.error("Email config invalid:", validation.error);
      return new Response(
        JSON.stringify({ error: "Configuration email invalide", message: validation.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- Create admin client for database access ----
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // ---- Fetch aide details ----
    const { data: aide, error: aideError } = await adminClient
      .from("aides")
      .select(`
        id,
        montant,
        date_allocation,
        statut,
        contexte_aide,
        beneficiaire_id,
        type_aide_id,
        association_id,
        beneficiaire:membres!beneficiaire_id(id, nom, prenom, email),
        type_aide:aides_types(nom)
      `)
      .eq("id", aide_id)
      .eq("association_id", association_id)
      .single();

    if (aideError || !aide) {
      console.error("Failed to fetch aide:", aideError);
      return new Response(
        JSON.stringify({ error: "Aide non trouvée", details: aideError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- Fetch association name ----
    const { data: association } = await adminClient
      .from("associations")
      .select("nom")
      .eq("id", association_id)
      .single();

    const associationNom = association?.nom ?? "Association";

    // ---- Build notification data ----
    const beneficiaire = aide.beneficiaire as { nom: string; prenom: string; email: string } | null;
    const typeAide = aide.type_aide as { nom: string } | null;

    const notificationData: NotificationData = {
      beneficiaireNom: beneficiaire?.nom ?? "",
      beneficiairePrenom: beneficiaire?.prenom ?? "",
      montant: aide.montant,
      typeAide: typeAide?.nom ?? "Non défini",
      dateAllocation: aide.date_allocation,
      associationNom,
    };

    // ---- Fetch latest comment from validation history ----
    const { data: latestHistory } = await adminClient
      .from("aides_validation_history")
      .select("commentaire")
      .eq("aide_id", aide_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestHistory?.commentaire) {
      notificationData.commentaire = latestHistory.commentaire;
    }

    // ---- Determine recipient(s) ----
    const template = NOTIFICATION_TEMPLATES[type];
    let recipientEmails: string[] = [];

    if (recipient_id) {
      // Specific recipient provided
      const { data: recipient } = await adminClient
        .from("membres")
        .select("email")
        .eq("id", recipient_id)
        .single();

      if (recipient?.email) {
        recipientEmails.push(recipient.email);
      }
    } else {
      // Default: for aide notifications, send to the beneficiary
      // For appel_de_fonds, send to association admins
      if (type === "appel_de_fonds") {
        const { data: admins } = await adminClient
          .from("user_roles")
          .select(`
            user_id,
            profiles:profiles(email)
          `)
          .eq("association_id", association_id)
          .in("role_name", ["administrateur", "tresorier"]);

        for (const admin of admins ?? []) {
          const profile = admin.profiles as { email: string } | null;
          if (profile?.email) {
            recipientEmails.push(profile.email);
          }
        }
      } else {
        // Aide notifications go to the beneficiary
        if (beneficiaire?.email) {
          recipientEmails.push(beneficiaire.email);
        }

        // Also notify validators for "soumise" type
        if (type === "aide_soumise") {
          const { data: validators } = await adminClient
            .from("user_roles")
            .select(`
              user_id,
              profiles:profiles(email)
            `)
            .eq("association_id", association_id)
            .in("role_name", ["administrateur", "tresorier", "secretaire_general"]);

          for (const v of validators ?? []) {
            const profile = v.profiles as { email: string } | null;
            if (profile?.email && !recipientEmails.includes(profile.email)) {
              recipientEmails.push(profile.email);
            }
          }
        }
      }
    }

    if (recipientEmails.length === 0) {
      console.warn("[send-aide-notification] No recipients found");
      return new Response(
        JSON.stringify({ error: "Aucun destinataire trouvé", warning: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- Build email content ----
    const subject = SUBJECT_TEMPLATES[type](notificationData);
    const bodyHtml = template.bodyHtml(notificationData);
    const htmlContent = buildEmailHtml(template.heading, bodyHtml);

    // ---- Send emails ----
    let sentCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const email of recipientEmails) {
      try {
        const result = await sendEmail(emailConfig, {
          to: email,
          subject,
          html: htmlContent,
        });

        if (!result.success) {
          throw new Error(result.error || "Failed to send email");
        }

        console.log(`[send-aide-notification] Email sent to ${email}`);
        sentCount++;

        // Rate limiting
        await new Promise((resolve) => setTimeout(resolve, 600));
      } catch (emailError: unknown) {
        const message = emailError instanceof Error ? emailError.message : String(emailError);
        console.error(`[send-aide-notification] Error sending to ${email}:`, message);
        errorCount++;
        errors.push(`${email}: ${message}`);
      }
    }

    console.log(
      `[send-aide-notification] Complete: ${sentCount} sent, ${errorCount} errors via ${emailConfig.service}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        sentCount,
        errorCount,
        recipientCount: recipientEmails.length,
        service: emailConfig.service,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[send-aide-notification] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
