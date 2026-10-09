-- 20260616_profiles_username_confirmed.sql
-- Ajoute un flag pour distinguer un pseudo CHOISI (inscription e-mail) d'un
-- pseudo AUTO (fallback OAuth) → déclenche l'écran « choisis ton pseudo ».

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username_confirmed boolean NOT NULL DEFAULT false;

-- Backfill : tous les comptes existants ont déjà choisi/utilisé un pseudo.
UPDATE public.profiles SET username_confirmed = true WHERE username_confirmed = false;

-- MAJ du trigger : confirmed = true si le pseudo vient des métadonnées (e-mail),
-- false si fallback (OAuth). Préserve la logique de dédup existante.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  declare
    v_username  text;
    v_confirmed boolean;
  begin
    v_username  := coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
    v_confirmed := (new.raw_user_meta_data->>'username') is not null;
    insert into public.profiles (id, username, avatar_id, username_confirmed)
    values (new.id, v_username, 'tomato', v_confirmed)
    on conflict (id) do nothing;
    return new;
  exception when unique_violation then
    insert into public.profiles (id, username, avatar_id, username_confirmed)
    values (new.id, v_username || '_' || substring(new.id::text, 1, 4), 'tomato', v_confirmed)
    on conflict do nothing;
    return new;
  end;
$function$;
