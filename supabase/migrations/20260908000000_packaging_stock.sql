-- Manage physical inventory as the sum of simple/blister and master-box stock.

alter table public.products
  add column if not exists blister_stock integer not null default 0 check (blister_stock >= 0),
  add column if not exists master_box_stock integer not null default 0 check (master_box_stock >= 0);

-- Preserve existing inventory by assigning it to simple stock on first application.
update public.products
set blister_stock = physical_stock,
    master_box_stock = 0
where blister_stock = 0 and master_box_stock = 0 and physical_stock > 0;

create or replace function public.sync_packaging_stock()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_to_remove integer;
  v_from_simple integer;
begin
  if tg_op = 'INSERT' then
    new.physical_stock := new.blister_stock + new.master_box_stock;
    return new;
  end if;

  if new.blister_stock is distinct from old.blister_stock
     or new.master_box_stock is distinct from old.master_box_stock then
    new.physical_stock := new.blister_stock + new.master_box_stock;
  elsif new.physical_stock is distinct from old.physical_stock then
    if new.physical_stock < old.physical_stock then
      v_to_remove := old.physical_stock - new.physical_stock;
      v_from_simple := least(old.blister_stock, v_to_remove);
      new.blister_stock := old.blister_stock - v_from_simple;
      new.master_box_stock := greatest(0, old.master_box_stock - (v_to_remove - v_from_simple));
    else
      new.blister_stock := old.blister_stock + (new.physical_stock - old.physical_stock);
      new.master_box_stock := old.master_box_stock;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_products_packaging_stock on public.products;
create trigger trg_products_packaging_stock
before insert or update of physical_stock, blister_stock, master_box_stock on public.products
for each row execute function public.sync_packaging_stock();

create or replace function public.admin_set_product_packaging_stock(
  _product_id uuid,
  _blister_stock integer,
  _master_box_stock integer,
  _note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_new_total integer;
  v_difference integer;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if _blister_stock is null or _blister_stock < 0
     or _master_box_stock is null or _master_box_stock < 0 then
    raise exception 'Stock inválido';
  end if;

  select * into v_product from public.products where id = _product_id for update;
  if not found then raise exception 'Producto no encontrado'; end if;
  v_new_total := _blister_stock + _master_box_stock;
  if v_new_total < v_product.reserved_stock then
    raise exception 'El stock total no puede ser menor que las % unidades reservadas', v_product.reserved_stock;
  end if;

  v_difference := v_new_total - v_product.physical_stock;
  update public.products
  set blister_stock = _blister_stock,
      master_box_stock = _master_box_stock
  where id = _product_id;

  if v_difference <> 0 then
    insert into public.inventory_movements (
      product_id, type, quantity, reference_type, notes, created_by
    ) values (
      _product_id, 'adjustment', v_difference, 'admin_adjustment',
      coalesce(nullif(trim(coalesce(_note, '')), ''), 'Ajuste manual de inventario'), auth.uid()
    );
  end if;

  insert into public.admin_activity_log (admin_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'packaging_stock_adjusted', 'product', _product_id,
          jsonb_build_object('blister_stock', _blister_stock,
                             'master_box_stock', _master_box_stock,
                             'total_stock', v_new_total));
end;
$$;

revoke all on function public.admin_set_product_packaging_stock(uuid, integer, integer, text) from public, anon;
grant execute on function public.admin_set_product_packaging_stock(uuid, integer, integer, text) to authenticated;

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
  blister_stock integer,
  master_box_stock integer,
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
         p.physical_stock, p.blister_stock, p.master_box_stock,
         p.reserved_stock, p.available_stock, p.minimum_stock,
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
  order by (p.status = 'discontinued'), p.updated_at desc, p.name;
$$;

revoke all on function public.admin_catalog_products() from public, anon;
grant execute on function public.admin_catalog_products() to authenticated;
