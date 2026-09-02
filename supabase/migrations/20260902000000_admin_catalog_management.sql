-- Transactional catalog editing and stock adjustments for the admin panel.

create or replace function public.admin_catalog_products()
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
  image_url text
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
         )
  from public.products p
  where public.is_admin()
  order by p.updated_at desc, p.name;
$$;

revoke all on function public.admin_catalog_products() from public, anon;
grant execute on function public.admin_catalog_products() to authenticated;

create or replace function public.admin_update_product(
  _product_id uuid,
  _name text,
  _description text,
  _retail_price integer,
  _status public.product_status,
  _minimum_stock integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if nullif(trim(_name), '') is null or length(trim(_name)) > 140 then
    raise exception 'Nombre inválido';
  end if;
  if length(coalesce(_description, '')) > 4000 then raise exception 'Descripción demasiado extensa'; end if;
  if _retail_price is null or _retail_price <= 0 then raise exception 'Precio inválido'; end if;
  if _minimum_stock is null or _minimum_stock < 0 then raise exception 'Stock mínimo inválido'; end if;

  update public.products
  set name = trim(_name),
      description = nullif(trim(coalesce(_description, '')), ''),
      short_description = left(nullif(trim(coalesce(_description, '')), ''), 180),
      retail_price = _retail_price,
      status = _status,
      minimum_stock = _minimum_stock
  where id = _product_id;
  if not found then raise exception 'Producto no encontrado'; end if;

  insert into public.admin_activity_log (admin_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'product_updated', 'product', _product_id,
          jsonb_build_object('name', trim(_name), 'retail_price', _retail_price, 'status', _status));
end;
$$;

revoke all on function public.admin_update_product(uuid, text, text, integer, public.product_status, integer) from public, anon;
grant execute on function public.admin_update_product(uuid, text, text, integer, public.product_status, integer) to authenticated;

create or replace function public.admin_set_product_stock(
  _product_id uuid,
  _physical_stock integer,
  _note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_difference integer;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if _physical_stock is null or _physical_stock < 0 then raise exception 'Stock inválido'; end if;

  select * into v_product from public.products where id = _product_id for update;
  if not found then raise exception 'Producto no encontrado'; end if;
  if _physical_stock < v_product.reserved_stock then
    raise exception 'El stock físico no puede ser menor que las % unidades reservadas', v_product.reserved_stock;
  end if;

  v_difference := _physical_stock - v_product.physical_stock;
  if v_difference = 0 then return; end if;

  update public.products set physical_stock = _physical_stock where id = _product_id;
  insert into public.inventory_movements (
    product_id, type, quantity, reference_type, notes, created_by
  ) values (
    _product_id, 'adjustment', v_difference, 'admin_adjustment',
    coalesce(nullif(trim(coalesce(_note, '')), ''), 'Ajuste manual de inventario'), auth.uid()
  );
  insert into public.admin_activity_log (admin_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'stock_adjusted', 'product', _product_id,
          jsonb_build_object('previous_stock', v_product.physical_stock, 'new_stock', _physical_stock));
end;
$$;

revoke all on function public.admin_set_product_stock(uuid, integer, text) from public, anon;
grant execute on function public.admin_set_product_stock(uuid, integer, text) to authenticated;

