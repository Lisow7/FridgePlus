// Conservation et rangement par ingrédient — v3.29.0 (Phase C — schéma unifié).
//
// Stratégie : override spécifique > préfixe par défaut > fallback global.
// Inspiré de `ingredientUnitHints.js` qui suit le même pattern.
//
// Champs :
//   • `method`           — type de conservation : 'fridge' | 'pantry' |
//                          'freezer' | 'cellar' | 'spice-rack' | 'bread-box'
//   • `durationDays`     — durée typique avant ouverture (jours), ou null
//   • `afterOpeningDays` — durée après ouverture (jours), ou null
//   • `location`         — où ranger : 'fridge' | 'pantry' | 'freezer' |
//                          'spice-rack' | 'fruit-bowl' | 'cellar' | 'bread-box'
//   • `compartment`      — pour fridge : 'door' | 'top-shelf' | 'middle' |
//                          'crisper' | 'bottom' | null
//   • `notes`            — texte libre court (ex: « à l'abri de la lumière »)
//
// Les durées sont **indicatives** — basées sur conventions sécurité alimentaire
// (ANSES, Que Choisir 2024-2025). À affiner par ingrédient lors de la Phase E.

const FALLBACK = {
  method: 'pantry',
  durationDays: 90,
  afterOpeningDays: 30,
  location: 'pantry',
  compartment: null,
  notes: '',
}

// 1) Defaults par préfixe d'ID — joue quand aucun override spécifique
const PREFIX_DEFAULTS = {
  // Surgelés : -18°C, longue conservation, 1-2 mois après décongélation
  'frz-': {
    method: 'freezer',
    durationDays: 180,
    afterOpeningDays: 30,
    location: 'freezer',
    compartment: null,
    notes: '-18 °C',
  },
  // Frigo : viande, poisson, dairy, charcuterie. Court terme.
  'fr-':  {
    method: 'fridge',
    durationDays: 7,
    afterOpeningDays: 3,
    location: 'fridge',
    compartment: 'middle',
    notes: '',
  },
  // Légumes : bac à légumes (crisper), 1-2 semaines
  'vg-':  {
    method: 'fridge',
    durationDays: 10,
    afterOpeningDays: 5,
    location: 'fridge',
    compartment: 'crisper',
    notes: '',
  },
  // Garde-manger : épicerie sec (longue conservation)
  'gp-':  {
    method: 'pantry',
    durationDays: 365,
    afterOpeningDays: 90,
    location: 'pantry',
    compartment: null,
    notes: '',
  },
  // Épices : porte-épices, très longue conservation mais perte d'arôme
  'sp-':  {
    method: 'spice-rack',
    durationDays: 730,
    afterOpeningDays: 365,
    location: 'spice-rack',
    compartment: null,
    notes: 'à l\'abri de la lumière',
  },
  // Japonais sec : pantry
  'jp-':  {
    method: 'pantry',
    durationDays: 365,
    afterOpeningDays: 90,
    location: 'pantry',
    compartment: null,
    notes: '',
  },
  // Boulangerie : 2-5 jours
  'bk-':  {
    method: 'bread-box',
    durationDays: 3,
    afterOpeningDays: 3,
    location: 'bread-box',
    compartment: null,
    notes: 'protéger du dessèchement',
  },
}

