import { Link } from "@tanstack/react-router";
import { ProductVisual } from "@/components/ProductVisual";
import { PriceBlock } from "@/components/PriceBlock";
import { useCart } from "@/hooks/useCart";
import { useToast } from "@/hooks/useToast";
import type { PublicProduct, ResolvedPrice } from "@/types";

export function ProductCard({
  product,
  price,
  loadingPrice,
}: {
  product: PublicProduct;
  price?: ResolvedPrice;
  loadingPrice?: boolean;
}) {
  const cart = useCart();
  const notify = useToast();
  const available = price?.available_stock ?? product.available_stock ?? 0;

  return (
    <article className="product-card">
      <Link to="/productos/$slug" params={{ slug: product.slug }} className="product-card-link">
        <ProductVisual product={product} />
      </Link>
      <div className="product-card-body">
        <div className="product-meta-row">
          <span className="eyebrow">{product.category_name}</span>
          <span className={available > 10 ? "stock ok" : "stock low"}>
            {available > 10 ? "● En stock" : available > 0 ? `● Últimas ${available}` : "● Sin stock"}
          </span>
        </div>
        <h3>
          <Link to="/productos/$slug" params={{ slug: product.slug }}>
            {product.name}
          </Link>
        </h3>
        <p className="sku">SKU {product.sku}</p>
        <PriceBlock product={product} price={price} compact loading={loadingPrice} />
        <div className="card-actions">
          <Link
            to="/productos/$slug"
            params={{ slug: product.slug }}
            className="btn secondary"
          >
            Ver detalle
          </Link>
          <button
            className="btn primary square"
            aria-label={`Agregar ${product.name} al carrito`}
            disabled={available <= 0}
            onClick={() => {
              if (available <= 0) {
                notify("Producto temporalmente sin stock disponible");
                return;
              }
              cart.add(product.id, 1, available);
              notify(`${product.short_name ?? product.name} agregado al carrito`);
            }}
          >
            ＋
          </button>
        </div>
      </div>
    </article>
  );
}
