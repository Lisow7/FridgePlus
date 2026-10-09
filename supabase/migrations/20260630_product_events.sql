-- Events produit (funnel d'activation). INSERT-only, gaté consentement côté client.
-- 1ʳᵉ table du projet ouverte en INSERT à `anon` (toutes les autres : SELECT-only ou
-- authenticated owner-only). Aucune policy SELECT/UPDATE/DELETE → rien de lisible côté
-- client ; l'analyse se fait en SQL/admin.
create table if not exists public.product_events (
  id          uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  user_id     uuid references auth.users(id) on delete set null,
  anon_id     text,
  event       text not null,
  props       jsonb not null default '{}'::jsonb,
  constraint product_events_event_chk check (event in
    ('ingredient_added','cookable_recipe_viewed','recipe_opened','cook_completed')),
  constraint product_events_props_chk check (pg_column_size(props) <= 2048)
);

alter table public.product_events enable row level security;

-- Intégrité d'écriture : un anon ne peut PAS forger un user_id ; un connecté ne peut
-- attribuer un event qu'à lui-même.
create policy "insert own events" on public.product_events
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

create index product_events_event_time_idx on public.product_events (event, occurred_at);
create index product_events_occurred_idx    on public.product_events (occurred_at);
create index product_events_user_idx        on public.product_events (user_id);
create index product_events_anon_idx        on public.product_events (anon_id);
