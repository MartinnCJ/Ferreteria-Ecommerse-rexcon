# Prompt Maestro

PROMPT MAESTRO — E-COMMERCE B2C + B2B DE HERRAMIENTAS EN CHILE

Quiero convertir el prototipo React adjunto en una aplicación e-commerce real, robusta y preparada para producción utilizando Lovable + Supabase.

1. CONTEXTO DEL NEGOCIO

Este proyecto corresponde a la tienda oficial de una marca propia de productos de ferretería y herramientas importados desde China y comercializados en Chile.

No debe sentirse como la página web tradicional de una ferretería local.

Debe sentirse como:

una marca profesional de herramientas con venta directa a consumidor final, profesionales, empresas, ferreterías y distribuidores a lo largo de Chile.

La plataforma tendrá dos dimensiones:

B2C

Venta directa a consumidor final.

B2B

Venta a:

maestros y profesionales;

empresas;

ferreterías;

distribuidores.

Los clientes B2B podrán acceder a precios especiales según su categoría y aprobación.

2. REGLA PRINCIPAL

Existe un frontend/prototipo React que ya contiene gran parte de la experiencia que quiero.

NO reconstruyas la aplicación desde cero.

Úsalo como base.

Quiero mantener en la medida de lo posible:

estructura visual;

navegación;

catálogo;

fichas de productos;

carrito;

checkout;

panel de cliente;

panel administrativo;

sistema visual de precios;

lógica conceptual B2B;

descuentos por volumen;

sistema de cotizaciones;

estados de pedidos;

sistema de inventario.

Puedes refactorizar componentes cuando sea necesario para mejorar mantenibilidad, seguridad o integración con Supabase.

No debes realizar cambios visuales importantes que no sean necesarios.

Prioridad:

funcionalidad → seguridad → estabilidad → experiencia → estética.

No agregues features solo por agregarlas.

3. TECNOLOGÍA

Usar:

React

TypeScript cuando sea posible

Supabase

Supabase Auth

PostgreSQL de Supabase

Row Level Security

Supabase Storage para imágenes si corresponde

Supabase Edge Functions cuando exista lógica que no deba ejecutarse en frontend

Preparar la arquitectura para integrar posteriormente:

Mercado Pago Chile

Webhooks de Mercado Pago

servicios de despacho

generación de documentos tributarios

NO integrar Mercado Pago todavía salvo que se solicite explícitamente después.

Por ahora debe existir una abstracción clara de métodos de pago que permita agregarlo posteriormente sin rehacer el sistema.

4. PRINCIPIO DE SEGURIDAD CRÍTICO

El frontend NO debe ser fuente de verdad para:

precios;

roles;

descuentos;

inventario;

stock reservado;

aprobación B2B;

totales de pedidos;

permisos;

estados sensibles;

procesamiento de pagos.

Nunca confiar en datos modificables desde el navegador para determinar cuánto debe pagar un cliente.

Los precios finales deben validarse/calcularse mediante lógica segura conectada a Supabase.

Nunca almacenar secretos, service role keys ni futuras credenciales de Mercado Pago en frontend.

5. AUTENTICACIÓN

Reemplazar completamente la autenticación demo/local por Supabase Auth real.

Implementar:

Registro

Campos:

nombre

apellido

email

teléfono

contraseña

RUT, opcional inicialmente dependiendo del tipo de cliente

razón social, cuando corresponda

tipo de cliente

Tipos:

retail

professional

company

wholesale

distributor

La interfaz puede presentar estos nombres en español:

Particular

Maestro / Profesional

Empresa

Ferretería / Mayorista

Distribuidor

6. MODELO DE USUARIO

Crear una tabla profiles asociada a auth.users.

Ejemplo conceptual:

profiles

id uuid
email
first_name
last_name
phone
rut
company_name
company_rut
customer_type
b2b_status
created_at
updated_at


customer_type:

retail
professional
company
wholesale
distributor
admin


b2b_status:

not_required
pending
approved
rejected
suspended


IMPORTANTE:

Registrarse como mayorista o distribuidor NO otorga automáticamente acceso a esos precios.

Debe existir aprobación administrativa.

Ejemplo:

Usuario solicita:

wholesale

pero:

