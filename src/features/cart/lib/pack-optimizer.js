// Optimiseur de panier — quelle combinaison de packs (vendus en grande surface)
// couvre un besoin donné au prix le plus bas ?
//
// Utilisé par l'onglet "À acheter" du panier. Les conditionnements (taille +
// prix unitaire au pack) viennent de `src/data/packSizes.js`.
//
// Algorithme : DP knapsack inverse — pour chaque grammage cible, on garde le
// prix minimum atteignable. Bornes : besoin ≤ 50 kg ou 100 pcs (très large).

import { PACK_SIZES }            from '@shared/static/pack-sizes'
import { getGramsPer,
         getReconstitutes }      from '@shared/static/ingredient-unit-hints'
import { resolvePacks }          from '@shared/lib/pricing/pricing-resolver'
import { toGrams }               from '@shared/lib/recipes/recipe-utils'

// Volumes : table de conversion vers cl (l'unité pivot pour les liquides).
// Utilisée par le mécanisme `reconstitutes` quand le besoin et le volume
// reconstitué d'un pack n'ont pas la même unité (ex: besoin en `L`, recons
// défini en `cl`).
const TO_CL = { cl: 1, ml: 0.1, L: 100 }

// Convertit un besoin (amount, unit) vers la même unité que le volume
// reconstitué (`reconUnit`). Renvoie null si conversion impossible.
//   - mêmes unités    → renvoie amount tel quel
//   - tous les deux liquides (cl/ml/L) → conversion via TO_CL
//   - tous les deux masses (g/kg)      → conversion grammes
//   - g↔cl : densité ≈ 1 (eau) — acceptable pour bouillon/lait/crème
function convertNeedToReconUnit(amount, unit, reconUnit) {
  if (unit === reconUnit) return amount
  // Liquide → liquide
  if (TO_CL[unit] && TO_CL[reconUnit]) {
    return amount * TO_CL[unit] / TO_CL[reconUnit]
  }
  // Masses
  if (unit === 'g'  && reconUnit === 'kg') return amount / 1000
  if (unit === 'kg' && reconUnit === 'g')  return amount * 1000
  // Liquide ↔ masse via densité ≈ 1 (acceptable pour les liquides cuisine)
  if (TO_CL[unit] && reconUnit === 'g')  return amount * TO_CL[unit] * 10
  if (TO_CL[unit] && reconUnit === 'kg') return amount * TO_CL[unit] / 100
  if (unit === 'g'  && TO_CL[reconUnit]) return amount / 10 / TO_CL[reconUnit]
  if (unit === 'kg' && TO_CL[reconUnit]) return amount * 100 / TO_CL[reconUnit]
  return null
}

// Convertit un besoin {amount, unit} vers la même unité que les packs
// d'un ingrédient. Renvoie null si la conversion est impossible.
//
// Cas standards :
//   • Packs en 'g'   → besoin converti en grammes via toGrams()
//   • Packs en 'pcs' → besoin converti en pcs via getGramsPer()⁻¹ si besoin
//                      en g, sinon valeur brute
//   • Packs en 'cl'  → besoin converti en cl (1 cl = 10 ml = 10 g pour eau)
function normalizeNeed(amount, unit, ingredientId, packUnit) {
  if (amount == null || amount === 0) return 0

  if (packUnit === 'g') {
    // toGrams couvre kg, cl→ml, ml, L, pcs→g via gramsPer, etc.
    const g = toGrams(amount, unit, ingredientId)
    if (g > 0) return g
    // Fallback v3.27.7 : si l'ingrédient est concentré (reconstitutes défini
    // sur 'g'), on convertit le besoin vers l'unité reconstituée puis on
    // applique le ratio. Ex : besoin 200g de coulis ÷ ratio 2.85 ≈ 70g
    // de concentré.
    return tryReconstitutes(amount, unit, ingredientId, packUnit)
  }

  if (packUnit === 'pcs') {
    if (unit === 'pcs' || unit === 'unité') return amount
    const gramsPerPiece = getGramsPer(ingredientId, 'unité') || getGramsPer(ingredientId, 'pcs')
    // Besoin en grammes → pcs via gramsPer (ex: 150g d'œufs → boîte 6)
    if (gramsPerPiece > 0 && unit === 'g') return Math.ceil(amount / gramsPerPiece)
    // Besoin dans une sous-unité connue (tranche, botte…) → g → pcs via gramsPer
    // Ex: 8 tranches de baguette → 8×30g=240g → ceil(240/250g)=1 baguette
    if (gramsPerPiece > 0) {
      const gramsPerSubUnit = getGramsPer(ingredientId, unit)
      if (gramsPerSubUnit > 0) return Math.ceil(amount * gramsPerSubUnit / gramsPerPiece)
    }
    // Fallback v3.27.7 : reconstitutes (ex: bouillon cube → cl)
    return tryReconstitutes(amount, unit, ingredientId, packUnit)
  }

  if (packUnit === 'cl') {
    if (unit === 'cl') return amount
    if (unit === 'ml') return amount / 10
    if (unit === 'L')  return amount * 100
    if (unit === 'cs') return amount * 1.5  // 1 c. à soupe ≈ 15 ml = 1.5 cl
    if (unit === 'cc') return amount * 0.5  // 1 c. à café ≈ 5 ml = 0.5 cl
    // Besoin en grammes vers pack en cl : densité ≈ 1 (acceptable pour tous
    // les liquides cuisine usuels — eau/lait/crème/vinaigre ; huile = 0.92,
    // erreur tolérable pour un panier indicatif).
    if (unit === 'g')  return amount / 10
    if (unit === 'kg') return amount * 100
    return null
  }

  // Autres unités-pièce (gousse, branche, sachet, tranche, botte, feuille…) :
  // si le besoin et le pack utilisent la même unité, on compare directement.
  // Si le besoin est en grammes et qu'on connaît gramsPer pour cette unité,
  // on convertit (ex: 50g de chèvre tranche → 2 tranches via gramsPer.tranche).
  if (unit === packUnit) return amount
  if (unit === 'g') {
    const gPerPack = getGramsPer(ingredientId, packUnit)
    if (gPerPack > 0) return Math.ceil(amount / gPerPack)
  }
  // Fallback v3.27.7 : reconstitutes pour les autres unités-pièce (sachet,
  // gousse…) si jamais un ingrédient l'utilise.
  return tryReconstitutes(amount, unit, ingredientId, packUnit)
}

