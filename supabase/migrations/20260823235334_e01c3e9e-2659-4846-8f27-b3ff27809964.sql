
-- ============ ENUMS ============
create type public.app_role as enum ('admin','staff');
create type public.customer_type as enum ('retail','professional','company','wholesale','distributor','admin');
create type public.b2b_status as enum ('not_required','pending','approved','rejected','suspended');
create type public.product_status as enum ('draft','active','out_of_stock','discontinued');
create type public.order_status as enum ('pending','confirmed','processing','shipped','delivered','cancelled');
create type public.payment_status as enum ('pending','awaiting_transfer','paid','failed','refunded','partially_refunded','cancelled');
create type public.fulfillment_status as enum ('unfulfilled','preparing','ready','shipped','delivered','returned');
create type public.quote_status as enum ('requested','reviewing','sent','accepted','rejected','expired','converted');
create type public.inventory_movement_type as enum ('purchase','sale','reservation','reservation_release','adjustment','return','cancelation');
create type public.payment_method as enum ('bank_transfer','mercadopago');

-- ============ HELPERS ============
create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  first_name text,
  last_name text,
  phone text,
  rut text,
  company_name text,
  company_rut text,
  customer_type public.customer_type not null default 'retail',
  b2b_status public.b2b_status not null default 'not_required',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_profiles_customer_type on public.profiles(customer_type);
create index idx_profiles_b2b_status on public.profiles(b2b_status);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- ============ USER ROLES ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin');
$$;

create policy "profiles_select_own_or_admin" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy "profiles_insert_own" on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy "profiles_update_own_or_admin" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

create policy "user_roles_select_own_or_admin" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "user_roles_admin_manage" on public.user_roles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Guard: nobody can grant themselves a commercial tier or admin type
create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.customer_type = 'admin' then new.customer_type := 'retail'; end if;
    new.b2b_status := case
      when new.customer_type in ('professional','company','wholesale','distributor') then 'pending'::public.b2b_status
      else 'not_required'::public.b2b_status end;
    return new;
  end if;
  if not public.has_role(auth.uid(), 'admin') then
    new.customer_type := old.customer_type;
    new.b2b_status := old.b2b_status;
  end if;
  return new;
end; $$;
create trigger trg_profiles_guard before insert or update on public.profiles
  for each row execute function public.guard_profile_privileges();
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- ============ CATEGORIES ============
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  parent_id uuid references public.categories(id) on delete set null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_categories_parent on public.categories(parent_id);
grant select on public.categories to anon, authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "categories_public_read" on public.categories for select to anon, authenticated using (active);
create policy "categories_admin_manage" on public.categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create trigger trg_categories_updated_at before update on public.categories
  for each row execute function public.update_updated_at_column();

-- ============ PRODUCTS ============
create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  slug text not null unique,
  name text not null,
  short_name text,
  short_description text,
  description text,
  category_id uuid references public.categories(id) on delete set null,
  brand text not null default 'NEXO TOOLS',
  status public.product_status not null default 'active',
  featured boolean not null default false,
  icon text,
  accent text,
  retail_price integer not null check (retail_price >= 0),
  professional_price integer check (professional_price >= 0),
  wholesale_price integer check (wholesale_price >= 0),
  distributor_price integer check (distributor_price >= 0),
  cost integer check (cost >= 0),
  physical_stock integer not null default 0 check (physical_stock >= 0),
  reserved_stock integer not null default 0 check (reserved_stock >= 0),
  available_stock integer generated always as (physical_stock - reserved_stock) stored,
  minimum_stock integer not null default 0,
  weight numeric,
  width numeric,
  height numeric,
  length numeric,
  warranty_months integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_reserved_lte_physical check (reserved_stock <= physical_stock)
);
create index idx_products_sku on public.products(sku);
create index idx_products_slug on public.products(slug);
create index idx_products_category on public.products(category_id);
create index idx_products_status on public.products(status);
grant all on public.products to service_role;
grant select, insert, update, delete on public.products to authenticated;
alter table public.products enable row level security;
create policy "products_admin_manage" on public.products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create trigger trg_products_updated_at before update on public.products
  for each row execute function public.update_updated_at_column();