b2b_status = pending

Entonces continúa viendo precio retail hasta que sea aprobado.

7. ADMINISTRADORES

NO determinar que alguien es administrador simplemente leyendo un campo modificable por el usuario.

Crear una solución segura para roles administrativos.

Idealmente:

user_roles


o claims/roles controlados desde backend.

Un usuario normal nunca debe poder asignarse:

admin


desde el navegador.

8. PRODUCTOS

Crear tabla products.

Como mínimo:

id
sku
slug
name
short_description
description
category_id
brand
status
featured
retail_price
professional_price
wholesale_price
distributor_price
cost
physical_stock
reserved_stock
minimum_stock
weight
width
height
length
warranty_months
created_at
updated_at


Estados sugeridos:

draft
active
out_of_stock
discontinued


9. PRECIOS

Mantener esta arquitectura conceptual:

retail_price
professional_price
wholesale_price
distributor_price


El precio mostrado depende de:

sesión;

tipo de cliente;

aprobación B2B;

cantidad comprada;

reglas comerciales vigentes.

Si el usuario no está aprobado:

retail_price


aunque se haya registrado como mayorista.

10. PROTECCIÓN DE PRECIOS B2B

Los precios mayoristas/distribuidor NO deben descargarse innecesariamente al navegador de visitantes sin autorización.

No resolver esto solamente haciendo:

if (!loggedIn) hidePrice()


porque el precio seguiría existiendo en el payload.

Aplicar RLS, RPC, Edge Functions o consultas seguras según sea necesario para evitar exposición de precios privados.

11. DESCUENTOS POR VOLUMEN

Crear sistema separado y escalable.

Ejemplo:

volume_price_rules

id
product_id
customer_type
min_quantity
max_quantity
discount_percentage
fixed_unit_price
active


Debe permitir reglas como:

1–5 unidades
6–11 unidades
12–23 unidades
24+


El precio calculado debe validarse también en backend.

12. CATEGORÍAS

Crear:

categories

id
name
slug
description
image_url
parent_id
active
sort_order


Permitir subcategorías.

Ejemplo:

Herramientas eléctricas
    Taladros
    Esmeriles
    Sierras

Herramientas manuales

Accesorios

Construcción

Seguridad


No hardcodear categorías permanentemente en React.

13. IMÁGENES

Crear:

product_images


Campos:

id
product_id
image_url
alt_text
sort_order
is_primary


Prepararlo para Supabase Storage.

Una ficha puede tener múltiples imágenes.

14. ESPECIFICACIONES TÉCNICAS

No quiero crear una columna diferente para cada característica posible.

Crear modelo flexible.

Por ejemplo:

product_specifications

id
product_id
name
value
unit
sort_order


Ejemplos:

Voltaje — 20 — V
Potencia — 850 — W
Diámetro — 115 — mm
RPM — 11000 — rpm


15. INVENTARIO

Mantener claramente diferenciados:

physical_stock
reserved_stock
available_stock


Donde:

available_stock = physical_stock - reserved_stock


El usuario solo debe poder comprar según:

available_stock


Nunca permitir stock negativo.

16. MOVIMIENTOS DE INVENTARIO

Idealmente crear:

inventory_movements

id
product_id
type
quantity
reference_type
reference_id
notes
created_by
created_at


Tipos:

purchase
sale
reservation
reservation_release
adjustment
return
cancelation


Esto permitirá posteriormente saber por qué cambió el inventario.

17. PEDIDOS

Crear tabla:

orders


Con:

id
order_number
user_id
status
payment_status
fulfillment_status

subtotal
discount_total
shipping_total
tax_total
total

customer_name
customer_email
customer_phone
customer_rut

shipping_address
shipping_city
shipping_region

billing_data

payment_method
payment_reference

created_at
updated_at


18. ITEMS DEL PEDIDO

Crear:

order_items


Campos:

id
order_id
product_id
sku
product_name
quantity
unit_price
discount
subtotal


MUY IMPORTANTE:

Guardar snapshot del producto y precio.

Si mañana cambia el nombre o precio del producto, un pedido histórico NO debe modificarse.

19. ESTADOS DE PEDIDO

Separar cuando sea posible:

Order status

