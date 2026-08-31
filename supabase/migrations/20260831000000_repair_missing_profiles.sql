-- Repairs the rare case where an Auth account exists without its matching profile.
-- It can only create the calling user's own profile and is safe to call repeatedly.
create or replace function public.ensure_my_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user auth.users%rowtype;
  v_customer_type public.customer_type := 'retail'::public.customer_type;
  v_raw_type text;
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;

  select * into v_user from auth.users where id = auth.uid();
  if not found then
    raise exception 'Usuario no encontrado';
  end if;

  v_raw_type := coalesce(v_user.raw_user_meta_data ->> 'customer_type', 'retail');
  if v_raw_type in ('professional', 'company', 'wholesale', 'distributor') then
    v_customer_type := v_raw_type::public.customer_type;
  end if;

  insert into public.profiles (
    id, email, first_name, last_name, phone, rut, company_name, company_rut, customer_type, b2b_status
  ) values (
    v_user.id,
    v_user.email,
    nullif(trim(v_user.raw_user_meta_data ->> 'first_name'), ''),
    nullif(trim(v_user.raw_user_meta_data ->> 'last_name'), ''),
    nullif(trim(v_user.raw_user_meta_data ->> 'phone'), ''),
    nullif(trim(v_user.raw_user_meta_data ->> 'rut'), ''),
    nullif(trim(v_user.raw_user_meta_data ->> 'company_name'), ''),
    nullif(trim(v_user.raw_user_meta_data ->> 'company_rut'), ''),
    v_customer_type,
    case
      when v_customer_type in ('professional', 'company', 'wholesale', 'distributor')
        then 'pending'::public.b2b_status
      else 'not_required'::public.b2b_status
    end
  ) on conflict (id) do nothing
  returning * into v_profile;

  if v_profile.id is null then
    select * into v_profile from public.profiles where id = auth.uid();
  end if;

  return v_profile;
end;
$$;

revoke all on function public.ensure_my_profile() from public, anon;
grant execute on function public.ensure_my_profile() to authenticated;
