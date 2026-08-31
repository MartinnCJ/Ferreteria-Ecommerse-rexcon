import { Link } from "@tanstack/react-router";
import { money } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import type { PublicProduct, ResolvedPrice } from "@/types";

const TIER_LABEL: Record<string, string> = {
  retail: "Precio retail",
  professional: "Precio PRO",
  company: "Precio empresa",
  wholesale: "Precio mayorista",
  distributor: "Precio distribuidor",
};

export function PriceBlock({
  product,
  price,
  compact = false,
  loading = false,
}: {
  product: PublicProduct;
  price?: ResolvedPrice;
  compact?: boolean;
  loading?: boolean;
}) {
  const { user, profile } = useAuth();
  const tier = price?.tier ?? "retail";
  const unit = price?.unit_price ?? product.retail_price;
  const base = price?.base_price ?? product.retail_price;
  const discount = Number(price?.discount_percentage ?? 0);
  const pendingB2B =
    Boolean(profile) &&
    ["professional", "company", "wholesale", "distributor"].includes(profile!.customer_type) &&
    profile!.b2b_status !== "approved";

  if (pendingB2B) {
    return (
      <div className="price-block">
        <div className="price-label">Precio comercial</div>
        <div className={compact ? "price compact price-awaiting" : "price price-awaiting"}>
          En revisión
        </div>
        <div className="price-pending">
          Tu solicitud comercial está pendiente. Te avisaremos cuando tus precios estén activos.
        </div>
      </div>
    );
  }

  return (
    <div className="price-block">
      <div className="price-label">
        {TIER_LABEL[tier] ?? "Precio retail"}
        {discount > 0 ? ` · -${discount}% volumen` : ""}
      </div>
      <div className={compact ? "price compact" : "price"}>
        {loading ? "…" : money(unit)}
      </div>
      {base < product.retail_price && (
        <div className="price-compare">Retail {money(product.retail_price)}</div>
      )}
      {!user && (
        <Link to="/auth" search={{ modo: "registro" }} className="price-access">
          🔒 ¿Eres profesional o ferretería? Crea tu cuenta para precios comerciales
        </Link>
      )}
    </div>
  );
}
