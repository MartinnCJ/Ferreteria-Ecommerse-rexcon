
-- Vista de catálogo con permisos del usuario que consulta
alter view public.products_public set (security_invoker = on);

-- Los productos dejan de ser legibles por completo: solo columnas seguras
revoke all on public.products from anon, authenticated;
grant select (id, sku, slug, name, short_name, short_description, description,
              category_id, brand, status, featured, icon, accent, retail_price,
              available_stock, warranty_months, weight, width, height, length,
              created_at, updated_at)
  on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;

create policy "products_public_read" on public.products for select to anon, authenticated
  using (status in ('active','out_of_stock'));

-- Reglas de volumen: nunca legibles directamente por el cliente
revoke all on public.volume_price_rules from anon, authenticated;
grant insert, update, delete on public.volume_price_rules to authenticated;

-- Funciones internas: ejecución mínima necesaria
revoke all on function public.effective_price_tier(uuid) from public, anon, authenticated;
revoke all on function public.product_base_price(public.products, public.customer_type) from public, anon, authenticated;
revoke all on function public.resolve_prices(uuid[], integer) from public;
revoke all on function public.has_role(uuid, public.app_role) from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.guard_profile_privileges() from public, anon, authenticated;
revoke all on function public.update_updated_at_column() from public, anon, authenticated;

grant execute on function public.resolve_prices(uuid[], integer) to anon, authenticated;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.is_admin() to authenticated;
