import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { track } from '@shared/lib/observability/track'
import { useWindowWidth } from '@shared/hooks/use-window-width'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'
import { useNavigate } from 'react-router-dom'
import { HIDDEN_DIETS } from '@shared/static/recipe-constants'
import { useIngredients, useBaseRecipes, useCountries, useDietTypes, useAllergenTypes, useIngredientsById, useGroupMaps } from '@shared/contexts/data-provider'
import { expandStock } from '@shared/lib/recipes/recipe-scoring'
import { useAuth } from '@shared/contexts/auth-provider'
import { useSubscription } from '@shared/hooks/use-subscription'
import { resolveNutrition } from '@shared/lib/ingredients/ingredient-resolver'
import { calcRecipeCost, calcMissingCost, toGrams as sharedToGrams } from '@shared/lib/recipes/recipe-utils'
import { logCooking } from '@shared/api/cooking-logs'
import { useBadgeCelebration } from '@shared/hooks/use-badge-celebration'
import { useQuickRatePrompt } from '@features/recipes/hooks/use-quick-rate-prompt'
import { useSaveErrorToast } from '@shared/hooks/use-save-error-toast'
import { listReviews, aggregateReviews } from '@features/recipes/api/recipe-reviews'
import { recipeToSchemaOrg } from '@features/recipes/lib/recipe-to-schema-org'
import { pickLocalizedName } from '@shared/lib/recipes/recipe-i18n'
import { getRecipesUsingBase } from '@features/recipes/api/recipes'
import { getIngredientItemsFlat, getIngredientIds, getIngredientQty, getSubRecipes, isIngredientRequired } from '@shared/lib/recipes/recipe-ingredients'
import { MODAL_I18N } from '@features/recipes/components/recipe-modal-i18n'
import { useRecipeCost } from '@features/recipes/hooks/use-recipe-cost'

const isPantryId = (id) => /^(gp-|sp-|bk-)/.test(id ?? '')

const COLORS = {
  ready:  { bg: '#E8F5E9', text: '#5A8A58', bar: '#7BB078' },
  almost: { bg: '#FEF3E2', text: '#C47820', bar: '#F5A45A' },
  low:    { bg: '#FEF8E8', text: '#A08040', bar: '#C4A555' },
}

/**
 * État, effets et actions du détail recette.
 *
 * Le JSX (~290 l) closure entièrement sur cet état : il fallait le sortir en
 * premier. Retourne un objet unique, destructuré par l'appelant — même
 * contrat que `use-support-panel` (#924) et `use-recipe-form-modal` (#930).
 */
