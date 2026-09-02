import { useState, type ChangeEvent, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { userErrorMessage } from "@/lib/errors";
import { money } from "@/lib/format";

type ProductStatus = "draft" | "active" | "out_of_stock" | "discontinued";
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function imageExtension(file: File) {
  return (
    (
      {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/avif": "avif",
      } as Record<string, string>
    )[file.type] ?? "jpg"
  );
}

function storagePathFromPublicUrl(url: string | null) {
  if (!url) return null;
  const marker = "/storage/v1/object/public/productos/";
  const markerIndex = url.indexOf(marker);
  return markerIndex < 0 ? null : decodeURIComponent(url.slice(markerIndex + marker.length));
}

interface AdminProduct {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  retail_price: number;
  status: ProductStatus;
  physical_stock: number;
  blister_stock: number;
  master_box_stock: number;
  reserved_stock: number;
  available_stock: number;
  minimum_stock: number;
  image_url: string | null;
  blister_simple_units: number | null;
  master_box_units: number | null;
  category_id: string | null;
  category_name: string | null;
}

export function AdminCatalogManager() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [replacementImages, setReplacementImages] = useState<Record<string, File | undefined>>({});
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );
  const products = useQuery({
    queryKey: ["admin-catalog-products"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_catalog_products");
      if (error) throw error;
      return (data ?? []) as AdminProduct[];
    },
  });
  const categories = useQuery({
    queryKey: ["catalog-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name")
        .eq("active", true)
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function refreshCatalog() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-catalog-products"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-inventory"] }),
      queryClient.invalidateQueries({ queryKey: ["catalog"] }),
    ]);
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>, product: AdminProduct) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSavingId(product.id);
    setFeedback(null);
    try {
      const { error } = await supabase.rpc("admin_update_product", {
        _product_id: product.id,
        _sku: String(form.get("sku") ?? "")
          .trim()
          .toUpperCase(),
        _name: String(form.get("name") ?? ""),
        _description: String(form.get("description") ?? ""),
        _retail_price: Number(form.get("price")),
        _status: String(form.get("status")) as ProductStatus,
        _minimum_stock: Number(form.get("minimumStock")),
        _blister_simple_units: form.get("blisterSimple") ? Number(form.get("blisterSimple")) : null,
        _master_box_units: form.get("masterBox") ? Number(form.get("masterBox")) : null,
        _category_id: String(form.get("categoryId") ?? "") || null,
      });
      if (error) throw error;
      const replacementImage = replacementImages[product.id];
      if (replacementImage) await replaceProductImage(product, replacementImage);
      await refreshCatalog();
      setReplacementImages((current) => ({ ...current, [product.id]: undefined }));
      setEditingId(null);
      setFeedback({ type: "success", message: "Ficha del producto actualizada." });
    } catch (error) {
      setFeedback({
        type: "error",
        message: userErrorMessage(error, "No pudimos actualizar el producto."),
      });
    } finally {
      setSavingId(null);
    }
  }

  function chooseReplacementImage(event: ChangeEvent<HTMLInputElement>, productId: string) {
    const file = event.target.files?.[0];
    setFeedback(null);
    if (!file) {
      setReplacementImages((current) => ({ ...current, [productId]: undefined }));
      return;
    }
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES) {
      event.target.value = "";
      setReplacementImages((current) => ({ ...current, [productId]: undefined }));
      setFeedback({
        type: "error",
        message: "Usa una imagen JPG, PNG, WebP o AVIF de hasta 5 MB.",
      });
      return;
    }
    setReplacementImages((current) => ({ ...current, [productId]: file }));
  }

  async function replaceProductImage(product: AdminProduct, file: File) {
    const storagePath = `${new Date().getUTCFullYear()}/${product.id}-${crypto.randomUUID()}.${imageExtension(file)}`;
    const { error: uploadError } = await supabase.storage
      .from("productos")
      .upload(storagePath, file, {
        cacheControl: "31536000",
        contentType: file.type,
        upsert: false,
      });
    if (uploadError) throw uploadError;

    try {
      const { data: publicUrl } = supabase.storage.from("productos").getPublicUrl(storagePath);
      const { data: primaryImage, error: findError } = await supabase
        .from("product_images")
        .select("id")
        .eq("product_id", product.id)
        .eq("is_primary", true)
        .maybeSingle();
      if (findError) throw findError;

      const imageValues = {
        image_url: publicUrl.publicUrl,
        alt_text: product.name,
        is_primary: true,
      };
      const imageResult = primaryImage
        ? await supabase.from("product_images").update(imageValues).eq("id", primaryImage.id)
        : await supabase.from("product_images").insert({
            ...imageValues,
            product_id: product.id,
          });
      if (imageResult.error) throw imageResult.error;

      const oldStoragePath = storagePathFromPublicUrl(product.image_url);
      if (oldStoragePath && oldStoragePath !== storagePath) {
        await supabase.storage.from("productos").remove([oldStoragePath]);
      }
    } catch (error) {
      await supabase.storage.from("productos").remove([storagePath]);
      throw error;
    }
  }

  async function saveStock(event: FormEvent<HTMLFormElement>, product: AdminProduct) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSavingId(product.id);
    setFeedback(null);
    try {
      const blisterStock = Number(form.get("blisterStock"));
      const masterBoxStock = Number(form.get("masterBoxStock"));
      const { error } = await supabase.rpc("admin_set_product_packaging_stock", {
        _product_id: product.id,
        _blister_stock: blisterStock,
        _master_box_stock: masterBoxStock,
        _note: "Ajuste desde el panel de catálogo",
      });
      if (error) throw error;
      await refreshCatalog();
      setFeedback({ type: "success", message: `Stock de ${product.name} actualizado.` });
    } catch (error) {
      setFeedback({
        type: "error",
        message: userErrorMessage(error, "No pudimos actualizar el stock."),
      });
    } finally {
      setSavingId(null);
    }
  }

  async function archiveProduct(product: AdminProduct) {
    const confirmed = window.confirm(
      `¿Estás seguro de esto?\n\n${product.name} se eliminará del catálogo público. El historial de ventas se conservará.`,
    );
    if (!confirmed) return;
    setSavingId(product.id);
    setFeedback(null);
    try {
      const { error } = await supabase.rpc("admin_archive_product", { _product_id: product.id });
      if (error) throw error;
      await refreshCatalog();
      setEditingId(null);
      setFeedback({ type: "success", message: `${product.name} fue retirado del catálogo.` });
    } catch (error) {
      setFeedback({
        type: "error",
        message: userErrorMessage(error, "No pudimos retirar el producto del catálogo."),
      });
    } finally {
      setSavingId(null);
    }
  }

  async function restoreProduct(product: AdminProduct) {
    setSavingId(product.id);
    setFeedback(null);
    try {
      const { error } = await supabase.rpc("admin_restore_product", { _product_id: product.id });
      if (error) throw error;
      await refreshCatalog();
      setFeedback({ type: "success", message: `${product.name} volvió al catálogo.` });
    } catch (error) {
      setFeedback({
        type: "error",
        message: userErrorMessage(error, "No pudimos restaurar el producto."),
      });
    } finally {
      setSavingId(null);
    }
  }

  const activeProducts = products.data?.filter((product) => product.status !== "discontinued");
  const discontinuedProducts = products.data?.filter(
    (product) => product.status === "discontinued",
  );

  return (
    <>
      <section className="admin-card catalog-manager">
        <div className="card-title">
          <div>
            <h2>Gestión del catálogo</h2>
            <p>Edita fichas, precios, visibilidad y existencias sin eliminar productos.</p>
          </div>
          <button className="btn secondary" type="button" onClick={() => void products.refetch()}>
            Actualizar
          </button>
        </div>
        {feedback && (
          <div className={`form-feedback ${feedback.type}`} role="status">
            {feedback.message}
          </div>
        )}
        {products.isLoading && <div className="empty-orders">Cargando catálogo…</div>}
        {products.error && (
          <div className="form-feedback error">
            No pudimos cargar los productos. Aplica primero la migración de administración.
          </div>
        )}
        <div className="catalog-admin-list">
          {activeProducts?.map((product) => (
            <article className="catalog-admin-item" key={product.id}>
              <div className="catalog-admin-summary">
                {product.image_url ? (
                  <img src={product.image_url} alt="" />
                ) : (
                  <div className="catalog-image-empty">🛠️</div>
                )}
                <div>
                  <b>{product.name}</b>
                  <small>
                    SKU {product.sku} · {money(product.retail_price)}
                  </small>
                </div>
                <span className="order-status">{product.available_stock} disponibles</span>
                <button
                  className="mini-action"
                  type="button"
                  onClick={() => setEditingId(editingId === product.id ? null : product.id)}
                >
                  {editingId === product.id ? "Cerrar" : "Editar ficha"}
                </button>
              </div>
              <form className="stock-editor" onSubmit={(event) => void saveStock(event, product)}>
                <label>
                  Stock blíster/simple
                  <input
                    name="blisterStock"
                    type="number"
                    min="0"
                    defaultValue={product.blister_stock}
                    required
                  />
                </label>
                <label>
                  Stock caja máster
                  <input
                    name="masterBoxStock"
                    type="number"
                    min="0"
                    defaultValue={product.master_box_stock}
                    required
                  />
                </label>
                <small>
                  Total {product.physical_stock} · {product.reserved_stock} reservadas · mínimo{" "}
                  {product.minimum_stock}
                </small>
                <button className="mini-action approve" disabled={savingId === product.id}>
                  Guardar stock
                </button>
              </form>
              {editingId === product.id && (
                <form
                  className="catalog-edit-form"
                  onSubmit={(event) => void saveProduct(event, product)}
                >
                  <label>
                    Código de producto
                    <input name="sku" defaultValue={product.sku} maxLength={60} required />
                  </label>
                  <label>
                    Nombre
                    <input name="name" defaultValue={product.name} maxLength={140} required />
                  </label>
                  <label>
                    Filtro / categoría
                    <select name="categoryId" defaultValue={product.category_id ?? ""}>
                      <option value="">Sin categoría</option>
                      {categories.data?.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Precio CLP
                    <input
                      name="price"
                      type="number"
                      min="1"
                      step="1"
                      defaultValue={product.retail_price}
                      required
                    />
                  </label>
                  <label>
                    Stock mínimo
                    <input
                      name="minimumStock"
                      type="number"
                      min="0"
                      step="1"
                      defaultValue={product.minimum_stock}
                      required
                    />
                  </label>
                  <label>
                    Blíster simple
                    <input
                      name="blisterSimple"
                      type="number"
                      min="1"
                      step="1"
                      defaultValue={product.blister_simple_units ?? ""}
                      placeholder="Unidades"
                    />
                  </label>
                  <label>
                    Caja máster
                    <input
                      name="masterBox"
                      type="number"
                      min="1"
                      step="1"
                      defaultValue={product.master_box_units ?? ""}
                      placeholder="Unidades"
                    />
                  </label>
                  <label>
                    Estado
                    <select name="status" defaultValue={product.status}>
                      <option value="active">Activo</option>
                      <option value="draft">Borrador</option>
                      <option value="out_of_stock">Sin stock</option>
                      <option value="discontinued">Descontinuado</option>
                    </select>
                  </label>
                  <label className="catalog-description">
                    Descripción
                    <textarea
                      name="description"
                      rows={4}
                      maxLength={4000}
                      defaultValue={product.description ?? ""}
                    />
                  </label>
                  <label className="catalog-image-replacement">
                    Cambiar imagen
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      onChange={(event) => chooseReplacementImage(event, product.id)}
                    />
                    <small>
                      {replacementImages[product.id]
                        ? `Nueva imagen: ${replacementImages[product.id]?.name}`
                        : "Opcional. JPG, PNG, WebP o AVIF de hasta 5 MB."}
                    </small>
                  </label>
                  <div className="catalog-edit-actions">
                    {product.status !== "discontinued" && (
                      <button
                        className="btn danger"
                        type="button"
                        disabled={savingId === product.id}
                        onClick={() => void archiveProduct(product)}
                      >
                        Eliminar del catálogo
                      </button>
                    )}
                    <button className="btn primary" disabled={savingId === product.id}>
                      {savingId === product.id ? "Guardando…" : "Guardar cambios"}
                    </button>
                  </div>
                </form>
              )}
            </article>
          ))}
        </div>
      </section>
      <section className="admin-card lower-admin-grid discontinued-products">
        <div className="card-title">
          <div>
            <h2>Productos descontinuados</h2>
            <p>Publicaciones eliminadas del catálogo público.</p>
          </div>
          <span className="count-badge">{discontinuedProducts?.length ?? 0}</span>
        </div>
        {!products.isLoading && (discontinuedProducts?.length ?? 0) === 0 && (
          <div className="empty-orders">No hay productos descontinuados.</div>
        )}
        <div className="catalog-admin-list">
          {discontinuedProducts?.map((product) => (
            <article className="catalog-admin-item" key={product.id}>
              <div className="catalog-admin-summary">
                {product.image_url ? (
                  <img src={product.image_url} alt="" />
                ) : (
                  <div className="catalog-image-empty">🛠️</div>
                )}
                <div>
                  <b>{product.name}</b>
                  <small>
                    SKU {product.sku} · {money(product.retail_price)}
                  </small>
                </div>
                <span className="order-status">Descontinuado</span>
                <button
                  className="mini-action approve"
                  type="button"
                  disabled={savingId === product.id}
                  onClick={() => void restoreProduct(product)}
                >
                  Restaurar
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
