import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";
import { catalogQueryOptions } from "@/hooks/useCatalog";
import { usePrices } from "@/hooks/usePrices";
import { ProductCard } from "@/components/ProductCard";
import { BRAND } from "@/types";
import { categoryIdsIncludingDescendants } from "@/lib/catalog";

const searchSchema = z.object({
  categoria: z.string().optional(),
  q: z.string().optional(),
});

export const Route = createFileRoute("/productos/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: `Catálogo de herramientas | ${BRAND.name}` },
      {
        name: "description",
        content: `Explora el catálogo completo de herramientas eléctricas, manuales, medición y seguridad ${BRAND.name} con stock en Chile.`,
      },
      { property: "og:title", content: `Catálogo de herramientas | ${BRAND.name}` },
      {
        property: "og:description",
        content: "Herramientas profesionales con despacho nacional y precios comerciales.",
      },
    ],
  }),
  loader: ({ context }) => {
    void context.queryClient.ensureQueryData(catalogQueryOptions());
  },
  component: CatalogPage,
});

function CatalogPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data } = useSuspenseQuery(catalogQueryOptions());
  const [sort, setSort] = useState<"relevancia" | "precio-asc" | "precio-desc">("relevancia");
  const [catalogView, setCatalogView] = useState<"large" | "compact">("compact");

  useEffect(() => {
    const savedView = localStorage.getItem("rexcon:catalog-view");
    if (savedView === "large" || savedView === "compact") setCatalogView(savedView);
  }, []);

  function changeCatalogView(view: "large" | "compact") {
    setCatalogView(view);
    localStorage.setItem("rexcon:catalog-view", view);
  }

  const filtered = useMemo(() => {
    const term = (search.q ?? "").trim().toLowerCase();
    const selectedCategory = search.categoria
      ? data.categories.find((category) => category.slug === search.categoria)
      : undefined;
    const categoryIds = selectedCategory
      ? categoryIdsIncludingDescendants(data.categories, selectedCategory.id)
      : null;

    let list = data.products.filter((product) => {
      const matchesCategory =
        !categoryIds || (product.category_id ? categoryIds.has(product.category_id) : false);
      const matchesTerm =
        !term ||
        product.name.toLowerCase().includes(term) ||
        product.sku.toLowerCase().includes(term) ||
        (product.short_description ?? "").toLowerCase().includes(term) ||
        (product.category_name ?? "").toLowerCase().includes(term);
      return matchesCategory && matchesTerm;
    });
    if (sort === "precio-asc") list = [...list].sort((a, b) => a.retail_price - b.retail_price);
    if (sort === "precio-desc") list = [...list].sort((a, b) => b.retail_price - a.retail_price);
    return list;
  }, [data.categories, data.products, search.categoria, search.q, sort]);

  const { prices, isLoading } = usePrices(filtered.map((p) => p.id));

  return (
    <section className="container section">
      <header className="section-head">
        <div>
          <h1>Catálogo</h1>
          <p className="muted">{filtered.length} productos disponibles</p>
        </div>
        <div className="filters">
          <input
            type="search"
            placeholder="Buscar por nombre o SKU"
            value={search.q ?? ""}
            onChange={(e) =>
              navigate({
                search: (prev) => ({ ...prev, q: e.target.value || undefined }),
                replace: true,
              })
            }
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            aria-label="Ordenar"
          >
            <option value="relevancia">Relevancia</option>
            <option value="precio-asc">Menor precio</option>
            <option value="precio-desc">Mayor precio</option>
          </select>
          <div className="catalog-view-toggle" aria-label="Tamaño de las tarjetas">
            <button
              type="button"
              className={catalogView === "large" ? "active" : ""}
              aria-label="Mostrar un producto por fila"
              aria-pressed={catalogView === "large"}
              title="Vista grande"
              onClick={() => changeCatalogView("large")}
            >
              ☰
            </button>
            <button
              type="button"
              className={catalogView === "compact" ? "active" : ""}
              aria-label="Mostrar cuatro productos por fila"
              aria-pressed={catalogView === "compact"}
              title="Vista de 4 columnas"
              onClick={() => changeCatalogView("compact")}
            >
              ▦
            </button>
          </div>
        </div>
      </header>

      <div className="chips">
        <button
          className={!search.categoria ? "chip active" : "chip"}
          onClick={() =>
            navigate({ search: (prev) => ({ ...prev, categoria: undefined }), replace: true })
          }
        >
          Todas
        </button>
        {data.categories.map((category) => (
          <button
            key={category.id}
            className={search.categoria === category.slug ? "chip active" : "chip"}
            onClick={() =>
              navigate({
                search: (prev) => ({ ...prev, categoria: category.slug }),
                replace: true,
              })
            }
          >
            {category.name}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🔍</div>
          <p>No encontramos productos con esos filtros.</p>
        </div>
      ) : (
        <div className={`products products-${catalogView}`}>
          {filtered.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              price={prices.get(product.id)}
              loadingPrice={isLoading}
            />
          ))}
        </div>
      )}
    </section>
  );
}