pending
confirmed
processing
shipped
delivered
cancelled


Payment status

pending
awaiting_transfer
paid
failed
refunded
partially_refunded
cancelled


Fulfillment

unfulfilled
preparing
ready
shipped
delivered
returned


Evitar tener un solo campo que intente representar las tres cosas.

20. TRANSFERENCIA BANCARIA

Inicialmente permitir pago mediante transferencia.

Flujo:

Paso 1

Usuario realiza checkout.

Paso 2

Se crea pedido:

payment_status = awaiting_transfer


Paso 3

El stock correspondiente queda:

reserved_stock += quantity


NO descontarlo todavía de:

physical_stock


Paso 4

Administrador confirma transferencia.

Entonces:

payment_status = paid


y se convierte la reserva en venta real.

Conceptualmente:

physical_stock -= quantity
reserved_stock -= quantity


Cancelación

Si el pedido se cancela antes del pago:

reserved_stock -= quantity


sin reducir stock físico.

Todas estas operaciones sensibles deben ejecutarse transaccionalmente.

21. EVITAR SOBREVENTA

La reserva de stock debe realizarse mediante operación atómica/transacción de PostgreSQL.

Evitar:

consultar stock
→ esperar
→ actualizar stock


desde frontend.

Dos clientes comprando simultáneamente no deben poder adquirir la misma última unidad.

Crear RPC/función SQL o lógica equivalente.

22. EXPIRACIÓN DE RESERVAS

Preparar el sistema para que pedidos por transferencia puedan tener reserva temporal.

Por ejemplo:

reservation_expires_at


No es necesario automatizar todavía la expiración si complica excesivamente el MVP, pero dejar la arquitectura preparada.

23. CARRITO

El carrito puede mantenerse local para visitantes.

Para usuarios autenticados, preparar posibilidad de persistencia.

Ideal:

carts
cart_items


pero no sobrecomplejizar el MVP si no es necesario.

Debe sobrevivir recargas del navegador.

Antes del checkout:

volver a comprobar stock;

volver a comprobar precios;

volver a comprobar descuentos;

volver a calcular totales desde backend.

Nunca confiar en el total que envía el navegador.

24. COTIZACIONES

Mantener el sistema de cotizaciones del prototipo.

Crear:

quotes

id
quote_number
user_id
status
subtotal
discount_total
total
customer_notes
admin_notes
valid_until
created_at
updated_at


y:

quote_items

id
quote_id
product_id
sku
product_name
quantity
unit_price
subtotal


Estados:

requested
reviewing
sent
accepted
rejected
expired
converted


25. FLUJO DE COTIZACIÓN

Cliente B2B:

arma carrito
↓
solicita cotización
↓
administrador recibe solicitud
↓
administrador puede ajustar precio
↓
envía cotización
↓
cliente acepta
↓
se puede convertir en pedido


Dejar preparada la arquitectura aunque algunas acciones inicialmente sean manuales.

26. ÁREA DEL CLIENTE

Mantener/construir:

Mi cuenta

datos personales;

datos empresa;

direcciones;

pedidos;

detalle de pedido;

cotizaciones;

estado de aprobación B2B;

cerrar sesión.

Ejemplo:

Mi cuenta

Pedidos
Cotizaciones
Direcciones
Datos comerciales
Configuración


27. PANEL ADMINISTRADOR

Mantener el panel de administración existente y conectarlo progresivamente a Supabase.

Debe permitir:

Dashboard

Mostrar:

ventas;

pedidos pendientes;

pedidos pagados;

pedidos por preparar;

solicitudes mayoristas;

cotizaciones;

productos con bajo stock.

No inventar métricas falsas cuando esté conectado a producción.

28. ADMIN — PRODUCTOS

Permitir:

crear;

editar;

activar/desactivar;

cambiar precio;

configurar precios B2B;

administrar imágenes;

especificaciones;

stock;

categorías;

SKU;

productos destacados.

29. ADMIN — CLIENTES B2B

Pantalla para solicitudes comerciales.

Mostrar:

Nombre
Empresa
RUT
Email
Teléfono
Tipo solicitado
Fecha
Estado


Acciones:

Aprobar
Rechazar
Suspender


Cuando se aprueba:

b2b_status = approved