-- Public catalog view (no commercial prices, no cost)
create view public.products_public as
  select p.id, p.sku, p.slug, p.name, p.short_name, p.short_description, p.description,
         p.category_id, c.name as category_name, c.slug as category_slug,
         p.brand, p.status, p.featured, p.icon, p.accent,
         p.retail_price, p.available_stock, p.warranty_months,
         p.weight, p.width, p.height, p.length, p.created_at
  from public.products p
  left join public.categories c on c.id = p.category_id
  where p.status in ('active','out_of_stock');
grant select on public.products_public to anon, authenticated;

-- ============ PRODUCT IMAGES / SPECS ============
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_product_images_product on public.product_images(product_id);
grant select on public.product_images to anon, authenticated;
grant all on public.product_images to service_role;
alter table public.product_images enable row level security;
create policy "product_images_public_read" on public.product_images for select to anon, authenticated using (true);
create policy "product_images_admin_manage" on public.product_images for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create table public.product_specifications (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  value text not null,
  unit text,
  sort_order integer not null default 0
);
create index idx_product_specs_product on public.product_specifications(product_id);
grant select on public.product_specifications to anon, authenticated;
grant all on public.product_specifications to service_role;
alter table public.product_specifications enable row level security;
create policy "product_specs_public_read" on public.product_specifications for select to anon, authenticated using (true);
create policy "product_specs_admin_manage" on public.product_specifications for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============ VOLUME PRICE RULES (private) ============
create table public.volume_price_rules (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  customer_type public.customer_type,
  min_quantity integer not null check (min_quantity > 0),
  max_quantity integer,
  discount_percentage numeric(5,2) check (discount_percentage >= 0 and discount_percentage <= 90),
  fixed_unit_price integer check (fixed_unit_price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_volume_rules_product on public.volume_price_rules(product_id);
grant all on public.volume_price_rules to service_role;
grant select, insert, update, delete on public.volume_price_rules to authenticated;
alter table public.volume_price_rules enable row level security;
create policy "volume_rules_admin_manage" on public.volume_price_rules for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create trigger trg_volume_rules_updated_at before update on public.volume_price_rules
  for each row execute function public.update_updated_at_column();

-- ============ PRICING FUNCTIONS ============
create or replace function public.effective_price_tier(_user_id uuid)
returns public.customer_type language sql stable security definer set search_path = public as $$
  select case
    when _user_id is null then 'retail'::public.customer_type
    else coalesce((
      select case
        when p.customer_type in ('professional','company','wholesale','distributor')
             and p.b2b_status = 'approved' then p.customer_type
        else 'retail'::public.customer_type
      end
      from public.profiles p where p.id = _user_id
    ), 'retail'::public.customer_type)
  end;
$$;

create or replace function public.product_base_price(_product public.products, _tier public.customer_type)
returns integer language sql immutable set search_path = public as $$
  select case _tier
    when 'professional' then coalesce(_product.professional_price, _product.retail_price)
    when 'company' then coalesce(_product.professional_price, _product.retail_price)
    when 'wholesale' then coalesce(_product.wholesale_price, _product.retail_price)
    when 'distributor' then coalesce(_product.distributor_price, _product.retail_price)
    else _product.retail_price
  end;
$$;

-- Returns the authoritative unit price for the current user
create or replace function public.resolve_prices(_product_ids uuid[], _quantity integer default 1)
returns table (
  product_id uuid,
  tier public.customer_type,
  base_price integer,
  unit_price integer,
  discount_percentage numeric,
  available_stock integer
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_tier public.customer_type := public.effective_price_tier(auth.uid());
  v_qty integer := greatest(1, coalesce(_quantity, 1));
begin
  return query
  select p.id,
         v_tier,
         public.product_base_price(p, v_tier) as base_price,
         case
           when r.fixed_unit_price is not null then r.fixed_unit_price
           else round(public.product_base_price(p, v_tier) * (1 - coalesce(r.discount_percentage,0)/100.0))::integer
         end as unit_price,
         coalesce(r.discount_percentage, 0) as discount_percentage,
         p.available_stock
  from public.products p
  left join lateral (
    select vr.* from public.volume_price_rules vr
    where vr.product_id = p.id and vr.active
      and (vr.customer_type is null or vr.customer_type = v_tier)
      and v_qty >= vr.min_quantity
      and (vr.max_quantity is null or v_qty <= vr.max_quantity)
      and v_tier <> 'retail'
    order by vr.min_quantity desc limit 1
  ) r on true
  where p.id = any(_product_ids) and p.status in ('active','out_of_stock');
end; $$;
grant execute on function public.resolve_prices(uuid[], integer) to anon, authenticated;
grant execute on function public.effective_price_tier(uuid) to anon, authenticated;

-- ============ SHIPPING ZONES ============
create table public.shipping_zones (
  id uuid primary key default gen_random_uuid(),
  region text not null,
  commune text,
  base_price integer not null default 0,
  free_shipping_threshold integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.shipping_zones to anon, authenticated;
grant all on public.shipping_zones to service_role;
alter table public.shipping_zones enable row level security;
create policy "shipping_zones_public_read" on public.shipping_zones for select to anon, authenticated using (active);
create policy "shipping_zones_admin_manage" on public.shipping_zones for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============ ORDERS ============
create sequence public.order_number_seq start 1;
create sequence public.quote_number_seq start 1;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default 'PED-' || lpad(nextval('public.order_number_seq')::text, 6, '0'),
  user_id uuid references auth.users(id) on delete set null,
  status public.order_status not null default 'pending',
  payment_status public.payment_status not null default 'pending',
  fulfillment_status public.fulfillment_status not null default 'unfulfilled',
  subtotal integer not null default 0,
  discount_total integer not null default 0,
  shipping_total integer not null default 0,
  tax_total integer not null default 0,
  total integer not null default 0,
  customer_name text,
  customer_email text,
  customer_phone text,
  customer_rut text,
  shipping_address text,
  shipping_city text,
  shipping_region text,
  billing_data jsonb,
  payment_method public.payment_method not null default 'bank_transfer',
  payment_reference text,
  reservation_expires_at timestamptz,
  idempotency_key text unique,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_orders_user on public.orders(user_id);
create index idx_orders_number on public.orders(order_number);
create index idx_orders_created_at on public.orders(created_at desc);
grant select, insert on public.orders to authenticated;
grant update, delete on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "orders_select_own_or_admin" on public.orders for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "orders_admin_manage" on public.orders for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create trigger trg_orders_updated_at before update on public.orders
  for each row execute function public.update_updated_at_column();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  sku text not null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price integer not null check (unit_price >= 0),
  discount integer not null default 0,
  subtotal integer not null default 0,
  created_at timestamptz not null default now()
);
create index idx_order_items_order on public.order_items(order_id);
grant select on public.order_items to authenticated;
grant all on public.order_items to service_role;
alter table public.order_items enable row level security;
create policy "order_items_select_own_or_admin" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));
create policy "order_items_admin_manage" on public.order_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============ QUOTES ============
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text not null unique default 'COT-' || lpad(nextval('public.quote_number_seq')::text, 6, '0'),
  user_id uuid references auth.users(id) on delete set null,
  status public.quote_status not null default 'requested',
  subtotal integer not null default 0,
  discount_total integer not null default 0,
  total integer not null default 0,
  customer_notes text,
  admin_notes text,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_quotes_user on public.quotes(user_id);
grant select on public.quotes to authenticated;
grant all on public.quotes to service_role;
alter table public.quotes enable row level security;
create policy "quotes_select_own_or_admin" on public.quotes for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "quotes_admin_manage" on public.quotes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create trigger trg_quotes_updated_at before update on public.quotes
  for each row execute function public.update_updated_at_column();

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  sku text not null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price integer not null check (unit_price >= 0),
  subtotal integer not null default 0,
  created_at timestamptz not null default now()
);
create index idx_quote_items_quote on public.quote_items(quote_id);
grant select on public.quote_items to authenticated;
grant all on public.quote_items to service_role;
alter table public.quote_items enable row level security;
create policy "quote_items_select_own_or_admin" on public.quote_items for select to authenticated
  using (exists (select 1 from public.quotes q where q.id = quote_id and (q.user_id = auth.uid() or public.is_admin())));
