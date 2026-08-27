import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/useToast";
import { BRAND } from "@/types";
import { BrandMark } from "@/components/BrandMark";
import { userErrorMessage } from "@/lib/errors";

export const Route = createFileRoute("/restablecer-clave")({
  head: () => ({
    meta: [
      { title: `Restablecer contraseña | ${BRAND.name}` },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const notify = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      notify("Contraseña actualizada");
      void navigate({ to: "/mi-cuenta", replace: true });
    } catch (err) {
      setError(userErrorMessage(err, "No pudimos actualizar la contraseña."));
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
            <small>Seguridad de la cuenta</small>
          </span>
        </div>
        <form className="auth-form" onSubmit={submit}>
          <h2>Nueva contraseña</h2>
          <p className="muted">Elige una contraseña nueva para tu cuenta.</p>
          <label>
            Nueva contraseña
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <label>
            Repetir contraseña
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </label>
          {error && <div className="pending-box">{error}</div>}
          <button className="btn primary full xl" type="submit" disabled={busy}>
            {busy ? "Actualizando…" : "Guardar nueva contraseña"}
          </button>
        </form>
      </div>
    </div>
  );
}