Solo entonces debe activarse el price tier correspondiente.

30. ADMIN — PEDIDOS

Mostrar:

número;

cliente;

fecha;

total;

método de pago;

estado de pago;

estado logístico.

Permitir las transiciones válidas correspondientes.

No permitir transiciones imposibles.

Ejemplo:

No pasar directamente:

cancelled → delivered


31. ADMIN — COTIZACIONES

Permitir:

revisar;

modificar cantidades;

cambiar precios;

agregar descuento;

agregar observaciones;

enviar;

aceptar/rechazar;

convertir en pedido.

32. ENVÍOS

Por ahora crear arquitectura simple para Chile.

Datos:

Región
Comuna
Dirección
Número
Departamento / oficina
Información adicional


Mantener cálculo de despacho desacoplado.

Inicialmente puede utilizar reglas configurables.

Ejemplo conceptual:

shipping_zones

id
region
commune
base_price
free_shipping_threshold
active


No hardcodear permanentemente costos de despacho dentro del componente React.

33. CHILE

La aplicación está dirigida inicialmente a clientes en Chile.

Por lo tanto:

Moneda

CLP.

Mostrar precios como:

$79.990


No:

$79,990.00


Dirección

Utilizar estructura compatible con:

Región

Comuna

Dirección

RUT

Dejar preparado sistema de validación de RUT chileno.

No bloquear el avance inicial si todavía no está implementada la validación completa.

34. MERCADO PAGO — PREPARACIÓN

NO integrar todavía las credenciales reales de Mercado Pago.

Sin embargo, diseñar el flujo para permitir posteriormente:

Checkout
↓
Backend calcula precio verdadero
↓
Crear order
↓
Crear preferencia/orden en Mercado Pago
↓
Usuario paga
↓
Webhook
↓
Backend valida evento
↓
payment_status = paid
↓
actualizar inventario


La futura integración debe hacerse mediante una función backend segura.

Nunca:

React → Access Token Mercado Pago


Debe ser:

React
↓
Supabase Edge Function / backend
↓
Mercado Pago API


35. WEBHOOKS

Preparar estructura conceptual para futuros webhooks.

Crear si resulta útil:

payment_events


Ejemplo:

id
provider
external_event_id
event_type
payload
processed
created_at


Los webhooks deben ser idempotentes.

Si Mercado Pago envía dos veces el mismo evento, el pedido NO debe:

descontar doble stock;

marcarse dos veces;

duplicar movimientos.

36. MÉTODOS DE PAGO

Crear modelo extensible.

Inicial:

bank_transfer


Futuro:

mercadopago


No escribir toda la aplicación suponiendo que siempre existirá un único proveedor.

37. ROW LEVEL SECURITY

Activar RLS en todas las tablas privadas relevantes.

Principios:

Clientes

Pueden ver:

su perfil;

sus pedidos;

sus cotizaciones;

sus direcciones.

No pueden ver los de otros usuarios.

Administradores

Pueden administrar recursos según permisos.

Catálogo público

Usuarios pueden consultar productos activos y datos públicos.

Precios comerciales

Solo clientes autorizados deben acceder a los niveles de precio correspondientes.

38. NO EXPONER COSTO

El campo:

cost


corresponde al costo interno del negocio.

Nunca debe ser visible para clientes normales.

Solo administración autorizada.

39. AUDITORÍA

Para acciones sensibles del panel administrativo sería útil guardar:

admin_activity_log


Ejemplo:

Administrador X aprobó cliente Y
Administrador X cambió precio SKU-001
Administrador X marcó PED-1002 como pagado


No es obligatorio construir una interfaz avanzada inicialmente, pero preparar arquitectura.

40. DATOS DEMO

Los productos actuales del prototipo pueden mantenerse temporalmente como seed/demo.

Separarlos claramente del código UI.

Evitar arrays gigantes hardcodeados dentro de los componentes cuando ya exista Supabase.

Mover progresivamente:

productos → database
clientes → database
pedidos → database
cotizaciones → database
inventario → database


41. UX

Mantener diseño:

profesional;

moderno;

industrial;

limpio;

premium;

fácil de usar;

responsive.

Debe sentirse más como:

marca de herramientas profesional

que como:

