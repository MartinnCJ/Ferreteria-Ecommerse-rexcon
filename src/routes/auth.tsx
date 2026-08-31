import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { formatRut, isValidRut } from "@/lib/format";
import { userErrorMessage } from "@/lib/errors";
import { BRAND, CLIENT_TYPES, type CustomerType } from "@/types";
import { BrandMark } from "@/components/BrandMark";

const searchSchema = z.object({
  modo: z.enum(["ingreso", "registro"]).optional(),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: `Ingresar o crear cuenta | ${BRAND.name}` },
      {
        name: "description",
        content:
          `Accede a tu cuenta ${BRAND.name} o regístrate como profesional, empresa o ferretería para obtener precios comerciales.`,
      },
      { property: "og:title", content: `Ingresar o crear cuenta | ${BRAND.name}` },
      {
        property: "og:description",
        content: `Cuenta retail o comercial para comprar herramientas ${BRAND.name} en Chile.`,
      },
    ],
  }),
  component: AuthPage,
});

const B2B_TYPES: CustomerType[] = ["professional", "company", "wholesale", "distributor"];

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const notify = useToast();
  const { user, refreshProfile } = useAuth();
  const [mode, setMode] = useState<"ingreso" | "registro">(search.modo ?? "ingreso");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phone: "",
    rut: "",
    companyName: "",
    companyRut: "",
    customerType: "retail" as CustomerType,
  });

  useEffect(() => {
    if (!user) return;
    const destination = search.redirect?.startsWith("/") && !search.redirect.startsWith("//")
      ? search.redirect
      : "/mi-cuenta";
    // Usamos navegación del navegador para aceptar redirects internos dinámicos sin
    // relajar el tipado de rutas de TanStack Router.
    window.location.replace(destination);
  }, [user, navigate, search.redirect]);

  const isB2B = B2B_TYPES.includes(form.customerType);

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handlePasswordReset() {
    setError(null);
    const email = form.email.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Ingresa tu correo para enviar el enlace de recuperación.");
      return;
    }
    setBusy(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/restablecer-clave`,
      });
      if (resetError) throw resetError;
      notify("Te enviamos un enlace para recuperar tu contraseña.");
    } catch (err) {
      setError(userErrorMessage(err, "No pudimos enviar el correo de recuperación."));
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (mode === "registro") {
      if (form.password.length < 8) {
        setError("La contraseña debe tener al menos 8 caracteres.");
        return;
      }
      if (form.rut && !isValidRut(form.rut)) {
        setError("El RUT ingresado no es válido.");
        return;
      }
      if (["company", "wholesale", "distributor"].includes(form.customerType) && !form.companyName.trim()) {
        setError("Indica el nombre de tu empresa o ferretería.");
        return;
      }
      if (form.companyRut && !isValidRut(form.companyRut)) {
        setError("El RUT de empresa ingresado no es válido.");
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === "ingreso") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: form.email.trim(),
          password: form.password,
        });
        if (signInError) throw signInError;
        notify("Sesión iniciada");
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: form.email.trim(),
          password: form.password,
          options: {
            emailRedirectTo: `${window.location.origin}${search.redirect?.startsWith("/") && !search.redirect.startsWith("//") ? search.redirect : "/mi-cuenta"}`,
            data: {
              first_name: form.firstName,
              last_name: form.lastName,
              phone: form.phone,
              rut: form.rut,
              company_name: form.companyName,
              company_rut: form.companyRut,
              customer_type: form.customerType,
            },
          },
        });
        if (signUpError) throw signUpError;

        if (data.session?.user) {
          // El trigger de auth.users crea el perfil y fija el estado B2B en el servidor.
          await refreshProfile();
          notify(
            isB2B
              ? "Cuenta creada. Tu acceso comercial queda en revisión."
              : "Cuenta creada. ¡Bienvenido!",
          );
        } else {
          notify("Revisa tu correo para confirmar la cuenta.");
        }
      }
    } catch (err) {
      setError(userErrorMessage(err, "No pudimos procesar la solicitud."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="protected-page">
      <div className="auth-modal modal" style={{ margin: "0 auto" }}>
        <div className="auth-brand">
          <BrandMark />
          <span>
            <strong>{BRAND.name}</strong>
            <small>Cuenta retail y comercial</small>
          </span>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === "ingreso" ? "active" : ""}
            onClick={() => setMode("ingreso")}
          >
            Ingresar
          </button>
          <button
            type="button"
            className={mode === "registro" ? "active" : ""}
            onClick={() => setMode("registro")}
          >
            Crear cuenta
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "registro" && (
            <>
              <div className="form-row">
                <label>
                  Nombre
                  <input
                    value={form.firstName}
                    onChange={(e) => update("firstName", e.target.value)}
                    required
                  />
                </label>
                <label>
                  Apellido
                  <input
                    value={form.lastName}
                    onChange={(e) => update("lastName", e.target.value)}
                  />
                </label>
              </div>
              <label>
                Tipo de cliente
                <select
                  value={form.customerType}
                  onChange={(e) => update("customerType", e.target.value)}
                >
                  {Object.entries(CLIENT_TYPES)
                    .filter(([key]) => key !== "admin")
                    .map(([key, value]) => (
                      <option key={key} value={key}>
                        {value.label}
                      </option>
                    ))}
                </select>
              </label>
              <div className="form-row">
                <label>
                  Teléfono
                  <input value={form.phone} onChange={(e) => update("phone", e.target.value)} />
                </label>
                <label>
                  RUT
                  <input
                    value={form.rut}
                    onChange={(e) => update("rut", formatRut(e.target.value))}
                    placeholder="12.345.678-9"
                  />
                </label>
              </div>
              {isB2B && (
                <div className="form-row">
                  <label>
                    Empresa / ferretería
                    <input
                      value={form.companyName}
                      onChange={(e) => update("companyName", e.target.value)}
                    />
                  </label>
                  <label>
                    RUT empresa
                    <input
                      value={form.companyRut}
                      onChange={(e) => update("companyRut", formatRut(e.target.value))}
                    />
                  </label>
                </div>
              )}
            </>
          )}

          <label>
            Correo
            <input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              required
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              required
            />
          </label>
          {mode === "ingreso" && (
            <button type="button" className="price-access" onClick={handlePasswordReset} disabled={busy}>
              Olvidé mi contraseña
            </button>
          )}

          {error && <div className="pending-box">{error}</div>}
          {mode === "registro" && isB2B && (
            <div className="pending-box">
              Los precios comerciales se activan tras validar tus datos. Hasta entonces no se
              mostrarán precios en tu cuenta comercial.
            </div>
          )}

          <button className="btn primary full xl" type="submit" disabled={busy}>
            {busy ? "Procesando…" : mode === "ingreso" ? "Ingresar" : "Crear cuenta"}
          </button>
          <p className="security-note">
            Tus precios y permisos se calculan siempre en el servidor. Nunca compartas tu
            contraseña.
          </p>
        </form>
      </div>
    </div>
  );
}
