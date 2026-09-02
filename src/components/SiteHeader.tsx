import { useEffect, useState, type MouseEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Moon, Sun } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useToast } from "@/hooks/useToast";
import { BRAND, CLIENT_TYPES } from "@/types";
import { BrandMark } from "@/components/BrandMark";
import { userErrorMessage } from "@/lib/errors";

export function SiteHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { user, profile, isAdmin, signOut } = useAuth();
  const cart = useCart();
  const notify = useToast();
  const navigate = useNavigate();

  const displayName =
    profile?.first_name || profile?.company_name || user?.email?.split("@")[0] || "Mi cuenta";

  useEffect(() => {
    const savedTheme = localStorage.getItem("rexcon_theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDarkMode(savedTheme ? savedTheme === "dark" : prefersDark);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("rexcon_theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      setMobileMenuOpen(false);
      notify("Sesión cerrada");
      void navigate({ to: "/", replace: true });
    } catch (error) {
      notify(userErrorMessage(error, "No pudimos cerrar la sesión."));
    } finally {
      setSigningOut(false);
    }
  }

  function scrollToAbout(event: MouseEvent<HTMLAnchorElement>) {
    if (window.location.pathname !== "/") return;
    const aboutSection = document.getElementById("quienes-somos");
    if (!aboutSection) return;
    event.preventDefault();
    aboutSection.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <>
      <div className="top-strip">
        Despacho a todo Chile · Garantía directa · Venta mayorista disponible
      </div>
      <header className="header">
        <div className="header-inner">
          <Link to="/" className="brand" aria-label="Ir al inicio de REXCON">
            <BrandMark />
            <span>
              <strong>{BRAND.name}</strong>
              <small>PROFESSIONAL TOOLS</small>
            </span>
          </Link>

          <nav className="desktop-nav">
            <Link to="/" activeOptions={{ exact: true }} activeProps={{ className: "active" }}>
              Inicio
            </Link>
            <a href="/#quienes-somos" onClick={scrollToAbout}>Quiénes somos</a>
            {isAdmin && (
              <Link to="/admin" activeProps={{ className: "active" }}>
                Admin
              </Link>
              )}
            <Link to="/productos" activeProps={{ className: "active" }}>
              Productos
            </Link>
            <Link to="/mayoristas" activeProps={{ className: "active" }}>
              Venta mayorista
            </Link>
          </nav>

          <div className="header-actions">
            {user ? (
              <Link to={isAdmin ? "/admin" : "/mi-cuenta"} className="account-pill">
                <span className="avatar">{displayName[0]?.toUpperCase() ?? "U"}</span>
                <span className="account-copy">
                  <strong>{displayName}</strong>
                  <small>{CLIENT_TYPES[profile?.customer_type ?? "retail"]?.badge}</small>
                </span>
              </Link>
            ) : (
              <Link to="/auth" className="btn ghost desktop-only">
                Ingresar
              </Link>
            )}
            {isAdmin && (
              <button
                className="admin-signout desktop-only"
                type="button"
                onClick={() => void handleSignOut()}
                disabled={signingOut}
                aria-label="Cerrar sesión de administrador"
                title="Cerrar sesión"
              >
                <LogOut size={17} aria-hidden="true" />
                <span>{signingOut ? "Saliendo…" : "Salir"}</span>
              </button>
            )}
            <button
              className="theme-toggle"
              type="button"
              onClick={() => setDarkMode((current) => !current)}
              aria-label={darkMode ? "Activar modo claro" : "Activar modo oscuro"}
              title={darkMode ? "Activar modo claro" : "Activar modo oscuro"}
            >
              {darkMode ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
            </button>
            <button
              className="cart-button"
              onClick={() => cart.setOpen(true)}
              aria-label="Abrir carrito"
            >
              🛒 <span className="cart-label">Carrito</span>
              {cart.count > 0 && <b>{cart.count}</b>}
            </button>
            <button
              className="menu-button"
              aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((v) => !v)}
            >
              ☰
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="mobile-nav" onClick={() => setMobileMenuOpen(false)}>
            <Link to="/">Inicio</Link>
            <Link to="/productos">Productos</Link>
            <Link to="/mayoristas">Venta mayorista</Link>
            <a href="/#quienes-somos" onClick={scrollToAbout}>Quiénes somos</a>
            {user && <Link to="/mi-cuenta">Mi cuenta</Link>}
            {isAdmin && <Link to="/admin">Admin</Link>}
            {user ? (
              <button onClick={handleSignOut}>Cerrar sesión</button>
            ) : (
              <Link to="/auth">Ingresar / registrarse</Link>
            )}
          </div>
        )}
      </header>
    </>
  );
}
