import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useShippingQuote } from "@/hooks/useShippingQuote";
import { useToast } from "@/hooks/useToast";
import { formatRut, isValidRut, money } from "@/lib/format";
import { userErrorMessage } from "@/lib/errors";
import { CHILE_REGIONS, type CheckoutResult } from "@/types";

/**
 * Checkout por transferencia. El frontend recoge datos y muestra una estimación,
 * pero Supabase vuelve a calcular precios, despacho y stock de forma transaccional.
 */
export function CheckoutModal({ subtotal, onClose }: { subtotal: number; onClose: () => void }) {
  const { profile, user } = useAuth();
  const cart = useCart();
  const notify = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [idempotencyKey] = useState(
    () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const [form, setForm] = useState({
    name: [profile?.first_name, profile?.last_name].filter(Boolean).join(" "),
    email: profile?.email ?? user?.email ?? "",
    phone: profile?.phone ?? "",
    rut: profile?.rut ?? "",
    address: "",
    city: "",
    region: "Metropolitana",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const shippingQuote = useShippingQuote(form.region, form.city, subtotal);
  const shipping = shippingQuote.data?.shipping_total ?? null;
  const total = shipping === null ? subtotal : subtotal + shipping;

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;

    const next: Record<string, string> = {};
    if (form.name.trim().length < 3) next.name = "Ingresa tu nombre completo";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Correo inválido";
    if (form.phone.replace(/\D/g, "").length < 8) next.phone = "Teléfono inválido";
    if (!isValidRut(form.rut)) next.rut = "RUT inválido";
    if (form.address.trim().length < 5) next.address = "Ingresa la dirección de despacho";
    if (form.city.trim().length < 2) next.city = "Ingresa la comuna";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("create_bank_transfer_order", {
        _items: cart.lines.map((line) => ({ product_id: line.productId, quantity: line.quantity })),
        _customer: {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          rut: form.rut.trim(),
          address: form.address.trim(),
          city: form.city.trim(),
          region: form.region,
        },
        _idempotency_key: idempotencyKey,
      });
      if (error) throw error;

      const order = ((data ?? []) as CheckoutResult[])[0];
      if (!order) throw new Error("No recibimos la confirmación del pedido.");

      cart.clear();
      cart.setOpen(false);
      onClose();
      notify(`${order.order_number} creado. Stock reservado por 24 horas.`);
      void navigate({ to: "/mi-cuenta" });
    } catch (error) {
      notify(userErrorMessage(error, "No pudimos crear el pedido."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Checkout">
        <header className="modal-head">
          <b>Confirmar pedido</b>
          <button onClick={onClose} aria-label="Cerrar" disabled={busy}>✕</button>
        </header>

        {!user ? (
          <div className="modal-body empty-state">
            <span>🔐</span>
            <h2>Ingresa para continuar</h2>
            <p>Tu carrito queda guardado en este navegador mientras inicias sesión.</p>
            <Link
              to="/auth"
              search={{ modo: "ingreso", redirect: "/productos" }}
              className="btn primary"
              onClick={() => {
                cart.setOpen(false);
                onClose();
              }}
            >
              Ingresar o crear cuenta
            </Link>
          </div>
        ) : (
          <form className="modal-body form-grid" onSubmit={submit}>
            <label>
              Nombre completo
              <input autoComplete="name" value={form.name} onChange={(e) => update("name", e.target.value)} />
              {errors.name && <em>{errors.name}</em>}
            </label>
            <label>
              RUT
              <input autoComplete="off" value={form.rut} onChange={(e) => update("rut", formatRut(e.target.value))} placeholder="12.345.678-5" />
              {errors.rut && <em>{errors.rut}</em>}
            </label>
            <label>
              Correo
              <input type="email" autoComplete="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
              {errors.email && <em>{errors.email}</em>}
            </label>
            <label>
              Teléfono
              <input type="tel" autoComplete="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
              {errors.phone && <em>{errors.phone}</em>}
            </label>
            <label className="span-2">
              Dirección
              <input autoComplete="street-address" value={form.address} onChange={(e) => update("address", e.target.value)} />
              {errors.address && <em>{errors.address}</em>}
            </label>
            <label>
              Comuna
              <input autoComplete="address-level2" value={form.city} onChange={(e) => update("city", e.target.value)} />
              {errors.city && <em>{errors.city}</em>}
            </label>
            <label>
              Región
              <select autoComplete="address-level1" value={form.region} onChange={(e) => update("region", e.target.value)}>
                {CHILE_REGIONS.map((region) => <option key={region}>{region}</option>)}
              </select>
            </label>

            <div className="span-2 summary-box">
              <div className="row"><span>Subtotal estimado</span><b>{money(subtotal)}</b></div>
              <div className="row">
                <span>Despacho</span>
                <b>{shippingQuote.isLoading ? "Calculando…" : shipping === null ? "No disponible" : shipping === 0 ? "Gratis" : money(shipping)}</b>
              </div>
              <div className="row total"><span>Total estimado</span><b>{money(total)}</b></div>
              {shippingQuote.data?.free_shipping_threshold && shipping !== 0 ? (
                <small className="hint">Despacho gratis desde {money(shippingQuote.data.free_shipping_threshold)} en esta zona.</small>
              ) : null}
              {shippingQuote.isError && <small className="hint">No pudimos estimar el despacho. Revisa la región o intenta nuevamente.</small>}
              <small className="hint">El servidor recalcula precios, descuentos, despacho y stock al confirmar.</small>
            </div>

            <div className="span-2 pending-box">
              <b>Pago por transferencia bancaria</b><br />
              Al confirmar, el stock queda reservado durante 24 horas. El pedido se prepara cuando administración valida la transferencia.
            </div>

            <button className="btn primary block span-2" type="submit" disabled={busy || cart.lines.length === 0}>
              {busy ? "Creando pedido…" : "Confirmar pedido y reservar stock"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
