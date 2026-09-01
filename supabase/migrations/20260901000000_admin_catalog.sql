-- Admin catalog: profile flag, product RLS and public product media.
-- user_roles remains the source of truth; profiles.is_admin is a protected mirror.

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

update public.profiles p
set is_admin = exists (
  select 1
  from public.user_roles ur
  where ur.user_id = p.id and ur.role = 'admin'
);

create or replace function public.profile_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin is true
  );
$$;

revoke all on function public.profile_is_admin() from public, anon;
grant execute on function public.profile_is_admin() to authenticated, service_role;

-- The flag cannot be elevated through a normal profile update.
create or replace function public.prevent_profile_admin_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_admin is distinct from old.is_admin
     and coalesce(current_setting('app.sync_admin_flag', true), '') <> 'on' then
    raise exception 'No se puede modificar is_admin directamente';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_profile_admin_change() from public, anon, authenticated;
drop trigger if exists trg_profiles_prevent_admin_change on public.profiles;
create trigger trg_profiles_prevent_admin_change
  before update of is_admin on public.profiles
  for each row execute function public.prevent_profile_admin_change();

-- Allow the trusted role-sync trigger to update the protected flag.
create or replace function public.sync_profile_admin_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := coalesce(new.user_id, old.user_id);
begin
  perform set_config('app.sync_admin_flag', 'on', true);
  update public.profiles
  set is_admin = exists (
    select 1 from public.user_roles where user_id = v_user_id and role = 'admin'
  )
  where id = v_user_id;
  return coalesce(new, old);
end;
$$;

revoke all on function public.sync_profile_admin_flag() from public, anon, authenticated;
drop trigger if exists trg_user_roles_sync_profile_admin on public.user_roles;
create trigger trg_user_roles_sync_profile_admin
  after insert or update or delete on public.user_roles
  for each row execute function public.sync_profile_admin_flag();

drop policy if exists "products_admin_manage" on public.products;
create policy "products_admin_insert" on public.products
  for insert to authenticated with check (public.profile_is_admin());
create policy "products_admin_update" on public.products
  for update to authenticated
  using (public.profile_is_admin()) with check (public.profile_is_admin());
create policy "products_admin_delete" on public.products
  for delete to authenticated using (public.profile_is_admin());

grant insert, update, delete on public.product_images to authenticated;
drop policy if exists "product_images_admin_manage" on public.product_images;
create policy "product_images_admin_insert" on public.product_images
  for insert to authenticated with check (public.profile_is_admin());
create policy "product_images_admin_update" on public.product_images
  for update to authenticated
  using (public.profile_is_admin()) with check (public.profile_is_admin());
create policy "product_images_admin_delete" on public.product_images
  for delete to authenticated using (public.profile_is_admin());

-- Public bucket: anyone can view via its public URL; only admins can mutate files.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'productos', 'productos', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "productos_admin_insert" on storage.objects;
drop policy if exists "productos_admin_update" on storage.objects;
drop policy if exists "productos_admin_delete" on storage.objects;

create policy "productos_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'productos' and public.profile_is_admin());
create policy "productos_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'productos' and public.profile_is_admin())
  with check (bucket_id = 'productos' and public.profile_is_admin());
create policy "productos_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'productos' and public.profile_is_admin());
