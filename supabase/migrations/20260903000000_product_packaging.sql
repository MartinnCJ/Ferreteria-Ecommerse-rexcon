-- Structured packaging information shown below each product description.

alter table public.products
  add column if not exists blister_simple_units integer,
  add column if not exists master_box_units integer;

alter table public.products
  drop constraint if exists products_blister_simple_units_positive,
  add constraint products_blister_simple_units_positive
    check (blister_simple_units is null or blister_simple_units > 0),
  drop constraint if exists products_master_box_units_positive,
  add constraint products_master_box_units_positive
    check (master_box_units is null or master_box_units > 0);

grant select (blister_simple_units, master_box_units) on public.products to anon, authenticated;

create or replace view public.products_public
with (security_invoker = true)
as
  select p.id, p.sku, p.slug, p.name, p.short_name, p.short_description, p.description,
         p.category_id, c.name as category_name, c.slug as category_slug,
         p.brand, p.status, p.featured, p.icon, p.accent,
         p.retail_price, p.available_stock, p.warranty_months,
         p.weight, p.width, p.height, p.length, p.created_at,
         p.blister_simple_units, p.master_box_units
  from public.products p
  left join public.categories c on c.id = p.category_id
  where p.status in ('active', 'out_of_stock');

grant select on public.products_public to anon, authenticated;

drop function if exists public.admin_catalog_products();
create function public.admin_catalog_products()
returns table (
  id uuid,
  sku text,
  name text,
  description text,
  retail_price integer,
  status public.product_status,
  physical_stock integer,
  reserved_stock integer,
  available_stock integer,
  minimum_stock integer,
  image_url text,
  blister_simple_units integer,
  master_box_units integer
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.sku, p.name, p.description, p.retail_price, p.status,
         p.physical_stock, p.reserved_stock, p.available_stock, p.minimum_stock,
         (
           select pi.image_url from public.product_images pi
           where pi.product_id = p.id
           order by pi.is_primary desc, pi.sort_order, pi.created_at
           limit 1
         ),
         p.blister_simple_units, p.master_box_units
  from public.products p
  where public.is_admin()
  order by p.updated_at desc, p.name;
$$;

revoke all on function public.admin_catalog_products() from public, anon;
grant execute on function public.admin_catalog_products() to authenticated;

drop function if exists public.admin_update_product(uuid, text, text, integer, public.product_status, integer);
create function public.admin_update_product(
  _product_id uuid,
  _name text,
  _description text,
  _retail_price integer,
  _status public.product_status,
  _minimum_stock integer,
  _blister_simple_units integer default null,
  _master_box_units integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if nullif(trim(_name), '') is null or length(trim(_name)) > 140 then raise exception 'Nombre inválido'; end if;
  if length(coalesce(_description, '')) > 4000 then raise exception 'Descripción demasiado extensa'; end if;
  if _retail_price is null or _retail_price <= 0 then raise exception 'Precio inválido'; end if;
  if _minimum_stock is null or _minimum_stock < 0 then raise exception 'Stock mínimo inválido'; end if;
  if _blister_simple_units is not null and _blister_simple_units <= 0 then raise exception 'Blíster simple inválido'; end if;
  if _master_box_units is not null and _master_box_units <= 0 then raise exception 'Caja máster inválida'; end if;

  update public.products
  set name = trim(_name),
      description = nullif(trim(coalesce(_description, '')), ''),
      short_description = left(nullif(trim(coalesce(_description, '')), ''), 180),
      retail_price = _retail_price,
      status = _status,
      minimum_stock = _minimum_stock,
      blister_simple_units = _blister_simple_units,
      master_box_units = _master_box_units
  where id = _product_id;
  if not found then raise exception 'Producto no encontrado'; end if;

  insert into public.admin_activity_log (admin_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'product_updated', 'product', _product_id,
          jsonb_build_object('name', trim(_name), 'retail_price', _retail_price, 'status', _status,
                             'blister_simple_units', _blister_simple_units, 'master_box_units', _master_box_units));
end;
$$;

revoke all on function public.admin_update_product(uuid, text, text, integer, public.product_status, integer, integer, integer) from public, anon;
grant execute on function public.admin_update_product(uuid, text, text, integer, public.product_status, integer, integer, integer) to authenticated;

