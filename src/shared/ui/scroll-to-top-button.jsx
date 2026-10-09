import { useEffect, useState } from 'react'
import { LuArrowUp } from 'react-icons/lu'
import { Z_INDEX } from '@shared/lib/z-index'

// Bouton flottant pour remonter en haut de la page (long scrolls
// type Legal/Changelog). Apparaît seulement après 300px de scroll, et
// disparaît à 0 — pas de pollution visuelle quand on est déjà en haut.
//
// Le scroll cible n'est pas `window` (le wrapper top a overflow:hidden +
// height:100dvh) mais l'élément `<main>` qui a `overflow-y-auto` sur les
// pages dédiées. On l'écoute via `document.querySelector('main')`.
//
// A11y :
// - aria-label traduit (lang prop)
// - cliquable au clavier (Enter/Espace)
// - `prefers-reduced-motion` : scroll instantané si activé
//
// 🔴 Le bouton RÉSERVE la zone qu'il occupe (2026-09-11). Il est `fixed`, et
// jusque-là aucune page ne lui gardait de place : sur écran étroit, en fin de
// défilement, il s'asseyait sur le coin de la carte « Prêt à cuisiner ? » de
// /faq et /guide et RECOUVRAIT le texte de la dernière entrée de /changelog —
// sans qu'aucun défilement puisse l'en sortir, puisqu'on est en bas. Même
// classe de défaut que le bandeau cookies du 28/08 (une surface fixe que
// personne ne réserve), même remède : la surface réserve elle-même, ici par
// un espaceur rendu à la fin de la page. Inutile à partir de `lg` : la colonne
// (≤ 860 px) est centrée et la flèche vit dans la marge (1 024 ≥ 860 + 2 × 68).
//
// Le z-index vient de l'échelle centralisée : au-dessus du contenu, SOUS les
// tiroirs, toasts, bannières et modales — un « 45 » en dur le mettait au niveau
// du fond des tiroirs, où l'ordre de rendu décidait du vainqueur.

const BOTTOM_OFFSET = 88
const SIZE = 44
// Hauteur réservée en fin de page : la zone du bouton, du bord bas au haut du bouton.
export const SCROLL_TO_TOP_RESERVED_HEIGHT = BOTTOM_OFFSET + SIZE

const I18N = {
 fr: 'Remonter en haut',
 en: 'Scroll to top',
}

export default function ScrollToTopButton({ lang = 'fr' }) {
 const [visible, setVisible] = useState(false)

 useEffect(() => {
 const main = document.querySelector('main')
 if (!main) return
 const onScroll = () => setVisible(main.scrollTop > 300)
 main.addEventListener('scroll', onScroll, { passive: true })
 onScroll()
 return () => main.removeEventListener('scroll', onScroll)
 }, [])

 const handleClick = () => {
 const main = document.querySelector('main')
 if (!main) return
 const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
 main.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
 }

 const label = I18N[lang] ?? I18N.fr

 return (
 <>
 <div
 aria-hidden="true"
 data-role="reserve-fleche"
 className="lg:hidden"
 style={{ height: `${SCROLL_TO_TOP_RESERVED_HEIGHT}px` }}
 />
 <button
 onClick={handleClick}
 aria-label={label}
 title={label}
 style={{
 position: 'fixed',
 bottom: `calc(${BOTTOM_OFFSET}px + var(--fp-bottom-inset, 0px))`,
 right: '24px',
 width: `${SIZE}px`, height: `${SIZE}px`,
 borderRadius: '14px',
 border: 'none',
 background: 'var(--gradient-warm)',
 color: 'white',
 cursor: 'pointer',
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 boxShadow: '0 6px 20px rgba(212,106,16,0.45)',
 zIndex: Z_INDEX.CONTENT_FRONT,
 opacity: visible ? 1 : 0,
 transform: visible ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.85)',
 pointerEvents: visible ? 'auto' : 'none',
 transition: 'opacity 0.22s ease, transform 0.22s ease, box-shadow 0.18s',
 }}
 onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 28px rgba(212,106,16,0.55)' }}
 onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(212,106,16,0.45)' }}
 >
 <LuArrowUp size={20} aria-hidden="true" />
 </button>
 </>
 )
}
