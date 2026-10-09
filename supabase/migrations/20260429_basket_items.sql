-- Table panier V6
create table if not exists public.basket_items (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  recipe_id      text not null,
  recipe_name    text not null,
  recipe_emoji   text,
  ingredient_id  text not null,
  label          text not null,
  amount         float,
  unit           text,
  price          float,
  checked        boolean not null default false,
  added_at       timestamptz not null default now()
);

-- Index pour les requêtes par user
create index if not exists basket_items_user_id_idx on public.basket_items(user_id);

-- RLS
alter table public.basket_items enable row level security;

create policy "basket_select_own" on public.basket_items
  for select using (auth.uid() = user_id);

create policy "basket_insert_own" on public.basket_items
  for insert with check (auth.uid() = user_id);

create policy "basket_update_own" on public.basket_items
  for update using (auth.uid() = user_id);

create policy "basket_delete_own" on public.basket_items
  for delete using (auth.uid() = user_id);
