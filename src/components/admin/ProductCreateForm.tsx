import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { userErrorMessage } from "@/lib/errors";

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const TEXT_DRAFT_KEY = "rexcon:admin:product-draft";
const DRAFT_DATABASE = "rexcon-admin-drafts";
const IMAGE_STORE = "images";
const IMAGE_DRAFT_KEY = "new-product";

type TextDraft = {
  productCode: string;
  name: string;
  description: string;
  price: string;
  blisterSimple: string;
  masterBox: string;
  categoryId: string;
};

function openDraftDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DRAFT_DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(IMAGE_STORE)) {
        request.result.createObjectStore(IMAGE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readDraftImage() {
  const database = await openDraftDatabase();
  return new Promise<File | null>((resolve, reject) => {
    const transaction = database.transaction(IMAGE_STORE);
    const request = transaction.objectStore(IMAGE_STORE).get(IMAGE_DRAFT_KEY);
    request.onsuccess = () => resolve(request.result instanceof File ? request.result : null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

async function writeDraftImage(file: File | null) {
  const database = await openDraftDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(IMAGE_STORE, "readwrite");
    if (file) transaction.objectStore(IMAGE_STORE).put(file, IMAGE_DRAFT_KEY);
    else transaction.objectStore(IMAGE_STORE).delete(IMAGE_DRAFT_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function extensionFor(file: File) {
  const byType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
  };
  return byType[file.type] ?? "jpg";
}

export function ProductCreateForm() {
  const queryClient = useQueryClient();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [productCode, setProductCode] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [blisterSimple, setBlisterSimple] = useState("");
  const [masterBox, setMasterBox] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );
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

  useEffect(() => {
    try {
      const saved = localStorage.getItem(TEXT_DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved) as Partial<TextDraft>;
        setName(typeof draft.name === "string" ? draft.name : "");
        setProductCode(typeof draft.productCode === "string" ? draft.productCode : "");
        setDescription(typeof draft.description === "string" ? draft.description : "");
        setPrice(typeof draft.price === "string" ? draft.price : "");
        setBlisterSimple(typeof draft.blisterSimple === "string" ? draft.blisterSimple : "");
        setMasterBox(typeof draft.masterBox === "string" ? draft.masterBox : "");
        setCategoryId(typeof draft.categoryId === "string" ? draft.categoryId : "");
      }
    } catch {
      localStorage.removeItem(TEXT_DRAFT_KEY);
    }
    void readDraftImage()
      .then(setImageFile)
      .catch(() => undefined)
      .finally(() => setDraftRestored(true));
  }, []);

  useEffect(() => {
    if (!draftRestored) return;
    const draft: TextDraft = {
      productCode,
      name,
      description,
      price,
      blisterSimple,
      masterBox,
      categoryId,
    };
    if (productCode || name || description || price || blisterSimple || masterBox || categoryId)
      localStorage.setItem(TEXT_DRAFT_KEY, JSON.stringify(draft));
    else localStorage.removeItem(TEXT_DRAFT_KEY);
  }, [blisterSimple, categoryId, description, draftRestored, masterBox, name, price, productCode]);

  useEffect(() => {
    if (!draftRestored) return;
    void writeDraftImage(imageFile).catch(() => {
      setFeedback({ type: "error", message: "No pudimos guardar la imagen en el borrador local." });
    });
  }, [draftRestored, imageFile]);

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(imageFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile]);

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setFeedback(null);
    if (!file) {
      setImageFile(null);
      return;
    }
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES) {
      setImageFile(null);
      event.target.value = "";
      setFeedback({
        type: "error",
        message: "Usa una imagen JPG, PNG, WebP o AVIF de hasta 5 MB.",
      });
      return;
    }
    setImageFile(file);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    const numericPrice = Number(price);
    const numericBlister = blisterSimple ? Number(blisterSimple) : null;
    const numericMasterBox = masterBox ? Number(masterBox) : null;
    if (
      !productCode.trim() ||
      !name.trim() ||
      !description.trim() ||
      !imageFile ||
      !Number.isFinite(numericPrice) ||
      numericPrice <= 0
    ) {
      setFeedback({
        type: "error",
        message: "Completa todos los campos con un precio mayor que cero.",
      });
      return;
    }
    const normalizedCode = productCode.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9._/-]*$/.test(normalizedCode) || normalizedCode.length > 60) {
      setFeedback({
        type: "error",
        message: "El código solo puede usar letras, números, punto, guion, barra y guion bajo.",
      });
      return;
    }
    if (
      (numericBlister !== null && (!Number.isInteger(numericBlister) || numericBlister <= 0)) ||
      (numericMasterBox !== null && (!Number.isInteger(numericMasterBox) || numericMasterBox <= 0))
    ) {
      setFeedback({
        type: "error",
        message: "Los formatos de empaque deben ser números enteros mayores que cero.",
      });
      return;
    }

    setSubmitting(true);
    let storagePath: string | null = null;
    let productId: string | null = null;
    try {
      const unique = crypto.randomUUID();
      const slug = `${slugify(name) || "producto"}-${unique.slice(0, 8)}`;
      const sku = normalizedCode;
      storagePath = `${new Date().getUTCFullYear()}/${unique}.${extensionFor(imageFile)}`;

      const { error: uploadError } = await supabase.storage
        .from("productos")
        .upload(storagePath, imageFile, {
          cacheControl: "31536000",
          contentType: imageFile.type,
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from("productos").getPublicUrl(storagePath);
      const { data: product, error: productError } = await supabase
        .from("products")
        .insert({
          name: name.trim(),
          description: description.trim(),
          short_description: description.trim().slice(0, 180),
          retail_price: numericPrice,
          sku,
          slug,
          brand: "REXCON",
          status: "active",
          blister_simple_units: numericBlister,
          master_box_units: numericMasterBox,
          category_id: categoryId || null,
        })
        .select("id")
        .single();
      if (productError) throw productError;
      productId = product.id;

      const { error: imageError } = await supabase.from("product_images").insert({
        product_id: product.id,
        image_url: publicUrlData.publicUrl,
        alt_text: name.trim(),
        is_primary: true,
      });
      if (imageError) throw imageError;

      setName("");
      setProductCode("");
      setDescription("");
      setPrice("");
      setBlisterSimple("");
      setMasterBox("");
      setCategoryId("");
      setImageFile(null);
      localStorage.removeItem(TEXT_DRAFT_KEY);
      await writeDraftImage(null).catch(() => undefined);
      if (imageInputRef.current) imageInputRef.current.value = "";
      setFeedback({ type: "success", message: "Producto publicado correctamente." });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["catalog"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-inventory"] }),
      ]);
    } catch (error) {
      if (productId) await supabase.from("products").delete().eq("id", productId);
      if (storagePath) await supabase.storage.from("productos").remove([storagePath]);
      setFeedback({
        type: "error",
        message: userErrorMessage(error, "No pudimos crear el producto."),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="admin-card product-create-card" aria-labelledby="new-product-title">
      <div className="card-title">
        <div>
          <h2 id="new-product-title">Nuevo producto</h2>
          <p>Publica una ficha con imagen, descripción y precio de venta.</p>
        </div>
      </div>
      <form className="product-create-form" onSubmit={submit}>
        <div className="product-image-field">
          <label htmlFor="product-image">Imagen del producto</label>
          <input
            ref={imageInputRef}
            id="product-image"
            name="image"
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            onChange={chooseImage}
            disabled={submitting}
          />
          <small>JPG, PNG, WebP o AVIF · máximo 5 MB.</small>
          {imageFile && <small className="draft-saved">Borrador guardado: {imageFile.name}</small>}
          {previewUrl && <img src={previewUrl} alt="Vista previa del producto" />}
        </div>
        <div className="product-fields">
          <div className="name-code-fields">
            <label>
              Código de producto
              <input
                value={productCode}
                onChange={(event) => setProductCode(event.target.value.toUpperCase())}
                maxLength={60}
                placeholder="Ej. DTG040"
                autoComplete="off"
                disabled={submitting}
                required
              />
            </label>
            <label>
              Nombre
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={140}
                disabled={submitting}
                required
              />
            </label>
          </div>
          <label>
            Filtro / categoría
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              disabled={submitting || categories.isLoading}
            >
              <option value="">Sin categoría</option>
              {categories.data?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Descripción
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              maxLength={4000}
              disabled={submitting}
              required
            />
          </label>
          <div className="packaging-fields">
            <label>
              Blíster simple (unidades)
              <input
                type="number"
                value={blisterSimple}
                onChange={(event) => setBlisterSimple(event.target.value)}
                min="1"
                step="1"
                inputMode="numeric"
                placeholder="Ej. 10"
                disabled={submitting}
              />
            </label>
            <label>
              Caja máster (unidades)
              <input
                type="number"
                value={masterBox}
                onChange={(event) => setMasterBox(event.target.value)}
                min="1"
                step="1"
                inputMode="numeric"
                placeholder="Ej. 200"
                disabled={submitting}
              />
            </label>
          </div>
          <label>
            Precio (CLP)
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              min="1"
              step="1"
              inputMode="numeric"
              disabled={submitting}
              required
            />
          </label>
          {feedback && (
            <div className={`form-feedback ${feedback.type}`} role="status">
              {feedback.message}
            </div>
          )}
          <button className="btn primary" type="submit" disabled={submitting}>
            {submitting ? "Publicando…" : "Publicar producto"}
          </button>
        </div>
      </form>
    </section>
  );
}
