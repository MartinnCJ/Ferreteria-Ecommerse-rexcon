# Fase 1 + 2 + 3: Base técnica del e-commerce B2C/B2B

## Qué detecté en el prototipo adjunto

Un único archivo `.jsx` (~1.276 líneas) con toda la app:

- `BRAND`, `CLIENT_TYPES` (customer / professional / wholesale / distributor / admin), `CATEGORIES` (array fijo), `INITIAL_PRODUCTS` con `retailPrice / professionalPrice / wholesalePrice / distributorPrice`, `stock`, `volumeTiers`, specs como array de strings.
- `SAMPLE_ORDERS`, `INITIAL_CUSTOMERS`, `INITIAL_QUOTES`, `CHILE_REGIONS`, `ORDER_STATUS_FLOW` (transiciones permitidas).
- Un componente gigante `HardwareEcommerceBase` con vistas por estado (catálogo, ficha, carrito, checkout, cuenta, admin), auth simulada, carrito y usuarios en `localStorage`, y `effectivePriceRole` calculado en el navegador según `role` + `priceAccessStatus`.
- Estilos en un string `CSS` inyectado (paleta oscura + acento lima, estética industrial).

Todo lo sensible (rol, aprobación comercial, precios, stock, totales) hoy vive en el navegador — ese es exactamente el punto a corregir.

## Decisiones de arquitectura (importantes)

- Este proyecto corre sobre **TanStack Start + React + TypeScript**, no Vite/CRA plano. La lógica de servidor se implementa con **server functions de TanStack** (`createServerFn`) en lugar de Supabase Edge Functions: mismo principio (código que el navegador no puede tocar, secretos solo en servidor), integrado al stack. Los webhooks futuros de Mercado Pago irán como ruta pública `/api/public/webhooks/mercadopago`.
- Backend: **Lovable Cloud** (Postgres + Auth + Storage + RLS gestionados). Lo habilito en este paso.
- La UI del prototipo se porta manteniendo estructura y estética: paleta y tipografía del prototipo se trasladan a tokens de diseño en `src/styles.css`; nada de rediseño.
- No se publica nada automáticamente.

## Alcance de esta entrega (solo Fases 1–3)

### 1. Esquema de base de datos (migración SQL versionada)

Tablas con FKs, constraints, índices, `created_at/updated_at` (timestamptz) y RLS activa:

`profiles`, `user_roles` (+ enum `app_role` y función `has_role` security definer), `categories` (con `parent_id`), `products`, `product_images`, `product_specifications`, `volume_price_rules`, `orders`, `order_items`, `quotes`, `quote_items`, `inventory_movements`, `shipping_zones`, `payment_events`, `admin_activity_log`.

Enums: `customer_type`, `b2b_status`, `product_status`, `order_status`, `payment_status`, `fulfillment_status`, `quote_status`, `inventory_movement_type`.

Reglas clave del esquema:
- `available_stock` como columna generada (`physical_stock - reserved_stock`), con checks que impiden valores negativos.
- Numeración humana `PED-000001` / `COT-000001` vía secuencia, separada del UUID interno.
- `order_items` / `quote_items` guardan snapshot (sku, nombre, precio unitario).
- Trigger `handle_new_user` que crea el `profile` desde `auth.users`, con `b2b_status = pending` para wholesale/distributor/company y `not_required` para retail.
- GRANTs explícitos por tabla según los roles que cada política permite.

### 2. Protección de precios y roles

- `products` **no** expone `wholesale_price`, `distributor_price`, `professional_price` ni `cost` al público: la política `anon`/`authenticated` de lectura se aplica sobre una **vista pública** con columnas seguras (retail y datos de catálogo).
- Los precios comerciales se resuelven por **RPC / server function** que verifica en el servidor `customer_type` + `b2b_status = approved` antes de devolver el precio, aplicando además las reglas de volumen. El navegador nunca recibe un tier al que no tiene derecho.
- `cost` accesible solo a admins.
- Ningún usuario puede escribir su propio rol: `user_roles` es de escritura exclusiva para admin/servicio, y `profiles` tiene política que bloquea auto-modificar `customer_type` y `b2b_status`.

### 3. Autenticación real (reemplazo de la demo)

- Página `/auth`: registro (nombre, apellido, email, teléfono, contraseña, tipo de cliente; RUT y razón social cuando corresponde), login, recuperación de contraseña, sesión persistente.
- Layout protegido para `/mi-cuenta` y `/admin` (este último además valida rol admin en servidor).
- Header reactivo a la sesión (avatar/menú + cerrar sesión), sin credenciales demo.
- Banner de estado B2B: "Tu acceso comercial está pendiente de aprobación — mientras tanto ves precio retail".
- Validación de RUT chileno (módulo 11) en formulario y en servidor.

### 4. Estructura de código

```
src/routes/        rutas (catálogo, producto, carrito, checkout, cuenta, admin, auth)
src/components/    Navbar, ProductCard, PriceDisplay, CartDrawer, ...
src/lib/*.functions.ts   server functions (pricing, auth, perfil)
src/services/      acceso a datos por dominio
src/types/         Product, Profile, Order, Quote, ...
src/data/seed      datos demo separados de la UI
```

### 5. Datos demo

Migración con seed de categorías (con subcategorías), los productos del prototipo, sus specs, reglas de volumen y zonas de despacho, marcados claramente como demo. Sin usuarios demo: los usuarios se crean por Auth real.

### 6. Verificación antes de cerrar la fase

Compilación, navegación desktop y mobile, registro/login/logout reales, que un usuario wholesale pendiente siga viendo precio retail, y que un cliente no pueda leer datos de otro ni escalar a admin.

## Fuera de alcance por ahora

Catálogo conectado (Fase 4), pricing en carrito, checkout, reservas de stock, cotizaciones y panel admin conectado se implementan en las fases siguientes, una por una. Mercado Pago no se integra: solo queda la abstracción de método de pago (`bank_transfer` inicial) y la tabla `payment_events` idempotente.
