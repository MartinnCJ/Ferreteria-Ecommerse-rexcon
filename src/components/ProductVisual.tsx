import type { CSSProperties } from "react";
import { BRAND, type PublicProduct } from "@/types";

export function ProductVisual({
  product,
  large = false,
}: {
  product: Pick<PublicProduct, "accent" | "icon" | "sku" | "image_url" | "image_alt">;
  large?: boolean;
}) {
  return (
    <div
      className={large ? "product-visual large" : "product-visual"}
      style={{ "--accent": product.accent ?? "#E7FF4F" } as CSSProperties}
    >
      {product.image_url ? (
        <img
          className="product-photo"
          src={product.image_url}
          alt={product.image_alt || `Producto ${product.sku}`}
          loading={large ? "eager" : "lazy"}
        />
      ) : (
        <>
          <div className="visual-grid" />
          <div className="visual-glow" />
          <div className="tool-icon">{product.icon ?? "🛠️"}</div>
          <div className="visual-brand">{BRAND.shortName}</div>
          <div className="visual-sku">{product.sku}</div>
        </>
      )}
    </div>
  );
}
