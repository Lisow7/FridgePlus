# 0006 — Trois paliers d'accès, et ce que chacun voit du Premium

- Statut : accepté
- Date : 2026-10-09 (directive du propriétaire du 2026-05-20, écrite ici à l'audit du 2026-10-04, PREM-08)

## Contexte et problème

Les fonctionnalités de Fridge+ se répartissent en trois paliers :

1. **Gratuit, sans compte** — le frigo, les recettes, les filtres, la voix pour remplir le frigo.
2. **Gratuit, avec un compte** — les favoris, le profil, la communauté, la création de recettes.
3. **Premium** — le panier (`/cart`), le mode cuisine avec la voix (`/cook/:id`), les substituts IA, l'analyse des dépenses, les listes sauvegardées.

La règle de **visibilité** du Premium existait depuis le 2026-05-20, mais seulement hors du dépôt
(consignes de l'audit, mémoire de l'assistant). Chaque point d'entrée décidait seul, et l'audit du
2026-10-04 en a trouvé quatre montrés aux visiteurs sans compte : le bouton « Substituts IA » de la
fiche, le verrou « Mode cuisine » de son pied, le groupe « Ce qui arrive » du guide (« Voir ce qui
arrive » ouvrait la fenêtre Premium), et `?modal=upgrade`, qui ouvrait cette fenêtre à n'importe qui.
Un visiteur rencontrait donc quatre promesses Premium avant même de s'inscrire.

## Décision

- **Visiteur sans compte : aucun point d'entrée Premium.** Ni bouton, ni onglet, ni verrou, ni
  pastille « Bientôt », ni fenêtre : pour lui, le Premium n'existe pas à l'écran.
- **Compte gratuit : visible et verrouillé.** Le point d'entrée est là, avec son verrou
  (`UpgradeGate`) ou sa pastille, qui mène à la fenêtre Premium.
- **Premium : la fonctionnalité.**

Sous forme de prédicat, à chaque point d'entrée :
`user ? (hasPremiumAccess ? fonctionnalité : verrou) : rien`. Les routes Premium (`/cart`, `/cook/:id`)
restent derrière `AuthGuard` (un visiteur est renvoyé vers la connexion, pas vers le verrou), et la
vérification de l'accès reste côté serveur (RLS, fonctions edge) : ce qui est décrit ici est
l'affichage, pas la sécurité.

## Conséquences

- Un nouveau point d'entrée Premium suit le prédicat, et son test le prouve pour les trois paliers
  (`src/test/unit/premium-invisible-pour-l-invite.test.jsx` en donne la forme).
- Tant que le Premium est « en pause » (`PREMIUM_ENABLED = false`), le verrou dit « Bientôt » au lieu
  de vendre : la règle ne change pas, seul le texte du verrou change.
- Ce que cet ADR ne tranche pas (en attente d'une décision du propriétaire) : la forme unique du
  verrou entre les six existantes, le bouton « Ajouter au panier » de la fiche pour un compte gratuit,
  et le panier en anglais (PREM-08 (5) à (9)).
