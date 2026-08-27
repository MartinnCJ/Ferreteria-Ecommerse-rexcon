import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ShippingQuote } from "@/types";

/**
 * Estimación de despacho desde Supabase. Es solo informativa: create_bank_transfer_order
 * vuelve a calcularla dentro de la misma transacción que reserva el inventario.
 */
export function useShippingQuote(region: string, commune: string, subtotal: number) {
  return useQuery({
    queryKey: ["shipping-quote", region.trim().toLowerCase(), commune.trim().toLowerCase(), subtotal],
    enabled: Boolean(region.trim()) && subtotal > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("resolve_shipping", {
        _region: region,
        _commune: commune || null,
        _subtotal: Math.max(0, Math.round(subtotal)),
      });
      if (error) throw error;
      return ((data ?? []) as ShippingQuote[])[0] ?? null;
    },
  });
}
