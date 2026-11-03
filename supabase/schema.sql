-- ESSENCE product catalogue
-- Run this file in the Supabase SQL Editor after creating your project.
create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'General',
  description text not null default '',
  price numeric(12,2) not null check (price > 0),
  image_url text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;

grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;

drop policy if exists "Public can view active products" on public.products;
create policy "Public can view active products"
on public.products for select
to anon, authenticated
using (is_active = true or (select coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)));

drop policy if exists "Admins can insert products" on public.products;
create policy "Admins can insert products"
on public.products for insert
to authenticated
with check ((select coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)));

drop policy if exists "Admins can update products" on public.products;
create policy "Admins can update products"
on public.products for update
to authenticated
using ((select coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)))
with check ((select coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)));

drop policy if exists "Admins can delete products" on public.products;
create policy "Admins can delete products"
on public.products for delete
to authenticated
using ((select coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

-- After creating your store owner's Auth user, grant admin in Supabase
-- Dashboard > Authentication > Users > select user > Edit app metadata:
-- { "is_admin": true }
-- Never use user_metadata for administrator privileges.