create policy "quote_items_admin_manage" on public.quote_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============ INVENTORY MOVEMENTS ============
create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  type public.inventory_movement_type not null,
  quantity integer not null,
  reference_type text,
  reference_id uuid,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_inventory_movements_product on public.inventory_movements(product_id);
grant select on public.inventory_movements to authenticated;
grant all on public.inventory_movements to service_role;
alter table public.inventory_movements enable row level security;
create policy "inventory_movements_admin" on public.inventory_movements for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============ PAYMENT EVENTS (idempotent webhooks) ============
create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_event_id text not null,
  event_type text,
  payload jsonb,
  processed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (provider, external_event_id)
);
grant all on public.payment_events to service_role;
alter table public.payment_events enable row level security;
create policy "payment_events_admin_read" on public.payment_events for select to authenticated
  using (public.is_admin());

-- ============ ADMIN ACTIVITY LOG ============
create table public.admin_activity_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);
grant select on public.admin_activity_log to authenticated;
grant all on public.admin_activity_log to service_role;
alter table public.admin_activity_log enable row level security;
create policy "admin_log_admin_only" on public.admin_activity_log for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============ SEED (datos demostrativos) ============
insert into public.categories (name, slug, sort_order) values
  ('Herramientas eléctricas','herramientas-electricas',1),
  ('Herramientas manuales','herramientas-manuales',2),
  ('Accesorios','accesorios',3),
  ('Construcción','construccion',4),
  ('Seguridad','seguridad',5);

