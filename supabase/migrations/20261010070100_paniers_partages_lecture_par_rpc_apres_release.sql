-- Seconde moitié d'« écritures publiques bornées » (audit du 2026-10-04,
-- BDD-05 (1)) : la lecture publique de la table des paniers partagés tombe.
-- Un panier se lit par `get_shared_basket` (un seul, celui du lien) ; le client
-- le fait depuis la release qui suit la première moitié.
--
-- 🔴 À APPLIQUER JUSTE APRÈS LA RELEASE, pas avant : la v0.145 en production
-- lit encore la table (`.from('shared_baskets')`), et chaque lien partagé
-- répondrait « ce lien a expiré ». Le propriétaire garde la lecture de ses
-- paniers par `shared_baskets_owner_select` (export de ses données).

DROP POLICY IF EXISTS shared_baskets_public_read ON public.shared_baskets;
