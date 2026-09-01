export type CustomerType =
  | "retail"
  | "professional"
  | "company"
  | "wholesale"
  | "distributor"
  | "admin";

export type B2BStatus =
  | "not_required"
  | "pending"
  | "approved"
  | "rejected"
  | "suspended";

export interface Profile {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  rut: string | null;
  company_name: string | null;
  company_rut: string | null;
  customer_type: CustomerType;
  b2b_status: B2BStatus;
  b2b_review_note: string | null;
  b2b_reviewed_at: string | null;
  b2b_reviewed_by: string | null;
  is_admin?: boolean;
}

export interface PublicProduct {
  id: string;
  sku: string;
  slug: string;
  name: string;
  short_name: string | null;
  short_description: string | null;
  description: string | null;
  category_id: string | null;
  category_name: string | null;
  category_slug: string | null;
  brand: string | null;
  status: string | null;
  featured: boolean | null;
  icon: string | null;
  accent: string | null;
  retail_price: number;
  available_stock: number;
  warranty_months: number | null;
  image_url: string | null;
  image_alt: string | null;
}

export interface ProductSpecification {
  id: string;
  name: string;
  value: string;
  unit: string | null;
  sort_order: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  sort_order: number;
}

export interface ResolvedPrice {
  product_id: string;
  tier: CustomerType;
  base_price: number;
  unit_price: number;
  discount_percentage: number;
  available_stock: number;
}

export interface CartLine {
  productId: string;
  quantity: number;
}

export interface InventoryRow {
  product_id: string;
  sku: string;
  name: string;
  status: "draft" | "active" | "out_of_stock" | "discontinued";
  physical_stock: number;
  reserved_stock: number;
  available_stock: number;
  minimum_stock: number;
  retail_price: number;
}

export interface ShippingQuote {
  shipping_total: number;
  free_shipping_threshold: number | null;
  zone_id: string;
}

export interface OrderSummary {
  id: string;
  order_number: string;
  status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";
  payment_status:
    | "pending"
    | "awaiting_transfer"
    | "paid"
    | "failed"
    | "refunded"
    | "partially_refunded"
    | "cancelled";
  fulfillment_status: "unfulfilled" | "preparing" | "ready" | "shipped" | "delivered" | "returned";
  total: number;
  reservation_expires_at: string | null;
  created_at: string;
}

export interface QuoteSummary {
  id: string;
  quote_number: string;
  status: "requested" | "reviewing" | "sent" | "accepted" | "rejected" | "expired" | "converted";
  total: number;
  customer_notes: string | null;
  admin_notes: string | null;
  valid_until: string | null;
  created_at: string;
}

export interface QuoteRequestResult {
  quote_id: string;
  quote_number: string;
  total: number;
}

export interface CheckoutResult {
  order_id: string;
  order_number: string;
  subtotal: number;
  shipping_total: number;
  total: number;
  reservation_expires_at: string | null;
}

export const CLIENT_TYPES: Record<string, { label: string; badge: string }> = {
  retail: { label: "Particular", badge: "Retail" },
  professional: { label: "Maestro / Profesional", badge: "PRO" },
  company: { label: "Empresa", badge: "Empresa" },
  wholesale: { label: "Ferretería / Mayorista", badge: "Mayorista" },
  distributor: { label: "Distribuidor", badge: "Distribuidor" },
  admin: { label: "Administrador", badge: "Admin" },
};

export const BRAND = {
  name: "REXCON",
  shortName: "REXCON",
  tagline: "Herramientas hechas para trabajar.",
  supportEmail: "ventas@tumarca.cl",
  supportPhone: "+56 9 0000 0000",
  logoMark: "/brand/rexcon-emblem.png",
  logoFull: "/brand/rexcon-logo.png",
} as const;

export const CHILE_REGIONS = [
  "Arica y Parinacota",
  "Tarapacá",
  "Antofagasta",
  "Atacama",
  "Coquimbo",
  "Valparaíso",
  "Metropolitana",
  "O'Higgins",
  "Maule",
  "Ñuble",
  "Biobío",
  "La Araucanía",
  "Los Ríos",
  "Los Lagos",
  "Aysén",
  "Magallanes",
];
