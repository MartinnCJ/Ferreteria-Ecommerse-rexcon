import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { CartLine, ResolvedPrice } from "@/types";

/**
 * Resuelve todo el carrito en una sola llamada protegida. La base de datos
 * calcula el tier efectivo y el tramo por volumen de cada SKU.
 */
export function useCartPricing(lines: CartLine[]) {
  const { session, loading } = useAuth();
  const userKey = session?.user?.id ?? "guest";
  const normalizedLines = [...lines]
    .map((line) => ({ productId: line.productId, quantity: line.quantity }))
    .sort((a, b) => a.productId.localeCompare(b.productId));

  const query = useQuery({
    queryKey: ["cart-prices", userKey, normalizedLines],
    enabled: !loading && normalizedLines.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("resolve_cart_prices", {
        _items: normalizedLines.map((line) => ({
          product_id: line.productId,
          quantity: line.quantity,
        })),
      });
      if (error) throw error;
      return (data ?? []) as ResolvedPrice[];
    },
  });

  const prices = new Map<string, ResolvedPrice>();
  for (const price of query.data ?? []) prices.set(price.product_id, price);

  const subtotal = lines.reduce((sum, line) => {
    const price = prices.get(line.productId);
    return sum + (price ? price.unit_price * line.quantity : 0);
  }, 0);

  return {
    prices,
    subtotal,
    isLoading: loading || (lines.length > 0 && query.isLoading),
    hasError: query.isError,
  };
}
