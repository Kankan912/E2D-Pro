import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmailAuto } from "../_shared/email-utils.ts";
import { notifyInApp, notifyManyInApp } from "../_shared/in-app-notify.ts";
import { requirePrivilegedUser } from "../_shared/auth-check.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type EventType =
  | "created"
  | "step_validated"
  | "rejected"
  | "final_approved"
  | "cancelled"
  | "disbursed"
  | "avaliste_request"
  | "avaliste_approved"
  | "avaliste_rejected";

interface Payload {
  request_id: string;
  event: EventType;
  step_label?: string;
  validator_name?: string;
  motif?: string;
}

const APP_URL = Deno.env.get("APP_URL") ?? "";

function fmtMontant(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.floor(n)) + " FCFA";
}

function htmlShell(title: string, body: string) {
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;color:#222;">
    <h2 style="color:#1a56db;margin:0 0 16px;">${title}</h2>
    ${body}
    <hr style="margin:24px 0;border:none;border-top:1px solid #eee;"/>
    <p style="font-size:12px;color:#888;">Email automatique — Ne pas répondre.</p>
  </body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // ---- Auth check: require privileged user ----
  const authResponse = await requirePrivilegedUser(req, corsHeaders);
  if (authResponse) return authResponse;

  try {
    const payload: Payload = await req.json();
    if (!payload?.request_id || !payload?.event) {
      return new Response(JSON.stringify({ error: "Payload invalide" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Charge la demande complète + user_id du demandeur (via membres)
    const { data: request, error: errReq } = await supabase
      .from("loan_requests")
      .select(
        "id, montant, description, urgence, duree_mois, statut, motif_rejet, membre_id, avaliste_id, avaliste_self, avaliste_motif_refus, membres!loan_requests_membre_id_fkey(nom, prenom, user_id), avaliste:membres!loan_requests_avaliste_id_fkey(nom, prenom, user_id, email)",
      )
      .eq("id", payload.request_id)
      .single();

    if (errReq || !request) {
      return new Response(JSON.stringify({ error: "Demande introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const m = (request as any).membres ?? {};
    const membreNom = `${m.prenom ?? ""} ${m.nom ?? ""}`.trim() || "Membre";
    const memberUserId: string | null = m.user_id ?? null;
    const montantFmt = fmtMontant(Number(request.montant));

    const recap = `
      <p><strong>Demandeur :</strong> ${membreNom}</p>
      <p><strong>Montant :</strong> ${montantFmt}</p>
      <p><strong>Durée :</strong> ${request.duree_mois} mois</p>
      <p><strong>Urgence :</strong> ${request.urgence}</p>
      <p><strong>Description :</strong> ${request.description}</p>
    `;

    const link = APP_URL
      ? `<p><a href="${APP_URL}/dashboard" style="background:#1a56db;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Ouvrir l'application</a></p>`
      : "";

    const sent: string[] = [];
    const failed: string[] = [];

    const avaliste = (request as any).avaliste ?? null;

    // ----- Branch: events AVALISTE -----
    if (payload.event === "avaliste_request") {
      if (avaliste?.email) {
        const subject = `Vous êtes désigné avaliste — Demande de prêt de ${membreNom}`;
        const body = `<p>Bonjour ${avaliste.prenom ?? ""},</p>
          <p>Le membre <strong>${membreNom}</strong> vous a désigné comme <strong>avaliste (garant)</strong> pour sa demande de prêt.</p>
          ${recap}
          <p>Veuillez vous connecter à l'application pour <strong>approuver</strong> ou <strong>refuser</strong> cette demande.</p>${link}`;
        const r = await sendEmailAuto({ to: avaliste.email, subject, html: htmlShell(subject, body) });
        (r.success ? sent : failed).push(avaliste.email);
      }
      if (avaliste?.user_id) {
        await notifyInApp({
          user_id: avaliste.user_id,
          type: "loan_avaliste_request",
          title: `Vous êtes désigné avaliste — ${membreNom}`,
          body: `${montantFmt} • ${request.duree_mois} mois`,
          link: "/dashboard/mes-avalisations",
          dedupe_key: `${payload.request_id}:avaliste_request`,
          metadata: { request_id: payload.request_id },
        }, supabase);
      }
      return new Response(JSON.stringify({ success: true, sent, failed, event: payload.event }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payload.event === "avaliste_approved" || payload.event === "avaliste_rejected") {
      const isApproved = payload.event === "avaliste_approved";
      const subject = isApproved
        ? `Votre avaliste a approuvé votre demande de prêt`
        : `Votre avaliste a refusé votre demande de prêt`;
      const avalisteName = avaliste ? `${avaliste.prenom ?? ""} ${avaliste.nom ?? ""}`.trim() : "votre avaliste";
      const body = isApproved
        ? `<p>Bonjour ${m.prenom ?? membreNom},</p>
            <p><strong>${avalisteName}</strong> a <strong>approuvé</strong> votre demande de prêt. Le workflow de validation se poursuit.</p>${recap}${link}`
        : `<p>Bonjour ${m.prenom ?? membreNom},</p>
            <p><strong>${avalisteName}</strong> a <strong>refusé</strong> de se porter avaliste pour votre demande de prêt.</p>
            <p><strong>Motif :</strong> ${payload.motif ?? (request as any).avaliste_motif_refus ?? "—"}</p>${recap}${link}`;
      // Email demandeur
      const { data: rows } = await supabase.rpc("get_loan_request_member_email", { _request_id: payload.request_id });
      const member = (rows ?? [])[0] as { email: string; nom: string; prenom: string } | undefined;
      if (member?.email) {
        const r = await sendEmailAuto({ to: member.email, subject, html: htmlShell(subject, body) });
        (r.success ? sent : failed).push(member.email);
      }
      if (memberUserId) {
        await notifyInApp({
          user_id: memberUserId,
          type: isApproved ? "loan_avaliste_approved" : "loan_avaliste_rejected",
          title: subject,
          body: isApproved ? `${montantFmt} • ${request.duree_mois} mois` : `Motif : ${payload.motif ?? "—"}`,
          link: "/dashboard/mes-demandes-pret",
          dedupe_key: `${payload.request_id}:${payload.event}`,
          metadata: { request_id: payload.request_id },
        }, supabase);
      }
      return new Response(JSON.stringify({ success: true, sent, failed, event: payload.event }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    if (payload.event === "created" || payload.event === "cancelled") {
      const { data: validators } = await supabase.rpc(
        "get_loan_request_validators_emails",
        { _request_id: payload.request_id },
      );
      const validatorRows = (validators ?? []) as Array<{ email: string }>;
      const recipients = Array.from(
        new Set(validatorRows.map((v) => v.email).filter(Boolean)),
      );

      const isCancelled = payload.event === "cancelled";
      const subject = isCancelled
        ? `Demande de prêt annulée — ${membreNom}`
        : `Nouvelle demande de prêt — ${membreNom}`;
      const intro = isCancelled
        ? `<p>Le membre <strong>${membreNom}</strong> a <strong>annulé</strong> sa demande de prêt. Aucune action n'est requise de votre part.</p>`
        : `<p>Une nouvelle demande de prêt a été soumise et requiert validation.</p>`;
      const html = htmlShell(
        isCancelled ? "Demande de prêt annulée" : "Nouvelle demande de prêt",
        `${intro}${recap}${link}`,
      );

      for (const to of recipients) {
        const r = await sendEmailAuto({ to, subject, html });
        (r.success ? sent : failed).push(to);
      }

      // In-app: récupérer les user_id des validateurs via leur email
      try {
        const emails = recipients;
        if (emails.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, email")
            .in("email", emails);
          const inAppInputs = (profs ?? [])
            .filter((p: any) => !!p.id)
            .map((p: any) => ({
              user_id: p.id as string,
              type: isCancelled ? "loan_cancelled" : "loan_request_submitted",
              title: isCancelled
                ? `Demande de prêt annulée — ${membreNom}`
                : `Nouvelle demande de prêt — ${membreNom}`,
              body: `${montantFmt} • ${request.duree_mois} mois${request.urgence === "urgent" ? " • Urgent" : ""}`,
              link: "/dashboard/admin/finances/demandes-prets",
              dedupe_key: `${payload.request_id}:${isCancelled ? "cancelled" : "submitted"}`,
              metadata: { request_id: payload.request_id },
            }));
          await notifyManyInApp(inAppInputs, supabase);
        }
      } catch (e) {
        console.error("[send-loan-notification] in-app validators failed:", e);
      }
    } else {
      // ----- Branch: events ciblés MEMBRE -----
      const { data: rows } = await supabase.rpc("get_loan_request_member_email", {
        _request_id: payload.request_id,
      });
      const member = (rows ?? [])[0] as
        | { email: string; nom: string; prenom: string }
        | undefined;

      let subject = "";
      let body = "";
      let inAppTitle = "";
      let inAppType = "";

      if (payload.event === "step_validated") {
        subject = `Votre demande de prêt a été validée par ${payload.step_label ?? "un validateur"}`;
        inAppTitle = `Étape validée — ${payload.step_label ?? "validateur"}`;
        inAppType = "loan_validated";
        body = `<p>Bonjour ${member?.prenom ?? membreNom},</p>
          <p>Votre demande de prêt a été <strong>validée</strong> par <em>${payload.step_label ?? ""}</em>${payload.validator_name ? ` (${payload.validator_name})` : ""}.</p>
          ${recap}
          <p>Le processus de validation se poursuit.</p>${link}`;
      } else if (payload.event === "rejected") {
        subject = `Votre demande de prêt a été rejetée`;
        inAppTitle = `Demande de prêt rejetée`;
        inAppType = "loan_rejected";
        body = `<p>Bonjour ${member?.prenom ?? membreNom},</p>
          <p>Votre demande de prêt a été <strong>rejetée</strong> à l'étape <em>${payload.step_label ?? ""}</em>${payload.validator_name ? ` par ${payload.validator_name}` : ""}.</p>
          <p><strong>Motif :</strong> ${payload.motif ?? request.motif_rejet ?? "—"}</p>
          ${recap}${link}`;
      } else if (payload.event === "final_approved") {
        subject = `Votre prêt est approuvé`;
        inAppTitle = `Prêt approuvé — en attente de décaissement`;
        inAppType = "loan_validated";
        body = `<p>Bonjour ${member?.prenom ?? membreNom},</p>
          <p>Bonne nouvelle : votre demande de prêt a été <strong>entièrement approuvée</strong>.</p>
          ${recap}
          <p>Veuillez vous rapprocher du <strong>trésorier</strong> pour le décaissement.</p>${link}`;
      } else if (payload.event === "disbursed") {
        subject = `Votre prêt a été décaissé`;
        inAppTitle = `Prêt décaissé — ${montantFmt}`;
        inAppType = "loan_disbursed";
        body = `<p>Bonjour ${member?.prenom ?? membreNom},</p>
          <p>Votre prêt de <strong>${montantFmt}</strong> a été <strong>décaissé</strong>. Vous pouvez en consulter le détail depuis votre espace.</p>
          ${recap}${link}`;
      }

      if (member?.email && subject) {
        const r = await sendEmailAuto({
          to: member.email,
          subject,
          html: htmlShell(subject, body),
        });
        (r.success ? sent : failed).push(member.email);
      }

      // In-app pour le demandeur
      if (memberUserId && inAppType) {
        const dedupeSuffix =
          payload.event === "step_validated"
            ? `step:${payload.step_label ?? "x"}`
            : payload.event;
        await notifyInApp(
          {
            user_id: memberUserId,
            type: inAppType,
            title: inAppTitle,
            body:
              payload.event === "rejected"
                ? `Motif : ${payload.motif ?? request.motif_rejet ?? "—"}`
                : `${montantFmt} • ${request.duree_mois} mois`,
            link:
              payload.event === "disbursed"
                ? "/dashboard/mes-prets"
                : "/dashboard/mes-demandes-pret",
            dedupe_key: `${payload.request_id}:${dedupeSuffix}`,
            metadata: { request_id: payload.request_id },
          },
          supabase,
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, failed, event: payload.event }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[send-loan-notification] error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
