import { FORM_I18N } from '@features/recipes/i18n/recipe-form-i18n'
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useSubmitGuard } from '@shared/hooks/use-submit-guard'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import { PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core'
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable'
import { useIngredients, useFridgeLayouts, useCountries, useDietTypes, useAllergenTypes, useIngredientsById } from '@shared/contexts/data-provider'
import { resolveAllergens } from '@shared/lib/ingredients/ingredient-resolver'
import { validateRecipeText } from '@shared/lib/moderation'
import { moderateContent } from '@shared/api/moderation-de-contenu'
import { useAuth } from '@shared/contexts/auth-provider'
import { createRecipeId } from '@features/recipes/lib/custom-recipes'
import { loadDraft, saveDraft, clearDraft } from '@features/recipes/lib/recipe-draft'
import { computeAiModerationStatus } from '@features/recipes/lib/recipe-ai-moderation'
import { buildPublishConsent } from '@features/recipes/lib/recipe-publish-consent'
import { getRecipeIssues } from '@shared/lib/recipes/recipe-completeness'
import { hasIngredientGroups } from '@shared/lib/recipes/recipe-ingredients'
import { toFormState } from '@features/recipes/lib/recipe-form-state'
import { useSimilarRecipes } from '@features/recipes/hooks/use-similar-recipes'
import { buildFlatIngredients, buildGroupedIngredients } from '@features/recipes/lib/recipe-form-ingredient-options'
import { DIET_BREAKING_IDS } from '@shared/static/diet-breaking-ids'

/**
 * État, effets et actions du formulaire de recette.
 *
 * Le JSX du modal est un bloc unique de ~380 lignes qui closure sur cet état :
 * il devait donc sortir en premier. Retourne un objet unique, destructuré par
 * l'appelant — même contrat que `use-support-panel` (#924).
 */
export default function useRecipeFormModal({ initialRecipe, onSave, onClose, lang }) {
  const t = FORM_I18N[lang] ?? FORM_I18N.fr
  const { user } = useAuth()
  const ingredients = useIngredients()
  // master data depuis BDD via Context
  const fridgeLayouts = useFridgeLayouts()
  const countries     = useCountries()
  const dietTypes     = useDietTypes()
  const allergenTypes = useAllergenTypes()
  // ALLERGEN_KEYS dérivés de l'ordre des master types (déjà ordonnés par sort_order)
  // Memoise : ce tableau est une dependance d'effet ET une valeur exportee par le
  // hook. Recree a chaque rendu, il rendait la dependance impossible a declarer
  // honnetement (l'effet aurait tourne a chaque rendu).
  const ALLERGEN_KEYS = useMemo(() => Object.keys(allergenTypes), [allergenTypes])
  // R-02 v0.30 — restauration brouillon au montage (création uniquement).
  // Si en édition, on ignore le draft : l'utilisateur édite une recette
  // existante, son contenu BDD est la source de vérité.
  const restoredDraft = useMemo(
    () => (initialRecipe ? null : loadDraft()),
    [initialRecipe],
  )
  const [form, setForm] = useState(() => restoredDraft?.payload ?? toFormState(initialRecipe))
  const [draftBanner, setDraftBanner] = useState(() => (restoredDraft ? { savedAt: restoredDraft.savedAt } : null))
  const [errors, setErrors] = useState({})
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [showPublishConfirm, setShowPublishConfirm] = useState(false)
  const [publishAcknowledged, setPublishAcknowledged] = useState(false)
  // R-03 — consentement explicite à la publication communautaire (CNIL).
  const [publishConsent, setPublishConsent] = useState(false)
  const [proposePublic, setProposePublic] = useState(
    initialRecipe?.moderation_status === 'pending' || initialRecipe?.moderation_status === 'approved'
  )
  const [consentToPromote, setConsentToPromote] = useState(
    Boolean(initialRecipe?.consent_to_promote ?? false)
  )
  const dirtyRef = useRef(false)
  const emojiRef = useRef(null)
  const scrollRef = useRef(null)
  const [showScrollTop, setShowScrollTop] = useState(false)

  // R-04 v0.31 — statut du dernier appel modération IA OpenAI.
  // 'passed' = OpenAI a dit OK. 'error' = l'API a planté (fail-open silencieux),
  // l'admin queue affichera un badge pour prioriser la review humaine. 'skipped'
  // = recette privée (jamais envoyée à OpenAI). NULL = pré-R-04 (historique).
  // 'flagged' n'est jamais persisté (la soumission est bloquée avant).
  const aiModerationStatusRef = useRef(null)

  const flatIngredients    = useMemo(() => buildFlatIngredients(ingredients, lang), [ingredients, lang])
  const groupedIngredients = useMemo(() => buildGroupedIngredients(ingredients, lang, fridgeLayouts), [ingredients, lang, fridgeLayouts])

  // R-09 — checklist de complétude INDICATIVE (n'empêche pas la soumission).
  // Repliable : fermée par défaut, reconnaissable via son en-tête + compteur.
  const [completenessOpen, setCompletenessOpen] = useState(false)
  const ingredientsById = useIngredientsById()
  const completenessIssues = useMemo(() => {
    const normalized = {
      servings: form.servings,
      time: form.time,
      steps: form.steps.map(s => s.text),
      ingredients: form.ingredients.map(i => ({ ids: i.ingredientId ? [i.ingredientId] : [] })),
    }
    return getRecipeIssues(normalized, (id) => ingredientsById.has(id))
  }, [form.servings, form.time, form.steps, form.ingredients, ingredientsById])

  // R-05 — détection de doublon : actif seulement si l'utilisateur vise la
  // publication (inutile de comparer une recette qui restera privée).
  const similarEnabled = Boolean(user && proposePublic)
  const similarIngredientIds = useMemo(
    () => form.ingredients.map(i => i.ingredientId).filter(Boolean),
    [form.ingredients],
  )
  const { similar: similarRecipes } = useSimilarRecipes(
    form.name, similarIngredientIds, initialRecipe?.id, similarEnabled,
  )

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    if (!showEmojiPicker) return
    const handler = e => { if (!emojiRef.current?.contains(e.target)) setShowEmojiPicker(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showEmojiPicker])

  // R-02 — Autosave brouillon, debounce 500 ms. Création uniquement, jamais
  // en édition. saveDraft() est défensif (skip si form vide, swallow quota).
  //
  // `enregistreeRef` : une fois la recette enregistrée, plus aucun minuteur en
  // attente n'écrit. Sans lui, un minuteur parti entre la purge du brouillon
  // et la fermeture de la fenêtre le RÉÉCRIVAIT — « Brouillon restauré »
  // reproposait une recette déjà enregistrée (vu par la fumée, 2026-10-08).
  const enregistreeRef = useRef(false)
  useEffect(() => {
    if (initialRecipe) return
    const timer = setTimeout(() => { if (!enregistreeRef.current) saveDraft(form) }, 500)
    return () => clearTimeout(timer)
  }, [form, initialRecipe])

  function handleResetDraft() {
    clearDraft()
    setForm(toFormState(null))
    setDraftBanner(null)
    setErrors({})
    dirtyRef.current = false
  }

  // Sync automatique : non-halal entièrement géré par les ingrédients (halal = manuel uniquement)
  // V3.0.4 : on utilise aussi les allergènes détectés via resolveAllergens (BDD)
  // pour ne pas dépendre uniquement de DIET_BREAKING_IDS (incomplet pour certains
  // ingrédients comme le pain de burger qui contient du lait).
  useEffect(() => {
    const selectedIds = form.ingredients.map(i => i.ingredientId).filter(Boolean)
    // Allergènes détectés (union des allergènes BDD des ingrédients sélectionnés)
    const detectedAllergens = new Set()
    for (const id of selectedIds) {
      for (const al of resolveAllergens(id, ingredientsById)) detectedAllergens.add(al)
    }
    setForm(prev => {
      let diet = [...prev.diet]
      let changed = false
      for (const key of ['vegetarian','vegan','gluten-free','dairy-free']) {
        const breaking = DIET_BREAKING_IDS[key]
        // Cassé soit via DIET_BREAKING_IDS, soit via cohérence allergènes
        const brokenByIngredient = breaking ? selectedIds.some(id => breaking.has(id)) : false
        const brokenByAllergen   =
          (key === 'gluten-free' && detectedAllergens.has('gluten')) ||
          (key === 'dairy-free'  && detectedAllergens.has('milk')) ||
          (key === 'vegan'       && (detectedAllergens.has('milk') || detectedAllergens.has('eggs') ||
                                     detectedAllergens.has('fish') || detectedAllergens.has('crustaceans') ||
                                     detectedAllergens.has('molluscs'))) ||
          (key === 'vegetarian'  && (detectedAllergens.has('fish') || detectedAllergens.has('crustaceans') ||
                                     detectedAllergens.has('molluscs')))
        const isBroken = brokenByIngredient || brokenByAllergen
        const isOn = diet.includes(key)
        if (isBroken && isOn) {
          diet = diet.filter(d => d !== key)
          changed = true
        } else if (!isBroken && !isOn) {
          diet = [...diet, key]
          changed = true
        }
      }
      if (!changed) return prev
      dirtyRef.current = true
      return { ...prev, diet }
    })
  }, [form.ingredients, ingredientsById])

  // Sync automatique allergènes : union de tous les al[] des ingrédients sélectionnés
  useEffect(() => {
    const selectedIds = form.ingredients.map(i => i.ingredientId).filter(Boolean)
    const detected = new Set()
    for (const id of selectedIds) {
      for (const al of resolveAllergens(id, ingredientsById)) detected.add(al)
    }
    const next = ALLERGEN_KEYS.filter(k => detected.has(k))
    setForm(prev => {
      const same = prev.allergens.length === next.length && next.every(k => prev.allergens.includes(k))
      if (same) return prev
      dirtyRef.current = true
      return { ...prev, allergens: next }
    })
  }, [form.ingredients, ingredientsById, ALLERGEN_KEYS])

  const countryOptions = Object.entries(countries)
    .map(([code, data]) => ({ value: code, label: data.names?.[lang] ?? data.names?.fr ?? code, flag: data.flag }))
    .sort((a, b) => {
      if (a.value === 'intl') return -1
      if (b.value === 'intl') return 1
      return a.label.localeCompare(b.label, lang)
    })

  const update = (field, value) => {
    dirtyRef.current = true
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => { const n = { ...prev }; delete n[field]; return n })
  }

  const handleClose = useCallback(() => {
    if (dirtyRef.current) setShowCloseConfirm(true)
    else onClose()
  }, [onClose])

  // Focus trap a11y. Remplace l'ancien Escape window-level :
  // gère Tab/Shift+Tab + Escape + restaure le focus à la fermeture.
  const dialogRef = useRef(null)
  useFocusTrap(dialogRef, { active: true, onEscape: handleClose })
  // Une seule entrée d'historique pour tout le cycle de vie de la modale
  // (isOpen reste `true`) ; seul le callback change selon le dialog imbriqué
  // ouvert — le retour ferme d'abord le dialog de confirmation publication,
  // puis celui d'annulation, avant de fermer le formulaire. Même pattern que
  // community-profile-modal.jsx : donner à RecipeFormCancelDialog/
  // RecipeFormPublishDialog leur propre useCloseOnBackButton créerait une
  // 2e entrée/listener qui se rouvrirait en cascade au clic sur leurs
  // propres boutons "Continuer" (history.back() de nettoyage remontant
  // jusqu'au listener englobant, dont le callback rouvrirait le dialog).
  useCloseOnBackButton(true, () => {
    if (showPublishConfirm) {
      setShowPublishConfirm(false); setPublishAcknowledged(false); setPublishConsent(false)
      return
    }
    if (showCloseConfirm) { setShowCloseConfirm(false); return }
    handleClose()
  })

  const addIngredient = () => {
    dirtyRef.current = true
    setForm(prev => ({ ...prev, ingredients: [...prev.ingredients, { _key:`ing-${Date.now()}-${Math.random()}`, ingredientId:'', labels:{}, qty:{ amount:'', unit:'g' }, required:true }] }))
    setErrors(prev => { const n = { ...prev }; delete n.ingredients; return n })
  }

  const updateIngredient = (key, patch) => {
    dirtyRef.current = true
    setForm(prev => ({ ...prev, ingredients: prev.ingredients.map(ing => ing._key === key ? { ...ing, ...patch } : ing) }))
    setErrors(prev => { const n = { ...prev }; delete n.ingredients; return n })
  }

  const deleteIngredient = (key) => {
    dirtyRef.current = true
    setForm(prev => ({ ...prev, ingredients: prev.ingredients.filter(i => i._key !== key) }))
  }

  const addStep = () => {
    dirtyRef.current = true
    setForm(prev => ({ ...prev, steps: [...prev.steps, { id:`s-${Date.now()}-${Math.random()}`, text:'' }] }))
    setErrors(prev => { const n = { ...prev }; delete n.steps; return n })
  }

  const updateStep = (id, text) => {
    dirtyRef.current = true
    setForm(prev => ({ ...prev, steps: prev.steps.map(s => s.id === id ? { ...s, text } : s) }))
    setErrors(prev => { const n = { ...prev }; delete n.steps; return n })
  }

  const deleteStep = (id) => {
    dirtyRef.current = true
    setForm(prev => ({ ...prev, steps: prev.steps.filter(s => s.id !== id) }))
  }

  const handleStepDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    setForm(prev => {
      const oldIdx = prev.steps.findIndex(s => s.id === active.id)
      const newIdx = prev.steps.findIndex(s => s.id === over.id)
      return { ...prev, steps: arrayMove(prev.steps, oldIdx, newIdx) }
    })
  }

  const toggleDiet = _key => {
    // Halal retiré temporairement (HIDDEN_DIETS), donc plus
    // aucun régime n'est en édition manuelle : tous les régimes affichés
    // (vegetarian, vegan, gluten-free, dairy-free) sont automatiques.
    // Cette fonction reste no-op pour préserver la signature des handlers.
    return
  }

  const validate = () => {
    const errs = {}
    if (!form.name.trim())       errs.name       = t.errorNameRequired
    if (!form.emoji)             errs.emoji       = t.errorEmojiRequired
    if (!form.country)           errs.country     = t.errorCountryRequired
    if (!form.time)              errs.time        = t.errorTimeRequired
    if (!form.difficulty)        errs.difficulty  = t.errorDifficultyRequired
    if (!form.type)              errs.type        = t.errorTypeRequired
    if (!form.servings)          errs.servings    = t.errorServingsRequired
    if (initialRecipe && hasIngredientGroups(initialRecipe)) errs.ingredients = t.errorGroupedNotEditable
    else if (form.ingredients.length === 0)              errs.ingredients = t.errorMinIngredient
    else if (form.ingredients.some(i => !i.ingredientId)) errs.ingredients = t.errorIngredientIncomplete
    if (form.steps.length === 0)                    errs.steps = t.errorMinStep
    else if (form.steps.some(s => !s.text.trim()))  errs.steps = t.errorStepEmpty
    const badField = validateRecipeText({ name: form.name, steps: form.steps.map(s => s.text) })
    if (badField) errs[badField] = t.errorProfanity
    return errs
  }

  const buildRecipe = (consentJustGiven = false) => ({
    id: initialRecipe?.id ?? createRecipeId(),
    name: form.name.trim(),
    emoji: form.emoji,
    time: `${form.time} min`,
    difficulty: form.difficulty,
    type: form.type,
    servings: parseInt(form.servings),
    country: form.country,
    diet: form.diet,
    allergens: form.allergens,
    ingredients: form.ingredients.map(ing => ({
      ids: [ing.ingredientId],
      labels: ing.labels,
      required: ing.required,
      qty: { amount: ing.qty.amount, unit: ing.qty.unit },
    })),
    steps: form.steps.map(s => s.text.trim()),
    isCustom: true,
    moderation_status: user && proposePublic ? 'pending' : 'private',
    is_public: false,
    consent_to_promote: user && proposePublic ? consentToPromote : false,
    // R-04 — trace du résultat de la modération IA OpenAI. Embarqué dans le
    // jsonb `data` côté BDD (pas besoin de migration). L'admin queue le lit
    // pour afficher un badge ⚠️ sur les recettes en `error`. cf. audit zone
    // création de recette R-04.
    ai_moderation_status: computeAiModerationStatus(
      Boolean(user && proposePublic),
      aiModerationStatusRef.current,
    ),
    // R-03 — preuve de consentement à la publication communautaire (colonnes
    // dédiées côté repo). Horodatage frais SEULEMENT si consentJustGiven (dialog
    // confirmé) ; sinon préserve l'existant. INVARIANT : la case de consentement
    // du dialog est le seul déclencheur de consentJustGiven=true.
    ...buildPublishConsent(consentJustGiven, initialRecipe),
  })

  // Garde anti-double-soumission. `onSave` peut être asynchrone
  // côté caller (App.jsx → BDD) ; sans guard, un double-clic créait
  // potentiellement 2 recettes / 2 publications en attente de modération.
  const { submitting, guard } = useSubmitGuard()

  // L'enregistrement a été refusé : 'locked' (recette validée par la
  // modération) ou 'failed' (tout le reste : réseau, session expirée…).
  const [saveError, setSaveError] = useState(null)

  // Enregistre, et ne ferme QUE si c'est fait.
  //
  // 🔴 Jusqu'au 2026-10-05 le résultat de `onSave` n'était pas lu : sur un
  // refus de la base le brouillon était purgé et le formulaire fermé — une
  // recette tapée en entier, perdue sans un mot. Sur un refus, maintenant : le
  // formulaire reste ouvert avec tout ce qui est tapé, le brouillon reste sur
  // l'appareil, et une alerte le dit en haut du formulaire.
  async function enregistrer(recipe) {
    setSaveError(null)
    let erreur
    try { erreur = (await onSave(recipe))?.error } catch (err) { erreur = err ?? new Error('unknown') }
    if (erreur) {
      setSaveError(erreur.code === 'approved_recipe_locked' ? 'locked' : 'failed')
      scrollRef.current?.scrollTo?.({ top: 0, behavior: 'smooth' })
      return
    }
    // R-02 — soumission OK → on purge le brouillon, le contenu est désormais
    // persisté en stock (custom_recipes / localStorage). En édition c'est un
    // no-op (le draft n'a pas été touché). `enregistreeRef` D'ABORD : un
    // minuteur d'enregistrement automatique en attente ne réécrira rien.
    enregistreeRef.current = true
    clearDraft()
    onClose()
  }
  // Modération IA OpenAI — appelée uniquement pour les publications publiques
  // (en plus de leo-profanity statique côté sync). Couvre les contournements
  // texte que leo-profanity rate (haine implicite, harcèlement, etc.).
  // Fail-open : si l'API est down, on ne bloque PAS la soumission pour
  // ne pas pénaliser un user légitime à cause d'une panne tierce.
  async function checkOpenAIModeration() {
    try {
      const content = [form.name, ...form.steps.map(s => s.text)].filter(Boolean).join('\n')
      const result = await moderateContent(content, 'recipe')
      if (result?.flagged) {
        // R-04 — 'flagged' n'est jamais persisté (la soumission est bloquée).
        // On nettoie la ref pour ne pas polluer une future re-soumission.
        aiModerationStatusRef.current = null
        setErrors({ name: t.errorModerated })
        scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
        return false
      }
      aiModerationStatusRef.current = 'passed'
    } catch (err) {
      // Fail-open : la soumission continue, mais on trace 'error' pour que
      // l'admin queue puisse prioriser la review humaine (pas de pré-filtre IA).
      console.warn('[moderation] OpenAI check failed, fallback to static check', err)
      aiModerationStatusRef.current = 'error'
    }
    return true
  }

  // eslint-disable-next-line react-hooks/refs
  const handleSubmit = guard(async () => {
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (user && proposePublic) {
      // Modération IA avant ouverture du dialog de confirmation publique
      if (!(await checkOpenAIModeration())) return
      setPublishAcknowledged(false)
      setPublishConsent(false)
      setShowPublishConfirm(true)
      return
    }
    await enregistrer(buildRecipe())
  })

  // Idem handleSubmit : guard pour éviter une double publication
  // si l'user double-clique pendant le round-trip BDD. Même faux positif de
  // `react-hooks/refs` : `guard()` est appelé au rendu, mais son rappel — qui
  // touche `enregistreeRef` par `enregistrer` — ne s'exécute qu'au clic.
  // eslint-disable-next-line react-hooks/refs
  const handleConfirmPublish = guard(async () => {
    setShowPublishConfirm(false)
    // consentJustGiven = true : l'utilisateur vient de cocher la case de
    // consentement et de confirmer → horodatage frais de la preuve (R-03).
    await enregistrer(buildRecipe(true))
  })

  return {
    t, user, ingredients, fridgeLayouts, countries, dietTypes, allergenTypes,
    form, setForm, errors, saveError, draftBanner, setDraftBanner,
    showEmojiPicker, setShowEmojiPicker, showCloseConfirm, setShowCloseConfirm,
    showPublishConfirm, setShowPublishConfirm, publishAcknowledged, setPublishAcknowledged,
    publishConsent, setPublishConsent, proposePublic, setProposePublic,
    consentToPromote, setConsentToPromote, showScrollTop, setShowScrollTop,
    completenessOpen, setCompletenessOpen,
    emojiRef, scrollRef, dialogRef,
    flatIngredients, groupedIngredients, completenessIssues, similarRecipes,
    countryOptions, sensors, submitting, ALLERGEN_KEYS,
    update, handleResetDraft, handleClose,
    addIngredient, updateIngredient, deleteIngredient,
    addStep, updateStep, deleteStep, handleStepDragEnd,
    toggleDiet, handleSubmit, handleConfirmPublish,
  }
}
