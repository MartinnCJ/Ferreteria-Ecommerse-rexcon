import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { money } from "@/lib/format";
import { userErrorMessage } from "@/lib/errors";
import { BRAND, CLIENT_TYPES, type InventoryRow, type OrderSummary, type Profile, type QuoteSummary } from "@/types";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: `Administración | ${BRAND.name}` },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const notify = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      void navigate({ to: "/auth", search: { modo: "ingreso", redirect: "/admin" }, replace: true });
    } else if (!isAdmin) {
      void navigate({ to: "/mi-cuenta", replace: true });
    }
  }, [isAdmin, loading, navigate, user]);

  const approvals = useQuery({
    queryKey: ["admin-b2b-pending"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name, phone, rut, company_name, company_rut, customer_type, b2b_status, b2b_review_note, b2b_reviewed_at, b2b_reviewed_by")
        .eq("b2b_status", "pending")
        .order("updated_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const orders = useQuery({
    queryKey: ["admin-orders"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, status, payment_status, fulfillment_status, total, reservation_expires_at, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as OrderSummary[];
    },
  });

  const quotes = useQuery({
    queryKey: ["admin-quotes"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("id, quote_number, status, total, customer_notes, admin_notes, valid_until, created_at")
        .in("status", ["requested", "reviewing"])
        .order("created_at", { ascending: true })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as QuoteSummary[];
    },
  });

  const inventory = useQuery({
    queryKey: ["admin-inventory"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_inventory");
      if (error) throw error;
      return (data ?? []) as InventoryRow[];
    },
  });

  if (loading || !user || !isAdmin) {
    return <div className="protected-page"><div className="empty-state"><p>Verificando permisos…</p></div></div>;
  }

  async function review(userId: string, approved: boolean) {
    try {
      const note = approved ? null : window.prompt("Motivo opcional del rechazo:") || null;
      const { error } = await supabase.rpc("review_b2b_access", {
        _user_id: userId,
        _approved: approved,
        _note: note,
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["admin-b2b-pending"] });
      notify(approved ? "Cuenta comercial aprobada" : "Solicitud rechazada");
    } catch (error) {
      notify(userErrorMessage(error, "No pudimos actualizar la solicitud."));
    }
  }

  async function confirmTransfer(orderId: string) {
    if (!window.confirm("¿Confirmar que la transferencia fue recibida? Esto convierte la reserva en venta.")) return;
    try {
      const { error } = await supabase.rpc("confirm_bank_transfer", { _order_id: orderId });
      if (error) throw error;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["catalog"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-inventory"] }),
      ]);
      notify("Transferencia confirmada y stock descontado");
    } catch (error) {
      notify(userErrorMessage(error, "No pudimos confirmar la transferencia."));
    }
  }

  async function cancelOrder(orderId: string) {
    if (!window.confirm("¿Cancelar este pedido y liberar su stock reservado?")) return;
    try {
      const { error } = await supabase.rpc("cancel_order", { _order_id: orderId });
      if (error) throw error;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["catalog"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-inventory"] }),
      ]);
      notify("Pedido cancelado");
    } catch (error) {
      notify(userErrorMessage(error, "No pudimos cancelar el pedido."));
    }
  }

  async function advanceFulfillment(
    orderId: string,
    target: "preparing" | "ready" | "shipped" | "delivered",
  ) {
    try {
      const { error } = await supabase.rpc("advance_order_fulfillment", {
        _order_id: orderId,
        _target: target,
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      const labels = { preparing: "Preparando", ready: "Listo para despacho", shipped: "Enviado", delivered: "Entregado" };
      notify(`Pedido actualizado: ${labels[target]}`);
    } catch (error) {
      notify(userErrorMessage(error, "No pudimos actualizar el estado logístico."));
    }
  }

  function nextFulfillment(order: OrderSummary) {
    if (order.payment_status !== "paid") return null;
    switch (order.fulfillment_status) {
      case "unfulfilled": return { target: "preparing" as const, label: "Preparar" };
      case "preparing": return { target: "ready" as const, label: "Marcar listo" };
      case "ready": return { target: "shipped" as const, label: "Marcar enviado" };
      case "shipped": return { target: "delivered" as const, label: "Marcar entregado" };
      default: return null;
    }
  }

  async function reviewQuote(quoteId: string, reject = false) {
    const note = reject ? window.prompt("Motivo opcional del rechazo:") || null : null;
    try {
      const { error } = await supabase.rpc("review_quote_request", {
        _quote_id: quoteId,
        _reject: reject,
        _note: note,
      });
      if (error) throw error;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-quotes"] }),
        queryClient.invalidateQueries({ queryKey: ["account-quotes"] }),
      ]);
      notify(reject ? "Cotización rechazada" : "Cotización tomada para revisión");
    } catch (error) {
      notify(userErrorMessage(error, "No pudimos actualizar la cotización."));
    }
  }

  const awaiting = orders.data?.filter((order) => order.payment_status === "awaiting_transfer" && order.status !== "cancelled") ?? [];
  const lowStock = (inventory.data ?? []).filter((product) => product.available_stock <= product.minimum_stock);
  const paid = orders.data?.filter((order) => order.payment_status === "paid") ?? [];
  const paidSales = paid.reduce((sum, order) => sum + order.total, 0);

  return (
    <section className="admin-page">
      <div className="container">
        <header className="admin-header">
          <div><span className="eyebrow">Operación</span><h1>Administración</h1><p>Pedidos, accesos comerciales e inventario disponible.</p></div>
          <div className="admin-actions"><button className="btn secondary" onClick={() => void Promise.all([approvals.refetch(), orders.refetch(), quotes.refetch(), inventory.refetch()])}>Actualizar</button></div>
        </header>

        <div className="metric-grid">
          <div className="metric-card"><span>Ventas pagadas</span><b>{money(paidSales)}</b><small>{paid.length} pedidos pagados</small></div>
          <div className="metric-card"><span>Esperando transferencia</span><b>{awaiting.length}</b><small>con stock reservado</small></div>
          <div className="metric-card"><span>Solicitudes B2B</span><b>{approvals.data?.length ?? 0}</b><small>pendientes de revisión</small></div>
          <div className="metric-card"><span>Stock bajo</span><b>{lowStock.length}</b><small>según mínimo configurado por SKU</small></div>
        </div>

        <div className="admin-grid">
          <div className="admin-card">
            <div className="card-title"><div><h2>Pedidos recientes</h2><p>Las transferencias se confirman manualmente.</p></div></div>
            {orders.isLoading && <div className="empty-orders">Cargando pedidos…</div>}
            {orders.data?.map((order) => (
              <div className="order-row admin-order-flow" key={order.id}>
                <div><b>{order.order_number}</b><small>{new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "short", timeZone: "America/Santiago" }).format(new Date(order.created_at))}</small></div>
                <span className="order-status">{order.payment_status.replaceAll("_", " ")} · {order.fulfillment_status.replaceAll("_", " ")}</span>
                <strong>{money(order.total)}</strong>
                <div style={{ display: "flex", gap: 6 }}>
                  {order.payment_status === "awaiting_transfer" && order.status !== "cancelled" && (
                    <button className="mini-action approve" onClick={() => void confirmTransfer(order.id)}>Confirmar pago</button>
                  )}
                  {nextFulfillment(order) && (
                    <button
                      className="mini-action approve"
                      onClick={() => {
                        const next = nextFulfillment(order);
                        if (next) void advanceFulfillment(order.id, next.target);
                      }}
                    >
                      {nextFulfillment(order)?.label}
                    </button>
                  )}
                  {order.status !== "cancelled" && order.payment_status !== "paid" && order.fulfillment_status !== "delivered" && (
                    <button className="mini-action" onClick={() => void cancelOrder(order.id)}>Cancelar</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="admin-card">
            <div className="card-title"><div><h2>Acceso comercial</h2><p>Usuarios esperando aprobación.</p></div><span className="count-badge">{approvals.data?.length ?? 0}</span></div>
            {(approvals.data?.length ?? 0) === 0 && <div className="empty-orders">No hay solicitudes pendientes.</div>}
            {approvals.data?.map((profile) => (
              <div className="approval-row" key={profile.id}>
                <div>
                  <b>{profile.company_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email}</b>
                  <small>{CLIENT_TYPES[profile.customer_type]?.label} · {profile.company_rut || profile.rut || "RUT no informado"}</small>
                </div>
                <div>
                  <button className="mini-action approve" onClick={() => void review(profile.id, true)}>Aprobar</button>
                  <button className="mini-action" onClick={() => void review(profile.id, false)}>Rechazar</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-card lower-admin-grid" style={{ marginBottom: 18 }}>
          <div className="card-title"><div><h2>Cotizaciones por revisar</h2><p>Solicitudes creadas desde carritos comerciales. No reservan stock.</p></div><span className="count-badge">{quotes.data?.length ?? 0}</span></div>
          {quotes.isLoading && <div className="empty-orders">Cargando cotizaciones…</div>}
          {!quotes.isLoading && (quotes.data?.length ?? 0) === 0 && <div className="empty-orders">No hay cotizaciones pendientes.</div>}
          {quotes.data?.map((quote) => (
            <div className="order-row" key={quote.id}>
              <div><b>{quote.quote_number}</b><small>{new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "short", timeZone: "America/Santiago" }).format(new Date(quote.created_at))}</small></div>
              <span className="order-status">{quote.status}</span>
              <strong>{money(quote.total)}</strong>
              <div style={{ display: "flex", gap: 6 }}>
                {quote.status === "requested" && <button className="mini-action approve" onClick={() => void reviewQuote(quote.id)}>Revisar</button>}
                <button className="mini-action" onClick={() => void reviewQuote(quote.id, true)}>Rechazar</button>
              </div>
            </div>
          ))}
        </div>

        <div className="admin-card lower-admin-grid">
          <div className="card-title"><div><h2>Productos con stock bajo</h2><p>Basado en stock disponible, ya descontando reservas.</p></div></div>
          {lowStock.length === 0 ? <div className="empty-orders">Sin alertas de stock.</div> : lowStock.map((product) => (
            <div className="order-row" key={product.product_id}>
              <div><b>{product.name}</b><small>SKU {product.sku} · mínimo {product.minimum_stock}</small></div>
              <span className="order-status">{product.available_stock} disp. · {product.reserved_stock} reserv.</span>
              <strong>{money(product.retail_price)}</strong>
              <span />
            </div>
          ))}
        </div>

        <div className="backend-note">
          <b>Seguridad activa</b>
          <span>Precios comerciales, aprobación B2B, creación de pedidos y movimientos de stock se validan en Supabase.</span>
          <small>La interfaz administrativa no puede convertir una cuenta normal en admin; ese rol permanece separado en user_roles.</small>
        </div>
      </div>
    </section>
  );
}
