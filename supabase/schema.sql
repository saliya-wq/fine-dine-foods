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