insert into public.categories (name, slug, parent_id, sort_order)
select v.name, v.slug, (select id from public.categories where slug='herramientas-electricas'), v.ord
from (values ('Taladros','taladros',1),('Esmeriles','esmeriles',2),('Sierras','sierras',3)) as v(name,slug,ord);

insert into public.products (sku, slug, name, short_name, short_description, description, category_id, status, featured, icon, accent, retail_price, professional_price, wholesale_price, distributor_price, cost, physical_stock, minimum_stock, warranty_months)
values
 ('NX-TAL-20V','taladro-percutor-brushless-20v','Taladro Percutor Brushless 20V','Taladro 20V','Taladro inalámbrico brushless 20V con maleta.','Taladro inalámbrico brushless para trabajo profesional, con 2 velocidades y mandril metálico de 13 mm.',(select id from public.categories where slug='taladros'),'active',true,'⚙️','#E7FF4F',89990,80990,72990,66990,44000,42,5,12),
 ('NX-ESM-115','esmeril-angular-900w-115mm','Esmeril Angular 900W 115 mm','Esmeril 900W','Esmeril compacto de 900W para corte y desbaste.','Esmeril compacto de 900W para corte y desbaste, con guarda ajustable y mango auxiliar.',(select id from public.categories where slug='esmeriles'),'active',true,'🛠️','#FFB347',44990,40990,35990,32990,21000,68,8,12),
 ('NX-IMP-20V','atornillador-de-impacto-20v','Atornillador de Impacto 20V','Impacto 20V','Atornillador de impacto compacto de alto torque.','Atornillador de impacto compacto con alto torque para armado, montaje y trabajo en obra.',(select id from public.categories where slug='herramientas-electricas'),'active',false,'🔩','#7CE7FF',69990,62990,55990,50990,33000,31,5,12),
 ('NX-LLV-12','juego-llaves-combinadas-12','Juego de Llaves Combinadas 12 Piezas','Llaves 12 pcs','Set de 12 llaves combinadas Cr-V.','Set de llaves combinadas de acero cromo vanadio, pensado para taller, mantención y uso profesional.',(select id from public.categories where slug='herramientas-manuales'),'active',true,'🔧','#D5D9E2',29990,26990,22990,19990,12000,120,15,6),
 ('NX-DIS-115-10','pack-10-discos-corte-115','Pack 10 Discos de Corte 115 mm','Discos 115 mm','Pack de 10 discos de corte 115 mm.','Pack de discos delgados para corte rápido de acero al carbono e inoxidable.',(select id from public.categories where slug='accesorios'),'active',false,'◉','#FF6B6B',12990,10990,8990,7490,4200,340,40,0),
 ('NX-LAS-3D','nivel-laser-3d-12-lineas','Nivel Láser 3D 12 Líneas','Nivel Láser 3D','Nivel láser autonivelante de 12 líneas verdes.','Nivel láser autonivelante de alta visibilidad para instalación, tabiquería, cerámica y terminaciones.',(select id from public.categories where slug='construccion'),'active',true,'📐','#73F59A',79990,71990,63990,57990,38000,24,4,12),
 ('NX-GUA-C5','guantes-anticorte-nivel-c','Guantes Anticorte Nivel C','Guantes Anticorte','Guante anticorte nivel C, uso industrial.','Guante de trabajo con protección anticorte, palma recubierta y alta sensibilidad para manipulación.',(select id from public.categories where slug='seguridad'),'active',false,'🧤','#C6A5FF',6990,5990,4490,3790,2100,510,60,0),
 ('NX-HUI-8M','huincha-de-medir-8m','Huincha de Medir Profesional 8 m','Huincha 8 m','Huincha 8 m con freno automático.','Huincha robusta con cinta ancha, freno automático y carcasa engomada para trabajo diario.',(select id from public.categories where slug='herramientas-manuales'),'active',false,'📏','#FFD84D',11990,9990,7990,6790,4000,220,25,6);

