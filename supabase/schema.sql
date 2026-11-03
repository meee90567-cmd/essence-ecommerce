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

-- Public product image delivery; uploads remain admin-only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "ESSENCE admins upload product images" on storage.objects;
create policy "ESSENCE admins upload product images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-images'
  and (select coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false))
);

drop policy if exists "ESSENCE admins update product images" on storage.objects;
create policy "ESSENCE admins update product images"
on storage.objects for update to authenticated
using (
  bucket_id = 'product-images'
  and (select coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false))
)
with check (
  bucket_id = 'product-images'
  and (select coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false))
);

drop policy if exists "ESSENCE admins delete product images" on storage.objects;
create policy "ESSENCE admins delete product images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'product-images'
  and (select coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false))
);


-- ESSENCE checkout orders. These tables are accessed only by trusted Edge Functions.
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  delivery_address text not null,
  total_amount numeric(12,2) not null check (total_amount > 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  status text not null default 'pending' check (status in ('pending','paid','failed')),
  paystack_reference text not null unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  product_name text not null,
  quantity integer not null check (quantity between 1 and 20),
  unit_price numeric(12,2) not null check (unit_price > 0),
  line_total numeric(12,2) not null check (line_total > 0)
);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists order_items_order_id_idx on public.order_items(order_id);
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
revoke all on public.orders from anon, authenticated;
revoke all on public.order_items from anon, authenticated;
