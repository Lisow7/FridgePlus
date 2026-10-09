import { useCallback, useEffect, useRef, useState } from 'react'

// Cycle de chargement d'un écran, sûr par construction (audit 2026-08-28).
//
// 🔴 Ce qu'il corrige : onze écrans d'administration réécrivaient la même
// séquence « allumer le voyant → attendre → l'éteindre », et AUCUN n'avait de
// `finally` (compté : 11 sections, 0 occurrence). Une exception réseau laissait
// donc le voyant allumé indéfiniment, sans message ni moyen de reprendre autre
// qu'un rechargement de page.
//
// ⚠️ La documentation React 19 pose une seconde exigence à tout chargement
// écrit à la main : se protéger des réponses OBSOLÈTES. Ces écrans ont tous des
// filtres — enchaîner deux filtres rapidement laissait la réponse la plus
// ancienne écraser la plus récente. D'où le prédicat `estObsolete()`.
//
// ── Pourquoi ce hook ne possède PAS les données ───────────────────────────
// Un `useAsyncData` classique rend `{ data, loading, error }`. Il ne convenait
// pas ici : les corps de ces écrans posent de DEUX à CINQ états différents
// (posts + signalements, recettes + total + erreur…). Ce hook possède donc le
// cycle, et chaque écran garde ses propres setters. C'est ce qui lui permet de
// couvrir les onze sans les réécrire.
//
// ── Usage ─────────────────────────────────────────────────────────────────
//   const { loading, error, reload } = useReloader(async (estObsolete) => {
//     const [p, r] = await Promise.all([chargerPosts(), chargerSignalements()])
//     if (estObsolete()) return          // une demande plus récente a pris la main
//     setPosts(p); setSignalements(r)
//   }, [statut, recherche])
//
// Le chargement part au montage et à chaque changement de `deps` — inutile
// d'ajouter un `useEffect(() => reload(), [reload])` dans l'écran.

/**
 * @param {(estObsolete: () => boolean) => Promise<void>} tache
 * @param {ReadonlyArray<unknown>} deps  dépendances qui relancent le chargement
 * @returns {{ loading: boolean, error: Error|null, reload: () => Promise<void> }}
 */
export function useReloader(tache, deps = []) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Jeton de version : seule la demande la plus récente a le droit d'écrire.
  // Incrémenté à chaque lancement et au démontage — d'où l'obsolescence
  // automatique de tout ce qui était en vol.
  const versionRef = useRef(0)
  // Miroir de la tache, ecrit pendant le rendu a dessein : `lancer` doit rester
  // stable (deps `[]`) tout en appelant la DERNIERE tache fournie. Le deplacer
  // dans un effet la ferait retarder d'un commit, et le premier `lancer()` —
  // declenche par l'effet juste en dessous — appellerait alors `undefined`.
  const tacheRef = useRef(tache)
  // eslint-disable-next-line react-hooks/refs
  tacheRef.current = tache

  const lancer = useCallback(async () => {
    const version = ++versionRef.current
    const estObsolete = () => versionRef.current !== version
    setLoading(true)
    setError(null)
    try {
      await tacheRef.current(estObsolete)
      if (!estObsolete()) setError(null)
    } catch (err) {
      // Une demande dépassée qui échoue ne doit pas afficher son erreur :
      // l'écran montre déjà le résultat d'une demande plus récente.
      if (!estObsolete()) setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      // 🔴 LE point de ce hook. Sans ce `finally`, une exception laisse le
      // voyant allumé pour toujours.
      if (!estObsolete()) setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Poser l'etat de chargement depuis un effet EST la raison d'etre de ce
    // hook : il synchronise React avec une source externe (reseau, base). La
    // regle vise les etats DERIVES, qui se calculent au rendu — pas ceux-la.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    lancer()
    // Au démontage comme au changement de dépendances, on périme ce qui vole.
    // Lire `versionRef.current` au nettoyage est VOULU : on invalide la version
    // qui vole a cet instant, pas celle capturee au montage — c'est l'inverse
    // du piege que la regle signale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { versionRef.current++ }
    // `deps` est fourni par l'appelant : la regle ne peut pas l'analyser.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { loading, error, reload: lancer }
}