catálogo antiguo de ferretería.

Mantener buena jerarquía visual.

No saturar de:

banners;

colores;

popups;

badges;

animaciones innecesarias.

42. MOBILE FIRST

Una parte importante de los clientes llegará desde celular.

Verificar especialmente:

navegación;

búsqueda;

catálogo;

filtros;

producto;

selector de cantidad;

carrito;

login;

checkout.

Los CTAs deben ser fáciles de tocar.

43. FICHA DEL PRODUCTO

Idealmente mantener:

Imagen

Nombre
SKU
Disponibilidad
Precio

Selector cantidad
Agregar al carrito
Solicitar cotización

Descripción
Especificaciones
Garantía
Despacho


Para clientes mayoristas:

mostrar claramente:

Tu precio mayorista


y cuando aplique:

Precio por volumen


44. VISITANTES

No obligar a registrarse simplemente para navegar por el sitio.

El catálogo público debe poder explorarse.

La arquitectura inicial será:

Visitante

Ve catálogo + precio retail.

Usuario registrado retail

Ve precio retail.

Professional aprobado

Ve professional price.

Wholesale aprobado

Ve wholesale price.

Distributor aprobado

Ve distributor price.

Esto puede cambiar posteriormente desde configuración sin rehacer el sistema.

45. MENSAJE PARA PRECIO B2B

Cuando alguien no tenga acceso:

¿Eres profesional o ferretería?

Crea tu cuenta para acceder a precios comerciales.


No exponer el precio privado detrás del mensaje.

46. BÚSQUEDA

Mantener búsqueda de catálogo.

Buscar por:

nombre;

SKU;

categoría;

características relevantes.

Inicialmente puede usarse búsqueda PostgreSQL sencilla.

No implementar infraestructura compleja de búsqueda externa todavía.

47. SEO

Las páginas públicas de producto deben poder indexarse correctamente.

Usar URLs:

/productos/taladro-percutor-20v


y no solamente:

/product?id=273


Preparar:

title;

meta description;

Open Graph;

canonical;

sitemap posteriormente.

48. ESTADOS DE CARGA

Cada acción conectada a Supabase debe manejar:

loading
success
error
empty


No dejar pantallas silenciosas o botones que parecen no funcionar.

49. ERRORES

Crear manejo amigable de errores.

Ejemplo:

En lugar de mostrar:

PostgrestError PGRST...


mostrar:

No pudimos cargar los productos.
Intenta nuevamente.


Registrar el error técnico cuando corresponda.

50. OPTIMISTIC UI

No utilizar optimistic updates para operaciones críticas como:

stock;

pagos;

aprobación B2B;

precio;

cancelación irreversible.

Esperar confirmación del backend.

51. VALIDACIONES

Validar tanto frontend como backend donde corresponda.

Nunca confiar únicamente en HTML:

required


para procesos sensibles.

52. IDEMPOTENCIA

Operaciones sensibles deben tolerar doble click o reintentos.

Especialmente:

checkout;

creación de pedido;

confirmar transferencia;

cancelar pedido;

futuro webhook de Mercado Pago.

Un doble click no debe generar dos pedidos o descontar stock dos veces.

53. ÍNDICES DE BASE DE DATOS

Agregar índices apropiados al menos para:

products.sku
products.slug
products.category_id
orders.user_id
orders.order_number
orders.created_at
quotes.user_id
profiles.customer_type
profiles.b2b_status
inventory_movements.product_id


54. TIMESTAMPS

Usar:

created_at
updated_at


consistentemente.

Preferiblemente timestamptz.

55. IDENTIFICADORES

Internamente usar UUID.

Para humanos generar números legibles:

PED-000001
COT-000001


No usar el UUID como número visible al cliente.

56. COMPONENTIZACIÓN

El prototipo actual puede contener mucha lógica en un único archivo.

Refactorizar gradualmente.

Ejemplo:

/components
/pages
/hooks
/lib
/services
/types


Posibles componentes:

Navbar
ProductCard
ProductGrid
ProductDetails
PriceDisplay
CartDrawer
CheckoutForm
OrderCard
QuoteCard
AdminSidebar
InventoryTable
CustomerApprovalTable


Evitar crear abstracciones innecesariamente complejas.

