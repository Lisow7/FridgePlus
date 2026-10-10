import { useLayoutEffect } from 'react'

// Contrat de mise en page du bas d'écran (2026-08-28).
//
// 🔴 Pourquoi ça existe : le bandeau cookies est une surface `fixed` opaque
// (237 px en 390×844, 256 px en 360×640) qu'aucune autre surface ne réservait.
// Mesuré en PRODUCTION au `elementFromPoint`, il rendait INCLIQUABLES le
// sélecteur de langue, la bascule de thème, les compartiments bas du frigo et
// le bouton « remonter en haut » des pages SEO — 5 points sur 5 bloqués.
//
// ⛔ Le classement des z-index ne peut PAS corriger cette classe de défaut :
// quel que soit le vainqueur du duel, la surface perdante devient inutilisable.
// Seule la réservation d'espace le règle. La surface publie sa hauteur ici,
// les autres la consomment via `var(--fp-bottom-inset, 0px)`.
//
// Consommateurs (garder cette liste à jour) : la zone de contenu de
// `app-shell`, le menu du header en feuille basse, la carte « Bien démarrer »,
// la fusée du footer, le bouton « remonter en haut », le prompt de mise à jour
// PWA, et les trois piles de toasts.

export const BOTTOM_INSET_VAR = '--fp-bottom-inset'

// Seconde réservation, même doctrine : la hauteur du PIED DE PAGE. Mesuré le
// 2026-09-12 en 360×640 sur l'accueil, la fusée « Bien démarrer » et la carte
// coach se posaient SUR la bande du footer — « © 2026 » était littéralement
// recouvert, et les liens légaux à demi cachés. Deux surfaces `fixed` ne se
// superposent pas : elles se séquencent (leçon du 2026-08-28, bandeau cookies).
export const FOOTER_HEIGHT_VAR = '--fp-footer-height'

/**
 * Publie la hauteur de l'élément référencé dans `--fp-bottom-inset` tant qu'il
 * est affiché, et la libère dès qu'il disparaît. Ne réserve rien quand
 * `active` est faux : aucun décalage pour les visiteurs qui ont déjà décidé.
 */
export function useBottomInsetPublisher(ref, active, variable = BOTTOM_INSET_VAR) {
  useLayoutEffect(() => {
    const racine = document.documentElement
    const liberer = () => racine.style.removeProperty(variable)

    if (!active || !ref?.current) {
      liberer()
      return liberer
    }

    const el = ref.current
    let derniere = null
    const publier = () => {
      const h = Math.round(el.getBoundingClientRect().height)
      // Réécrire la variable invalide le style de tout le document : seulement
      // si la hauteur a changé (audit du 2026-10-04, PERF-13).
      if (h === derniere) return
      derniere = h
      // 0 = surface repliée ou pas encore mesurée : ne rien réserver plutôt
      // que réserver faux.
      if (h > 0) racine.style.setProperty(variable, `${h}px`)
      else liberer()
    }

    // Pas de mesure ici : en plein commit, elle forçait une mise en page
    // complète (PERF-13 : 183 ms mesurés). Le ResizeObserver rappelle dès
    // l'observation, après la mise en page et avant la peinture.

    // La hauteur bouge : chargement des polices, retour à la ligne du texte,
    // rotation de l'écran. On suit plutôt que de mesurer une seule fois.
    let observer = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(publier)
      observer.observe(el)
    } else {
      publier() // vieux navigateur : une mesure au montage, comme avant
    }

    return () => {
      observer?.disconnect()
      liberer()
    }
  }, [ref, active, variable])
}
