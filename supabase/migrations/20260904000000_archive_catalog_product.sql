-- Remove a publication from the public catalog without destroying order history.

create or replace function public.admin_archive_product(_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;

  select * into v_product from public.products where id = _product_id for update;
  if not found then raise exception 'Producto no encontrado'; end if;
  if v_product.reserved_stock > 0 then
    raise exception 'No puedes retirar un producto con unidades reservadas';
  end if;

  update public.products set status = 'discontinued' where id = _product_id;

  insert into public.admin_activity_log (admin_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'product_archived', 'product', _product_id,
          jsonb_build_object('name', v_product.name, 'sku', v_product.sku));
end;
$$;

revoke all on function public.admin_archive_product(uuid) from public, anon;
grant execute on function public.admin_archive_product(uuid) to authenticated;

