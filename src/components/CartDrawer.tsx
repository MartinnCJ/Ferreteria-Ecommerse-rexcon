import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { catalogQueryOptions } from "@/hooks/useCatalog";
import { useCart } from "@/hooks/useCart";
import { useCartPricing } from "@/hooks/useCartPricing";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { supabase } from "@/integrations/supabase/client";
import { userErrorMessage } from "@/lib/errors";
import { money } from "@/lib/format";
import { ProductVisual } from "@/components/ProductVisual";
import { CheckoutModal } from "@/components/CheckoutModal";
import type { QuoteRequestResult } from "@/types";

export function CartDrawer() {
  const cart = useCart();
  const { user, profile } = useAuth();
  const notify = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const { data: catalog } = useQuery(catalogQueryOptions());
  const { prices, subtotal, isLoading, hasError } = useCartPricing(cart.lines);
  const hasPendingCommercialAccess = Boolean(
    profile &&
      ["professional", "company", "wholesale", "distributor"].includes(profile.customer_type) &&
      profile.b2b_status !== "approved",
  );

  const products = useMemo(
    () => new Map((catalog?.products ?? []).map((product) => [product.id, product])),
    [catalog?.products],
  );
  const displaySubtotal = cart.lines.reduce((sum, line) => {
    const product = products.get(line.productId);
    const unitPrice = prices.get(line.productId)?.unit_price ?? product?.retail_price ?? 0;
    return sum + unitPrice * line.quantity;
  }, 0);
  const hasUnavailable = cart.lines.some((line) => {
    const product = products.get(line.productId);
    const available = prices.get(line.productId)?.available_stock ?? product?.available_stock ?? 0;
    return !product || available < line.quantity;
  });

  useEffect(() => {
    if (!catalog || isLoading) return;
    for (const line of cart.lines) {
      const product = products.get(line.productId);
      if (!product) {
        cart.remove(line.productId);
        continue;
      }
      const available = prices.get(line.productId)?.available_stock ?? product.available_stock ?? 0;
      if (available > 0 && line.quantity > available) {
        cart.setQuantity(line.productId, available, available);
      }
    }
  }, [catalog, cart.lines, cart.remove, cart.setQuantity, isLoading, prices, products]);


  const canRequestQuote = Boolean(
    user &&
      profile &&
      profile.b2b_status !== "suspended" &&
      ["professional", "company", "wholesale", "distributor"].includes(profile.customer_type),
  );

  async function requestQuote() {
    if (!user || !canRequestQuote || cart.lines.length === 0 || isLoading || hasError || hasUnavailable) return;
    setQuoting(true);
    try {
      const { data, error } = await supabase.rpc("create_quote_request", {
        _items: cart.lines.map((line) => ({ product_id: line.productId, quantity: line.quantity })),
        _customer_notes: null,
      });
      if (error) throw error;
      const quote = ((data ?? []) as QuoteRequestResult[])[0];
      if (!quote) throw new Error("No pudimos crear la cotización");
      await queryClient.invalidateQueries({ queryKey: ["account-quotes", user.id] });
      notify(`Cotización ${quote.quote_number} creada`);
      cart.setOpen(false);
      void navigate({ to: "/mi-cuenta" });
    } catch (error) {
      notify(userErrorMessage(error, "No pudimos crear la cotización."));
    } finally {
      setQuoting(false);
    }
  }

  if (!cart.open) return null;

  return (
    <>
      <div className="drawer-backdrop" onClick={() => cart.setOpen(false)} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Carrito de compras">
        <header className="drawer-head">
          <b>Tu carrito ({cart.count})</b>
          <button onClick={() => cart.setOpen(false)} aria-label="Cerrar carrito">
            ✕
          </button>
        </header>

        <div className="drawer-body">
          {cart.lines.length === 0 && (
            <div className="empty">
              <div className="empty-icon">🧰</div>
              <p>Tu carrito está vacío</p>
              <Link to="/productos" className="btn primary" onClick={() => cart.setOpen(false)}>
                Ver productos
              </Link>
            </div>
          )}

          {cart.lines.map((line) => {
            const product = products.get(line.productId);
            if (!product) return null;
            const price = prices.get(line.productId);
            const unit = price?.unit_price ?? product.retail_price;
            const max = price?.available_stock ?? product.available_stock ?? 1;
            return (
              <div className="cart-line" key={line.productId}>
                <div className="cart-thumb">
                  <ProductVisual product={product} />
                </div>
                <div className="cart-line-body">
                  <strong>{product.short_name ?? product.name}</strong>
                  <span className="sku">SKU {product.sku}</span>
                  <div className="qty-row">
                    <div className="qty">
                      <button
                        onClick={() => cart.setQuantity(line.productId, line.quantity - 1, max)}
                        aria-label="Quitar una unidad"
                      >
                        −
                      </button>
                      <span>{line.quantity}</span>
                      <button
                        onClick={() => cart.setQuantity(line.productId, line.quantity + 1, max)}
                        aria-label="Agregar una unidad"
                        disabled={line.quantity >= max}
                      >
                        ＋
                      </button>
                    </div>
                    <div className="line-total">
                      <b>{hasPendingCommercialAccess ? "Por confirmar" : isLoading ? "…" : money(unit * line.quantity)}</b>
                      <small>{hasPendingCommercialAccess ? "Cotización comercial" : `${money(unit)} c/u`}</small>
                    </div>
                  </div>
                  <button className="link-danger" onClick={() => cart.remove(line.productId)}>
                    Eliminar
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {cart.lines.length > 0 && (
          <footer className="drawer-foot">
            <div className="row">
              <span>Subtotal</span>
              <b>{hasPendingCommercialAccess ? "Por confirmar" : isLoading ? "Calculando..." : money(displaySubtotal)}</b>
            </div>
            <div className="row">
              <span>Despacho</span>
              <b>Según región</b>
            </div>
            <small className="hint">El costo de despacho se calcula con la región y comuna en el checkout.</small>
            {hasError && <div className="pending-box">No pudimos validar uno o más precios. Intenta nuevamente.</div>}
            {hasUnavailable && <div className="pending-box">Ajustamos o detectamos productos sin stock suficiente.</div>}
            {hasPendingCommercialAccess && <div className="pending-box">Tu cuenta comercial está en revisión. Solicita una cotización mientras activamos tus precios.</div>}
            <button
              className="btn primary block"
              onClick={() => setCheckoutOpen(true)}
              disabled={hasPendingCommercialAccess || isLoading || hasError || hasUnavailable}
            >
              {hasPendingCommercialAccess ? "Precios en revisión" : isLoading ? "Validando precios…" : "Continuar"}
            </button>
            {canRequestQuote && (
              <button
                className="btn secondary block"
                onClick={() => void requestQuote()}
                disabled={quoting || isLoading || hasError || hasUnavailable}
              >
                {quoting ? "Creando cotización…" : "Solicitar cotización"}
              </button>
            )}
            {!user && (
              <Link to="/auth" className="btn ghost block" onClick={() => cart.setOpen(false)}>
                Ingresar para precios comerciales
              </Link>
            )}
          </footer>
        )}
      </aside>

      {checkoutOpen && (
        <CheckoutModal subtotal={subtotal} onClose={() => setCheckoutOpen(false)} />
      )}
    </>
  );
}
