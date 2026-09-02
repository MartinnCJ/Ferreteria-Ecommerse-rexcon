import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { userErrorMessage } from "@/lib/errors";
import { money } from "@/lib/format";

type ProductStatus = "draft" | "active" | "out_of_stock" | "discontinued";

interface AdminProduct {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  retail_price: number;
  status: ProductStatus;
  physical_stock: number;
  reserved_stock: number;
  available_stock: number;
  minimum_stock: number;
  image_url: string | null;
}

export function AdminCatalogManager() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
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
        _name: String(form.get("name") ?? ""),
        _description: String(form.get("description") ?? ""),
        _retail_price: Number(form.get("price")),
        _status: String(form.get("status")) as ProductStatus,
        _minimum_stock: Number(form.get("minimumStock")),
      });
      if (error) throw error;
      await refreshCatalog();
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

  async function saveStock(event: FormEvent<HTMLFormElement>, product: AdminProduct) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSavingId(product.id);
    setFeedback(null);
    try {
      const { error } = await supabase.rpc("admin_set_product_stock", {
        _product_id: product.id,
        _physical_stock: Number(form.get("stock")),
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

  return (
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
        {products.data?.map((product) => (
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
                Stock físico
                <input
                  name="stock"
                  type="number"
                  min={product.reserved_stock}
                  defaultValue={product.physical_stock}
                  required
                />
              </label>
              <small>
                {product.reserved_stock} reservadas · mínimo {product.minimum_stock}
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
                  Nombre
                  <input name="name" defaultValue={product.name} maxLength={140} required />
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
                <div className="catalog-edit-actions">
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
  );
}
