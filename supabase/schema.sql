-- Calista — Supabase schema + seed for the shared menu.
-- Run this ONCE in the Supabase dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT DO NOTHING.

-- ── Tables ────────────────────────────────────────────────────────────────
create table if not exists categories (
  id         text primary key,
  name       text not null,
  sort_order int  not null default 0
);

create table if not exists menu_items (
  id          text primary key,
  category_id text    not null references categories(id) on delete cascade,
  name        text    not null,
  description text    not null default '',
  price       integer not null default 0,     -- LKR, whole rupees
  image_url   text    not null default '',
  sort_order  int     not null default 0,
  available   boolean not null default true
);

-- ── Row Level Security ────────────────────────────────────────────────────
-- Public can READ the menu (the website). All WRITES go through the server
-- (service-role key), which bypasses RLS — so no public write policy exists.
alter table categories enable row level security;
alter table menu_items enable row level security;

drop policy if exists "public read categories" on categories;
create policy "public read categories" on categories for select using (true);

drop policy if exists "public read menu_items" on menu_items;
create policy "public read menu_items" on menu_items for select using (true);

-- ── Storage bucket for menu images (public read) ──────────────────────────
insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;

-- ── Customers (Stage 3) ───────────────────────────────────────────────────
-- Private table: no public RLS policies. All access is via the server
-- (service-role) through api/customers.js. lookup only returns one record.
create table if not exists customers (
  phone       text primary key,
  name        text not null,
  visits      int  not null default 0,
  total_spent bigint not null default 0,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);
alter table customers enable row level security;
-- Saved delivery details (auto-filled on the customer's next order).
alter table customers add column if not exists address text;
alter table customers add column if not exists location text;

-- ── Promotions (Stage 3b) — public read, admin writes via api/promotions.js ─
create table if not exists promotions (
  id          text primary key,
  title       text not null,
  description text not null default '',
  image_url   text not null default '',
  start_date  date,
  end_date    date,
  url         text not null default '',
  sort_order  int  not null default 0
);
alter table promotions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='promotions' and policyname='public_read_promotions') then
    create policy public_read_promotions on promotions for select using (true);
  end if;
end $$;

-- ── Site images (brand logo/hero) — public read, admin writes via api/site-images.js ─
create table if not exists site_images (
  id  text primary key,
  url text not null
);
alter table site_images enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='site_images' and policyname='public_read_site_images') then
    create policy public_read_site_images on site_images for select using (true);
  end if;
end $$;

-- ── Business details (brand) — public read, admin writes via api/settings.js ─
create table if not exists site_settings (
  id   text primary key,
  data jsonb not null default '{}'
);
alter table site_settings enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='site_settings' and policyname='public_read_site_settings') then
    create policy public_read_site_settings on site_settings for select using (true);
  end if;
end $$;

-- ── Orders (Phase 1) ──────────────────────────────────────────────────────
-- Private table: no public RLS policies. All access is via the server
-- (service-role) through api/orders.js. Customers read their own order
-- through the `get` action using the unguessable CAL-XXXXXX id.
create table if not exists orders (
  id text primary key                             -- CAL-XXXXXX
);
-- Columns are added one by one rather than inline above: `create table if not
-- exists` is a silent no-op when a table of that name already exists, so an
-- older/differently-shaped `orders` table would leave the columns missing and
-- every insert failing. These ALTERs converge any existing table on the right
-- shape. Every added column is nullable or defaulted so this is safe to run
-- against a table that already has rows.
alter table orders add column if not exists created_at             timestamptz not null default now();
alter table orders add column if not exists updated_at             timestamptz not null default now();
alter table orders add column if not exists mode                   text;    -- delivery | pickup | table
alter table orders add column if not exists status                 text not null default 'placed';
alter table orders add column if not exists table_no               int;
alter table orders add column if not exists customer_name          text;
alter table orders add column if not exists customer_phone         text;
alter table orders add column if not exists address                text;
alter table orders add column if not exists location               text;    -- Google Maps link
alter table orders add column if not exists delivery_distance_km   numeric;
alter table orders add column if not exists out_of_zone            boolean not null default false;
alter table orders add column if not exists requested_time         text;
alter table orders add column if not exists notes                  text;
alter table orders add column if not exists items                  jsonb   not null default '[]';
alter table orders add column if not exists subtotal               integer not null default 0;
alter table orders add column if not exists discount_amount        integer not null default 0;
alter table orders add column if not exists discount_percent       numeric not null default 0;
alter table orders add column if not exists service_charge         integer not null default 0;
alter table orders add column if not exists service_charge_percent numeric not null default 0;
alter table orders add column if not exists delivery_fee           integer not null default 0;
alter table orders add column if not exists total                  integer not null default 0;
alter table orders add column if not exists rider_id               text;
alter table orders enable row level security;
create index if not exists orders_created_at_idx on orders (created_at desc);
create index if not exists orders_status_idx on orders (status);

