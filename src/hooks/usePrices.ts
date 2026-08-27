import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { ResolvedPrice } from "@/types";

/**
 * Precio autoritativo: lo calcula la base de datos según el tipo de cliente,
 * su aprobación comercial y la cantidad. El navegador nunca decide el precio.
 */
export function usePrices(productIds: string[], quantity = 1) {
  const { session, loading } = useAuth();
  const ids = [...productIds].sort();

  const query = useQuery({
    queryKey: ["prices", session?.user?.id ?? "guest", quantity, ids.join(",")],
    enabled: !loading && ids.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("resolve_prices", {
        _product_ids: ids,
        _quantity: quantity,
      });
      if (error) throw error;
      const map = new Map<string, ResolvedPrice>();
      for (const row of (data ?? []) as ResolvedPrice[]) map.set(row.product_id, row);
      return map;
    },
  });

  return {
    prices: query.data ?? new Map<string, ResolvedPrice>(),
    isLoading: query.isLoading,
    error: query.error,
  };
}
