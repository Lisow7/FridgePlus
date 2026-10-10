import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

// Au changement de page (audit du 2026-10-04, A11Y-16) : le focus du clavier
// restait sur le lien cliqué — souvent disparu avec l'ancienne page, donc sur
// <body> — et un lecteur d'écran n'entendait rien. Désormais, à chaque
// changement de CHEMIN (une recherche ou une ancre n'en sont pas) :
//   1. on attend que la nouvelle page pose son titre (`useDocumentTitle`, parfois
//      après le chargement de son fichier) : on écoute <title>, avec un repli ;
//   2. ce titre est annoncé dans une région vivante (`aria-live`) ;
//   3. le focus revient au début du contenu (`#contenu-principal`, le <main> du
//      lien d'évitement) quand il est sur <body> (le lien cliqué a disparu avec
//      l'ancienne page) ou hors du contenu (un lien de l'en-tête). Il n'est PAS
//      déplacé quand il est dans une fenêtre (la fiche recette) ou déjà dans le
//      contenu : un champ en `autoFocus`, le menu latéral du profil qui reste
//      d'une sous-page à l'autre — c'est la page qui l'a placé.
//      (Comparer à l'élément « de départ » ne marche pas : quand cet effet
//      s'exécute, React a déjà donné le focus au bouton `autoFocus` de la page.)

const CALME_MS = 150
const REPLI_MS = 800

export default function AnnonceDePage() {
  const { pathname } = useLocation()
  const precedent = useRef(pathname)
  const [annonce, setAnnonce] = useState('')

  useEffect(() => {
    if (precedent.current === pathname) return undefined
    precedent.current = pathname
    setAnnonce('')
    let fait = false
    let minuteur = null

    const conclure = () => {
      if (fait) return
      fait = true
      setAnnonce(document.title)
      const actif = document.activeElement
      const contenu = document.getElementById('contenu-principal')
      const surLeCorps = !actif || actif === document.body
      const placeParLaPage = actif?.closest?.('[role="dialog"], [role="alertdialog"], [aria-modal="true"]') || contenu?.contains(actif)
      if (!surLeCorps && placeParLaPage) return
      contenu?.focus({ preventScroll: true })
    }
    const relancer = (delai) => { clearTimeout(minuteur); minuteur = setTimeout(conclure, delai) }

    const titre = document.querySelector('title')
    const observateur = titre && typeof MutationObserver !== 'undefined'
      ? new MutationObserver(() => relancer(CALME_MS))
      : null
    observateur?.observe(titre, { childList: true, characterData: true, subtree: true })
    relancer(REPLI_MS)
    return () => { observateur?.disconnect(); clearTimeout(minuteur) }
  }, [pathname])

  // `aria-live` sans `role="status"` : c'est l'attribut qui fait l'annonce, et cette région
  // vit dans la coquille de toutes les pages — un rôle « status » de plus troublerait ceux
  // des pages (un compte de résultats, « Pas de réseau »…), que l'on cherche par leur rôle.
  return <p id="annonce-de-page" aria-live="polite" aria-atomic="true" className="sr-only">{annonce}</p>
}