export default function useRecipeModal({ recipe, stock, onClose, lang, darkMode, onToggleIngredient, allergenPrefs, basketRecipeIds, variant, lockedServings }) {
  const isPage = variant === 'page'
  // Navigation vers une recette de base référencée dans une étape (ex.
  // « béchamel ») — un seul niveau d'état ici : si la recette de base
  // ouverte référence elle-même une autre recette de base, CETTE instance
  // de RecipeModal (rendue par BaseRecipeOverlay) gère son propre
  // peekRecipeId indépendamment → l'empilement est naturellement récursif,
  // sans pile explicite à gérer manuellement.
  const [peekRecipeId, setPeekRecipeId] = useState(null)
  const closePeek = useCallback(() => setPeekRecipeId(null), [])

  // Suggestions inverses (chantier recettes de base, 2026-07-14) : ids des
  // recettes complètes qui référencent CETTE recette comme sous-recette.
  // Fail-open côté API (getRecipesUsingBase renvoie [] sur erreur) → la
  // section reste simplement masquée, jamais d'état d'erreur visible.
  const [recipesUsingThis, setRecipesUsingThis] = useState([])
  useEffect(() => {
    let cancelled = false
    getRecipesUsingBase(recipe.id).then(ids => { if (!cancelled) setRecipesUsingThis(ids) })
    return () => { cancelled = true }
  }, [recipe.id])
  const { user, isAdmin } = useAuth()
  const celebrate = useBadgeCelebration()
  const promptQuickRate = useQuickRatePrompt(recipe?.id)
  const signalerEchec = useSaveErrorToast()
  // v3.418 — Lock édition recette communauté validée par admin.
  // Une fois approved (moderation_status='approved'), l'auteur ne peut plus
  // modifier le contenu pour préserver l'intégrité de la modération. Seuls
  // les admins peuvent rééditer via leur panel dédié. Defense in depth :
  // UI cache + trigger SQL bloque le UPDATE quoi qu'il arrive.
  const isApprovedCommunity = recipe?.isCustom && recipe?.moderation_status === 'approved'
  const canEditRecipe = recipe?.isCustom && (!isApprovedCommunity || isAdmin)

  // Partage : feuille (lien public + QR + impression). Le lien n'est proposé
  // que si la recette est publiquement accessible (base, ou communauté publiée
  // et modérée) — sinon le lien /recipe/:id renverrait « introuvable » (RLS).
  const [shareOpen, setShareOpen] = useState(false)
  const isPubliclyShareable = !recipe?.isCustom || recipe?._isCommunity || (recipe?.is_public && recipe?.moderation_status === 'approved')
  const shareUrl = `${window.location.origin}${import.meta.env.BASE_URL}recipe/${recipe?.id}`
  const ingredients = useIngredients()
  const { recipeNames: RECIPE_NAMES, recipes: baseRecipes, recipesById } = useBaseRecipes()
  const countries = useCountries()
  const dietTypes = useDietTypes()
  const allergenTypes = useAllergenTypes()
  const INGREDIENT_LOOKUP = useMemo(() => {
    const lookup = {}
    Object.values(ingredients).forEach(group =>
      group.forEach(item => { lookup[item.id] = { labels: item.labels, emoji: item.emoji, image_url: item.image_url, allergens: item.allergens ?? [] } })
    )
    return lookup
  }, [ingredients])
  const windowWidth = useWindowWidth()
  const isMobile    = windowWidth < 768
  const t        = MODAL_I18N[lang] ?? MODAL_I18N.fr
  const ingredientsById = useIngredientsById()

  // Ingrédients « catégories » (parents de groupe : Œuf, Riz, Pâtes, Pain…) ne
  // sont PAS stockables (le frigo ne contient que des concrets ; App.jsx purge
  // les parents du stock). Deux conséquences gérées ici (#A) :
  //  1) `effectiveStock` : avoir un enfant concret satisfait un slot parent
  //     (cohérent avec le scoring de la liste, qui utilise déjà expandStock).
  //  2) `concreteOptions` : le picker ne propose que des concrets stockables —
  //     on retire les parents-catégories, et si un slot n'a QUE des parents on
  //     les remplace par leurs enfants concrets. Plus de catégorie proposée,
  //     et cliquer « Œuf/Riz/Pain » ouvre le choix de concrets (au lieu d'un
  //     toggle mort qui ne passait jamais au vert).
  const groupMaps = useGroupMaps()
  const effectiveStock = useMemo(() => expandStock(stock, groupMaps), [stock, groupMaps])
  const isCategoryParent = (id) => !!(groupMaps?.groupMap?.[id]?.length)
  // Chaque id est expansé indépendamment : un parent-catégorie devient ses
  // enfants concrets même quand un autre alternative de la même liste est déjà
  // un leaf (bug 2026-07-17 — Guacamole : ids ["vg-tomate","vg-tomate-cerise"]
  // ne proposait QUE "vg-tomate-cerise" et perdait "vg-tomate-ronde", un autre
  // enfant concret de "vg-tomate" pourtant satisfait via effectiveStock).
  const concreteOptions = (ids) => {
    const opts = ids.flatMap(id => isCategoryParent(id) ? (groupMaps?.groupMap?.[id] ?? [id]) : [id])
    return [...new Set(opts)]
  }

  // ── Calcul nutrition par portion ──────────────────────────
  const recipeNutrition = useMemo(() => {
    let cal = 0, prot = 0, carb = 0, fat = 0, fib = 0
    let hasData = false
    const allergenSet = new Set()
    for (const ing of getIngredientItemsFlat(recipe)) {
      const ingIds = getIngredientIds(ing)
      const id = ingIds.find(id => resolveNutrition(id, ingredientsById)) ?? ingIds[0]
      const nut = resolveNutrition(id, ingredientsById)
      if (!nut) continue
      hasData = true
      const qData = getIngredientQty(ing)
      const grams = qData ? sharedToGrams(qData.amount, qData.unit, id) : 100
      const factor = grams / 100
      cal  += (nut.cal  ?? 0) * factor
      prot += (nut.prot ?? 0) * factor
      carb += (nut.carb ?? 0) * factor
      fat  += (nut.fat  ?? 0) * factor
      fib  += (nut.fib  ?? 0) * factor
      ;(nut.al ?? []).forEach(a => allergenSet.add(a))
    }
    const servings = recipe.servings ?? 1
    return {
      hasData,
      cal:  Math.round(cal  / servings),
      prot: Math.round(prot / servings * 10) / 10,
      carb: Math.round(carb / servings * 10) / 10,
      fat:  Math.round(fat  / servings * 10) / 10,
      fib:  Math.round(fib  / servings * 10) / 10,
      allergens: [...allergenSet].sort(),
      allergenWarnings: [...allergenSet].filter(a => allergenPrefs.includes(a)).sort(),
    }
  }, [recipe, allergenPrefs, ingredientsById])
  // Allergènes affichés sur la fiche : champ `allergens` déclaré (autoritaire,
  // audité) UNIONNÉ avec les allergènes BDD de TOUS les substituts de chaque
  // slot. L'ancienne source (recipeNutrition.allergens) lisait la table
  // NUTRITION statique sur le seul 1er id de chaque slot → sous-déclarait
  // les allergènes des substituts (ex. sauce soja en 2e alternative). Le
  // champ allergens reste la base ; l'union ingrédients garantit zéro oubli.
  const recipeAllergens = useMemo(() => {
    const set = new Set(recipe.allergens ?? [])
    for (const ing of getIngredientItemsFlat(recipe)) {
      for (const id of getIngredientIds(ing)) {
        for (const a of (INGREDIENT_LOOKUP[id]?.allergens ?? [])) set.add(a)
      }
    }
    // Filet de sécurité (chantier recettes de base, 2026-07-14) : voir
    // card-allergens.js#deriveRecipeAllergens — même logique, dupliquée ici
    // car la modale calcule ses allergènes indépendamment de la carte.
    for (const subRecipe of getSubRecipes(recipe)) {
      const baseRecipe = recipesById.get(subRecipe.recipe_id)
      if (!baseRecipe) continue
      for (const ing of getIngredientItemsFlat(baseRecipe)) {
        for (const id of getIngredientIds(ing)) {
          for (const a of (INGREDIENT_LOOKUP[id]?.allergens ?? [])) set.add(a)
        }
      }
    }
    return [...set].sort()
  }, [recipe, INGREDIENT_LOOKUP, recipesById])
  const recipeAllergenWarnings = useMemo(
    () => recipeAllergens.filter(a => allergenPrefs.includes(a)),
    [recipeAllergens, allergenPrefs],
  )
  const required   = getIngredientItemsFlat(recipe).filter(i => isIngredientRequired(i))
  const matchCount = required.filter(i => getIngredientIds(i).some(id => effectiveStock.has(id))).length
  const pct        = Math.round((matchCount / required.length) * 100)
  const theme      = pct === 100 ? COLORS.ready : pct >= 60 ? COLORS.almost : COLORS.low
  const barColor   = pct === 100 ? '#4CAF7D'
    : pct >= 76 ? '#7BB078'
    : pct >= 51 ? '#C4A555'
    : pct >= 26 ? 'var(--color-brand-500)'
    : '#D06060'
  // Jumelle TEXTE : la barre garde le pastel, le libellé prend la version foncée.
  // 🔴 Deux palettes, une par thème — et l'inverse l'une de l'autre. En clair il
  // faut ASSOMBRIR (les pastel plafonnaient à 3,23 sur leur propre fond) ; en
  // sombre les teintes d'origine passent déjà, seule la rouge rate de peu
  // (4,24) et s'éclaircit d'un cheveu. Appliquer la palette claire aux deux
  // dégradait le sombre — mesuré, pas supposé.
  const barTextColor = darkMode
    ? (pct === 100 ? '#4CAF7D'
      : pct >= 76 ? '#7BB078'
        : pct >= 51 ? '#C4A555'
          : pct >= 26 ? 'var(--link-accent)'
            : '#D36A6A')
    : (pct === 100 ? '#2F7A52'
      : pct >= 76 ? '#50724E'
        : pct >= 51 ? '#7B6836'
          : pct >= 26 ? 'var(--link-accent)'
            : '#9C5454')

  // country et diet sont désormais sur la recette directement (chargée depuis BDD).
  // countries / dietTypes / allergenTypes viennent du DataContext (master tables BDD).
  const countryCode = recipe.country
  const countryInfo = countryCode ? countries[countryCode] : null
  // Filtre HIDDEN_DIETS : les régimes désactivés temporairement
  // (halal en attente de certification partenaire) sont retirés des badges
  // affichés. Les données existantes en BDD ne sont PAS supprimées : elles
  // resurgiront dès qu'on retirera la clé de HIDDEN_DIETS.
  const recipeDiets = (recipe.diet ?? []).filter(d => !HIDDEN_DIETS.includes(d))
  // P7 D6.1 : cascade locale → langue → fr → en → id. userLocale=null tant
  // que la préférence "Origine des plats" n'est pas exposée côté profil.
  const recipeName  = recipe.isCustom
    ? pickLocalizedName(recipe.name, null, lang, recipe.id)
    : pickLocalizedName(RECIPE_NAMES[recipe.id], null, lang, recipe.id)
  // Custom recipes : steps = array (1 langue, celle de l'auteur).
  // Base recipes : steps = jsonb {fr: [...], en: [...]}.
  const recipeSteps = recipe.isCustom ? (recipe.steps ?? []) : (recipe.steps?.[lang] ?? [])
  // Descriptif court affiché sous le header de la fiche (cascade langue → fr → en).
  // recipe.description = jsonb {fr,en} (base) ou string (anciennes custom).
  const recipeDescription = (() => {
    const d = recipe.description
    if (!d) return ''
    if (typeof d === 'string') return d
    return d[lang] ?? d.fr ?? d.en ?? ''
  })()
  const [flagHovered, setFlagHovered]       = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [pickerIndex, setPickerIndex]       = useState(null)
  // Index de l'ingrédient absent dont on affiche le popover IA "Substituts"
  // (mutuellement exclusif avec pickerIndex : on ne peut pas avoir à la fois
  // un picker d'alternative en stock et une suggestion IA pour le même item).
  const [substituteIndex, setSubstituteIndex] = useState(null)
  // Index de l'ingrédient qui vient d'être AJOUTÉ au frigo → flash de confirmation
  // (pastille qui « pop » + chip « ✓ frigo » qui s'envole), pour ne plus ajouter à
  // l'aveugle. Se réarme à chaque ajout, s'efface seul après ~0,9 s.
  const [addedFlashIndex, setAddedFlashIndex] = useState(null)
  const addedFlashTimerRef                  = useRef(null)
  const pickerRef                           = useRef(null)
  const [selectedServings, setSelectedServings] = useState(lockedServings ?? recipe.servings ?? 1)
  const baseServings = recipe.servings ?? 1
  const minServings  = baseServings === 1 ? 1 : 2
  const servingsLocked = lockedServings != null
  const scaleFactor  = selectedServings / baseServings
  const recipeCost   = calcRecipeCost(recipe, lang, scaleFactor, ingredientsById)
  // eslint-disable-next-line no-unused-vars -- missingCost calculé pour debug, gardé prêt pour réintégration
  const missingCost  = calcMissingCost(recipe, stock, lang, scaleFactor, ingredientsById)
  // (l'état de l'onglet Coût vit dans useRecipeCost — appelé plus bas, après
  //  `activeTab`, car il a besoin de savoir si l'onglet est actif)
  const isInCart   = basketRecipeIds?.has(recipe.id) ?? false
  const hasMissing = getIngredientItemsFlat(recipe).some(ing => isIngredientRequired(ing) && !getIngredientIds(ing).some(id => effectiveStock.has(id)))
  // eslint-disable-next-line no-unused-vars -- cartToast/cartToastRef gardés pour futur toast inline (cf. cartHeaderNotice qui prend le relais)
  const [cartToast, setCartToast]               = useState(null)
  // eslint-disable-next-line no-unused-vars
  const cartToastRef                            = useRef(null)
  const [cartHeaderNotice, setCartHeaderNotice] = useState(null) // 'added' | 'duplicate' | 'all_in_fridge'
  const cartHeaderNoticeRef                     = useRef(null)
  const allInFridge                             = !hasMissing && !isInCart

  // ── V3 state ────────────────────────────────────────────────────────────────
  const [step, setStep]                 = useState('detail')
  const [selections, setSelections]     = useState({}) // { [ingIndex]: id } — picker selections in detail view
  const [stepTwoState, setStepTwoState] = useState({}) // { [ingIndex]: { resolved: id|'skip'|null, checked: bool, inStockOptions?: id[] } }
  const [withdrawFeedback, setWithdrawFeedback] = useState(null)
  const feedbackTimerRef                = useRef(null)
  const { hasPremiumAccess } = useSubscription()

  // Mode cuisine plein écran
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('steps')

  // Onglet Coût — état persistant (mode + prix live) + auto-refresh à l'ouverture,
  // tenu hors de la vue (montée conditionnellement) pour survivre aux changements
  // d'onglet ; dérivation dans RecipeCostTab (§2, 2026-07-25).
  const cost = useRecipeCost({ active: activeTab === 'cost', recipe, lang })

  // Agrégat des avis (alimente le badge ⭐ dans le header)
  const [reviewsAgg, setReviewsAgg] = useState({ avg: 0, count: 0 })
  const reviewsRef = useRef(null)

  // Header collapsible au scroll (mobile / layout mono-scroll) — #4 backlog UX.
  // Au scroll vers le bas, le header se condense à l'essentiel (titre + temps
  // + niveau + % ingrédients) ; le reste (descriptif, portions, badges
  // type/régime, strip allergènes) se replie et réapparaît de retour en haut.
  // Hystérésis (48/16) pour éviter le clignotement au passage du seuil.
  const [headerCondensed, setHeaderCondensed] = useState(false)
  const scrollRafRef  = useRef(0)
  const handleBodyScroll = (e) => {
    const top = e.currentTarget.scrollTop
    cancelAnimationFrame(scrollRafRef.current)
    scrollRafRef.current = requestAnimationFrame(() => {
      setHeaderCondensed(prev => {
        if (!prev && top > 48) return true
        if (prev && top < 16) return false
        return prev
      })
    })
  }
  useEffect(() => () => cancelAnimationFrame(scrollRafRef.current), [])
  // Réinitialise le header (déplié) au changement de recette ou d'étape :
  // évite d'ouvrir une fiche déjà condensée par le scroll de la précédente.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setHeaderCondensed(false) }, [recipe.id, step])

  useEffect(() => {
    if (!recipe.id || (recipe.isCustom && !recipe._isCommunity)) return
    const source = recipe._isCommunity ? 'community' : 'base'
    listReviews(recipe.id, source).then(reviews => setReviewsAgg(aggregateReviews(reviews)))
    // `isCustom` et `_isCommunity` ne bougent pas a id constant : les recettes de
    // base et communautaires ont des identifiants distincts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe.id])

  // Funnel : ouverture d'une recette (chokepoint unique, tous points d'entrée).
  useEffect(() => {
    if (recipe?.id) track('recipe_opened', { recipeId: recipe.id })
  }, [recipe?.id])

  // Schema.org JSON-LD (PR 8.8.e). Memo pour ne pas re-stringify
  // à chaque render (sinon le useEffect du composant `<RecipeJsonLd>` ré-tape
  // le DOM constamment).
  const schemaData = useMemo(
    () => recipeToSchemaOrg({
      recipe, recipeName, lang, countries, ingredientsById, reviewsAgg,
      authorName: recipe.isCustom ? (recipe.author_username ?? null) : null,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recipe, recipeName, lang, reviewsAgg],
  )

  const hasStockIngredients = getIngredientItemsFlat(recipe).some(ing => isIngredientRequired(ing) && getIngredientIds(ing).some(id => effectiveStock.has(id)))

  useEffect(() => {
    if (pickerIndex === null) return
    const handler = (e) => { if (!pickerRef.current?.contains(e.target)) setPickerIndex(null) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pickerIndex])

  // Focus trap a11y. Remplace l'ancien Escape window-level :
  // le hook gère Escape + boucle Tab + restaure le focus à la fermeture.
  const dialogRef = useRef(null)
  // Sprint 11 S11.c.1 — focus trap désactivé en variant='page' : sinon
  // l'utilisateur ne peut plus tabber vers le Header (logo, menu langue,
  // paramètres). Sur une route directe, c'est une page, pas une modale.
  // L'escape key reste connecté à onClose (= smart back / accueil).
  useFocusTrap(dialogRef, { active: !isPage, onEscape: onClose })

  // a11y (EAA/WCAG) — en variant page, on déplace le focus sur le titre
  // de la recette au montage : le lecteur d'écran annonce la recette et
  // le clavier démarre dans le contenu (pas coincé dans le header). On
  // n'active ça que sur la page (pas la modale, qui a son focus trap).
  const titleRef = useRef(null)
  useEffect(() => {
    if (isPage) titleRef.current?.focus({ preventScroll: true })
  }, [isPage])

  useEffect(() => () => clearTimeout(feedbackTimerRef.current), [])
  useEffect(() => () => clearTimeout(addedFlashTimerRef.current), [])

  // Déclenche le flash « ajouté au frigo » sur la ligne d'ingrédient `index`.
  const flashAdded = (index) => {
    setAddedFlashIndex(index)
    clearTimeout(addedFlashTimerRef.current)
    addedFlashTimerRef.current = setTimeout(() => setAddedFlashIndex(null), 900)
  }

  // (auto-refresh des prix à l'ouverture de l'onglet Coût déplacé dans useRecipeCost)

  // ── Ingredient click handler (detail view) ────────────────────────────────
  // 1 ID                         → toggle direct (ajoute ou retire)
  // multi ID + 1 en stock        → retire directement (raccourci)
  // multi ID + 0 ou >1 en stock  → ouvre le picker (ajouter ou retirer alternative par alternative)
  const handleIngredientClick = (ing, index) => {
    if (!onToggleIngredient) return
    // On raisonne sur les concrets STOCKABLES (parents-catégories exclus/éclatés).
    const opts = concreteOptions(getIngredientIds(ing))
    const inStockIds = opts.filter(id => stock.has(id))

    if (opts.length === 1) {
      if (!stock.has(opts[0])) flashAdded(index)  // feedback seulement si AJOUT
      onToggleIngredient(opts[0])
      setSelections(prev => { const n = { ...prev }; delete n[index]; return n })
      setPickerIndex(null)
      return
    }

    if (inStockIds.length === 1) {
      // inStockIds[0] est en stock → ce clic le RETIRE : pas de flash « ajouté ».
      onToggleIngredient(inStockIds[0])
      setSelections(prev => { const n = { ...prev }; delete n[index]; return n })
      setPickerIndex(null)
      return
    }

    setPickerIndex(prev => prev === index ? null : index)
  }

  // ── Enter withdrawal step ─────────────────────────────────────────────────
  function enterWithdraw() {
    const state = {}
    getIngredientItemsFlat(recipe).forEach((ing, index) => {
      if (!isIngredientRequired(ing)) return
      // Concrets stockables (les parents-catégories sont éclatés en enfants) →
      // le retrait « J'ai cuisiné » agit sur l'ingrédient réellement en stock.
      const inStockIds = concreteOptions(getIngredientIds(ing)).filter(id => stock.has(id))
      if (inStockIds.length === 0) return

      const sel = selections[index]
      if (sel) {
        state[index] = { resolved: sel, checked: true }
      } else if (inStockIds.length === 1) {
        state[index] = { resolved: inStockIds[0], checked: true }
      } else {
        // Multi-stock non résolu : on laisse coché par défaut, l'utilisateur choisira l'alternative
        state[index] = { resolved: null, checked: true, inStockOptions: inStockIds }
      }
    })
    setStepTwoState(state)
    setPickerIndex(null)
    setStep('withdraw')
  }

  // Source de la recette pour le journal de cuisine.
  const recipeSource = recipe.isCustom ? 'custom' : (recipe._isCommunity ? 'community' : 'base')

  // #14a — résout le pays d'une recette base pour la célébration du badge
  // « monde » (custom → null, rattrapé à l'affichage du profil).
  const resolveCookCountry = (recipeId, source) =>
    source === 'custom' ? null : (baseRecipes?.find(r => r.id === recipeId)?.country ?? null)

  // Note la recette au journal de cuisine. La célébration du badge et
  // l'invite à noter ne partent QUE si c'est fait ; sinon on le dit. Rend
  // `true` si le plat est noté. (Jusqu'au 2026-10-05 la suite partait quoi
  // qu'il arrive : `logCooking` ne rendait rien.)
  async function noterAuJournal() {
    const resultat = await logCooking(user.id, { recipeId: recipe.id, recipeSource, servings: Math.round(selectedServings) })
    if (resultat?.error) { signalerEchec('cooking'); return false }
    celebrate(user.id, { resolveCountry: resolveCookCountry, lang })
    promptQuickRate(user.id, { recipeId: recipe.id, recipeSource, lang })
    return true
  }

  // ── Confirm withdrawal ────────────────────────────────────────────────────
  function confirmWithdraw() {
    track('cook_completed', { recipeId: recipe.id })
    const toRemove = Object.values(stepTwoState)
      .filter(s => s.resolved && s.resolved !== 'skip' && s.checked)
      .map(s => s.resolved)
    toRemove.forEach(id => onToggleIngredient(id))
    // Journal de cuisine (connecté seulement)
    if (user?.id) noterAuJournal()
    // Ventilation frigo vs garde-manger pour le feedback
    const fridge = toRemove.filter(id => !isPantryId(id)).length
    const pantry = toRemove.filter(id =>  isPantryId(id)).length
    setStep('detail')
    setWithdrawFeedback(t.feedbackSplit ? t.feedbackSplit(fridge, pantry) : t.feedbackDone(toRemove.length))
    clearTimeout(feedbackTimerRef.current)
    feedbackTimerRef.current = setTimeout(() => setWithdrawFeedback(null), 3500)
  }

  // Marquer la recette comme cuisinée sans rien retirer du stock.
  // Cas d'usage : l'user a cuisiné une recette pour laquelle il n'a aucun
  // ingrédient dans son frigo (ex : ingrédients déjà consommés ailleurs).
  function logCookedWithoutWithdraw() {
    if (!user?.id) return
    track('cook_completed', { recipeId: recipe.id })
    // « Ajoutée à ton journal de cuisine » ne s'affiche qu'une fois que c'est vrai.
    noterAuJournal().then((notee) => {
      if (!notee) return
      setWithdrawFeedback(t.feedbackCookedLogged)
      clearTimeout(feedbackTimerRef.current)
      feedbackTimerRef.current = setTimeout(() => setWithdrawFeedback(null), 3500)
    })
  }

  const canConfirm = Object.values(stepTwoState).every(s => s.resolved !== null)

  const mutedColor  = darkMode ? '#7A90A8' : '#7A5F56'
  const headerBg    = darkMode ? '#0F1923' : theme.bg
  const headerBorder = darkMode ? 'rgba(255,255,255,0.08)' : `${theme.text}18`
  const headerText  = darkMode ? '#FFFFFF' : theme.text

  // Header condensé : actif uniquement en layout mono-scroll (mobile) quand
  // l'utilisateur a scrollé sous le seuil. Repli animé (max-height + opacity).
  const condensed = isMobile && headerCondensed
  const collapseStyle = {
    maxHeight: condensed ? 0 : '260px',
    opacity: condensed ? 0 : 1,
    overflow: 'hidden',
    transition: 'max-height 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.18s ease',
    // Chantier scroll mobile (2026-07-09) : isole le reflow du repli à ce
    // seul bloc (n'affecte pas le reste de l'arbre) et prévient le
    // navigateur de la transition à venir — réduit le coût de la
    // réorganisation qui redimensionne la zone de scroll en plein geste.
    contain: 'layout paint',
    willChange: 'max-height, opacity',
  }

  return {
    activeTab, addedFlashIndex, addedFlashTimerRef, allergenTypes, allInFridge, barColor, barTextColor,
    baseServings, canConfirm, canEditRecipe, cartHeaderNotice, cartHeaderNoticeRef, celebrate, closePeek, collapseStyle, concreteOptions, condensed, confirmWithdraw,
    cost, countries, countryCode, countryInfo, dialogRef, dietTypes, effectiveStock, enterWithdraw,
    feedbackTimerRef, flagHovered, flashAdded, groupMaps, handleBodyScroll, handleIngredientClick,
    hasMissing, hasPremiumAccess, hasStockIngredients, headerBg, headerBorder, headerCondensed,
    headerText, INGREDIENT_LOOKUP, ingredients, ingredientsById, isAdmin, isApprovedCommunity,
    isCategoryParent, isInCart, isMobile, isPage, isPubliclyShareable, logCookedWithoutWithdraw,
    matchCount, minServings, mutedColor, navigate, pct, peekRecipeId, pickerIndex,
    pickerRef, promptQuickRate, recipeAllergens, recipeAllergenWarnings, recipeCost,
    recipeDescription, recipeDiets, recipeName, RECIPE_NAMES, recipeNutrition, recipesById,
    recipeSource, recipeSteps, recipesUsingThis, required, resolveCookCountry, reviewsAgg,
    reviewsRef, scaleFactor, schemaData, scrollRafRef, selectedServings, selections,
    servingsLocked, setActiveTab, setAddedFlashIndex, setCartHeaderNotice, setFlagHovered, setHeaderCondensed, setPeekRecipeId, setPickerIndex, setRecipesUsingThis,
    setReviewsAgg, setSelectedServings, setSelections, setShareOpen, setShowDeleteConfirm, setStep,
    setStepTwoState, setSubstituteIndex, setWithdrawFeedback, shareOpen, shareUrl,
    showDeleteConfirm, step, stepTwoState, substituteIndex, t, theme, titleRef, user, windowWidth,
    withdrawFeedback,
  }
}
