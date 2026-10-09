# 0005 — Corrections apportées par l'audit du 2026-08-28

- Statut : accepté
- Date : 2026-08-28
- Remplace (partiellement) : [0001](0001-persistance-dual-mode.md), [0002](0002-i18n-inline-par-composant.md), [0004](0004-donnees-static-vs-supabase.md)

## Contexte

Les ADR sont en **ajout seul** (`README.md` de ce dossier) : on ne corrige pas une
décision passée en la réécrivant, on en publie une nouvelle qui la remplace. L'audit
complet du 2026-08-28 a vérifié 136 affirmations de la documentation contre le code et
en a trouvé **41 fausses ou périmées (32 %)**. Celles qui vivaient dans des ADR sont
rectifiées ici.

## Ce qui change

### Périmètre linguistique : 2 langues, pas 5 — remplace 0002

L'ADR 0002 annonce « l'app est en 5 langues (`fr,en,es,de,ja`) » et impose de fournir
chaque chaîne dans les cinq. **C'est faux depuis la réduction du périmètre** :
`SUPPORTED_LANGS` (`src/shared/contexts/ui-provider.jsx`) ne contient que `fr` et `en`,
et un réglage hérité `es`/`de`/`ja` est migré vers `en` au démarrage.

Ce faux fait n'est pas resté théorique : il a été recopié dans la documentation interne, dans
`docs/ARCHITECTURE.md`, dans le README admin — puis **imprimé dans l'image d'aperçu
publique du site**, où il annonçait cinq langues aux visiteurs. Corrigé le 2026-08-27.

**Règle** : une chaîne nouvelle se fournit en `fr` et `en`. Les clés `es`/`de`/`ja`
subsistant dans certains objets `I18N` sont un héritage inerte, pas un contrat.

Le décompte de l'ADR 0002 (« ≈ 69 fichiers » avec un `I18N` inline) est lui aussi périmé :
il y en a **92**. La décision de fond — i18n inline plutôt qu'une librairie — n'est pas
remise en cause.

### Migration invité → compte : plus aucun drapeau — remplace 0001

L'ADR 0001 décrit « deux flags de migration distincts » et demande de « préserver les
deux chemins ». Il y en avait en réalité **quatre**, et surtout ils étaient **nuisibles** :
stockés dans `localStorage`, donc à portée navigateur, et purgés nulle part.

Conséquence, sur un poste partagé comme lors d'un simple re-test : A se connecte (drapeau
posé) → se déconnecte → un invité remplit le frigo → quelqu'un se reconnecte → le frigo de
l'invité est **ignoré**, puis détruit à la déconnexion suivante. Même résultat que
l'incident du 21 août, par un autre chemin.

**Les drapeaux sont supprimés.** Depuis le correctif d'août, les clés de données ne sont
effacées qu'**après confirmation de l'écriture** : leur présence *est* le signal
« migration en attente ». Un second signal ne pouvait que diverger du premier.

⚠️ Ne pas « corriger » cela par une clé indexée sur l'utilisateur : elle ne couvre pas le
cas A → invité → A, qui est justement celui du re-test.

La mention d'idempotence via `onConflict: 'id'` de l'ADR 0001 est également inexacte : le
stock et les favoris utilisent `onConflict: 'user_id,ingredient_id'` (resp.
`'user_id,recipe_id'`) avec `ignoreDuplicates: true`. L'idempotence tient, le mécanisme
cité non.

### Fichiers statiques : repli hors-ligne, pas source — précise 0004

L'ADR 0004 présente `ingredients.js` et `fridge-layouts.js` comme « encore servis par des
fichiers statiques ». Les deux fichiers portent aujourd'hui, en première ligne,
`@deprecated — Fallback offline uniquement`. Ils servent d'**état initial** avant la
réponse Supabase, pas de source de vérité. Écart notable : `recipes.js` contient une
centaine de recettes quand la base en porte 515.

L'ADR 0004 mentionne aussi `migrate:legacy` comme « obsolète ». Le script npm existait
encore et pointait vers un fichier supprimé — il était donc **cassé**. Retiré de
`package.json` le 2026-08-28.

## Conséquence

Toute affirmation chiffrée d'un document de ce dépôt doit être considérée comme datée.
La source de vérité est le code, et pour la base, la base elle-même. Un document qui
restate une règle finit par la contredire : préférer un pointeur à une copie.
