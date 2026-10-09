// Domaines de valeurs du formulaire « recettes de base » (admin).
//
// Extrait de `base-recipes-section.jsx` le 2026-08-28 (audit) : ce sont des
// données, pas de la logique de rendu, et le fichier appelant était sous
// cliquet de taille.

export const DIFF_OPTIONS = ['very-easy', 'easy', 'medium', 'hard']
export const DIFF_LABELS = {
  'very-easy': 'Très facile', easy: 'Facile', medium: 'Intermédiaire', hard: 'Difficile',
}

export const TYPE_OPTIONS = ['main', 'starter', 'side', 'dessert', 'salad', 'drink', 'sauce-base']
export const TYPE_LABELS = {
  main: '🍽️ Plat principal', starter: '🥣 Entrée / Soupe', side: '🥗 Accompagnement',
  dessert: '🍰 Dessert', salad: '🥙 Salade', drink: '🥤 Boisson', 'sauce-base': '🥣 Sauce & Base',
}

// 🔴 Valait `['active','archived']` jusqu'au 2026-08-28 : deux valeurs hors du
// domaine réel de la colonne. `recipes_unified.status` n'a AUCUNE contrainte
// CHECK — elles étaient donc acceptées en silence, et la policy de lecture
// publique (`status IN ('published','featured')`) rendait alors la recette
// INVISIBLE pour tout le monde, tout en la laissant listée côté admin. Ni
// erreur, ni signal. Vérifié en base au moment de l'audit : 515 recettes
// toutes en `published`, le piège n'avait encore jamais été déclenché.
//
// ⛔ Ces valeurs doivent rester alignées sur la policy de `recipes_unified`.
export const STATUS_OPTIONS = ['published', 'featured', 'draft']
export const STATUS_LABELS = {
  published: 'Publiée', featured: 'Mise en avant', draft: 'Brouillon (masquée)',
}

export const DIET_KEYS = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free']
export const DIET_LABELS = {
  vegetarian: '🌿 Végétarien', vegan: '🌱 Végan',
  'gluten-free': '🚫🌾 Sans gluten', 'dairy-free': '🥛 Sans lactose',
}
