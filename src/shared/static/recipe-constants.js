// Régimes masqués temporairement de la UI (sélecteurs, filtres,
// badges) avant le launch public. Le `halal` est retiré le temps qu'on
// puisse certifier la base d'ingrédients (additifs, gélatine, alcool de
// process, traceurs) avec un partenaire reconnu — sinon promesse non
// tenable. Ne PAS supprimer les données existantes : si une recette
// avait déjà `diet: ['halal']`, le tag est filtré côté affichage mais
// reste dans `recipe.diet` pour réactivation post-launch sans data loss.
// Réactivation = retirer la clé de cette liste (zéro autre changement).
export const HIDDEN_DIETS = ['halal']

export const TYPE_COLORS = {
  'Entrée & Soupe':      { bg: '#E3F0F7', text: '#3A7A9C' },
  'Plat principal':      { bg: '#FEF3E2', text: '#C47820' },
  'Accompagnement':      { bg: '#EDF7ED', text: '#4A8A48' },
  'Salade':              { bg: '#E8F5E9', text: '#3A7A58' },
  'Dessert & Petit-déj': { bg: '#F7EDF7', text: '#8A4A8A' },
  'Boisson':             { bg: '#E0F4F4', text: '#2C8A8A' },
  'Sauce & Base':        { bg: '#F5EBD9', text: '#8A6420' },
}

export const DIFFICULTY_COLOR = {
  'Très facile':   '#7BB078',
  'Facile':        '#5B9AAE',
  'Intermédiaire': '#C4A555',
  'Difficile':     '#D07070',
}

// Jumelle TEXTE de la palette ci-dessus : celle du dessus reste le FOND (posée
// à 13 % d'opacité), celle-ci porte le libellé.
//
// Mesuré le 2026-08-25 sur `/recipe/:id` : en texte sur leur propre fond, les
// quatre pastel plafonnaient entre **2,07 et 2,83** pour un seuil AA de 4,5:1 —
// et l'audit initial n'avait vu qu'une seule recette, donc qu'une seule des
// quatre. Les valeurs ci-dessous atteignent 4,6 à 4,7 en ne bougeant que la
// luminosité, teinte et saturation conservées.
export const DIFFICULTY_TEXT = {
  'Très facile':   '#50724E',
  'Facile':        '#426F7D',
  'Intermédiaire': '#7B6836',
  'Difficile':     '#9C5454',
}

// 🔴 Le thème SOMBRE demande l'INVERSE — piège rencontré en direct : appliquer
// les teintes foncées ci-dessus aux deux thèmes corrigeait le clair (0 violation)
// et DÉGRADAIT le sombre (2,62 et 2,92, soit pire qu'avant).
//
// Sur les fonds sombres, les pastel d'origine passent DÉJÀ : « Très facile »
// 5,67 · « Intermédiaire » 6,04. Seules deux ratent de peu (4,55 et 4,25) et se
// rattrapent en éclaircissant d'un cheveu. On garde donc la palette d'origine
// ici, à deux retouches près.
export const DIFFICULTY_TEXT_DARK = {
  'Très facile':   '#7BB078',
  'Facile':        '#5D9BAF',
  'Intermédiaire': '#C4A555',
  'Difficile':     '#D37979',
}

// Sprint 7 PR S7.b — Réduction à FR + EN.
export const DIFFICULTY_LABELS = {
  fr: { 'Très facile': 'Très facile', 'Facile': 'Facile', 'Intermédiaire': 'Intermédiaire', 'Difficile': 'Difficile' },
  en: { 'Très facile': 'Very easy',   'Facile': 'Easy',   'Intermédiaire': 'Intermediate',  'Difficile': 'Difficult' },
}

export const TYPE_LABELS = {
  fr: { 'Entrée & Soupe': 'Entrée & Soupe',   'Plat principal': 'Plat principal',  'Accompagnement': 'Accompagnement', 'Salade': 'Salade', 'Dessert & Petit-déj': 'Dessert & Petit déjeuner', 'Boisson': 'Boisson', 'Sauce & Base': 'Sauce & Base' },
  en: { 'Entrée & Soupe': 'Starter & Soup',    'Plat principal': 'Main course',     'Accompagnement': 'Side dish',      'Salade': 'Salad',  'Dessert & Petit-déj': 'Dessert & Breakfast', 'Boisson': 'Drink', 'Sauce & Base': 'Sauce & Base' },
}

export const TYPE_OPTIONS = {
  fr: [
    { value: 'all',                  label: 'Tous les types' },
    { value: 'Entrée & Soupe',       label: 'Entrée & Soupe' },
    { value: 'Plat principal',       label: 'Plat principal' },
    { value: 'Accompagnement',       label: 'Accompagnement' },
    { value: 'Salade',               label: 'Salade' },
    { value: 'Dessert & Petit-déj',  label: 'Dessert & Petit déjeuner' },
    { value: 'Boisson',              label: 'Boisson' },
    { value: 'Sauce & Base',         label: 'Sauce & Base' },
  ],
  en: [
    { value: 'all',                  label: 'All types' },
    { value: 'Entrée & Soupe',       label: 'Starter & Soup' },
    { value: 'Plat principal',       label: 'Main course' },
    { value: 'Accompagnement',       label: 'Side dish' },
    { value: 'Salade',               label: 'Salad' },
    { value: 'Dessert & Petit-déj',  label: 'Dessert & Breakfast' },
    { value: 'Boisson',              label: 'Drink' },
    { value: 'Sauce & Base',         label: 'Sauce & Base' },
  ],
}