// Tentative de conversion via le mécanisme `reconstitutes`.
// Renvoie le nombre de packs nécessaires (arrondi sup) ou null si pas de
// règle reconstitutes définie / unité incompatible.
//
// Exemple bouillon cube : packUnit = 'pcs', recons['pcs'] = { amount: 100,
// unit: 'cl' }. Pour besoin 100 cl → ceil(100 / 100) = 1 pcs.
function tryReconstitutes(amount, unit, ingredientId, packUnit) {
  const recons = getReconstitutes(ingredientId, packUnit)
  if (!recons || recons.amount <= 0) return null
  const reconvertedAmount = convertNeedToReconUnit(amount, unit, recons.unit)
  if (reconvertedAmount == null || reconvertedAmount <= 0) return null
  const ratio = reconvertedAmount / recons.amount
  // Pour les packs entiers (pcs/sachet), on arrondit au sup.
  // Pour les packs en grammes (concentrés), on garde la valeur fractionnaire
  // et le DP de l'optimiseur arrondira aux packs disponibles.
  return packUnit === 'g' ? ratio : Math.ceil(ratio)
}

// Cœur de l'optimiseur. Prend une liste de packs disponibles et un besoin
// (dans la même unité que les packs). Renvoie la combinaison la moins chère
// qui couvre ≥ needed.
//
// Implémentation : DP knapsack inverse non borné.
//   dp[i] = { price, parent } pour avoir au moins i unités
// Avec bound = needed + maxPackSize - 1, on garantit qu'on dépasse jamais
// inutilement.
function dpKnapsackInverse(packs, needed) {
  if (needed <= 0) return { packs: [], totalSize: 0, totalPrice: 0 }
  if (packs.length === 0) return null

  const maxPack = Math.max(...packs.map(p => p.size))
  const bound = needed + maxPack // borne haute du DP

  // dp[i] = prix minimum pour atteindre exactement ≥ i unités à i fixé
  // On stocke le pack utilisé en dernier pour reconstruire la combo.
  const dp = new Array(bound + 1).fill(Infinity)
  const parent = new Array(bound + 1).fill(-1)
  dp[0] = 0

  for (let i = 1; i <= bound; i++) {
    for (let p = 0; p < packs.length; p++) {
      const { size, price } = packs[p]
      const prev = Math.max(0, i - size)
      if (dp[prev] + price < dp[i]) {
        dp[i] = dp[prev] + price
        parent[i] = p
      }
    }
  }

  // On cherche le grammage ≥ needed avec le prix le plus bas
  let bestIdx = needed
  for (let i = needed; i <= bound; i++) {
    if (dp[i] < dp[bestIdx]) bestIdx = i
  }
  if (dp[bestIdx] === Infinity) return null

  // Reconstruction de la combinaison
  const counts = new Array(packs.length).fill(0)
  let cur = bestIdx
  while (cur > 0 && parent[cur] !== -1) {
    const p = parent[cur]
    counts[p]++
    cur = Math.max(0, cur - packs[p].size)
  }

  const usedPacks = []
  let totalSize = 0
  let totalPrice = 0
  for (let p = 0; p < packs.length; p++) {
    if (counts[p] > 0) {
      usedPacks.push({ size: packs[p].size, unit: packs[p].unit, count: counts[p], price: packs[p].price })
      totalSize  += packs[p].size  * counts[p]
      totalPrice += packs[p].price * counts[p]
    }
  }
  // Tri par taille croissante pour un affichage stable
  usedPacks.sort((a, b) => a.size - b.size)
  return { packs: usedPacks, totalSize, totalPrice: Math.round(totalPrice * 100) / 100 }
}

