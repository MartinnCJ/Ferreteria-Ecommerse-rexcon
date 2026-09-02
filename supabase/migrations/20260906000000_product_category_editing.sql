-- Select and edit the catalog category used by storefront filters.

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
  master_box_units integer,
  category_id uuid,
  category_name text
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
         p.blister_simple_units, p.master_box_units, p.category_id, c.name
  from public.products p
  left join public.categories c on c.id = p.category_id
  where public.is_admin()
  order by p.updated_at desc, p.name;
$$;

revoke all on function public.admin_catalog_products() from public, anon;
grant execute on function public.admin_catalog_products() to authenticated;

drop function if exists public.admin_update_product(
  uuid, text, text, text, integer, public.product_status, integer, integer, integer
);

create function public.admin_update_product(
  _product_id uuid,
  _sku text,
  _name text,
  _description text,
  _retail_price integer,
  _status public.product_status,
  _minimum_stock integer,
  _category_id uuid,
  _blister_simple_units integer default null,
  _master_box_units integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sku text := upper(trim(coalesce(_sku, '')));
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if v_sku = '' or length(v_sku) > 60 or v_sku !~ '^[A-Z0-9][A-Z0-9._/-]*$' then
    raise exception 'Código de producto inválido';
  end if;
  if nullif(trim(_name), '') is null or length(trim(_name)) > 140 then raise exception 'Nombre inválido'; end if;
  if length(coalesce(_description, '')) > 4000 then raise exception 'Descripción demasiado extensa'; end if;
  if _retail_price is null or _retail_price <= 0 then raise exception 'Precio inválido'; end if;
  if _minimum_stock is null or _minimum_stock < 0 then raise exception 'Stock mínimo inválido'; end if;
  if _category_id is not null and not exists (
    select 1 from public.categories where id = _category_id and active
  ) then raise exception 'Categoría inválida'; end if;
  if _blister_simple_units is not null and _blister_simple_units <= 0 then raise exception 'Blíster simple inválido'; end if;
  if _master_box_units is not null and _master_box_units <= 0 then raise exception 'Caja máster inválida'; end if;

  update public.products
  set sku = v_sku,
      name = trim(_name),
      description = nullif(trim(coalesce(_description, '')), ''),
      short_description = left(nullif(trim(coalesce(_description, '')), ''), 180),
      retail_price = _retail_price,
      status = _status,
      minimum_stock = _minimum_stock,
      category_id = _category_id,
      blister_simple_units = _blister_simple_units,
      master_box_units = _master_box_units
  where id = _product_id;
  if not found then raise exception 'Producto no encontrado'; end if;

  insert into public.admin_activity_log (admin_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'product_updated', 'product', _product_id,
          jsonb_build_object('sku', v_sku, 'name', trim(_name), 'retail_price', _retail_price,
                             'status', _status, 'category_id', _category_id,
                             'blister_simple_units', _blister_simple_units,
                             'master_box_units', _master_box_units));
exception
  when unique_violation then raise exception 'Ya existe un producto con el código %', v_sku;
end;
$$;

revoke all on function public.admin_update_product(
  uuid, text, text, text, integer, public.product_status, integer, uuid, integer, integer
) from public, anon;
grant execute on function public.admin_update_product(
  uuid, text, text, text, integer, public.product_status, integer, uuid, integer, integer
) to authenticated;

