import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { formatRut, isValidRut, money } from "@/lib/format";
import { userErrorMessage } from "@/lib/errors";
import {
  BRAND,
  CLIENT_TYPES,
  type CustomerType,
  type OrderSummary,
} from "@/types";

export const Route = createFileRoute("/mi-cuenta")({
  head: () => ({
    meta: [
      { title: `Mi cuenta | ${BRAND.name}` },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AccountPage,
});

const B2B_TYPES: CustomerType[] = ["professional", "company", "wholesale", "distributor"];

const PAYMENT_LABELS: Record<string, string> = {
  pending: "Pendiente",
  awaiting_transfer: "Esperando transferencia",
  paid: "Pagado",
  failed: "Pago fallido",
  refunded: "Reembolsado",
  partially_refunded: "Reembolso parcial",
  cancelled: "Cancelado",
};

const FULFILLMENT_LABELS: Record<string, string> = {
  unfulfilled: "Pendiente de preparación",
  preparing: "Preparando",
  ready: "Listo para despacho",
  shipped: "Enviado",
  delivered: "Entregado",
  returned: "Devuelto",
};

const QUOTE_LABELS: Record<string, string> = {
  requested: "Solicitada",
  reviewing: "En revisión",
  sent: "Enviada",
  accepted: "Aceptada",
  rejected: "Rechazada",
  expired: "Vencida",
  converted: "Convertida en pedido",
};

function AccountPage() {
  const { user, profile, loading, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const notify = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [requestingB2B, setRequestingB2B] = useState(false);
  const [b2bType, setB2bType] = useState<CustomerType>("professional");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    rut: "",
    companyName: "",
    companyRut: "",
  });

  useEffect(() => {
    if (!loading && !user) {
      void navigate({ to: "/auth", search: { modo: "ingreso", redirect: "/mi-cuenta" }, replace: true });
    }
  }, [loading, navigate, user]);

  useEffect(() => {
    if (!profile) return;
    setForm({
      firstName: profile.first_name ?? "",
      lastName: profile.last_name ?? "",
      phone: profile.phone ?? "",
      rut: profile.rut ?? "",
      companyName: profile.company_name ?? "",
      companyRut: profile.company_rut ?? "",
    });
    if (B2B_TYPES.includes(profile.customer_type)) setB2bType(profile.customer_type);
  }, [profile]);

  const orders = useQuery({
    queryKey: ["account-orders", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, status, payment_status, fulfillment_status, total, reservation_expires_at, created_at")
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return (data ?? []) as OrderSummary[];
    },
  });

  const quotes = useQuery({
    queryKey: ["account-quotes", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("id, quote_number, status, total, valid_until, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (loading || !user) {
    return (
      <div className="protected-page">
        <div className="empty-state"><p>Cargando tu cuenta…</p></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="protected-page">
        <div className="empty-state">
          <h2>No pudimos cargar tu perfil</h2>
          <p>La sesión está activa, pero falta el perfil asociado.</p>
          <button className="btn primary" onClick={() => void refreshProfile()}>Reintentar</button>
        </div>
      </div>
    );
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (form.rut && !isValidRut(form.rut)) {
      notify("El RUT personal no es válido");
      return;
    }
    if (form.companyRut && !isValidRut(form.companyRut)) {
      notify("El RUT de empresa no es válido");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: form.firstName.trim() || null,
          last_name: form.lastName.trim() || null,
          phone: form.phone.trim() || null,
          rut: form.rut.trim() || null,
          company_name: form.companyName.trim() || null,
          company_rut: form.companyRut.trim() || null,
        })
        .eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      notify("Datos actualizados");
    } catch (error) {
      notify(userErrorMessage(error, "No pudimos guardar los cambios."));
    } finally {
      setSaving(false);
    }
  }

  async function requestCommercialAccess() {
    if (!["professional", "company", "wholesale", "distributor"].includes(b2bType)) return;
    if (["company", "wholesale", "distributor"].includes(b2bType) && !form.companyName.trim()) {
      notify("Indica tu empresa o ferretería antes de solicitar acceso");
      return;
    }
    if (form.companyRut && !isValidRut(form.companyRut)) {
      notify("El RUT de empresa no es válido");
      return;
    }

    setRequestingB2B(true);
    try {
      const { error } = await supabase.rpc("request_b2b_access", {
        _customer_type: b2bType,
        _company_name: form.companyName.trim() || null,
        _company_rut: form.companyRut.trim() || null,
      });
      if (error) throw error;
      await refreshProfile();
      notify("Solicitud comercial enviada para revisión");
    } catch (error) {
      notify(userErrorMessage(error, "No pudimos enviar la solicitud."));
    } finally {
      setRequestingB2B(false);
    }
  }

  async function cancelOrder(orderId: string) {
    try {
      const { error } = await supabase.rpc("cancel_order", { _order_id: orderId });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["account-orders", user.id] });
      notify("Pedido cancelado y stock liberado");
    } catch (error) {
      notify(userErrorMessage(error, "No pudimos cancelar el pedido."));
    }
  }

  const displayName =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.company_name || user.email || "Cliente";
  const isApprovedB2B = B2B_TYPES.includes(profile.customer_type) && profile.b2b_status === "approved";
  const canRequestB2B = profile.b2b_status !== "approved" && profile.b2b_status !== "suspended";

  return (
    <section className="container account-page">
      <header className="account-header">
        <div>
          <span className="eyebrow">Área de cliente</span>
          <h1>Mi cuenta</h1>
          <p>Administra tus datos, pedidos y acceso comercial.</p>
        </div>
        <button
          className="btn ghost"
          onClick={async () => {
            try {
              await signOut();
              void navigate({ to: "/", replace: true });
            } catch (error) {
              notify(userErrorMessage(error, "No pudimos cerrar la sesión."));
            }
          }}
        >
          Cerrar sesión
        </button>
      </header>

      <div className="account-grid">
        <aside className="profile-card">
          <div className="big-avatar">{displayName[0]?.toUpperCase() ?? "U"}</div>
          <h3>{displayName}</h3>
          <p>{user.email}</p>
          <span className="role-badge">{CLIENT_TYPES[profile.customer_type]?.badge ?? "Retail"}</span>

          {profile.b2b_status === "pending" && (
            <div className="pending-box">⏳ Tu solicitud comercial está en revisión.</div>
          )}
          {profile.b2b_status === "rejected" && (
            <div className="pending-box">
              Tu solicitud anterior no fue aprobada.
              {profile.b2b_review_note ? ` ${profile.b2b_review_note}` : " Puedes actualizar tus datos y volver a solicitarla."}
            </div>
          )}
          {profile.b2b_status === "suspended" && (
            <div className="pending-box">Tu acceso comercial está suspendido. Contacta a ventas.</div>
          )}
          {isApprovedB2B && (
            <div className="pending-box">✓ Precios comerciales activos para tu cuenta.</div>
          )}

          <hr />
          <small>TIPO DE CLIENTE</small>
          <strong>{CLIENT_TYPES[profile.customer_type]?.label ?? profile.customer_type}</strong>
          <small>ESTADO COMERCIAL</small>
          <strong>{profile.b2b_status.replaceAll("_", " ")}</strong>
        </aside>

        <div>
          <form className="orders-card" onSubmit={saveProfile}>
            <div className="card-title">
              <div>
                <h2>Datos personales y comerciales</h2>
                <p>Estos datos se usan para contacto, despacho y validación comercial.</p>
              </div>
            </div>
            <div className="auth-form">
              <div className="form-row">
                <label>Nombre<input value={form.firstName} onChange={(e) => setForm((v) => ({ ...v, firstName: e.target.value }))} /></label>
                <label>Apellido<input value={form.lastName} onChange={(e) => setForm((v) => ({ ...v, lastName: e.target.value }))} /></label>
              </div>
              <div className="form-row">
                <label>Teléfono<input value={form.phone} onChange={(e) => setForm((v) => ({ ...v, phone: e.target.value }))} /></label>
                <label>RUT<input value={form.rut} onChange={(e) => setForm((v) => ({ ...v, rut: formatRut(e.target.value) }))} /></label>
              </div>
              <div className="form-row">
                <label>Empresa / ferretería<input value={form.companyName} onChange={(e) => setForm((v) => ({ ...v, companyName: e.target.value }))} /></label>
                <label>RUT empresa<input value={form.companyRut} onChange={(e) => setForm((v) => ({ ...v, companyRut: formatRut(e.target.value) }))} /></label>
              </div>
              <button type="submit" className="btn primary" disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</button>
            </div>
          </form>

          {canRequestB2B && (
            <div className="orders-card" style={{ marginTop: 18 }}>
              <div className="card-title">
                <div>
                  <h2>Acceso a precios comerciales</h2>
                  <p>Solicita un nivel comercial. Hasta la aprobación seguirás viendo precio retail.</p>
                </div>
              </div>
              <div className="auth-form">
                <label>
                  Tipo de cuenta solicitada
                  <select value={b2bType} onChange={(e) => setB2bType(e.target.value as CustomerType)}>
                    {B2B_TYPES.map((type) => <option key={type} value={type}>{CLIENT_TYPES[type]?.label ?? type}</option>)}
                  </select>
                </label>
                <button className="btn secondary" type="button" onClick={requestCommercialAccess} disabled={requestingB2B}>
                  {requestingB2B ? "Enviando…" : profile.b2b_status === "pending" ? "Actualizar solicitud" : "Solicitar acceso comercial"}
                </button>
              </div>
            </div>
          )}

          <div className="orders-card" style={{ marginTop: 18 }}>
            <div className="card-title">
              <div><h2>Mis pedidos</h2><p>Pedidos creados desde esta cuenta.</p></div>
              <Link to="/productos" className="btn secondary">Comprar</Link>
            </div>
            {orders.isLoading && <div className="empty-orders">Cargando pedidos…</div>}
            {orders.isError && <div className="pending-box">No pudimos cargar tus pedidos.</div>}
            {!orders.isLoading && (orders.data?.length ?? 0) === 0 && <div className="empty-orders">Todavía no tienes pedidos.</div>}
            {orders.data?.map((order) => (
              <div className="order-row" key={order.id}>
                <div>
                  <b>{order.order_number}</b>
                  <small>{new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeZone: "America/Santiago" }).format(new Date(order.created_at))}</small>
                </div>
                <span className="order-status">{PAYMENT_LABELS[order.payment_status] ?? order.payment_status} · {FULFILLMENT_LABELS[order.fulfillment_status] ?? order.fulfillment_status}</span>
                <strong>{money(order.total)}</strong>
                {order.payment_status === "awaiting_transfer" && order.status !== "cancelled" ? (
                  <button onClick={() => void cancelOrder(order.id)}>Cancelar</button>
                ) : <span />}
              </div>
            ))}
          </div>

          <div className="orders-card" style={{ marginTop: 18 }}>
            <div className="card-title"><div><h2>Mis cotizaciones</h2><p>Solicitudes y propuestas comerciales.</p></div></div>
            {quotes.isLoading && <div className="empty-orders">Cargando cotizaciones…</div>}
            {!quotes.isLoading && (quotes.data?.length ?? 0) === 0 && <div className="empty-orders">Todavía no tienes cotizaciones.</div>}
            {quotes.data?.map((quote) => (
              <div className="order-row" key={quote.id}>
                <div><b>{quote.quote_number}</b><small>{new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeZone: "America/Santiago" }).format(new Date(quote.created_at))}</small></div>
                <span className="order-status">{QUOTE_LABELS[quote.status] ?? quote.status}</span>
                <strong>{money(quote.total)}</strong>
                <span />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
