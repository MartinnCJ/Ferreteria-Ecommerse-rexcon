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
              {BRAND.tagline} Equipamiento profesional con stock en Chile, garantía directa y
              condiciones especiales para maestros, empresas y ferreterías.
            </p>
            <div className="hero-actions">
              <Link to="/productos" className="btn primary">
                Ver catálogo
              </Link>
              <Link to="/mayoristas" className="btn ghost">
                Quiero precios mayoristas
              </Link>
            </div>
            <div className="hero-stats">
              <div>
                <b>{data.products.length}</b>
                <span>Productos activos</span>
              </div>
              <div>
                <b>Chile</b>
                <span>Despacho por región</span>
              </div>
              <div>
                <b>Directa</b>
                <span>Garantía según producto</span>
              </div>
            </div>
          </div>
          <div className="hero-panel">
            <div className="panel-title">Acceso comercial</div>
            <ul>
              <li>Precios PRO, empresa, mayorista y distribuidor</li>
              <li>Descuentos automáticos por volumen</li>
              <li>Acceso comercial sujeto a aprobación</li>
            </ul>
            <Link to="/auth" search={{ modo: "registro" }} className="btn primary block">
              Crear cuenta comercial
            </Link>
          </div>
        </div>
      </section>

      <section id="quienes-somos" className="about-band">
        <div className="container about-grid">
          <span className="eyebrow">Quiénes somos</span>
          <h2>Experiencia que se traduce en herramientas para todos los días.</h2>
          <div>
            <p>
              REXCON se construye sobre a&ntilde;os de experiencia en el rubro de herramientas y
              abastecimiento. Seleccionamos soluciones para faena, taller, empresa y ferretería,
              con productos confiables y una respuesta comercial clara.
            </p>
            <Link to="/mayoristas" className="link">Conoce nuestra venta mayorista</Link>
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

      <section className="container section">
        <div className="grid categories">
          {data.categories.map((category) => (
            <Link
              key={category.id}
              to="/productos"
              search={{ categoria: category.slug }}
              className="category-card"
            >
              <b>{category.name}</b>
              <span>
                {data.products.filter((product) => {
                  const ids = categoryIdsIncludingDescendants(data.categories, category.id);
                  return product.category_id ? ids.has(product.category_id) : false;
                }).length} productos
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
