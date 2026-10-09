-- Sécurité pré-launch (audit 2026-06-17) — restreindre l'EXECUTE de fonctions
-- internes / SECURITY DEFINER exposées par erreur via PostgREST.
-- Aucune n'est appelée par le client ni les Edge Functions en tant qu'anon /
-- authenticated (vérifié par grep). postgres + service_role conservent l'accès.

-- F-SEC1b (CRITIQUE) — _reschedule_cron planifie des jobs cron arbitraires
-- (SQL exécuté côté serveur) SANS contrôle d'accès, et était exécutable par
-- `authenticated` → escalade de privilèges. Helper interne aux migrations.
REVOKE EXECUTE ON FUNCTION public._reschedule_cron(text, text, text) FROM PUBLIC, anon, authenticated;

-- F-SEC1 — get_monthly_ai_cost_cents() exposait la dépense IA mensuelle au
-- rôle `anon` (donnée opérationnelle interne). Appelée uniquement côté serveur
-- (budget-guard du module IA, via service_role dans les Edge Functions).
REVOKE EXECUTE ON FUNCTION public.get_monthly_ai_cost_cents() FROM PUBLIC, anon, authenticated;

-- F-SEC1c — reset_inactive_warning() pouvait effacer l'avertissement
-- d'inactivité de n'importe quel utilisateur, exécutable par `authenticated`.
-- Réservé au job cron / service_role.
REVOKE EXECUTE ON FUNCTION public.reset_inactive_warning(uuid) FROM PUBLIC, anon, authenticated;

-- Propreté — rls_auto_enable() est une fonction d'event trigger (non appelable
-- utilement en RPC) ; on retire l'EXECUTE superflu pour faire taire le lint.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
