-- Table restes utilisateur (Bacs Restes V1.2.59)
create table if not exists public.user_leftovers (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  emoji         text not null default '🥡',
  ingredient_id text,
  dlc_days      int not null check (dlc_days between 1 and 5),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  deleted_at    timestamptz
);

create index if not exists user_leftovers_user_id_idx on public.user_leftovers(user_id);

alter table public.user_leftovers enable row level security;

create policy "leftovers_owner_all" on public.user_leftovers
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