-- ── Push subscriptions (Phase 2) ──────────────────────────────────────────
-- Private table: no public RLS policies. Written by api/push.js on the
-- service-role key. One row per browser/device, so one customer can have
-- several. `installed` records whether that device is running the app as an
-- installed PWA (display-mode: standalone) at subscribe time.
create table if not exists push_subscriptions (
  endpoint text primary key
);
alter table push_subscriptions add column if not exists customer_phone text;
alter table push_subscriptions add column if not exists p256dh         text;
alter table push_subscriptions add column if not exists auth           text;
alter table push_subscriptions add column if not exists user_agent     text;
alter table push_subscriptions add column if not exists installed      boolean not null default false;
alter table push_subscriptions add column if not exists created_at     timestamptz not null default now();
alter table push_subscriptions add column if not exists last_seen      timestamptz not null default now();
alter table push_subscriptions add column if not exists fail_count     int not null default 0;
alter table push_subscriptions enable row level security;
create index if not exists push_subs_phone_idx on push_subscriptions (customer_phone);

-- Install / opt-in state, tracked per customer (Phase 2).
alter table customers add column if not exists installed_pwa boolean not null default false;
alter table customers add column if not exists installed_at  timestamptz;
alter table customers add column if not exists push_opted_in boolean not null default false;

-- ── Staff login keys (Phase 3) ────────────────────────────────────────────
-- Private table: no public RLS policies. Only the SHA-256 hash of each key is
-- stored, so a database leak does not hand over working logins and a lost key
-- cannot be recovered — only revoked and reissued. `key_prefix` is the first
-- segment kept in the clear purely so the UI can tell keys apart.
-- Roles: sysadmin | admin | manager | rider. Customers are NOT in this table;
-- they have no key and are identified by phone at order time.
create table if not exists staff_keys (
  id uuid primary key default gen_random_uuid()
);
alter table staff_keys add column if not exists role         text not null default 'rider';
alter table staff_keys add column if not exists name         text not null default '';
alter table staff_keys add column if not exists key_hash     text;
alter table staff_keys add column if not exists key_prefix   text;
alter table staff_keys add column if not exists active       boolean not null default true;
alter table staff_keys add column if not exists created_at   timestamptz not null default now();
alter table staff_keys add column if not exists last_used_at timestamptz;
alter table staff_keys add column if not exists created_by   text;
alter table staff_keys enable row level security;
create unique index if not exists staff_keys_hash_idx on staff_keys (key_hash);

-- ── Seed: categories ──────────────────────────────────────────────────────
insert into categories (id, name, sort_order) values
  ('starters', 'Starters', 1),
  ('pizza',    'Pizza',    2),
  ('mains',    'Mains',    3),
  ('drinks',   'Drinks',   4),
  ('desserts', 'Desserts', 5)
on conflict (id) do nothing;

-- ── Seed: menu items (current placeholder menu) ───────────────────────────
insert into menu_items (id, category_id, name, description, price, image_url, sort_order) values
  ('bruschetta','starters','Tomato Bruschetta','Toasted sourdough, vine tomatoes, basil, olive oil',1200,'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=800&q=80',1),
  ('arancini','starters','Truffle Arancini','Crispy risotto balls, truffle aioli',1450,'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800&q=80',2),
  ('calamari','starters','Salt & Pepper Calamari','Lemon, garlic mayo',1650,'https://images.unsplash.com/photo-1599974579688-8dbdd335c77f?w=800&q=80',3),
  ('burrata','starters','Burrata & Heirloom Tomato','Aged balsamic, basil oil',1850,'https://images.unsplash.com/photo-1631823372438-9c0d8a3f9aa6?w=800&q=80',4),
  ('margherita','pizza','Margherita','San Marzano, fior di latte, basil',2200,'https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?w=800&q=80',1),
  ('prosciutto','pizza','Prosciutto & Rocket','Buffalo mozzarella, parmesan shavings',2600,'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80',2),
  ('funghi','pizza','Funghi','Wild mushrooms, taleggio, thyme',2400,'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80',3),
  ('diavola','pizza','Diavola','Spicy salami, chilli honey, mozzarella',2500,'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=800&q=80',4),
  ('gnocchi','mains','Wild Mushroom Gnocchi','Hand-rolled, sage butter, parmesan',2800,'https://images.unsplash.com/photo-1587740908075-9e245311b96e?w=800&q=80',1),
  ('salmon','mains','Pan-Seared Salmon','Charred greens, lemon beurre blanc',3400,'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&q=80',2),
  ('steak','mains','Eye Fillet 250g','Triple-cooked chips, red wine jus',4200,'https://images.unsplash.com/photo-1546964124-0cce460f38ef?w=800&q=80',3),
  ('risotto','mains','Prawn Risotto','Tiger prawns, saffron, mascarpone',3200,'https://images.unsplash.com/photo-1633964913295-ceb43826a07f?w=800&q=80',4),
  ('sparkling','drinks','Italian Sparkling Water 750ml','Still or sparkling',650,'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=800&q=80',1),
  ('soda','drinks','Craft Soda','Lemon-lime / cola / ginger',500,'https://images.unsplash.com/photo-1437418747212-8d9709afab22?w=800&q=80',2),
  ('espresso','drinks','Espresso','Single-origin Arabica',450,'https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=800&q=80',3),
  ('wine','drinks','House Red 250ml','Sangiovese blend',1400,'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&q=80',4),
  ('tiramisu','desserts','Tiramisu','Mascarpone, espresso, cocoa',1200,'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800&q=80',1),
  ('panna','desserts','Vanilla Panna Cotta','Berry compote',1100,'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&q=80',2),
  ('gelato','desserts','Gelato Trio','Choose three scoops',1000,'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=800&q=80',3)
on conflict (id) do nothing;
