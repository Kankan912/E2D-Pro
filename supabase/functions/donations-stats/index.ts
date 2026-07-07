import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Verify user is admin or tresorier
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      console.log("No authenticated user found");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("User authenticated:", user.id);

    // Check user role from user_roles table joined with roles
    const { data: userRolesData, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("role_id, roles(name)")
      .eq("user_id", user.id);

    if (roleError) {
      console.log("Role query error:", roleError);
    }

    console.log("User roles data:", userRolesData);

    // Check if user has admin or tresorier role
    const allowedRoles = ["admin", "tresorier", "administrateur"];
    const userRoleNames = userRolesData?.map((ur) => {
      const roleData = ur.roles as { name?: string } | null;
      return roleData?.name?.toLowerCase();
    }).filter(Boolean) as string[] || [];
    const hasAllowedRole = userRoleNames.some((role) => allowedRoles.includes(role));
    
    if (!hasAllowedRole) {
      console.log("User roles not allowed:", userRoleNames);
      return new Response(JSON.stringify({ error: "Forbidden", roles: userRoleNames }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("User authorized with roles:", userRoleNames);

    const { period } = await req.json();

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Current month stats
    const startOfMonth = new Date(currentYear, currentMonth, 1).toISOString();
    const startOfLastMonth = new Date(currentYear, currentMonth - 1, 1).toISOString();
    const endOfLastMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59).toISOString();

    const { data: currentMonthDonations } = await supabaseClient
      .from("donations")
      .select("amount, donor_email")
      .gte("created_at", startOfMonth)
      .eq("payment_status", "completed");

    const { data: lastMonthDonations } = await supabaseClient
      .from("donations")
      .select("amount")
      .gte("created_at", startOfLastMonth)
      .lte("created_at", endOfLastMonth)
      .eq("payment_status", "completed");

    const currentMonthTotal = currentMonthDonations?.reduce((sum, d) => sum + Number(d.amount), 0) || 0;
    const lastMonthTotal = lastMonthDonations?.reduce((sum, d) => sum + Number(d.amount), 0) || 0;
    const monthTrend = lastMonthTotal > 0 ? ((currentMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 : 0;

    const uniqueDonors = new Set(currentMonthDonations?.map((d) => d.donor_email) || []).size;

    // Current year stats
    const startOfYear = new Date(currentYear, 0, 1).toISOString();
    const startOfLastYear = new Date(currentYear - 1, 0, 1).toISOString();
    const endOfLastYear = new Date(currentYear - 1, 11, 31, 23, 59, 59).toISOString();

    const { data: currentYearDonations } = await supabaseClient
      .from("donations")
      .select("amount")
      .gte("created_at", startOfYear)
      .eq("payment_status", "completed");

    const { data: lastYearDonations } = await supabaseClient
      .from("donations")
      .select("amount")
      .gte("created_at", startOfLastYear)
      .lte("created_at", endOfLastYear)
      .eq("payment_status", "completed");

    const currentYearTotal = currentYearDonations?.reduce((sum, d) => sum + Number(d.amount), 0) || 0;
    const lastYearTotal = lastYearDonations?.reduce((sum, d) => sum + Number(d.amount), 0) || 0;
    const yearTrend = lastYearTotal > 0 ? ((currentYearTotal - lastYearTotal) / lastYearTotal) * 100 : 0;

    const average = currentMonthDonations?.length ? currentMonthTotal / currentMonthDonations.length : 0;

    const stats = {
      currentMonth: {
        total: Math.round(currentMonthTotal * 100) / 100,
        trend: Math.round(monthTrend * 10) / 10,
        donors: uniqueDonors,
        newDonors: 0,
        average: Math.round(average * 100) / 100,
        averageTrend: 0,
      },
      currentYear: {
        total: Math.round(currentYearTotal * 100) / 100,
        trend: Math.round(yearTrend * 10) / 10,
      },
    };

    console.log("Returning stats:", stats);

    return new Response(JSON.stringify(stats), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in donations-stats:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
