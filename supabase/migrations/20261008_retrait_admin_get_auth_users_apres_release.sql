-- 2026-10-08 — Seconde moitié de `consultations_sensibles_tracees` (au
-- registre, version 20261008095232) : plus aucun compte ne peut rapatrier
-- les e-mails de TOUS les comptes d'un seul appel.
-- Audit du 2026-10-04, ADM-05 (point 1).
--
-- 🔴 À APPLIQUER JUSTE APRÈS LA RELEASE, PAS AVANT : la v0.145 en production
-- appelle `admin_get_auth_users()` à l'ouverture de l'onglet Utilisateurs.
-- Appliquée avant, cet onglet dirait « Le chargement a échoué » jusqu'à la
-- release.
--
-- AVANT D'APPLIQUER, vérifier que plus rien ne l'appelle :
--   git grep -n "admin_get_auth_users" -- src supabase/functions
-- ne doit rien rendre.
--
-- CE QU'ELLE FAIT : retire le droit d'appel à `anon` et `authenticated`. Le
-- seul chemin vers l'e-mail d'un compte devient `admin_reveler_compte`, qui
-- écrit sa trace AVANT de lire. Un retrait de droit plutôt qu'un DROP : le
-- geste se défait en une ligne (GRANT) si la release devait être annulée.
-- La fonction pourra être supprimée plus tard, sans urgence.
--
-- APRÈS : renommer ce fichier à sa version (14 chiffres) et rejouer la sonde
-- `supabase/probes/20261008_retrait_admin_get_auth_users_apres_release.sql`.

BEGIN;

REVOKE ALL ON FUNCTION public.admin_get_auth_users() FROM PUBLIC, anon, authenticated;

COMMIT;
