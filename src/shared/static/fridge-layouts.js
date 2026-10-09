// @deprecated v3.3.13 — Fallback offline uniquement.
// Source de vérité : `fridge_layouts.structure` jsonb (cf. supabase/SCHEMA.md).
export const FRIDGE_LAYOUTS = {
  fr: {
    type: 'top-freezer',
    fridgeLabel: 'Frigo',
    pantryLabel: 'Garde-manger',
    openLabel: 'Ouvrir',
    closeDoorLabel: 'Fermer la porte',
    closeDoorsLabel: 'Fermer les portes',
    recipesLabel: 'Recettes',
    resetLabel: 'Vider le frigo / garde-manger',
    fridge: [
      {
        id: 'freezer', label: 'Congélateur', emoji: '❄️', flex: 1,
        subcategories: [
          { id: 'frozen-meat',   label: 'Viande congelée',  emoji: '🥩' },
          { id: 'frozen-fish',   label: 'Poisson congelé',  emoji: '🐟' },
          { id: 'frozen-veg',    label: 'Légumes congelés', emoji: '🥦' },
          { id: 'ready-meals',   label: 'Plats préparés',   emoji: '🍕' },
          { id: 'ice-cream',     label: 'Glaces',           emoji: '🍨' },
          { id: 'frozen-bread',  label: 'Pain & Viennoiseries', emoji: '🥐' },
        ],
      },
      {
        id: 'fresh', label: 'Frais', emoji: '🧊', flex: 2,
        subcategories: [
          { id: 'meat',    label: 'Viande',       emoji: '🥩' },
          { id: 'fish',    label: 'Poisson',      emoji: '🐟' },
          { id: 'bof',     label: 'Beurre·Œufs·Fromage', emoji: '🧀' },
          { id: 'deli',    label: 'Charcuterie',  emoji: '🥓' },
        ],
      },
      {
        id: 'leftovers', label: 'Restes', emoji: '🥡', flex: 2,
        subcategories: [
          { id: 'today',    label: "Aujourd'hui",   emoji: '📅' },
          { id: 'thisweek', label: 'Cette semaine', emoji: '🗓️' },
        ],
      },
      {
        id: 'crisper', label: 'Légumes & Fruits', emoji: '🥦', flex: 1.5,
        subcategories: [
          { id: 'vegetables',      label: 'Légumes',              emoji: '🥦' },
          { id: 'fruits',          label: 'Fruits',               emoji: '🍎' },
        ],
      },
    ],
    pantry: [
      {
        id: 'dry', label: 'Épicerie sèche', emoji: '🌾', desc: 'Pâtes, riz, conserves…',
        subcategories: [
          { id: 'pasta-rice',  label: 'Pâtes & Riz',           emoji: '🍝' },
          { id: 'canned',      label: 'Conserves',              emoji: '🥫' },
          { id: 'cereals',     label: 'Céréales & Légumineuses',emoji: '🌾' },
          { id: 'bread',       label: 'Pain & Biscottes',       emoji: '🍞' },
          { id: 'sweet',       label: 'Chocolat & Confiseries', emoji: '🍫' },
          { id: 'nuts-dried',  label: 'Noix & Fruits secs',     emoji: '🥜' },
        ],
      },
      {
        id: 'spices', label: 'Épices & Condiments', emoji: '🌿', desc: 'Sel, poivre, huile…',
        subcategories: [
          { id: 'salt-spices', label: 'Sel & Épices',        emoji: '🧂' },
          { id: 'herbs',       label: 'Herbes aromatiques',  emoji: '🌿' },
          { id: 'sauces',      label: 'Sauces & Condiments', emoji: '🫙' },
          { id: 'oils',        label: 'Huiles & Vinaigres',  emoji: '🫒' },
        ],
      },
    ],
  },

  en: {
    type: 'side-by-side',
    fridgeLabel: 'Fridge',
    pantryLabel: 'Pantry',
    openLabel: 'Open',
    closeDoorLabel: 'Close door',
    closeDoorsLabel: 'Close doors',
    recipesLabel: 'Recipes',
    resetLabel: 'Clear fridge & pantry',
    fridge: [
      {
        id: 'freezer', label: 'Freezer', emoji: '❄️', flex: 1,
        subcategories: [
          { id: 'frozen-meat',  label: 'Frozen Meat',     emoji: '🥩' },
          { id: 'frozen-fish',  label: 'Frozen Fish',     emoji: '🐟' },
          { id: 'frozen-veg',   label: 'Frozen Veggies',  emoji: '🥦' },
          { id: 'ready-meals',  label: 'Ready Meals',     emoji: '🍕' },
          { id: 'ice-cream',    label: 'Ice Cream',           emoji: '🍨' },
          { id: 'frozen-bread', label: 'Frozen Bread & Pastries', emoji: '🥐' },
        ],
      },
      {
        id: 'fresh', label: 'Fresh', emoji: '🧊', flex: 2,
        subcategories: [
          { id: 'meat',   label: 'Meat',        emoji: '🥩' },
          { id: 'fish',   label: 'Fish',        emoji: '🐟' },
          { id: 'bof',    label: 'Dairy & Eggs',emoji: '🧀' },
          { id: 'deli',   label: 'Deli',        emoji: '🥓' },
        ],
      },
      {
        id: 'leftovers', label: 'Leftovers', emoji: '🥡', flex: 1.5,
        subcategories: [
          { id: 'today',    label: 'Today',     emoji: '📅' },
          { id: 'thisweek', label: 'This week', emoji: '🗓️' },
        ],
      },
      {
        id: 'crisper', label: 'Crisper', emoji: '🥦', flex: 1,
        subcategories: [
          { id: 'vegetables',      label: 'Vegetables',     emoji: '🥦' },
          { id: 'fruits',          label: 'Fruits',         emoji: '🍎' },
        ],
      },
    ],
    pantry: [
      {
        id: 'dry', label: 'Dry Goods', emoji: '🌾', desc: 'Pasta, rice, cans…',
        subcategories: [
          { id: 'pasta-rice', label: 'Pasta & Rice',   emoji: '🍝' },
          { id: 'canned',     label: 'Canned Goods',   emoji: '🥫' },
          { id: 'cereals',    label: 'Cereals & Pulses',emoji: '🌾' },
          { id: 'bread',      label: 'Bread & Crackers',emoji: '🍞' },
          { id: 'sweet',      label: 'Chocolate & Sweets',  emoji: '🍫' },
          { id: 'nuts-dried', label: 'Nuts & Dried Fruits',  emoji: '🥜' },
        ],
      },
      {
        id: 'spices', label: 'Spices & Condiments', emoji: '🌿', desc: 'Salt, pepper, oil…',
        subcategories: [
          { id: 'salt-spices', label: 'Salt & Spices',    emoji: '🧂' },
          { id: 'herbs',       label: 'Herbs',             emoji: '🌿' },
          { id: 'sauces',      label: 'Sauces',            emoji: '🫙' },
          { id: 'oils',        label: 'Oils & Vinegars',   emoji: '🫒' },
        ],
      },
    ],
  },

}
