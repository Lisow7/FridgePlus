import { useEffect, useState } from 'react'
import { useBaseRecipes } from '@shared/contexts/data-provider'
import { getRecipeById } from '@features/recipes/api/recipes'

// Hook résolveur d'ID recette → recette complète (3 sources).
//
// Sprint 11 S11.c.1 — alimente `<RecipePage />` (route /recipe/:id)
// pour le deep linking. Résout l'ID depuis :
//   1. Base recipes (préfixe `r-`) → mémoire via useBaseRecipes()
//   2. Custom recipes / public recipes communauté (UUID Supabase) →
//      fetch single-row via getRecipeById() — cold-load safe (pas
//      besoin que l'user soit passé par la communauté avant).
//
// Sécurité (defense in depth) :
//   - RLS Supabase enforce côté serveur : un user ne fetch jamais une
//     recette privée qui n'est pas la sienne.
//   - Côté client, status `'not-found'` est rendu identique pour
//     « inexistante » et « privée pas à toi » — évite le leak RGPD
//     (cf. commentaire dans getRecipeById).
//
// API :
//   const { recipe, status } = useRecipeById(id)
//     status : 'loading' | 'ok' | 'not-found' | 'error'
//
// `not-found` et `error` sont distincts À DESSEIN : le premier dit que la
// recette n'est pas accessible, le second qu'on n'a pas pu le savoir. Annoncer
// « introuvable » sur une panne technique est un diagnostic faux, qui dissuade
// l'utilisateur de réessayer.
//
// Pas de cache au-delà du request en cours : si l'user navigue vers
// la même recette plusieurs fois de suite, on refetch (acceptable
// pour S11.c.1 — optimisation deferred via `location.state.recipe`
// en S11.c.2/3/4 quand on viendra du SPA).
export function useRecipeById(id) {
  const { recipes: baseRecipes } = useBaseRecipes()
  const [state, setState] = useState({ recipe: null, status: 'loading' })

  useEffect(() => {
    if (!id) { setState({ recipe: null, status: 'not-found' }); return }

    // Source 1 : base recipes (memory)
    const baseHit = baseRecipes?.find(r => r.id === id)
    if (baseHit) { setState({ recipe: baseHit, status: 'ok' }); return }

    // Source 2 : custom_recipes / public communauté (Supabase, async)
    let cancelled = false
    setState({ recipe: null, status: 'loading' })
    getRecipeById(id)
      .then(({ recipe, status }) => {
        if (cancelled) return
        setState({ recipe, status })
      })
      // ⚠️ Indispensable : `/recipe/:id` est une route PUBLIQUE, atteinte par
      // lien partagé. Sans ce catch, une promesse rejetée laissait `status` à
      // 'loading' pour toujours — écran mort, sans recours autre qu'un
      // rechargement manuel. Mesuré le 2026-08-07 : supabase-js LÈVE sur une
      // requête réseau avortée au lieu de renseigner `error`.
      .catch(() => {
        if (cancelled) return
        setState({ recipe: null, status: 'error' })
      })
    return () => { cancelled = true }
  }, [id, baseRecipes])

  return state
}
