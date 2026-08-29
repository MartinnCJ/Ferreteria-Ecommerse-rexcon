import { createFileRoute, Link } from "@tanstack/react-router";
import { BRAND } from "@/types";

export const Route = createFileRoute("/mayoristas")({
  head: () => ({
    meta: [
      { title: `Venta mayorista y precios B2B | ${BRAND.name}` },
      {
        name: "description",
        content:
          `Programa mayorista ${BRAND.name} para ferreterías, empresas y distribuidores en Chile: precios por volumen y despacho nacional.`,
      },
      { property: "og:title", content: `Venta mayorista y precios B2B | ${BRAND.name}` },
      {
        property: "og:description",
        content: "Precios comerciales por volumen para ferreterías, empresas y distribuidores.",
      },
    ],
  }),
  component: WholesalePage,
});

function WholesalePage() {
  return (
    <>
      <section className="b2b-hero">
        <div className="container b2b-hero-grid">
          <div>
            <span className="eyebrow lime">Programa mayorista</span>
            <h1>
              Precios <em>de importador</em> para tu ferretería
            </h1>
            <p>
              Compra directo a la marca: sin intermediarios, con stock real en Chile, garantía
              directa y precios que escalan según tu volumen mensual.
            </p>
            <div className="hero-actions">
              <Link to="/auth" search={{ modo: "registro" }} className="btn primary xl">
                Solicitar cuenta comercial
              </Link>
              <Link to="/productos" className="btn ghost xl">
                Ver catálogo
              </Link>
            </div>
          </div>
          <div className="b2b-metrics">
            <div>
              <strong>B2B</strong>
              <span>Precios según tipo de cliente</span>
            </div>
            <div>
              <strong>Manual</strong>
              <span>Validación de cuenta comercial</span>
            </div>
            <div>
              <strong>Directa</strong>
              <span>Garantía según cada producto</span>
            </div>
            <div>
              <strong>Chile</strong>
              <span>Despacho a todas las regiones</span>
            </div>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Cómo funciona</span>
            <h2>Cuatro pasos para comprar a precio comercial</h2>
          </div>
        </div>
        <div className="steps-grid">
          <div>
            <b>01</b>
            <span>📝</span>
            <h3>Crea tu cuenta</h3>
            <p>Regístrate indicando si eres profesional, empresa, ferretería o distribuidor.</p>
          </div>
          <div>
            <b>02</b>
            <span>🔍</span>
            <h3>Validamos tus datos</h3>
            <p>Revisamos los datos comerciales antes de habilitar el nivel de precio solicitado.</p>
          </div>
          <div>
            <b>03</b>
            <span>💰</span>
            <h3>Se activan tus precios</h3>
            <p>El catálogo completo pasa a mostrar tu nivel de precio y los tramos por volumen.</p>
          </div>
          <div>
            <b>04</b>
            <span>🚚</span>
            <h3>Compra y despacho</h3>
            <p>Pedidos en línea o cotizaciones a medida con despacho a todo Chile.</p>
          </div>
        </div>
      </section>

      <section className="container section pricing-demo">
        <div className="section-heading centered">
          <div>
            <span className="eyebrow">Niveles</span>
            <h2>Cada tipo de cliente, su precio</h2>
          </div>
        </div>
        <div className="pricing-table">
          <div>
            <span>Particular</span>
            <b>Precio retail</b>
            <small>—</small>
          </div>
          <div>
            <span>Maestro / profesional</span>
            <b>Precio PRO</b>
            <small>según lista comercial</small>
          </div>
          <div>
            <span>Empresa</span>
            <b>Precio empresa</b>
            <small>según convenio</small>
          </div>
          <div className="highlight">
            <span>Ferretería / mayorista</span>
            <b>Precio mayorista</b>
            <small>según volumen</small>
          </div>
          <div>
            <span>Distribuidor</span>
            <b>Precio distribuidor</b>
            <small>según volumen</small>
          </div>
        </div>
      </section>

      <section className="container section faq">
        <h2>Preguntas frecuentes</h2>
        <details>
          <summary>¿Cuánto demora la activación comercial?</summary>
          <p>La cuenta queda pendiente hasta que el equipo comercial revise y apruebe los datos.</p>
        </details>
        <details>
          <summary>¿Hay compra mínima?</summary>
          <p>
            No para retail. Para niveles mayorista y distribuidor aplican tramos por volumen que se
            calculan automáticamente en el carrito.
          </p>
        </details>
        <details>
          <summary>¿Cómo son los despachos?</summary>
          <p>
            Despachamos a las regiones habilitadas. El costo y el umbral de despacho gratis se
            calculan según la zona configurada.
          </p>
        </details>
        <details>
          <summary>¿Puedo cambiar o devolver productos?</summary>
          <p>
          Las condiciones de cambios, devoluciones y garantía deben publicarse según la política
          comercial vigente y el tipo de producto.
          </p>
        </details>
      </section>
    </>
  );
}
