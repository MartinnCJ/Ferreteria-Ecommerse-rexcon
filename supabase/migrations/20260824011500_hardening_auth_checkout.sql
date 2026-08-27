-- Hardening pass: auth/profile provisioning, B2B requests, public media policies,
-- authoritative shipping and transactional bank-transfer checkout.


-- Chilean RUT validation for server-side checkout and B2B requests.
create or replace function public.is_valid_chilean_rut(_rut text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_clean text := upper(regexp_replace(coalesce(_rut, ''), '[^0-9Kk]', '', 'g'));
  v_body text;
  v_dv text;
  v_sum integer := 0;
  v_multiplier integer := 2;
  v_rest integer;
  v_expected text;
  i integer;
begin
  if length(v_clean) < 7 then return false; end if;
  v_body := left(v_clean, length(v_clean) - 1);
  v_dv := right(v_clean, 1);
  if v_body !~ '^[0-9]+$' then return false; end if;

  for i in reverse length(v_body)..1 loop
    v_sum := v_sum + substring(v_body from i for 1)::integer * v_multiplier;
    v_multiplier := case when v_multiplier = 7 then 2 else v_multiplier + 1 end;
  end loop;

  v_rest := 11 - (v_sum % 11);
  v_expected := case when v_rest = 11 then '0' when v_rest = 10 then 'K' else v_rest::text end;
  return v_expected = v_dv;
end;
$$;

revoke all on function public.is_valid_chilean_rut(text) from public, anon, authenticated;

-- ============ PROFILE PROVISIONING ============
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requested_type public.customer_type := 'retail'::public.customer_type;
  v_raw_type text := coalesce(new.raw_user_meta_data ->> 'customer_type', 'retail');
begin
  if v_raw_type in ('professional','company','wholesale','distributor') then
    v_requested_type := v_raw_type::public.customer_type;
  end if;

  insert into public.profiles (
    id,
    email,
    first_name,
    last_name,
    phone,
    rut,
    company_name,
    company_rut,
    customer_type,
    b2b_status
  ) values (
    new.id,
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'last_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'rut'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'company_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'company_rut'), ''),
    v_requested_type,
    case
      when v_requested_type in ('professional','company','wholesale','distributor')
        then 'pending'::public.b2b_status
      else 'not_required'::public.b2b_status
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.sync_user_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    perform set_config('app.sync_user_email', 'on', true);
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_user_email() from public, anon, authenticated;
drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.sync_user_email();

-- Backfill accounts created before the trigger existed.
insert into public.profiles (
  id, email, first_name, last_name, phone, rut, company_name, company_rut, customer_type, b2b_status
)
select
  u.id,
  u.email,
  nullif(trim(u.raw_user_meta_data ->> 'first_name'), ''),
  nullif(trim(u.raw_user_meta_data ->> 'last_name'), ''),
  nullif(trim(u.raw_user_meta_data ->> 'phone'), ''),
  nullif(trim(u.raw_user_meta_data ->> 'rut'), ''),
  nullif(trim(u.raw_user_meta_data ->> 'company_name'), ''),
  nullif(trim(u.raw_user_meta_data ->> 'company_rut'), ''),
  case
    when coalesce(u.raw_user_meta_data ->> 'customer_type', '') in ('professional','company','wholesale','distributor')
      then (u.raw_user_meta_data ->> 'customer_type')::public.customer_type
    else 'retail'::public.customer_type
  end,
  case
    when coalesce(u.raw_user_meta_data ->> 'customer_type', '') in ('professional','company','wholesale','distributor')
      then 'pending'::public.b2b_status
    else 'not_required'::public.b2b_status
  end
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- Profiles are provisioned from auth.users; clients only update their own editable fields.
revoke insert on public.profiles from authenticated;

-- Review metadata belongs to the business, not to the customer.
alter table public.profiles
  add column if not exists b2b_review_note text,
  add column if not exists b2b_reviewed_at timestamptz,
  add column if not exists b2b_reviewed_by uuid references auth.users(id) on delete set null;

-- Keep privilege fields immutable from ordinary profile updates. A dedicated
-- SECURITY DEFINER RPC is the only customer-facing way to request B2B access.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_b2b_request boolean := coalesce(current_setting('app.b2b_request', true), '') = 'on';
  v_email_sync boolean := coalesce(current_setting('app.sync_user_email', true), '') = 'on';
