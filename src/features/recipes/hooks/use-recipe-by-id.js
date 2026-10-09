import { useEffect, useState } from 'react'
import { useBaseRecipes } from '@shared/contexts/data-provider'
import { getOfficialRecipeById, getRecipeById } from '@features/recipes/api/recipes'

// Hook résolveur d'ID recette → recette complète.
//
// Alimente `<RecipePage />` (route /recipe/:id, lien partagé ou venu de
// Google) et le mode cuisine. Sources :
//   1. le catalogue en mémoire (`useBaseRecipes()`), une fois le catalogue
//      ARRIVÉ (`catalogStatus === 'ok'`), et pour une recette COMPLÈTE : le
//      catalogue n'a plus les étapes ni les descriptions (PERF-01) ;
//   2. la recette officielle lue SEULE (`getOfficialRecipeById`, une ligne) ;
//   3. une recette d'utilisateur (`getRecipeById`, table `custom_recipes`).
// Les deux lectures partent ensemble.
//
// 🔴 Audit du 2026-10-04, PERF-02 : avant, la mémoire faisait foi dès le
// démarrage. Or elle ne contient alors que les 100 recettes embarquées sur 515,
// sans étapes ni descriptions : un lien direct vers les 415 autres affichait
// « Recette introuvable » le temps que le catalogue arrive (au repos, puis
// 626 Ko), et pour toujours s'il n'arrivait pas.
//
// Sécurité (defense in depth) :
//   - RLS Supabase enforce côté serveur : un user ne fetch jamais une
//     recette privée qui n'est pas la sienne.
//   - Côté client, status `'not-found'` est rendu identique pour
//     « inexistante » et « privée pas à toi » — évite le leak RGPD
//     (cf. commentaire dans getRecipeById).
//
// API :
//   const { recipe, status, pending } = useRecipeById(id)
//     status  : 'loading' | 'ok' | 'not-found' | 'error'
//     pending : vrai quand la recette montrée est la version EMBARQUÉE (sans
//               étapes ni description) et que sa fiche complète arrive
//
// `not-found` et `error` sont distincts À DESSEIN : le premier dit que la
// recette n'est pas accessible, le second qu'on n'a pas pu le savoir. Annoncer
// « introuvable » sur une panne technique est un diagnostic faux, qui dissuade
// l'utilisateur de réessayer.
// L'état de départ, calculé DÈS le premier rendu depuis la mémoire (audit du
// 2026-10-04, PERF-05) : une recette déjà là s'affiche sans passer par
// « chargement ». Avant, le premier rendu disait toujours « chargement » : sur
// une page pré-rendue, il posait un squelette d'une image entre le HTML servi et
// la fiche. L'état porte son `id` : tant que l'effet n'a pas rattrapé un
// changement de recette, on rend l'état de départ de la nouvelle — jamais la
// précédente, même le temps d'un rendu.
function etatDeDepart(id, enMemoire, catalogStatus) {
  if (!id) return { id, recipe: null, status: 'not-found' }
  if (!enMemoire) return { id, recipe: null, status: 'loading' }
  if (catalogStatus === 'ok' && 'steps' in enMemoire) return { id, recipe: enMemoire, status: 'ok' }
  return { id, recipe: enMemoire, status: 'ok', pending: true }
}

export function useRecipeById(id) {
  const { recipes: baseRecipes, catalogStatus, registerRecipeName } = useBaseRecipes()
  // L'effet dépend de la recette trouvée, pas du tableau : un fournisseur qui
  // rend un tableau neuf à chaque rendu (vu en CI le 2026-10-05 avec un
  // simulacre de test) relançait l'effet à chaque rendu, sans fin.
  const enMemoire = baseRecipes?.find(r => r.id === id) ?? null
  const [state, setState] = useState(() => etatDeDepart(id, enMemoire, catalogStatus))

  useEffect(() => {
    if (!id) { setState({ id, recipe: null, status: 'not-found' }); return }

    const catalogueArrive = catalogStatus === 'ok'

    // Catalogue arrivé et recette complète : la mémoire fait foi.
    if (enMemoire && catalogueArrive && 'steps' in enMemoire) {
      setState((prev) => (prev.id === id && prev.recipe === enMemoire && prev.status === 'ok' && !prev.pending
        ? prev
        : { id, recipe: enMemoire, status: 'ok' }))
      return
    }

    let cancelled = false
    // Recette en mémoire mais sans ses étapes (embarquée, ou venue du
    // catalogue mince) : on la montre TOUT DE SUITE, et sa fiche complète la
    // remplace dès qu'elle arrive. L'attendre, c'était jusqu'à 7 s de
    // squelette sur un réseau qui flanche : supabase-js relance trois fois une
    // lecture en échec (1 s, 2 s, 4 s).
    // Sauf si cette recette est DÉJÀ à l'écran, lue en entier (le catalogue,
    // sans étapes, arrive pendant qu'on la lit) : on ne la remplace ni par sa
    // version mince ni par un squelette, même un instant — la relecture la
    // remplacera quand elle arrivera.
    // (Un état équivalent garde sa référence : pas de rendu pour rien.)
    setState((prev) => {
      if (prev.id === id && prev.status === 'ok' && !prev.pending) return prev
      if (enMemoire) return prev.id === id && prev.pending && prev.recipe === enMemoire ? prev : { id, recipe: enMemoire, status: 'ok', pending: true }
      return prev.id === id && prev.status === 'loading' && !prev.recipe ? prev : { id, recipe: null, status: 'loading' }
    })
    // Appel enveloppé : une fonction absente ou qui lève sur-le-champ devient
    // une lecture refusée, pas un écran blanc.
    const lire = (fn) => Promise.resolve().then(() => fn(id))
    // Catalogue arrivé sans cette recette : elle n'est pas officielle.
    const officielle = catalogueArrive && !enMemoire ? Promise.resolve(null) : lire(getOfficialRecipeById)
    // Une recette en mémoire est officielle : inutile d'interroger custom_recipes.
    const perso = enMemoire ? Promise.resolve(null) : lire(getRecipeById)

    Promise.allSettled([officielle, perso]).then(([o, p]) => {
      if (cancelled) return
      if (o.status === 'fulfilled' && o.value?.recipe) {
        registerRecipeName?.(id, o.value.name)
        setState({ id, recipe: o.value.recipe, status: 'ok' })
        return
      }
      // Lecture en panne, mais la recette est en mémoire : mieux vaut sa
      // version sans étapes qu'un écran d'erreur.
      if (enMemoire) { setState({ id, recipe: enMemoire, status: 'ok' }); return }
      if (p.status === 'fulfilled' && p.value?.status === 'ok') {
        setState({ id, recipe: p.value.recipe, status: 'ok' })
        return
      }
      // ⚠️ Une PANNE n'est pas une ABSENCE : si l'une des deux sources n'a pas
      // pu répondre, on ne sait pas. supabase-js LÈVE sur une requête avortée
      // (mesuré le 2026-08-07) — d'où `allSettled`, et jamais de `loading`
      // éternel sur cette route publique.
      const panne = o.status === 'rejected' || p.status === 'rejected' || p.value?.status === 'error'
      setState({ id, recipe: null, status: panne ? 'error' : 'not-found' })
    })
    return () => { cancelled = true }
  }, [id, enMemoire, catalogStatus, registerRecipeName])

  return state.id === id ? state : etatDeDepart(id, enMemoire, catalogStatus)
}
