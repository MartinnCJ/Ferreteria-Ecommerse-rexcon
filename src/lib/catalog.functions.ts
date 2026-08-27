import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import type { Category, PublicProduct } from "@/types";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  if (key.startsWith("sb_secret_")) {
    throw new Error("El catálogo público no debe ejecutarse con una Supabase secret key");
  }
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

type CatalogProductRow = Pick<
  Database["public"]["Views"]["products_public"]["Row"],
  | "id" | "sku" | "slug" | "name" | "short_name" | "short_description" | "description"
  | "category_id" | "category_name" | "category_slug" | "brand" | "status" | "featured"
  | "icon" | "accent" | "retail_price" | "available_stock" | "warranty_months"
>;

type CatalogCategoryRow = Pick<
  Database["public"]["Tables"]["categories"]["Row"],
  "id" | "name" | "slug" | "parent_id" | "sort_order"
>;

function normalizeProduct(
  row: CatalogProductRow,
  image?: { image_url: string; image_alt: string | null },
): PublicProduct {
  if (!row.id || !row.sku || !row.slug || !row.name || row.retail_price == null) {
    throw new Error("Producto público incompleto en la base de datos");
  }
  return {
    id: row.id,
    sku: row.sku,
    slug: row.slug,
    name: row.name,
    short_name: row.short_name,
    short_description: row.short_description,
    description: row.description,
    category_id: row.category_id,
    category_name: row.category_name,
    category_slug: row.category_slug,
    brand: row.brand,
    status: row.status,
    featured: row.featured,
    icon: row.icon,
    accent: row.accent,
    retail_price: row.retail_price,
    available_stock: Math.max(0, row.available_stock ?? 0),
    warranty_months: row.warranty_months,
    image_url: image?.image_url ?? null,
    image_alt: image?.image_alt ?? null,
  };
}

function normalizeCategory(row: CatalogCategoryRow): Category {
  return { id: row.id, name: row.name, slug: row.slug, parent_id: row.parent_id, sort_order: row.sort_order };
}

/** Catálogo público: solo columnas seguras (precio retail, sin costo ni precios B2B). */
export const listCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  const [products, categories] = await Promise.all([
    supabase
      .from("products_public")
      .select(
        "id, sku, slug, name, short_name, short_description, description, category_id, category_name, category_slug, brand, status, featured, icon, accent, retail_price, available_stock, warranty_months",
      )
      .order("featured", { ascending: false })
      .order("name"),
    supabase.from("categories").select("id, name, slug, parent_id, sort_order").order("sort_order"),
  ]);

  if (products.error) throw new Error(products.error.message);
  if (categories.error) throw new Error(categories.error.message);

  const productRows = products.data ?? [];
  const ids = productRows.map((product) => product.id).filter((id): id is string => Boolean(id));
  const primaryImages = new Map<string, { image_url: string; image_alt: string | null }>();

  if (ids.length > 0) {
    const { data: images, error: imagesError } = await supabase
      .from("product_images")
      .select("product_id, image_url, alt_text, is_primary, sort_order")
      .in("product_id", ids)
      .order("is_primary", { ascending: false })
      .order("sort_order", { ascending: true });
    if (imagesError) throw new Error(imagesError.message);
    for (const image of images ?? []) {
      if (!primaryImages.has(image.product_id)) {
        primaryImages.set(image.product_id, { image_url: image.image_url, image_alt: image.alt_text });
      }
    }
  }

  return {
    products: productRows.map((product) =>
      normalizeProduct(product, product.id ? primaryImages.get(product.id) : undefined),
    ),
    categories: (categories.data ?? []).map(normalizeCategory),
  };
});

export const getProductBySlug = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ slug: z.string().min(1).max(180) }).parse(input))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: product, error } = await supabase
      .from("products_public")
      .select(
        "id, sku, slug, name, short_name, short_description, description, category_id, category_name, category_slug, brand, status, featured, icon, accent, retail_price, available_stock, warranty_months",
      )
      .eq("slug", data.slug)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!product?.id) return { product: null, specifications: [] };

    const [specificationsResult, imagesResult] = await Promise.all([
      supabase
        .from("product_specifications")
        .select("id, name, value, unit, sort_order")
        .eq("product_id", product.id)
        .order("sort_order"),
      supabase
        .from("product_images")
        .select("image_url, alt_text, is_primary, sort_order")
        .eq("product_id", product.id)
        .order("is_primary", { ascending: false })
        .order("sort_order", { ascending: true }),
    ]);

    if (specificationsResult.error) throw new Error(specificationsResult.error.message);
    if (imagesResult.error) throw new Error(imagesResult.error.message);
    const primaryImage = imagesResult.data?.[0];

    return {
      product: normalizeProduct(product, primaryImage ? { image_url: primaryImage.image_url, image_alt: primaryImage.alt_text } : undefined),
      specifications: specificationsResult.data ?? [],
    };
  });
