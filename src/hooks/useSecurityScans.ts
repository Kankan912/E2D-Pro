import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface SecurityScan {
  id: string;
  scan_date: string;
  critical_count: number;
  warning_count: number;
  info_count: number;
  summary: string | null;
  report_url: string | null;
  created_by: string | null;
  created_at: string;
}

export const useLatestSecurityScan = () => {
  return useQuery({
    queryKey: ["security-scans", "latest"],
    queryFn: async (): Promise<SecurityScan | null> => {
      const { data, error } = await (supabase as unknown)
        .from('security_scans').select('id, scan_type, result, vulnerabilities, created_at')
        .order("scan_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
};

export const useSecurityScans = () => {
  return useQuery({
    queryKey: ["security-scans", "all"],
    queryFn: async (): Promise<SecurityScan[]> => {
      const { data, error } = await (supabase as unknown)
        .from('security_scans').select('id, scan_type, result, vulnerabilities, created_at')
        .order("scan_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
};

export const useCreateSecurityScan = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: {
      critical_count: number;
      warning_count: number;
      info_count: number;
      summary?: string;
      report_url?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Non authentifié");
      const { data, error } = await (supabase as unknown)
        .from("security_scans")
        .insert({ ...input, created_by: uid })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["security-scans"] });
      toast({ title: "Scan enregistré", description: "Statut de sécurité mis à jour." });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    },
  });
};