57. SERVICIOS

Separar lógica de acceso a datos.

Ejemplo:

productService
orderService
quoteService
inventoryService
profileService


Evitar hacer consultas Supabase dispersas por todos los componentes cuando sea posible.

58. TIPOS

Crear tipos TypeScript claros:

Product
Category
Profile
CustomerType
Order
OrderItem
Quote
QuoteItem
InventoryMovement


Evitar depender de any salvo necesidad puntual.

59. ENVIRONMENT VARIABLES

Toda configuración sensible debe utilizar variables de entorno.

Nunca hardcodear secretos.

Preparar:

VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY


Y futuras variables secretas exclusivamente del backend/Edge Functions:

MERCADOPAGO_ACCESS_TOKEN


Nunca exponer esa última en VITE_.

60. MIGRACIONES

Generar migraciones SQL ordenadas.

No depender solamente de cambios manuales en dashboard.

Quiero poder reconstruir el esquema de Supabase posteriormente.

61. DATOS INICIALES

Crear seed inicial opcional con algunos productos ficticios para poder probar:

catálogo;

carrito;

precios;

inventario;

cotizaciones.

Mantener claro que esos datos son demostrativos.

62. QUÉ NO HACER

NO:

rehacer toda la interfaz sin necesidad;

eliminar funcionalidades existentes útiles;

agregar marketplace;

agregar múltiples vendedores;

agregar chat de IA;

agregar recomendaciones con IA;

integrar Mercado Pago todavía;

crear sistema contable completo;

generar boletas reales todavía;

agregar logística compleja todavía;

agregar funcionalidades sociales;

introducir dependencias innecesarias;

confiar en localStorage como fuente de verdad;

confiar en el frontend para precios;

poner service role key en frontend;

permitir que un usuario se vuelva admin;

aprobar automáticamente cuentas mayoristas;

descontar stock sin una operación segura;

duplicar pedidos por doble click.

63. ESTRATEGIA DE IMPLEMENTACIÓN

NO intentes implementar todo de una sola vez si eso pone en riesgo la aplicación.

Trabajar progresivamente.

FASE 1

Analizar el proyecto existente.

Identificar:

componentes;

navegación;

estados;

productos demo;

carrito;

usuarios demo;

pedidos demo;

cotizaciones demo;

panel admin.

No modificar todavía.

Presentar brevemente qué arquitectura detectaste.

FASE 2

Crear esquema Supabase.

Prioridad:

profiles
user_roles
categories
products
product_images
product_specifications
volume_price_rules
orders
order_items
quotes
quote_items
inventory_movements


Crear:

foreign keys;

constraints;

índices;

timestamps;

RLS.

FASE 3

Conectar autenticación real.

Eliminar credenciales demo.

Implementar:

signup;

login;

logout;

recuperación de contraseña;

persistencia de sesión;

profile.

FASE 4

Conectar catálogo.

Reemplazar datos hardcodeados por Supabase.

Mantener apariencia existente.

FASE 5

Implementar pricing seguro.

Resolver:

retail
professional
wholesale
distributor


con aprobación B2B.

FASE 6

Conectar carrito y checkout.

Revalidar:

precios;

descuentos;

stock.

Crear pedido mediante operación backend segura.

FASE 7

Inventario.

Implementar:

physical
reserved
available


y movimientos.

FASE 8

Cotizaciones.

Conectar flujo B2B.

FASE 9

Panel admin.

Conectar:

productos;

pedidos;

usuarios;

solicitudes B2B;

inventario;

cotizaciones.

FASE 10

Testing y hardening.

Revisar:

permisos;

RLS;

usuario A accediendo a pedido de usuario B;

manipulación de precios;

manipulación de rol;

stock concurrente;

doble checkout;

carrito desactualizado;

productos agotados;

usuarios suspendidos;

descuentos;

responsive.

64. IMPORTANTE DURANTE EL DESARROLLO

Después de cada fase:

Verificar que compile.

Verificar navegación.

Verificar desktop.

Verificar mobile.

Verificar que funciones existentes no hayan dejado de funcionar.

Corregir errores antes de continuar.

NO acumular errores para resolverlos al final.

65. NO PUBLICAR AUTOMÁTICAMENTE

