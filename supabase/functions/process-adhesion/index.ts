import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { escapeHtml } from '../_shared/email-utils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://e2d-pro.vercel.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Template email de bienvenue
const getWelcomeEmailHtml = (prenom: string, nom: string, typeAdhesion: string, appUrl: string) => {
  const typeName = typeAdhesion === 'e2d' ? 'E2D' : 
                   typeAdhesion === 'phoenix' ? 'Phoenix' : 
                   typeAdhesion === 'both' ? 'E2D et Phoenix' : typeAdhesion;
  
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenue à E2D</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 0;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header avec logo -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                🎉 Bienvenue à l'Association E2D !
              </h1>
            </td>
          </tr>
          
          <!-- Contenu principal -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="font-size: 18px; color: #1f2937; margin: 0 0 20px 0;">
                Bonjour <strong>${prenom} ${nom}</strong>,
              </p>
              
              <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
                Nous sommes ravis de vous accueillir parmi les membres de l'<strong>Association E2D</strong> ! 
                Votre adhésion <strong>${typeName}</strong> a été confirmée avec succès.
              </p>
              
              <!-- Carte d'information -->
              <table role="presentation" style="width: 100%; background-color: #f0f9ff; border-radius: 8px; margin: 24px 0;">
                <tr>
                  <td style="padding: 24px;">
                    <h3 style="margin: 0 0 16px 0; color: #1e40af; font-size: 16px;">
                      📋 Votre adhésion
                    </h3>
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Type d'adhésion</td>
                        <td style="padding: 8px 0; color: #1f2937; font-size: 14px; text-align: right; font-weight: 600;">${typeName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Statut</td>
                        <td style="padding: 8px 0; text-align: right;">
                          <span style="background-color: #10b981; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">✓ Actif</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
                En tant que membre, vous avez désormais accès à :
              </p>
              
              <ul style="color: #4b5563; font-size: 15px; line-height: 2; padding-left: 24px; margin: 0 0 24px 0;">
                <li>Votre espace membre personnel</li>
                <li>Les réunions et événements de l'association</li>
                <li>Les activités sportives E2D et Phoenix</li>
                <li>Le système d'épargne et de prêts solidaires</li>
              </ul>
              
              <!-- Bouton CTA -->
              <table role="presentation" style="width: 100%; margin: 32px 0;">
                <tr>
                  <td style="text-align: center;">
                    <a href="${appUrl}/dashboard" style="display: inline-block; background-color: #1e40af; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      Accéder à mon espace membre
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin: 0;">
                Si vous avez des questions, n'hésitez pas à nous contacter ou à participer à notre prochaine réunion !
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">
                Association E2D - Ensemble pour le Développement et le Dynamisme
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                © ${new Date().getFullYear()} Association E2D. Tous droits réservés.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ---- Auth verification ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid Authorization header" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Validate JWT by calling Supabase auth
    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: invalid or expired token" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // ---- Input validation ----
    let body: { adhesion_id?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid request body: expected JSON" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { adhesion_id } = body;

    if (!adhesion_id || typeof adhesion_id !== "string" || adhesion_id.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid adhesion_id (expected non-empty string)" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Processing adhesion:', adhesion_id, 'by user:', user.id);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Récupérer l'adhésion
    const { data: adhesion, error: adhesionError } = await supabaseClient
      .from('adhesions')
      .select('*')
      .eq('id', adhesion_id)
      .single();

    if (adhesionError) {
      console.error('Error fetching adhesion:', adhesionError);
      throw adhesionError;
    }

    // SECURITY (Audit Fix #5 / P0): ownership / RBAC check.
    // The caller must EITHER be the owner of this adhesion (user_id match)
    // OR be an admin. Without this, any authenticated user could process
    // (validate / reject / re-trigger) someone else's adhesion.
    const isOwner = adhesion.user_id && adhesion.user_id === user.id;
    if (!isOwner) {
      const { data: isAdmin } = await supabaseClient
        .rpc('is_admin', { _user_id: user.id })
        .catch(() => ({ data: false }));
      if (!isAdmin) {
        console.error('[process-adhesion] Forbidden: caller is neither owner nor admin', {
          caller: user.id,
          adhesion_owner: adhesion.user_id,
          adhesion_id,
        });
        return new Response(
          JSON.stringify({ error: 'Forbidden — vous ne pouvez traiter que votre propre adhésion' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Vérifier si l'adhésion n'est pas déjà traitée
    if (adhesion.processed) {
      console.log('Adhesion already processed:', adhesion_id);
      return new Response(
        JSON.stringify({ error: 'Adhésion déjà traitée' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Si le paiement est complété, créer le membre
    if (adhesion.payment_status === 'completed') {
      console.log('Creating member for:', adhesion.prenom, adhesion.nom);
      
      const { data: membre, error: membreError } = await supabaseClient
        .from('membres')
        .insert([
          {
            nom: adhesion.nom,
            prenom: adhesion.prenom,
            telephone: adhesion.telephone,
            email: adhesion.email,
            est_membre_e2d: adhesion.type_adhesion === 'e2d' || adhesion.type_adhesion === 'both',
            est_adherent_phoenix: adhesion.type_adhesion === 'phoenix' || adhesion.type_adhesion === 'both',
            statut: 'actif',
          },
        ])
        .select()
        .single();

      if (membreError) {
        console.error('Error creating member:', membreError);
        throw membreError;
      }

      console.log('Member created:', membre.id);

      // Mettre à jour l'adhésion avec le membre_id
      const { error: updateError } = await supabaseClient
        .from('adhesions')
        .update({
          membre_id: membre.id,
          processed: true,
        })
        .eq('id', adhesion_id);

      if (updateError) {
        console.error('Error updating adhesion:', updateError);
        throw updateError;
      }

      // Envoyer email de bienvenue via la fonction send-email
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (resendApiKey && adhesion.email) {
        try {
          // Récupérer l'URL de l'app depuis la config
          const { data: appUrlConfig } = await supabaseClient
            .from('configurations')
            .select('valeur')
            .eq('cle', 'app_url')
            .single();
          
          const appUrl = appUrlConfig?.valeur || Deno.env.get('APP_URL') || 'https://e2d.app';
          
          const emailHtml = getWelcomeEmailHtml(
            escapeHtml(adhesion.prenom ?? ""),
            escapeHtml(adhesion.nom ?? ""),
            adhesion.type_adhesion,
            appUrl
          );

          // Appeler la fonction send-email existante
          const { error: emailError } = await supabaseClient.functions.invoke('send-email', {
            body: {
              to: adhesion.email,
              subject: '🎉 Bienvenue à l\'Association E2D !',
              html: emailHtml
            }
          });

          if (emailError) {
            console.error('Error sending welcome email:', emailError);
          } else {
            console.log('Welcome email sent to:', adhesion.email);
          }
        } catch (emailError) {
          console.error('Error sending welcome email:', emailError);
          // Ne pas échouer la fonction si l'email échoue
        }
      } else {
        console.log('Skipping email: RESEND_API_KEY not configured or no email');
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Adhésion traitée avec succès' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error processing adhesion:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});