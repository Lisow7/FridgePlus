import { useEffect, useRef } from 'react'

// Fait en sorte que le bouton/geste "retour" du téléphone (Android surtout,
// où c'est un geste système et non une navigation de page) ferme la modale
// ouverte au lieu de traverser dessous — sans ça, l'utilisateur revient sur
// la page précédente pendant que la modale reste affichée par-dessus (le
// fond change, pas la modale). Pousse une entrée d'historique factice à
// l'ouverture ; le "retour" la dépile (popstate) et ferme la modale au lieu
// de changer de page. Consomme proprement cette entrée à la fermeture par un
// autre biais (X, backdrop, Escape) pour ne jamais laisser de retour
// "fantôme" qui ne ferait plus rien.
//
// Composable avec des modales imbriquées : chaque instance pousse/dépile sa
// propre entrée, donc le retour ferme la modale du dessus en premier.
//
// Jeton unique par instance (pas un simple booléen) : un compteur global
// donne à chaque push une identité propre, vérifiée à la fermeture via
// `window.history.state?.fpModalBack === token` plutôt que `=== true`.
// Nécessaire pour le cas "une modale en remplace une autre dans le même
// rendu" — trouvé en usage réel (2026-07-11) sur l'enchaînement d'alors
// (help-guide fermait sa modale ET ouvrait TourWizard ; depuis, le bouton
// « Visite guidée » navigue vers `/guide`). Le cas reste vivant partout où
// deux modales se succèdent d'un seul clic. Avec un booléen
// partagé, le cleanup de la modale qui se ferme voit l'entrée fraîchement
// poussée par la modale qui s'ouvre, la confond avec la sienne, et la dépile
// par erreur — fermant la modale qui vient tout juste de s'ouvrir.
let nextToken = 0

// Robuste à React StrictMode (dev) : StrictMode double-invoque les effets
// (mount -> cleanup -> remount, tout synchrone) pour détecter les effets non
// idempotents. `history.back()` est asynchrone (même en vrai navigateur) :
// appelé naïvement dans le cleanup du "faux" démontage, son popstate arrive
// APRÈS le remount et se ferait intercepter par le nouveau listener, fermant
// la modale immédiatement après son ouverture. `activeRef` (persiste entre
// les deux passes, même instance de ref) + un setTimeout(0) dans le cleanup
// permettent de vérifier, une fois le tick synchrone terminé, qu'aucun
// remount n'a entre-temps repris la main avant de dépiler pour de vrai.
export function useCloseOnBackButton(isOpen, onClose) {
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  const activeRef = useRef(false)
  const tokenRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return

    const token = ++nextToken
    tokenRef.current = token
    window.history.pushState({ fpModalBack: token }, '')
    activeRef.current = true

    const onPopState = () => {
      // On atterrit sur NOTRE propre entrée : ce n'est pas un « retour » qui
      // nous vise, c'est une modale du dessus qui vient de dépiler la sienne
      // (fermée par X, Échap, backdrop…). Rester ouvert. Sans cette garde,
      // Échap dans le tiroir des filtres fermait aussi le panneau Recettes
      // (audit 2026-10-02) ; un vrai « retour » quitte d'abord notre entrée.
      if (window.history.state?.fpModalBack === token) return
      activeRef.current = false
      onCloseRef.current?.()
    }
    window.addEventListener('popstate', onPopState)

    return () => {
      window.removeEventListener('popstate', onPopState)
      activeRef.current = false
      setTimeout(() => {
        // Si un remount a eu lieu dans le même tick (StrictMode dev),
        // activeRef.current est de nouveau true : l'entrée poussée sert
        // toujours, ne pas la dépiler. Et ne dépiler QUE si l'entrée
        // courante est encore la nôtre (par identité de jeton) — sinon une
        // autre modale a entre-temps poussé la sienne par-dessus.
        if (!activeRef.current && window.history.state?.fpModalBack === token) {
          window.history.back()
        }
      }, 0)
    }
  }, [isOpen])
}