No publicar/deployar automáticamente cambios a producción.

Realizar los cambios en el proyecto y permitir revisión antes de deployment final.

66. PRIMERA TAREA

Comienza únicamente con:

analizar el código existente;

proponer la arquitectura final;

crear/configurar Supabase;

diseñar las tablas, relaciones y políticas RLS;

conectar autenticación real;

reemplazar los datos demo de usuarios.

Después verificar que todo funcione.

NO continúes todavía con Mercado Pago.

NO realices un rediseño visual general.

Cuando esta fase esté estable, continuaremos progresivamente con catálogo, precios, inventario, pedidos y cotizaciones.

La prioridad absoluta es construir una base técnicamente sólida que podamos seguir ampliando sin tener que rehacer el proyecto.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/466be344-ca7b-4670-bfea-e663e9ac3c97).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Estado técnico actual (hardening 2026-08-24)

La base ahora incluye, además del catálogo y pricing por rol:

- creación automática de `profiles` desde `auth.users` mediante trigger;
- recuperación y restablecimiento real de contraseña;
- página `/mi-cuenta` con perfil, solicitudes B2B, pedidos y cotizaciones;
- página `/admin` protegida por `user_roles`;
- aprobación/rechazo B2B auditada;
- imágenes de producto desde `product_images`;
- cálculo de despacho desde `shipping_zones`;
- checkout por transferencia transaccional e idempotente;
- reserva de inventario al crear el pedido;
- liberación segura de reserva al cancelar pedidos no pagados;
- confirmación administrativa de transferencia y conversión de reserva en venta;
- función preparada para liberar reservas expiradas mediante un job futuro;
- políticas públicas de imágenes/especificaciones limitadas a productos visibles.

### Crear el primer administrador

No existe auto-promoción a administrador por diseño. Después de crear la cuenta que administrará la tienda, asigna el rol usando un contexto seguro (SQL Editor/service role), reemplazando el correo:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role
from auth.users
where email = 'admin@ejemplo.cl'
on conflict (user_id, role) do nothing;
```

Nunca expongas la `service_role` en React ni agregues una función pública que permita a un usuario asignarse `admin`.

### Transferencia bancaria

La creación del pedido y la reserva de stock ya funcionan conceptualmente desde Supabase, pero los datos bancarios reales de la empresa **no están inventados ni hardcodeados** en el proyecto. Configúralos antes de usar el checkout en producción.

### Reservas expiradas

`release_expired_order_reservations()` está intencionalmente sin permiso para `anon`/`authenticated`. Más adelante debe ejecutarse desde un job programado seguro (por ejemplo, Edge Function/cron con credenciales de servidor).

### Mejoras adicionales de robustez incluidas en esta revisión

- `resolve_cart_prices(jsonb)` resuelve todo el carrito en una sola llamada, manteniendo el tier y descuentos por volumen del lado servidor.
- `create_quote_request(jsonb, text)` permite a cuentas comerciales pendientes/aprobadas crear cotizaciones sin reservar stock.
- `review_quote_request(...)` permite a administración tomar o rechazar solicitudes de cotización sin dar permisos directos de escritura al cliente.
- `admin_inventory()` alimenta las alertas de stock según `minimum_stock` por SKU, mostrando físico, reservado y disponible.
- `advance_order_fulfillment(...)` impone el flujo logístico `preparing → ready → shipped → delivered` para pedidos pagados.
- El checkout usa advisory lock por clave de idempotencia para cerrar carreras de doble click/reintentos simultáneos.
- Las cantidades y UUID enviados a RPC se validan antes de cualquier cast de PostgreSQL.
- El email del perfil se sincroniza desde Supabase Auth y un cliente no puede alterarlo directamente en `profiles`.
- Se rechazan claves `sb_secret_` si accidentalmente se configuran como publishable en código que deba respetar RLS.
- Las categorías padre incluyen productos de todas sus subcategorías descendientes.
- Las alertas y mensajes públicos ya no prometen porcentajes, tiempos de aprobación ni costos de envío hardcodeados.

> Importante: aplica la migración `20260824011500_hardening_auth_checkout.sql` antes de probar las nuevas acciones de cuenta, cotización, checkout o administración.