// 2) Overrides spécifiques par ingrédient — cas qui dérogent au préfixe
const SPECIFIC = {
  // ── Œufs : frigo, durée moyenne ────────────────────────────────────────
  'fr-oeuf':         { method: 'fridge', durationDays: 28, afterOpeningDays: 7,
                       location: 'fridge', compartment: 'door', notes: '' },
  'fr-oeufs-standard': { method: 'fridge', durationDays: 28, afterOpeningDays: 7,
                         location: 'fridge', compartment: 'door', notes: '' },

  // ── Lait UHT : pantry tant que fermé, frigo après ouverture ────────────
  'fr-lait':         { method: 'pantry', durationDays: 90, afterOpeningDays: 5,
                       location: 'pantry', compartment: null,
                       notes: 'frigo après ouverture' },
  'fr-lait-entier':  { method: 'pantry', durationDays: 90, afterOpeningDays: 5,
                       location: 'pantry', compartment: null,
                       notes: 'frigo après ouverture' },

  // ── Beurre : frigo, longue durée si non ouvert ─────────────────────────
  'fr-beurre':       { method: 'fridge', durationDays: 60, afterOpeningDays: 30,
                       location: 'fridge', compartment: 'door', notes: '' },

  // ── Crème fraîche/liquide : frigo, courte durée après ouverture ────────
  'fr-creme':        { method: 'fridge', durationDays: 21, afterOpeningDays: 4,
                       location: 'fridge', compartment: 'middle', notes: '' },
  'fr-creme-liquide':{ method: 'fridge', durationDays: 21, afterOpeningDays: 4,
                       location: 'fridge', compartment: 'middle', notes: '' },
  'fr-creme-fraiche':{ method: 'fridge', durationDays: 21, afterOpeningDays: 7,
                       location: 'fridge', compartment: 'middle', notes: '' },

  // ── Yaourts : frigo, ~3 semaines ──────────────────────────────────────
  'fr-yaourt-nature':{ method: 'fridge', durationDays: 21, afterOpeningDays: 0,
                       location: 'fridge', compartment: 'middle', notes: 'à consommer rapidement après ouverture' },

  // ── Fruits typiquement à température ambiante (corbeille) ─────────────
  'fr-banane':       { method: 'pantry', durationDays: 5, afterOpeningDays: 5,
                       location: 'fruit-bowl', compartment: null,
                       notes: 'mûrir à T° ambiante, ne pas mettre au frigo' },
  'fr-pomme':        { method: 'pantry', durationDays: 14, afterOpeningDays: 7,
                       location: 'fruit-bowl', compartment: null, notes: '' },
  'fr-poire':        { method: 'pantry', durationDays: 7, afterOpeningDays: 7,
                       location: 'fruit-bowl', compartment: null, notes: '' },
  'fr-citron':       { method: 'pantry', durationDays: 14, afterOpeningDays: 7,
                       location: 'fruit-bowl', compartment: null, notes: '' },
  'fr-orange':       { method: 'pantry', durationDays: 14, afterOpeningDays: 7,
                       location: 'fruit-bowl', compartment: null, notes: '' },

  // ── Légumes pomme de terre / oignon / ail : pantry sec, frais et obscur
  'vg-pomme-terre':  { method: 'pantry', durationDays: 30, afterOpeningDays: 30,
                       location: 'pantry', compartment: null,
                       notes: 'à l\'abri de la lumière' },
  'vg-oignon':       { method: 'pantry', durationDays: 30, afterOpeningDays: 14,
                       location: 'pantry', compartment: null, notes: '' },
  'vg-ail':          { method: 'pantry', durationDays: 90, afterOpeningDays: 30,
                       location: 'pantry', compartment: null, notes: '' },

  // ── Pains : 2-3 jours, à défaut surgeler ──────────────────────────────
  'gp-pain':         { method: 'bread-box', durationDays: 3, afterOpeningDays: 3,
                       location: 'bread-box', compartment: null, notes: '' },
  'gp-baguette':     { method: 'bread-box', durationDays: 1, afterOpeningDays: 1,
                       location: 'bread-box', compartment: null, notes: 'fraîcheur 24h' },
  'gp-pain-mie':     { method: 'pantry', durationDays: 7, afterOpeningDays: 5,
                       location: 'pantry', compartment: null, notes: '' },

  // ── Huiles : pantry, à l'abri de la lumière ───────────────────────────
  'sp-huile-olive-ex':{method: 'pantry', durationDays: 540, afterOpeningDays: 180,
                       location: 'pantry', compartment: null,
                       notes: 'à l\'abri de la lumière' },
  'sp-huile-tournesol':{method: 'pantry', durationDays: 540, afterOpeningDays: 180,
                       location: 'pantry', compartment: null,
                       notes: 'à l\'abri de la lumière' },

  // ── Miel / sirops : indéfini ─────────────────────────────────────────
  'gp-miel':         { method: 'pantry', durationDays: 1825, afterOpeningDays: 1825,
                       location: 'pantry', compartment: null,
                       notes: 'pratiquement indéfini' },

  // ── Conserves ouvertes → transvaser, frigo 2-3 jours ──────────────────
  'gp-tomates-pelees':{ method: 'pantry', durationDays: 1095, afterOpeningDays: 3,
                       location: 'pantry', compartment: null,
                       notes: 'transvaser et conserver au frigo après ouverture' },
}

/**
 * Renvoie la conservation+rangement d'un ingrédient.
 * @param {string} ingredientId
 * @returns {{method:string, durationDays:number, afterOpeningDays:number, location:string, compartment:string|null, notes:string}}
 */
export function getConservation(ingredientId) {
  if (!ingredientId) return { ...FALLBACK }
  if (SPECIFIC[ingredientId]) return { ...SPECIFIC[ingredientId] }
  for (const [prefix, hints] of Object.entries(PREFIX_DEFAULTS)) {
    if (ingredientId.startsWith(prefix)) return { ...hints }
  }
  return { ...FALLBACK }
}

/**
 * Liste des méthodes de conservation possibles. Utile pour l'UI admin.
 * @type {readonly string[]}
 */
export const CONSERVATION_METHODS = Object.freeze([
  'fridge', 'pantry', 'freezer', 'cellar', 'spice-rack', 'bread-box',
])

/**
 * Liste des emplacements de rangement possibles.
 * @type {readonly string[]}
 */
export const STORAGE_LOCATIONS = Object.freeze([
  'fridge', 'pantry', 'freezer', 'spice-rack', 'fruit-bowl', 'cellar', 'bread-box',
])

/**
 * Liste des compartiments frigo. Utile pour l'UI admin et le frigo 3D.
 * @type {readonly string[]}
 */
export const FRIDGE_COMPARTMENTS = Object.freeze([
  'door', 'top-shelf', 'middle', 'crisper', 'bottom',
])
