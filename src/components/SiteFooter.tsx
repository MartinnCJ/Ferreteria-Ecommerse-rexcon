import { Link } from "@tanstack/react-router";
import { BRAND } from "@/types";
import { BrandMark } from "@/components/BrandMark";

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <Link to="/" className="brand footer-brand" aria-label="Ir al inicio de REXCON">
            <BrandMark />
            <span>
              <strong>{BRAND.name}</strong>
              <small>PROFESSIONAL TOOLS</small>
            </span>
          </Link>
          <p>
            {BRAND.tagline}
            <br />
            Importación directa y distribución en Chile.
          </p>
        </div>
        <div>
          <b>Comprar</b>
          <Link to="/productos">Productos</Link>
          <Link to="/mayoristas">Venta mayorista</Link>
          <a href="/#quienes-somos">Quiénes somos</a>
        </div>
        <div>
          <b>Ayuda</b>
          <Link to="/mayoristas">Despachos</Link>
          <Link to="/mayoristas">Cambios y devoluciones</Link>
        </div>
        <div>
          <b>Ventas</b>
          <span>{BRAND.supportEmail}</span>
          <span>{BRAND.supportPhone}</span>
          <small>Lun–Vie · 09:00–18:00</small>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© 2026 {BRAND.name}. Todos los derechos reservados.</span>
        <span>Privacidad · Términos · Garantía</span>
      </div>
    </footer>
  );
}
