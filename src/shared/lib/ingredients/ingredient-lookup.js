// Factory pour récupérer le label *canonique* d'un ingrédient à partir de son
// id (depuis la BDD via DataContext). Construit des index id→ingrédient et
// id→sous-catégorie une seule fois pour la map d'ingrédients passée.
//
// Utile dans le panier : les recettes stockent leurs ingrédients avec un label
// décrivant la *quantité* (ex: "3 œufs (1 entier + 2 jaunes)"). Or dans la
// liste de courses, on veut juste le nom de l'ingrédient (ex: "Œufs").
//
// Usage typique : `const lookup = createIngredientLookup(ingredients)`
// puis `lookup.getLabel(id, 'fr')`. Côté React, utiliser le hook
// `useIngredientLookup()` exposé par DataContext.

// Clés d'AFFICHAGE du frigo qui ré-injectent d'autres sous-catégories (bacs
// regroupés). Ce ne sont PAS de vraies sous-catégories d'ingrédient → on ne
// les laisse pas écraser la vraie sous-cat dans subcatById (sinon le panier
// classerait beurre/œufs/fromage en « Autres » au lieu de « Crèmerie & Œufs »).
//   - 'bof' = bac Beurre·Œufs·Fromage (= dairy + cheese + eggs)
const DISPLAY_AGGREGATE_SUBCATS = new Set(['bof'])

export function createIngredientLookup(ingredients) {
  const idIndex = new Map()
  const subcatIndex = new Map()
  if (ingredients) {
    for (const [subcat, cat] of Object.entries(ingredients)) {
      for (const item of cat) {
        if (item?.id) {
          idIndex.set(item.id, item)
          // Les items d'un agrégat d'affichage sont déjà indexés sous leur
          // vraie sous-catégorie (dairy/cheese/eggs) → ne pas l'écraser.
          if (!DISPLAY_AGGREGATE_SUBCATS.has(subcat)) subcatIndex.set(item.id, subcat)
        }
      }
    }
  }

  return {
    // Renvoie le label canonique d'un ingrédient dans la langue demandée, ou
    // null si l'ingrédient n'est pas trouvé. Fallback fr si la langue manque.
    getLabel(ingredientId, lang = 'fr') {
      if (!ingredientId) return null
      const item = idIndex.get(ingredientId)
      if (!item) return null
      return item.labels?.[lang] ?? item.labels?.fr ?? null
    },

    // Renvoie l'objet ingrédient complet (id, labels, emoji, group_id, price).
    getIngredient(ingredientId) {
      if (!ingredientId) return null
      return idIndex.get(ingredientId) ?? null
    },

    // Renvoie la sous-catégorie d'INGREDIENTS contenant l'ingrédient
    // (ex: 'frozen-meat', 'dairy', 'vegetables', 'sauces'…) ou null.
    // Sert au panier pour grouper les ingrédients par rayon supermarché.
    getSubCategory(ingredientId) {
      if (!ingredientId) return null
      return subcatIndex.get(ingredientId) ?? null
    },

    // Renvoie la clé "canonique" pour un ingrédient : son group_id parent
    // s'il existe, sinon son propre id. Sert à cumuler les variantes d'un
    // même ingrédient dans le panier (ex: fr-oeufs-standard et fr-oeufs-bio
    // venant de deux recettes différentes se cumulent sous fr-oeuf).
    getCanonicalKey(ingredientId) {
      if (!ingredientId) return null
      const item = idIndex.get(ingredientId)
      return item?.group_id ?? ingredientId
    },

    // Map<id, ingredient> brute (utile pour passer à calcRecipeCost).
    byId: idIndex,

    // Map<id, subcat> — la subcat est la clé de l'arbre INGREDIENTS, pas
    // une propriété de l'item lui-même. On l'expose pour les consommateurs
    // qui doivent regrouper par rayon (ex: panier groupByAisleConsolidated).
    subcatById: subcatIndex,
  }
}

// Pluriel adaptatif d'un label d'ingrédient en fonction du nombre.
//
// Stratégie :
//   1. Si le label contient un marqueur explicite "(s)", "(es)" ou "(er)"
//      (convention Fridge+ : "Œuf(s)", "Egg(s)", "Ei(er)"), on l'utilise :
//      les parenthèses sont retirées si count ≥ 2, le suffixe est retiré
//      si count = 1.
//   2. Sinon en français/espagnol, on ajoute "s" pour count ≥ 2 (sauf si
//      le label se termine déjà par s/x/z = invariable).
//   3. Pour en/de/ja sans marqueur : on garde tel quel (trop de cas
//      particuliers en anglais : leaf→leaves, potato→potatoes…).
export function pluralizeLabel(label, count, lang = 'fr') {
  if (!label) return label
  // 1. Marqueur explicite : Œuf(s), Egg(s), Ei(er), Huevo(s)…
  const m = label.match(/^(.*)\(([^)]+)\)$/)
  if (m) {
    const [, base, suffix] = m
    return count >= 2 ? `${base}${suffix}` : base.trim()
  }
  // 2. Pluriel par défaut français/espagnol
  if (lang === 'fr' || lang === 'es') {
    if (count < 2) return label
    if (/[sxz]$/i.test(label)) return label // déjà invariable
    return `${label}s`
  }
  // 3. Autres langues : pas de transformation auto
  return label
}
