import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CartLine } from "@/types";

const STORAGE_KEY = "rexcon_cart_v3";
const LEGACY_STORAGE_KEYS = ["nexo_cart_v3"];

interface CartValue {
  lines: CartLine[];
  count: number;
  open: boolean;
  setOpen: (open: boolean) => void;
  add: (productId: string, quantity: number, max: number) => void;
  setQuantity: (productId: string, quantity: number, max: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [open, setOpen] = useState(false);

  // El carrito solo se lee en el cliente (evita desajustes de hidratación).
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) ?? LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean) ?? "[]";
      const saved: unknown = JSON.parse(stored);
      if (Array.isArray(saved)) {
        const deduped = new Map<string, number>();
        for (const item of saved) {
          if (!item || typeof item !== "object") continue;
          const productId = "productId" in item && typeof item.productId === "string" ? item.productId : "";
          const rawQuantity = "quantity" in item && typeof item.quantity === "number" ? item.quantity : 0;
          const quantity = Math.min(9999, Math.max(1, Math.floor(rawQuantity)));
          if (!productId || !Number.isFinite(quantity)) continue;
          deduped.set(productId, Math.min(9999, (deduped.get(productId) ?? 0) + quantity));
        }
        const restored = [...deduped].map(([productId, quantity]) => ({ productId, quantity }));
        setLines(restored);
        if (!localStorage.getItem(STORAGE_KEY) && restored.length) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(restored));
        }
      }
    } catch {
      /* almacenamiento no disponible */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* almacenamiento no disponible */
    }
  }, [lines]);

  const add = useCallback((productId: string, quantity: number, max: number) => {
    setLines((prev) => {
      if (!productId || !Number.isFinite(quantity) || !Number.isFinite(max) || max <= 0) return prev;
      const existing = prev.find((line) => line.productId === productId);
      const limit = Math.max(1, Math.floor(max));
      if (existing) {
        return prev.map((line) =>
          line.productId === productId
            ? { ...line, quantity: Math.min(limit, line.quantity + quantity) }
            : line,
        );
      }
      return [...prev, { productId, quantity: Math.min(limit, Math.max(1, quantity)) }];
    });
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number, max: number) => {
    if (!productId || !Number.isFinite(quantity) || !Number.isFinite(max)) return;
    setLines((prev) =>
      quantity <= 0
        ? prev.filter((line) => line.productId !== productId)
        : prev.map((line) =>
            line.productId === productId
              ? { ...line, quantity: Math.min(Math.max(1, max), quantity) }
              : line,
          ),
    );
  }, []);

  const remove = useCallback(
    (productId: string) => setLines((prev) => prev.filter((l) => l.productId !== productId)),
    [],
  );

  const clear = useCallback(() => setLines([]), []);

  const count = useMemo(() => lines.reduce((sum, line) => sum + line.quantity, 0), [lines]);

  return (
    <CartContext.Provider value={{ lines, count, open, setOpen, add, setQuantity, remove, clear }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de CartProvider");
  return ctx;
}
