// Libellés du popover panier du header.
//
// Extrait de `BasketPopover.jsx` le 2026-07-31 (§2 audit front) — 5ᵉ application
// du pattern. 32 lignes suffisaient ici à faire passer le fichier sous la barre
// des 500, le critère d'acceptation : un petit gain au bon endroit vaut mieux
// qu'un gros gain sur un fichier qui reste hors critère.
//
// Couvert automatiquement par `i18n-dictionaries-parity.test.js` (#904).

export const BASKET_POPOVER_I18N = {
 fr: {
 titleEmpty: 'Ta liste de courses',
 titleFilled: (n) => `Ta liste de courses (${n})`,
 headlineEmptyZero: 'Pas encore de liste',
 headlineEmptyHasLists: 'Mes listes récentes',
 descEmptyZero: 'Accède à ton panier ou parcours nos recettes pour commencer.',
 descFilled: 'Aperçu de la liste',
 ctaStart: 'Accéder à mon panier',
 ctaBrowse: 'Parcourir les recettes',
 ctaSeeList: 'Voir ma liste',
 ctaSeeAllLists: 'Voir toutes mes listes',
 moreItems: (n) => `+ ${n} ${n > 1 ? 'autres' : 'autre'}`,
 items: (n) => n <= 1 ? `${n} élément` : `${n} éléments`,
 confirmReplace: 'Ton panier actuel n\'est pas vide. Le remplacer par cette liste ?',
 listLoaded: 'Liste chargée dans le panier.',
 },
 en: {
 titleEmpty: 'Your shopping list',
 titleFilled: (n) => `Your shopping list (${n})`,
 headlineEmptyZero: 'No list yet',
 headlineEmptyHasLists: 'My recent lists',
 descEmptyZero: 'Open your basket or browse our recipes to get going.',
 descFilled: 'List preview',
 ctaStart: 'Open my basket',
 ctaBrowse: 'Browse recipes',
 ctaSeeList: 'View my list',
 ctaSeeAllLists: 'See all my lists',
 moreItems: (n) => `+ ${n} more`,
 items: (n) => n === 1 ? `${n} item` : `${n} items`,
 confirmReplace: 'Your current basket isn\'t empty. Replace it with this list?',
 listLoaded: 'List loaded into basket.',
 },
}
