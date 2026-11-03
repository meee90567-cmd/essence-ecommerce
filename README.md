# ESSENCE

A premium, editorial-style e-commerce storefront for considered everyday living. Launch currency is Nigerian naira (₦), with the product model designed to support additional African markets in future.

## Stack
- React 19 + Vite
- Supabase (Postgres, Auth and Row Level Security)
- Render Static Site

## Run locally
1. Install Node.js 20.19+ or 22.12+.
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env`.
4. Add your Supabase project URL and publishable/anon key.
5. Run `npm run dev`.

## Supabase setup
1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL Editor.
3. Create the store owner's user in Authentication.
4. Set the user's **app_metadata** to `{ "is_admin": true }`. Do not use user-editable user metadata for authorization.
5. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Render.

Only the public publishable/anon key belongs in frontend environment variables. Never expose a service-role or secret key in browser code.

## Product management
Open **Store admin** in the footer, sign in with the authorised store account, and add products. Product management is restricted by database RLS to users whose trusted app metadata contains `is_admin: true`.

## Current scope
The storefront includes a responsive catalogue, category filters, search, a persistent shopping bag, Naira pricing and an administrator product-entry screen. Checkout/payment processing is not enabled yet; a payment provider and verified server-side payment flow must be integrated before accepting live orders.

## Deploy
The repository includes `render.yaml` for a Render Static Site. Connect the repository in Render and provide the two Supabase public environment variables. If Supabase is not configured, the storefront displays a demonstration collection.