insert into public.product_specifications (product_id, name, value, sort_order)
select p.id, s.name, s.value, s.ord from public.products p
join (values
 ('NX-TAL-20V','Motor','Brushless',1),('NX-TAL-20V','Velocidad','0–2.000 RPM',2),('NX-TAL-20V','Mandril','13 mm',3),('NX-TAL-20V','Baterías','2 x 4.0 Ah',4),('NX-TAL-20V','Incluye','Maleta',5),
 ('NX-ESM-115','Potencia','900 W',1),('NX-ESM-115','Velocidad','11.000 RPM',2),('NX-ESM-115','Disco','115 mm',3),('NX-ESM-115','Mango','Lateral',4),
 ('NX-IMP-20V','Voltaje','20 V',1),('NX-IMP-20V','Torque','180 Nm',2),('NX-IMP-20V','Encaje','1/4"',3),('NX-IMP-20V','Luz','LED',4),
 ('NX-LLV-12','Piezas','12',1),('NX-LLV-12','Medidas','8–19 mm',2),('NX-LLV-12','Material','Cr-V',3),('NX-LLV-12','Estuche','Organizador',4),
 ('NX-DIS-115-10','Dimensiones','115 x 1.0 x 22.2 mm',1),('NX-DIS-115-10','Unidades','10',2),('NX-DIS-115-10','Material','Metal / Inox',3),('NX-DIS-115-10','RPM máx.','13.300',4),
 ('NX-LAS-3D','Líneas','12',1),('NX-LAS-3D','Láser','Verde',2),('NX-LAS-3D','Nivelación','Automática',3),('NX-LAS-3D','Batería','Recargable',4),
 ('NX-GUA-C5','Nivel de corte','C',1),('NX-GUA-C5','Palma','Nitrilo',2),('NX-GUA-C5','Tallas','M–XL',3),
 ('NX-HUI-8M','Largo','8 m',1),('NX-HUI-8M','Cinta','25 mm',2),('NX-HUI-8M','Freno','Automático',3),('NX-HUI-8M','Gancho','Magnético',4)
) as s(sku,name,value,ord) on s.sku = p.sku;

insert into public.volume_price_rules (product_id, customer_type, min_quantity, max_quantity, discount_percentage)
select p.id, null, v.min_q, v.max_q, v.disc from public.products p
join (values
 ('NX-TAL-20V',6,11,3),('NX-TAL-20V',12,23,6),('NX-TAL-20V',24,null,9),
 ('NX-ESM-115',6,11,2),('NX-ESM-115',12,23,5),('NX-ESM-115',24,null,8),
 ('NX-IMP-20V',6,11,3),('NX-IMP-20V',12,23,6),('NX-IMP-20V',24,null,10),
 ('NX-LLV-12',12,23,3),('NX-LLV-12',24,47,7),('NX-LLV-12',48,null,11),
 ('NX-DIS-115-10',12,23,4),('NX-DIS-115-10',24,47,8),('NX-DIS-115-10',48,null,12),
 ('NX-LAS-3D',6,11,3),('NX-LAS-3D',12,23,6),('NX-LAS-3D',24,null,9),
 ('NX-GUA-C5',24,47,4),('NX-GUA-C5',48,95,8),('NX-GUA-C5',96,null,12),
 ('NX-HUI-8M',12,23,3),('NX-HUI-8M',24,47,7),('NX-HUI-8M',48,null,11)
) as v(sku,min_q,max_q,disc) on v.sku = p.sku;

insert into public.shipping_zones (region, base_price, free_shipping_threshold)
values
 ('Arica y Parinacota',7990,150000),('Tarapacá',7990,150000),('Antofagasta',7990,150000),('Atacama',7990,150000),
 ('Coquimbo',7990,150000),('Valparaíso',5990,150000),('Metropolitana',4990,150000),('O''Higgins',5990,150000),
 ('Maule',6990,150000),('Ñuble',6990,150000),('Biobío',6990,150000),('La Araucanía',7990,150000),
 ('Los Ríos',7990,150000),('Los Lagos',7990,150000),('Aysén',9990,200000),('Magallanes',9990,200000);
