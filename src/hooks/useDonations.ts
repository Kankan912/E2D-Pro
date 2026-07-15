import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
// Phase 2-b (Task 15) — tenant-scoped cache keys via AuthContext.profile.association_id.
import { useAssociation } from "@/hooks/useAssociation";

interface DonationFilters {
  startDate?: string;
  endDate?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  isRecurring?: boolean;
}

export const useDonations = (filters?: DonationFilters) => {
  // Phase 2-b (Task 15) — tenant-scoped cache key. RLS filters server-side;
  // we add associationId here so different tenants get separate cache entries.
  const { associationId } = useAssociation();
  return useQuery({
    queryKey: ["donations", associationId, filters],
    queryFn: async () => {
      let query = supabase
        .from('donations').select('id, donor_name, donor_email, donor_phone, amount, currency, status, payment_method, association_id, created_at')
        .order("created_at", { ascending: false });

      if (filters?.startDate) {
        query = query.gte("created_at", filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte("created_at", filters.endDate);
      }
      if (filters?.paymentMethod && filters.paymentMethod !== "all") {
        query = query.eq("payment_method", filters.paymentMethod);
      }
      if (filters?.paymentStatus && filters.paymentStatus !== "all") {
        query = query.eq("payment_status", filters.paymentStatus);
      }
      if (filters?.isRecurring !== undefined) {
        query = query.eq("is_recurring", filters.isRecurring);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
  });
};

export const useDonationStats = (period: "month" | "year" = "month") => {
  return useQuery({
    queryKey: ["donation-stats", period],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("donations-stats", {
        body: { period },
      });

      if (error) {
        const errorMessage = data?.error || error.message;
        throw new Error(errorMessage);
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
  });
};

export const useMobileMoneyDonations = (status?: string) => {
  // Phase 2-b (Task 15) — tenant-scoped cache key.
  const { associationId } = useAssociation();
  return useQuery({
    queryKey: ["mobile-money-donations", associationId, status],
    queryFn: async () => {
      let query = supabase
        .from('donations').select('id, donor_name, donor_email, donor_phone, amount, currency, status, payment_method, association_id, created_at')
        .in("payment_method", ["orange_money", "mtn_money"])
        .order("created_at", { ascending: false });

      if (status) {
        query = query.eq("payment_status", status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
};