begin
  if tg_op = 'INSERT' then
    if new.customer_type = 'admin' then
      new.customer_type := 'retail';
    end if;
    new.b2b_status := case
      when new.customer_type in ('professional','company','wholesale','distributor')
        then 'pending'::public.b2b_status
      else 'not_required'::public.b2b_status
    end;
    new.b2b_review_note := null;
    new.b2b_reviewed_at := null;
    new.b2b_reviewed_by := null;
    return new;
  end if;

  if public.has_role(auth.uid(), 'admin') then
    return new;
  end if;

  if v_email_sync then
    new.customer_type := old.customer_type;
    new.b2b_status := old.b2b_status;
    new.b2b_review_note := old.b2b_review_note;
    new.b2b_reviewed_at := old.b2b_reviewed_at;
    new.b2b_reviewed_by := old.b2b_reviewed_by;
    return new;
  end if;

  if v_b2b_request then
    if new.customer_type not in ('professional','company','wholesale','distributor') then
      raise exception 'Tipo de cliente comercial no válido';
    end if;
    new.b2b_status := 'pending';
    new.b2b_review_note := null;
    new.b2b_reviewed_at := null;
    new.b2b_reviewed_by := null;
    return new;
  end if;

  new.email := old.email;
  new.customer_type := old.customer_type;
  new.b2b_status := old.b2b_status;
  new.b2b_review_note := old.b2b_review_note;
  new.b2b_reviewed_at := old.b2b_reviewed_at;
  new.b2b_reviewed_by := old.b2b_reviewed_by;
  return new;
end;
$$;

revoke all on function public.guard_profile_privileges() from public, anon, authenticated;

create or replace function public.request_b2b_access(
  _customer_type public.customer_type,
  _company_name text default null,
  _company_rut text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;

  if _customer_type not in ('professional','company','wholesale','distributor') then
    raise exception 'Tipo de cuenta comercial no válido';
  end if;

  if _customer_type in ('company','wholesale','distributor')
     and nullif(trim(coalesce(_company_name, '')), '') is null then
    raise exception 'Debes indicar la empresa o ferretería';
  end if;

  if nullif(trim(coalesce(_company_rut, '')), '') is not null
     and not public.is_valid_chilean_rut(_company_rut) then
    raise exception 'RUT de empresa inválido';
  end if;

  perform set_config('app.b2b_request', 'on', true);

  update public.profiles
  set customer_type = _customer_type,
      b2b_status = 'pending',
      company_name = coalesce(nullif(trim(_company_name), ''), company_name),
      company_rut = coalesce(nullif(trim(_company_rut), ''), company_rut),
      b2b_review_note = null,
      b2b_reviewed_at = null,
      b2b_reviewed_by = null
  where id = auth.uid();

  if not found then
    raise exception 'No existe un perfil para esta cuenta';
  end if;
end;
$$;

revoke all on function public.request_b2b_access(public.customer_type, text, text) from public, anon;
grant execute on function public.request_b2b_access(public.customer_type, text, text) to authenticated;

create or replace function public.review_b2b_access(
  _user_id uuid,
  _approved boolean,
  _note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  select * into v_profile
  from public.profiles
  where id = _user_id
  for update;

  if not found then
    raise exception 'Perfil no encontrado';
  end if;

  if v_profile.customer_type not in ('professional','company','wholesale','distributor') then
    raise exception 'La cuenta no corresponde a un nivel comercial';
  end if;

  update public.profiles
  set b2b_status = (case when _approved then 'approved' else 'rejected' end)::public.b2b_status,
      b2b_review_note = nullif(trim(coalesce(_note, '')), ''),
      b2b_reviewed_at = now(),
      b2b_reviewed_by = auth.uid()
  where id = _user_id;

  insert into public.admin_activity_log (admin_id, action, entity_type, entity_id, details)
  values (
    auth.uid(),
    case when _approved then 'b2b_access_approved' else 'b2b_access_rejected' end,
    'profile',
    _user_id,
    jsonb_build_object('customer_type', v_profile.customer_type, 'note', _note)
  );
end;
$$;

revoke all on function public.review_b2b_access(uuid, boolean, text) from public, anon;
grant execute on function public.review_b2b_access(uuid, boolean, text) to authenticated;

-- Defensive data constraints for fields that participate in pricing/inventory.
alter table public.products
  add constraint products_minimum_stock_nonnegative check (minimum_stock >= 0),
  add constraint products_warranty_nonnegative check (warranty_months >= 0);
alter table public.volume_price_rules
  add constraint volume_rules_range_valid check (max_quantity is null or max_quantity >= min_quantity);
alter table public.shipping_zones
  add constraint shipping_base_price_nonnegative check (base_price >= 0),
  add constraint shipping_free_threshold_nonnegative check (free_shipping_threshold is null or free_shipping_threshold >= 0);
alter table public.orders
  add constraint orders_amounts_nonnegative check (
    subtotal >= 0 and discount_total >= 0 and shipping_total >= 0 and tax_total >= 0 and total >= 0
  );
alter table public.quotes
  add constraint quotes_amounts_nonnegative check (subtotal >= 0 and discount_total >= 0 and total >= 0);

-- Normalize accidental duplicate primary flags before enforcing one primary image.
with ranked_primary as (
  select id, row_number() over (partition by product_id order by sort_order, created_at, id) as rn
  from public.product_images
  where is_primary
)
update public.product_images pi
set is_primary = false
from ranked_primary rp
where pi.id = rp.id and rp.rn > 1;

create unique index if not exists idx_product_images_one_primary
  on public.product_images (product_id) where is_primary;

-- ============ PUBLIC PRODUCT CHILDREN ============
-- Do not expose images/specifications belonging to draft/discontinued products.
drop policy if exists "product_images_public_read" on public.product_images;
create policy "product_images_public_read" on public.product_images
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.status in ('active','out_of_stock')
    )
  );

