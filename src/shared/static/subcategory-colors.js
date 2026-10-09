// @deprecated v3.3.13 — Fallback offline uniquement.
// Source de vérité : `ingredient_subcategories.bg_color` + `text_color`.
export const SUBCATEGORY_COLORS = {
  // Viande → rouge
  'meat':         { bg: '#FAE8E8', text: '#B83030' },
  'frozen-meat':  { bg: '#FAE8E8', text: '#B83030' },

  // Poisson → bleu
  'fish':         { bg: '#E8F4F8', text: '#5B9AAE' },
  'frozen-fish':  { bg: '#E8F4F8', text: '#5B9AAE' },

  // Végétal → vert
  'vegetables':   { bg: '#EEF6E8', text: '#5A8A28' },
  'frozen-veg':   { bg: '#EEF6E8', text: '#5A8A28' },
  'fruits':       { bg: '#E8F5E9', text: '#6DAA6A' },
  'herbs':        { bg: '#EEF6E8', text: '#5A8A28' },

  // Œufs + Fromage → jaune/doré
  'eggs':         { bg: '#FEF8E0', text: '#B89A20' },
  'cheese':       { bg: '#FEF3DC', text: '#A88020' },
  'dairy':        { bg: '#FEF3DC', text: '#A88020' },

  // Charcuterie → rose
  'deli':         { bg: '#F5E0EB', text: '#B84070' },

  // Plats préparés → gris argenté
  'ready-meals':  { bg: '#EEF2F5', text: '#7A90A0' },

  // Restes / Divers → gris terne
  'today':        { bg: '#F0F0EE', text: '#808080' },
  'thisweek':     { bg: '#F0F0EE', text: '#808080' },
  'bof':          { bg: '#F0F0EE', text: '#808080' },
  'leftovers':    { bg: '#F0F0EE', text: '#808080' },
  'crisper':      { bg: '#EEF6E8', text: '#5A8A28' },
  'top-freezer':  { bg: '#EEF2F5', text: '#7A90A0' },

  // Tofu / Légumineuses → crème chaude
  'tofu':         { bg: '#F5F2E5', text: '#7A6B40' },

  // Blé / Produits secs → beige chaud
  'pasta-rice':   { bg: '#F5EFE0', text: '#9A7840' },
  'cereals':      { bg: '#F5EFE0', text: '#9A7840' },
  'bread':        { bg: '#F5EFE0', text: '#9A7840' },
  'frozen-bread': { bg: '#F5EFE0', text: '#9A7840' },
  'canned':       { bg: '#F5EFE0', text: '#9A7840' },
  'sweet':        { bg: '#F5EFE0', text: '#9A7840' },
  'rice':         { bg: '#F7F3E8', text: '#8A7040' },
  'dry':          { bg: '#F0EAD8', text: '#7A6030' },

  // Épices / Condiments / Assaisonnements → orange (couleur du site)
  'salt-spices':  { bg: '#FBF0E4', text: '#C0601A' },
  'sauces':       { bg: '#FBF0E4', text: '#C0601A' },
  'oils':         { bg: '#FBF0E4', text: '#C0601A' },
  'basic':        { bg: '#FBF0E4', text: '#C0601A' },

  // Glaces → violet doux
  'ice-cream':    { bg: '#F2EEF8', text: '#8A68C0' },
}