// API publique. Renvoie la combinaison de packs optimale pour couvrir un
// besoin (amount, unit) d'un ingrédient dans une langue donnée.
//
// Renvoie `null` quand :
//   • L'ingrédient n'a pas d'entrée dans PACK_SIZES (ingrédient en vrac → le
//     caller fait fallback sur prices.js)
//   • L'unité est 'pm' / 'PM' (épice à volonté → pas de coût d'achat)
//   • Le besoin n'est pas convertible vers l'unité des packs
//   • Le besoin est ≤ 0
//
// Renvoie `{ packs, totalSize, totalUnit, totalPrice }` quand l'optimisation
// est possible. `packs` est une liste `[{ size, unit, count, price }, ...]`.
export function optimizePackPurchase(ingredientId, amount, unit, lang = 'fr') {
  if (!ingredientId || amount == null || amount <= 0) return null
  if (unit === 'pm' || unit === 'PM') return null

  const entry = PACK_SIZES[ingredientId]
  if (!entry) return null

  // `resolvePacks` priorise pricing/<year>.json (Phase D), fallback
  // packSizes.js. Les sizes/units sont stables ; seuls les prix peuvent
  // diverger entre les deux sources lors de mises à jour annuelles.
  const packs = resolvePacks(ingredientId, entry, lang)
  if (!packs || packs.length === 0) return null

  // Toutes les options d'un même ingrédient × langue partagent la même unité.
  const packUnit = packs[0].unit

  const needed = normalizeNeed(amount, unit, ingredientId, packUnit)
  if (needed === null) return null
  if (needed === 0)    return null

  const result = dpKnapsackInverse(packs, Math.ceil(needed))
  if (!result) return null

  return {
    packs: result.packs,
    totalSize: result.totalSize,
    totalUnit: packUnit,
    totalPrice: result.totalPrice,
  }
}

// Estime le prix d'un besoin à partir d'une liste de packs quelconque
// (ex: fallback par sous-catégorie via defaultPacksByCategory.js).
// Pour chaque pack de la liste, calcule le nombre minimum d'unités à acheter
// pour couvrir le besoin, et renvoie le prix le plus bas toutes options confondues.
// Renvoie null si aucun pack n'est compatible avec l'unité du besoin.
export function cheapestPackPrice(packs, amount, unit, ingredientId = null) {
  if (!packs || packs.length === 0 || amount == null || amount <= 0) return null
  if (unit === 'pm' || unit === 'PM') return null
  let best = null
  for (const pack of packs) {
    const needed = normalizeNeed(amount, unit, ingredientId, pack.unit)
    if (needed === null || needed <= 0) continue
    const count = Math.ceil(needed / pack.size)
    const price = Math.round(count * pack.price * 100) / 100
    if (best === null || price < best) best = price
  }
  return best
}

// Helper : indique si un ingrédient a au moins un pack défini dans la langue
// demandée. Utile à l'UI pour décider s'il faut basculer vers le fallback
// vrac (calcul linéaire via prices.js).
export function hasPackData(ingredientId, lang = 'fr') {
  const entry = PACK_SIZES[ingredientId]
  if (!entry) return false
  const packs = resolvePacks(ingredientId, entry, lang)
  return Array.isArray(packs) && packs.length > 0
}

// Renvoie la liste des conditionnements grande surface disponibles
// pour un ingrédient dans la langue demandée. Utilisé par CartManualAdd pour
// proposer un choix de pack respectant la référence grande surface FR 2025-2026, au
// lieu d'un mini-form qty/unit libre. Renvoie [] si pas de pack data
// (ingrédient en vrac → fallback caller doit gérer un mini-form).
export function getPacksFor(ingredientId, lang = 'fr') {
  const entry = PACK_SIZES[ingredientId]
  if (!entry) return []
  return resolvePacks(ingredientId, entry, lang) ?? []
}
