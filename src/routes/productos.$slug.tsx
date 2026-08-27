import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getProductBySlug } from "@/lib/catalog.functions";
import { usePrices } from "@/hooks/usePrices";
import { useCart } from "@/hooks/useCart";
import { useToast } from "@/hooks/useToast";
import { ProductVisual } from "@/components/ProductVisual";
import { PriceBlock } from "@/components/PriceBlock";
import { money } from "@/lib/format";
import { BRAND, type ProductSpecification, type PublicProduct } from "@/types";

const productQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: ["product", slug],
    queryFn: () => getProductBySlug({ data: { slug } }),
    staleTime: 60_000,
  });

export const Route = createFileRoute("/productos/$slug")({
  loader: async ({ context, params }) => {
    const result = await context.queryClient.ensureQueryData(productQueryOptions(params.slug));
    if (!result.product) throw notFound();
    return { product: result.product as PublicProduct };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: `Producto no disponible | ${BRAND.name}` }, { name: "robots", content: "noindex" }],
      };
    }
    const title = `${loaderData.product.name} | ${BRAND.name}`;
    const description =
      loaderData.product.short_description ??
      `Compra ${loaderData.product.name} con despacho a todo Chile y garantía directa ${BRAND.name}.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: ProductDetail,
  notFoundComponent: ProductNotFound,
});

function ProductNotFound() {
  return (
    <div className="protected-page">
      <div className="empty-state">
        <h2>Producto no encontrado</h2>
        <p>Puede que haya sido descontinuado o que el enlace esté mal escrito.</p>
        <Link to="/productos" className="btn primary">
          Ver catálogo
        </Link>
      </div>
    </div>
  );
}

function ProductDetail() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(productQueryOptions(slug));
  const product = data.product as PublicProduct;
  const specifications = (data.specifications ?? []) as ProductSpecification[];
  const [quantity, setQuantity] = useState(1);
  const cart = useCart();
  const notify = useToast();
  const { prices, isLoading } = usePrices([product.id], quantity);
  const price = prices.get(product.id);
  const available = price?.available_stock ?? product.available_stock ?? 0;
  const unit = price?.unit_price ?? product.retail_price;

  return (
    <div className="catalog-page">
      <section className="catalog-hero">
        <div className="container">
          <span className="eyebrow lime">{product.category_name ?? "Catálogo"}</span>
          <h1>{product.name}</h1>
          <p>SKU {product.sku}</p>
        </div>
      </section>

      <section className="container section">
        <div className="product-modal-grid">
          <ProductVisual product={product} large />
          <div className="product-detail">
            <div className="detail-meta">
              <span>{product.brand ?? BRAND.name}</span>
              {product.warranty_months ? <span>Garantía {product.warranty_months} meses</span> : null}
              <span className={available > 10 ? "stock ok" : "stock low"}>
                {available > 0 ? `${available} disponibles` : "Sin stock"}
              </span>
            </div>
            <h2>{product.short_name ?? product.name}</h2>
            <p className="detail-description">
              {product.description ?? product.short_description ?? `Herramienta profesional ${BRAND.name}.`}
            </p>

            {specifications.length > 0 && (
              <ul className="spec-list">
                {specifications.map((spec) => (
                  <li key={spec.id}>
                    <b>{spec.name}:</b> {spec.value}
                    {spec.unit ? ` ${spec.unit}` : ""}
                  </li>
                ))}
              </ul>
            )}

            <PriceBlock product={product} price={price} loading={isLoading} />

            <div className="buy-row">
              <div className="qty-control">
                <button aria-label="Quitar una unidad" disabled={quantity <= 1} onClick={() => setQuantity((q) => Math.max(1, q - 1))}>−</button>
                <span>{quantity}</span>
                <button aria-label="Agregar una unidad" disabled={available <= 0 || quantity >= available} onClick={() => setQuantity((q) => Math.min(Math.max(available, 1), q + 1))}>
                  ＋
                </button>
              </div>
              <button
                className="btn primary grow xl"
                disabled={available <= 0}
                onClick={() => {
                  cart.add(product.id, quantity, available);
                  notify(`${product.short_name ?? product.name} agregado al carrito`);
                }}
              >
                {available > 0 ? `Agregar · ${money(unit * quantity)}` : "Sin stock"}
              </button>
            </div>

            <p className="security-note">
              El precio final se calcula en el servidor según tu tipo de cliente y la cantidad.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