drop policy if exists "product_specs_public_read" on public.product_specifications;
create policy "product_specs_public_read" on public.product_specifications
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.status in ('active','out_of_stock')
    )
  );

-- Admin inventory projection: avoids exposing cost/commercial prices while
-- providing the operational stock fields the dashboard actually needs.
create or replace function public.admin_inventory()
returns table (
  product_id uuid,
  sku text,
  name text,
  status public.product_status,
  physical_stock integer,
  reserved_stock integer,
  available_stock integer,
  minimum_stock integer,
  retail_price integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  return query
  select p.id, p.sku, p.name, p.status, p.physical_stock, p.reserved_stock,
         p.available_stock, p.minimum_stock, p.retail_price
  from public.products p
  order by p.name;
end;
$$;

revoke all on function public.admin_inventory() from public, anon;
grant execute on function public.admin_inventory() to authenticated;

-- ============ SHIPPING ============
create index if not exists idx_shipping_zones_lookup
  on public.shipping_zones (region, commune)
  where active;

drop trigger if exists trg_shipping_zones_updated_at on public.shipping_zones;
create trigger trg_shipping_zones_updated_at
  before update on public.shipping_zones
  for each row execute function public.update_updated_at_column();

create or replace function public.resolve_shipping(
  _region text,
  _commune text default null,
  _subtotal integer default 0
)
returns table (
  shipping_total integer,
  free_shipping_threshold integer,
  zone_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  with zone as (
    select z.*
    from public.shipping_zones z
    where z.active
      and lower(trim(z.region)) = lower(trim(_region))
      and (z.commune is null or lower(trim(z.commune)) = lower(trim(coalesce(_commune, ''))))
    order by (z.commune is not null) desc
    limit 1
  )
  select
    case
      when zone.free_shipping_threshold is not null
           and greatest(0, coalesce(_subtotal, 0)) >= zone.free_shipping_threshold then 0
      else zone.base_price
    end,
    zone.free_shipping_threshold,
    zone.id
  from zone;
$$;

revoke all on function public.resolve_shipping(text, text, integer) from public;
grant execute on function public.resolve_shipping(text, text, integer) to anon, authenticated;

-- One protected round-trip for cart pricing with per-line quantities.
create or replace function public.resolve_cart_prices(_items jsonb)
returns table (
  product_id uuid,
  tier public.customer_type,
  base_price integer,
  unit_price integer,
  discount_percentage numeric,
  available_stock integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_item record;
  v_price record;
begin
  if jsonb_typeof(_items) <> 'array' then raise exception 'El carrito contiene cantidades inválidas'; end if;
  if jsonb_array_length(_items) > 100 then raise exception 'El pedido contiene demasiadas líneas'; end if;

  if exists (
    select 1 from jsonb_array_elements(_items) x
    where jsonb_typeof(x) <> 'object'
       or coalesce(x ->> 'product_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or coalesce(x ->> 'quantity', '') !~ '^[0-9]{1,4}$'
  ) then raise exception 'El carrito contiene cantidades inválidas'; end if;

  if exists (
    select 1
    from jsonb_array_elements(_items) x
    group by (x ->> 'product_id')
    having sum((x ->> 'quantity')::integer) < 1
       or sum((x ->> 'quantity')::integer) > 9999
  ) then raise exception 'El carrito contiene cantidades inválidas'; end if;

  for v_item in
    select (x ->> 'product_id')::uuid as product_id,
           sum((x ->> 'quantity')::integer)::integer as quantity
    from jsonb_array_elements(_items) x
    group by 1
    order by 1
  loop
    select * into v_price
    from public.resolve_prices(array[v_item.product_id], v_item.quantity)
    limit 1;

    if v_price.product_id is not null then
      product_id := v_price.product_id;
      tier := v_price.tier;
      base_price := v_price.base_price;
      unit_price := v_price.unit_price;
      discount_percentage := v_price.discount_percentage;
      available_stock := v_price.available_stock;
      return next;
    end if;
  end loop;
end;
$$;

revoke all on function public.resolve_cart_prices(jsonb) from public;
grant execute on function public.resolve_cart_prices(jsonb) to anon, authenticated;

-- ============ QUOTE REQUESTS ============
-- Customers submit only product ids/quantities. Prices are snapshotted server-side
-- using the same protected pricing resolver as the cart; no stock is reserved.
create or replace function public.create_quote_request(
  _items jsonb,
  _customer_notes text default null
)
returns table (
  quote_id uuid,
  quote_number text,
  total integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item record;
  v_product public.products%rowtype;
  v_price record;
  v_quote public.quotes%rowtype;
  v_subtotal integer := 0;
  v_discount_total integer := 0;
begin
  if v_user_id is null then raise exception 'Debes iniciar sesión'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = v_user_id
      and p.customer_type in ('professional','company','wholesale','distributor')
      and p.b2b_status in ('pending','approved')
  ) then
    raise exception 'Tu cuenta no está habilitada para solicitar cotizaciones';
  end if;
  if jsonb_typeof(_items) <> 'array' or jsonb_array_length(_items) = 0 then
    raise exception 'El carrito está vacío';
  end if;
  if jsonb_array_length(_items) > 100 then raise exception 'La cotización contiene demasiadas líneas'; end if;
  if length(coalesce(_customer_notes, '')) > 2000 then raise exception 'Las notas son demasiado extensas'; end if;

  if exists (
    select 1 from jsonb_array_elements(_items) x
    where jsonb_typeof(x) <> 'object'
       or coalesce(x ->> 'product_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or coalesce(x ->> 'quantity', '') !~ '^[0-9]{1,4}$'
  ) then raise exception 'La cotización contiene cantidades inválidas'; end if;

  if exists (
    select 1 from jsonb_array_elements(_items) x
    where (x ->> 'quantity')::integer < 1 or (x ->> 'quantity')::integer > 9999
  ) then raise exception 'La cotización contiene cantidades inválidas'; end if;
  if exists (
    select 1 from jsonb_array_elements(_items) x
    group by (x ->> 'product_id')
    having sum((x ->> 'quantity')::integer) > 9999
  ) then raise exception 'La cotización contiene cantidades inválidas'; end if;

  for v_item in
    select (x ->> 'product_id')::uuid as product_id,
           sum((x ->> 'quantity')::integer)::integer as quantity
    from jsonb_array_elements(_items) x
    group by 1
    order by 1
  loop
    select * into v_product from public.products
    where id = v_item.product_id and status in ('active','out_of_stock');
    if not found then raise exception 'Uno de los productos ya no está disponible'; end if;

    select * into v_price
    from public.resolve_prices(array[v_product.id], v_item.quantity)
    limit 1;
    if v_price.product_id is null then raise exception 'No fue posible calcular un precio'; end if;

    v_subtotal := v_subtotal + v_price.unit_price * v_item.quantity;
    v_discount_total := v_discount_total + (v_price.base_price - v_price.unit_price) * v_item.quantity;
  end loop;

  insert into public.quotes (user_id, status, subtotal, discount_total, total, customer_notes)
  values (v_user_id, 'requested', v_subtotal, v_discount_total, v_subtotal, nullif(trim(coalesce(_customer_notes, '')), ''))
  returning * into v_quote;

  for v_item in
    select (x ->> 'product_id')::uuid as product_id,
           sum((x ->> 'quantity')::integer)::integer as quantity
    from jsonb_array_elements(_items) x
    group by 1
    order by 1
  loop
    select * into v_product from public.products where id = v_item.product_id;
    select * into v_price from public.resolve_prices(array[v_product.id], v_item.quantity) limit 1;
    insert into public.quote_items (quote_id, product_id, sku, product_name, quantity, unit_price, subtotal)
    values (v_quote.id, v_product.id, v_product.sku, v_product.name, v_item.quantity, v_price.unit_price, v_price.unit_price * v_item.quantity);
  end loop;

  return query select v_quote.id, v_quote.quote_number, v_quote.total;
end;
$$;

revoke all on function public.create_quote_request(jsonb, text) from public, anon;
grant execute on function public.create_quote_request(jsonb, text) to authenticated;

create or replace function public.review_quote_request(
  _quote_id uuid,
  _reject boolean default false,
  _note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes%rowtype;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if length(coalesce(_note, '')) > 2000 then raise exception 'La nota es demasiado extensa'; end if;

  select * into v_quote from public.quotes where id = _quote_id for update;
  if not found then raise exception 'Cotización no encontrada'; end if;
  if v_quote.status not in ('requested','reviewing') then
    raise exception 'La cotización ya no está pendiente de revisión';
  end if;

  update public.quotes
  set status = case when _reject then 'rejected'::public.quote_status else 'reviewing'::public.quote_status end,
      admin_notes = coalesce(nullif(trim(coalesce(_note, '')), ''), admin_notes)
  where id = v_quote.id;

  insert into public.admin_activity_log (admin_id, action, entity_type, entity_id, details)
  values (
    auth.uid(),
    case when _reject then 'quote_rejected' else 'quote_review_started' end,
    'quote',
    v_quote.id,
    jsonb_build_object('quote_number', v_quote.quote_number, 'note', _note)
  );
end;
$$;

revoke all on function public.review_quote_request(uuid, boolean, text) from public, anon;
grant execute on function public.review_quote_request(uuid, boolean, text) to authenticated;

-- ============ TRANSACTIONAL CHECKOUT ============
-- Customers can read their orders, but creation/state changes go through RPCs.
revoke insert, update, delete on public.orders from authenticated;
revoke insert, update, delete on public.order_items from authenticated;

create or replace function public.create_bank_transfer_order(
  _items jsonb,
  _customer jsonb,
  _idempotency_key text
)
returns table (
  order_id uuid,
  order_number text,
  subtotal integer,
  shipping_total integer,
  total integer,
  reservation_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item record;
  v_product public.products%rowtype;
  v_price record;
  v_order public.orders%rowtype;
  v_subtotal integer := 0;
  v_discount_total integer := 0;
  v_shipping integer;
  v_region text := nullif(trim(_customer ->> 'region'), '');
  v_commune text := nullif(trim(_customer ->> 'city'), '');
  v_name text := nullif(trim(_customer ->> 'name'), '');
  v_email text := nullif(trim(_customer ->> 'email'), '');
  v_phone text := nullif(trim(_customer ->> 'phone'), '');
  v_rut text := nullif(trim(_customer ->> 'rut'), '');
  v_address text := nullif(trim(_customer ->> 'address'), '');
  v_existing public.orders%rowtype;
begin
  if v_user_id is null then
    raise exception 'Debes iniciar sesión para confirmar el pedido';
  end if;

  if _idempotency_key is null or length(trim(_idempotency_key)) < 8 then
    raise exception 'Identificador de operación inválido';
  end if;

  -- Serializa reintentos simultáneos con la misma clave. Así un doble click o
  -- reintento de red no alcanza a crear dos pedidos antes del UNIQUE.
  perform pg_advisory_xact_lock(
    hashtextextended(v_user_id::text || ':' || trim(_idempotency_key), 0)
  );

  select * into v_existing
  from public.orders
  where idempotency_key = _idempotency_key and user_id = v_user_id;

  if found then
    return query select v_existing.id, v_existing.order_number, v_existing.subtotal,
      v_existing.shipping_total, v_existing.total, v_existing.reservation_expires_at;
    return;
  end if;

  if jsonb_typeof(_items) <> 'array' or jsonb_array_length(_items) = 0 then
    raise exception 'El carrito está vacío';
  end if;
  if jsonb_array_length(_items) > 100 then
    raise exception 'El pedido contiene demasiadas líneas';
  end if;

  -- Valida formato antes de castear UUID/cantidades para devolver un error
  -- controlado incluso ante payloads manipulados manualmente.
  if exists (
    select 1
    from jsonb_array_elements(_items) x
    where jsonb_typeof(x) <> 'object'
       or coalesce(x ->> 'product_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or coalesce(x ->> 'quantity', '') !~ '^[0-9]{1,4}$'
  ) then
    raise exception 'El carrito contiene cantidades inválidas';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(_items) x
    where (x ->> 'quantity')::integer < 1
       or (x ->> 'quantity')::integer > 9999
  ) then
    raise exception 'El carrito contiene cantidades inválidas';
  end if;
  if exists (
    select 1 from jsonb_array_elements(_items) x
    group by (x ->> 'product_id')
    having sum((x ->> 'quantity')::integer) > 9999
  ) then
    raise exception 'El carrito contiene cantidades inválidas';
  end if;

  if v_name is null or length(v_name) < 3 then raise exception 'Nombre inválido'; end if;
  if v_email is null or v_email !~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then raise exception 'Correo inválido'; end if;
  if v_phone is null or length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 8 then raise exception 'Teléfono inválido'; end if;
  if v_rut is null or not public.is_valid_chilean_rut(v_rut) then raise exception 'RUT inválido'; end if;
  if v_address is null or length(v_address) < 5 then raise exception 'Dirección inválida'; end if;
  if v_commune is null or v_region is null then raise exception 'Región y comuna requeridas'; end if;

  -- Lock every requested product in deterministic order and calculate server prices.
  for v_item in
    select (x ->> 'product_id')::uuid as product_id,
           sum((x ->> 'quantity')::integer)::integer as quantity
    from jsonb_array_elements(_items) x
    group by 1
    order by 1
  loop
    select * into v_product
    from public.products
    where id = v_item.product_id and status = 'active'
    for update;

    if not found then
      raise exception 'Uno de los productos ya no está disponible';
    end if;

    if v_product.available_stock < v_item.quantity then
      raise exception 'Stock insuficiente para %', v_product.name;
    end if;

    select * into v_price
    from public.resolve_prices(array[v_product.id], v_item.quantity)
    limit 1;

    if v_price.product_id is null then
      raise exception 'No fue posible calcular el precio de %', v_product.name;
    end if;

    v_subtotal := v_subtotal + (v_price.unit_price * v_item.quantity);
    v_discount_total := v_discount_total + ((v_price.base_price - v_price.unit_price) * v_item.quantity);
  end loop;

  select s.shipping_total into v_shipping
  from public.resolve_shipping(v_region, v_commune, v_subtotal) s
  limit 1;

  if v_shipping is null then
    raise exception 'No hay despacho configurado para la región seleccionada';
  end if;

  insert into public.orders (
    user_id, status, payment_status, fulfillment_status,
    subtotal, discount_total, shipping_total, tax_total, total,
    customer_name, customer_email, customer_phone, customer_rut,
    shipping_address, shipping_city, shipping_region,
    payment_method, reservation_expires_at, idempotency_key
  ) values (
    v_user_id, 'pending', 'awaiting_transfer', 'unfulfilled',
    v_subtotal, v_discount_total, v_shipping, 0, v_subtotal + v_shipping,
    v_name, v_email, v_phone, v_rut,
    v_address, v_commune, v_region,
    'bank_transfer', now() + interval '24 hours', trim(_idempotency_key)
  )
  returning * into v_order;

  for v_item in
    select (x ->> 'product_id')::uuid as product_id,
           sum((x ->> 'quantity')::integer)::integer as quantity
    from jsonb_array_elements(_items) x
    group by 1
    order by 1
  loop
    select * into v_product from public.products where id = v_item.product_id;
    select * into v_price
    from public.resolve_prices(array[v_product.id], v_item.quantity)
    limit 1;

    insert into public.order_items (
      order_id, product_id, sku, product_name, quantity, unit_price, discount, subtotal
    ) values (
      v_order.id, v_product.id, v_product.sku, v_product.name, v_item.quantity,
      v_price.unit_price, greatest(0, v_price.base_price - v_price.unit_price),
      v_price.unit_price * v_item.quantity
    );

    update public.products
    set reserved_stock = reserved_stock + v_item.quantity
    where id = v_product.id;

    insert into public.inventory_movements (
      product_id, type, quantity, reference_type, reference_id, notes, created_by
    ) values (
      v_product.id, 'reservation', v_item.quantity, 'order', v_order.id,
      'Reserva por pedido pendiente de transferencia', v_user_id
    );
  end loop;

  return query select v_order.id, v_order.order_number, v_order.subtotal,
    v_order.shipping_total, v_order.total, v_order.reservation_expires_at;
end;
$$;

revoke all on function public.create_bank_transfer_order(jsonb, jsonb, text) from public, anon;
grant execute on function public.create_bank_transfer_order(jsonb, jsonb, text) to authenticated;

create or replace function public.cancel_order(_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
  v_admin boolean := public.is_admin();
begin
  select * into v_order from public.orders where id = _order_id for update;
  if not found then raise exception 'Pedido no encontrado'; end if;

  if v_order.user_id <> auth.uid() and not v_admin then
    raise exception 'No autorizado';
  end if;

  if v_order.status = 'cancelled' then return; end if;
  if v_order.payment_status = 'paid' then
    raise exception 'Un pedido pagado requiere un flujo de devolución, no una cancelación';
  end if;
  if v_order.payment_status not in ('pending','awaiting_transfer') then
    raise exception 'El pedido ya no puede cancelarse automáticamente';
  end if;
  if v_order.fulfillment_status in ('shipped','delivered') then
    raise exception 'El pedido ya fue despachado';
  end if;

  for v_item in
    select oi.product_id, oi.quantity
    from public.order_items oi
    where oi.order_id = v_order.id and oi.product_id is not null
    order by oi.product_id
  loop
    perform 1 from public.products where id = v_item.product_id for update;
    update public.products
    set reserved_stock = greatest(0, reserved_stock - v_item.quantity)
    where id = v_item.product_id;

    insert into public.inventory_movements (
      product_id, type, quantity, reference_type, reference_id, notes, created_by
    ) values (
      v_item.product_id, 'reservation_release', v_item.quantity, 'order', v_order.id,
      'Liberación de reserva por cancelación', auth.uid()
    );
  end loop;

  update public.orders
  set status = 'cancelled', payment_status = 'cancelled'
  where id = v_order.id;
end;
$$;

revoke all on function public.cancel_order(uuid) from public, anon;
grant execute on function public.cancel_order(uuid) to authenticated;

create or replace function public.confirm_bank_transfer(_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;

  select * into v_order from public.orders where id = _order_id for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if v_order.payment_status = 'paid' then return; end if;
  if v_order.payment_status <> 'awaiting_transfer' then
    raise exception 'El pedido no está esperando una transferencia';
  end if;

  for v_item in
    select oi.product_id, oi.quantity
    from public.order_items oi
    where oi.order_id = v_order.id and oi.product_id is not null
    order by oi.product_id
  loop
    perform 1 from public.products where id = v_item.product_id for update;

    update public.products
    set physical_stock = physical_stock - v_item.quantity,
        reserved_stock = reserved_stock - v_item.quantity
    where id = v_item.product_id
      and reserved_stock >= v_item.quantity
      and physical_stock >= v_item.quantity;

    if not found then
      raise exception 'La reserva de stock del pedido es inconsistente';
    end if;

    insert into public.inventory_movements (
      product_id, type, quantity, reference_type, reference_id, notes, created_by
    ) values (
      v_item.product_id, 'sale', v_item.quantity, 'order', v_order.id,
      'Venta confirmada por transferencia bancaria', auth.uid()
    );
  end loop;

  update public.orders
  set payment_status = 'paid', status = 'confirmed', fulfillment_status = 'preparing'
  where id = v_order.id;

  insert into public.admin_activity_log (admin_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'bank_transfer_confirmed', 'order', v_order.id,
          jsonb_build_object('order_number', v_order.order_number));
end;
$$;

revoke all on function public.confirm_bank_transfer(uuid) from public, anon;
grant execute on function public.confirm_bank_transfer(uuid) to authenticated;

-- Admin-only fulfillment state machine. Inventory was already converted from
-- reservation to sale when payment was confirmed; this RPC only moves logistics.
create or replace function public.advance_order_fulfillment(
  _order_id uuid,
  _target public.fulfillment_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_allowed boolean := false;
  v_order_status public.order_status;
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  if _target not in ('preparing','ready','shipped','delivered') then
    raise exception 'Estado logístico no válido';
  end if;

  select * into v_order
  from public.orders
  where id = _order_id
  for update;

  if not found then raise exception 'Pedido no encontrado'; end if;
  if v_order.status = 'cancelled' then raise exception 'El pedido está cancelado'; end if;
  if v_order.payment_status <> 'paid' then raise exception 'El pedido debe estar pagado'; end if;

  v_allowed :=
    (v_order.fulfillment_status = 'unfulfilled' and _target = 'preparing') or
    (v_order.fulfillment_status = 'preparing' and _target = 'ready') or
    (v_order.fulfillment_status = 'ready' and _target = 'shipped') or
    (v_order.fulfillment_status = 'shipped' and _target = 'delivered') or
    (v_order.fulfillment_status = _target);

  if not v_allowed then
    raise exception 'Transición logística no válida: % → %', v_order.fulfillment_status, _target;
  end if;

  if v_order.fulfillment_status = _target then
    return;
  end if;

  v_order_status := case _target
    when 'shipped' then 'shipped'::public.order_status
    when 'delivered' then 'delivered'::public.order_status
    else 'processing'::public.order_status
  end;

  update public.orders
  set fulfillment_status = _target,
      status = v_order_status
  where id = v_order.id;

  insert into public.admin_activity_log (admin_id, action, entity_type, entity_id, details)
  values (
    auth.uid(),
    'fulfillment_advanced',
    'order',
    v_order.id,
    jsonb_build_object('from', v_order.fulfillment_status, 'to', _target, 'order_number', v_order.order_number)
  );
end;
$$;

revoke all on function public.advance_order_fulfillment(uuid, public.fulfillment_status) from public, anon;
grant execute on function public.advance_order_fulfillment(uuid, public.fulfillment_status) to authenticated;

create or replace function public.release_expired_order_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_count integer := 0;
begin
  -- Intentionally not exposed to end users. Can later be called by a scheduled
  -- Edge Function/service-role job.
  for v_order in
    select id from public.orders
    where payment_status = 'awaiting_transfer'
      and status <> 'cancelled'
      and reservation_expires_at is not null
      and reservation_expires_at < now()
    for update skip locked
  loop
    -- The function is SECURITY DEFINER; cancellation logic is reproduced here
    -- because cancel_order also performs ownership checks against auth.uid().
    perform 1;
    update public.products p
    set reserved_stock = greatest(0, p.reserved_stock - oi.quantity)
    from public.order_items oi
    where oi.order_id = v_order.id and oi.product_id = p.id;

    insert into public.inventory_movements (product_id, type, quantity, reference_type, reference_id, notes)
    select oi.product_id, 'reservation_release', oi.quantity, 'order', v_order.id,
           'Liberación automática de reserva expirada'
    from public.order_items oi
    where oi.order_id = v_order.id and oi.product_id is not null;

    update public.orders
    set status = 'cancelled', payment_status = 'cancelled'
    where id = v_order.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.release_expired_order_reservations() from public, anon, authenticated;
