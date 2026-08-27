# Hardening / revisión técnica

Fecha de revisión: 2026-08-24

## Qué se corrigió

### Autenticación y perfiles
- Trigger real `auth.users -> profiles`.
- Backfill de usuarios que hubieran quedado sin perfil.
- Sincronización de email desde Auth.
- El cliente ya no puede cambiar email, `customer_type`, `b2b_status` ni metadatos de revisión directamente.
- Registro B2B queda `pending`; nunca se autoaprueba.
- Recuperación/restablecimiento de contraseña.
- Rutas reales `/mi-cuenta`, `/admin` y `/restablecer-clave`.

### B2B
- Solicitud segura mediante `request_b2b_access()`.
- Revisión admin auditada mediante `review_b2b_access()`.
- Precios comerciales continúan protegidos por el resolver del servidor.
- Se eliminaron porcentajes promocionales inventados del frontend.

### Catálogo
- Marca centralizada en `BRAND`.
- Imágenes principales desde `product_images`.
- Imágenes/especificaciones de productos draft/discontinued dejan de ser públicas.
- Filtros por categoría incluyen descendientes.
- Validación y normalización de datos al cruzar el límite servidor/UI.

### Carrito y pricing
- Persistencia local defensiva: valida estructura, deduplica y limita cantidades.
- Una sola RPC `resolve_cart_prices()` para todas las líneas.
- El navegador nunca envía un precio como fuente de verdad.
- Revalidación de stock y precio antes de acciones sensibles.

### Checkout / pedidos
- Checkout real por transferencia mediante RPC transaccional.
- Precio, descuentos, despacho y stock se recalculan en PostgreSQL.
- Reserva de inventario por 24 h.
- Conversión de reserva a venta solo al confirmar transferencia.
- Cancelación segura solo para pedidos no pagados.
- Los pedidos pagados requieren futuro flujo de devolución; no liberan reservas ajenas.
- Idempotencia reforzada con advisory lock para doble click/reintentos concurrentes.
- Máquina logística: Preparando -> Listo -> Enviado -> Entregado.

### Cotizaciones
- Cuentas comerciales pendientes/aprobadas pueden crear una cotización desde el carrito.
- Los precios se guardan como snapshot calculado por backend.
- Las cotizaciones no reservan inventario.
- Admin puede tomar una solicitud para revisión o rechazarla.

### Inventario
- Físico, reservado y disponible permanecen separados.
- Panel admin usa `minimum_stock` de cada SKU, no un número hardcodeado.
- Movimientos de inventario quedan registrados para reserva, liberación y venta.
- Función de liberación de reservas vencidas preparada para cron/service role.

### Seguridad
- RLS sigue siendo la barrera principal de acceso por usuario/admin.
- Se revocó inserción directa de perfiles a clientes.
- Pedidos y sus items no se crean/modifican directamente desde el navegador.
- Claves Supabase `sb_secret_` son rechazadas en clientes/RLS middleware donde serían peligrosas.
- Restricciones adicionales de integridad para stock, precios, zonas de despacho y totales.
- Una sola imagen puede quedar marcada como primaria por producto.

## Validación realizada aquí

- Todos los archivos `.ts`/`.tsx` pasan una transpilación de sintaxis con TypeScript.
- Todos los imports locales resuelven a archivos existentes.
- Se verificó que todas las rutas enlazadas principales existan.
- Se revisaron patrones de acceso a tablas sensibles y las RPC usadas por el frontend.
- La migración nueva tiene bloques dollar-quoted balanceados y las funciones `SECURITY DEFINER` usan `search_path` explícito.

## Limitación de esta revisión

El ZIP original no incluía `node_modules` y la instalación de dependencias no completó en este entorno, por lo que aquí no se pudo ejecutar un `vite build`/`eslint` completo ni aplicar la migración contra la base Supabase real. Al importar los cambios en Lovable, el primer paso debe ser aplicar la migración y ejecutar build/lint allí antes de publicar.

## No implementado todavía a propósito

- Mercado Pago y webhooks reales.
- Datos bancarios reales.
- Automatización cron de reservas vencidas.
- Devoluciones/reembolsos de pedidos pagados.
- Edición avanzada de una cotización por el administrador y conversión a pedido.
- Emisión tributaria/facturación electrónica.

## 2026-08-24 — Identidad REXCON

- Reemplazado el placeholder visual de marca por el emblema oficial REXCON mejorado.
- Agregados `public/brand/rexcon-emblem.png` y `public/brand/rexcon-logo.png`.
- Favicon y Apple Touch Icon ahora derivan del emblema REXCON.
- Centralizada la marca visible como `REXCON` mediante `BRAND`.
- Creado `BrandMark` reutilizable para header, footer, login y recuperación de contraseña.
- Migrado el namespace del carrito a `rexcon_cart_v3` conservando compatibilidad con `nexo_cart_v3` para no perder carritos existentes.
