import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { catalogQueryOptions } from "@/hooks/useCatalog";
import { usePrices } from "@/hooks/usePrices";
import { ProductCard } from "@/components/ProductCard";
import { BRAND } from "@/types";
import { categoryIdsIncludingDescendants } from "@/lib/catalog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${BRAND.name} | Herramientas profesionales en Chile` },
      {
        name: "description",
        content:
          "Herramientas eléctricas y manuales de marca propia con despacho a todo Chile. Precios retail, profesionales y mayoristas con garantía directa.",
      },
      { property: "og:title", content: `${BRAND.name} | Herramientas profesionales en Chile` },
      {
        property: "og:description",
        content:
          "Importación directa y venta B2C y B2B de herramientas en Chile. Crea tu cuenta para acceder a precios comerciales.",
      },
    ],
  }),
  loader: ({ context }) => {
    void context.queryClient.ensureQueryData(catalogQueryOptions());
  },
  component: Home,
});

function Home() {
  const { data } = useSuspenseQuery(catalogQueryOptions());
  const featured = data.products.filter((p) => p.featured).slice(0, 4);
  const list = featured.length > 0 ? featured : data.products.slice(0, 4);
  const { prices, isLoading } = usePrices(list.map((p) => p.id));

  return (
    <>
      <section className="hero rexcon-hero">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow">Marca propia · Importación directa</span>
            <h1>
              Herramientas hechas <span className="hl">para trabajar</span>
            </h1>
            <p>
              Equipamiento profesional seleccionado para rendir en el trabajo diario, con stock en
              Chile, garantía directa y condiciones especiales para profesionales, empresas y
              ferreterías.
            </p>
            <div className="hero-actions">
              <Link to="/productos" className="btn primary">
                Ver productos
              </Link>
              <Link to="/mayoristas" className="btn ghost">
                Venta mayorista
              </Link>
            </div>
            <div className="hero-stats">
              <div>
                <b>Despacho a todo Chile</b>
                <span>Envíos por región</span>
              </div>
              <div>
                <b>Garantía directa</b>
                <span>Respaldo según producto</span>
              </div>
              <div>
                <b>Precios comerciales</b>
                <span>Para profesionales y empresas</span>
              </div>
            </div>
          </div>
          <div className="hero-panel">
            <div className="panel-title">Acceso comercial</div>
            <div className="panel-copy">
              <p>Precios especiales para profesionales, empresas, ferreterías y distribuidores.</p>
              <p>Descuentos por volumen. Acceso sujeto a aprobación.</p>
            </div>
            <Link to="/auth" search={{ modo: "registro" }} className="btn primary block">
              Solicitar acceso comercial
            </Link>
          </div>
        </div>
      </section>

      <section id="quienes-somos" className="about-band">
        <div className="container about-grid">
          <span className="eyebrow">Quiénes somos</span>
          <h2>Herramientas que responden cuando el trabajo exige más.</h2>
          <div>
            <p>
              En REXCON buscamos que cada producto tenga una razón para estar en nuestro catálogo:
              rendimiento, durabilidad y valor.
            </p>
            <p>
              Abastecemos a profesionales, empresas y ferreterías con herramientas seleccionadas
              para el trabajo diario y disponibles en Chile.
            </p>
            <Link to="/productos" className="link">Descubre REXCON {"\u2192"}</Link>
          </div>
        </div>
      </section>

      <section className="container section">
        <header className="section-head">
          <h2>Destacados</h2>
          <Link to="/productos" className="link">
            Ver todo el catálogo →
          </Link>
        </header>
        <div className="grid products">
          {list.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              price={prices.get(product.id)}
              loadingPrice={isLoading}
            />
          ))}
        </div>
      </section>

    </>
  );
}
