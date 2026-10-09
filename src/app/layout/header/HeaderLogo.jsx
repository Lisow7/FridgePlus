import { useState, useEffect, useRef } from 'react'
import { HOME_LABEL } from './constants'

// Tagline typewriter rotative (même style que la modale Premium).
// Efface lettre par lettre et tape la suivante, toutes les 4 s.
// Visible uniquement en desktop (xl+, ≥1280px).

const TAGLINES = {
 fr: [
 'Cuisine mieux, sans limites.',
 'Ton assistant cuisine personnel.',
 'Planifie tes repas, simplifie tes courses.',
 'La liste de courses qui se fait toute seule.',
 "Plus d'idées, moins de stress en cuisine.",
 'Transforme tes restes en plats savoureux.',
 'Des recettes sur mesure, chaque soir.',
 'Moins de gaspillage, plus de créativité.',
 'La cuisine du quotidien, enfin inspirante.',
 "Ouvre ton frigo. Trouve l'inspiration.",
 ],
 en: [
 'Cook better, without limits.',
 'Your personal kitchen assistant.',
 'Plan your meals, simplify your shopping.',
 'The shopping list that builds itself.',
 'More ideas, less kitchen stress.',
 'Turn your leftovers into delicious dishes.',
 'Tailored recipes, every evening.',
 'Less waste, more creativity.',
 'Everyday cooking, finally inspiring.',
 'Open your fridge. Find your inspiration.',
 ],
}

export default function HeaderLogo({ lang = 'fr', onReset, darkMode = false }) {
 const getTaglines = () => TAGLINES[lang] ?? TAGLINES.fr

 const [displayText, setDisplayText] = useState(() => getTaglines()[0] ?? '')
 const [isTyping, setIsTyping] = useState(false)
 const [hover, setHover] = useState(false)
 const tagIdxRef = useRef(0)
 const animRef = useRef(null)
 const isAnimRef = useRef(false)
 const taglinesRef = useRef(getTaglines())

 // Sync ref + reset cycle quand la langue change
 useEffect(() => {
 const tl = TAGLINES[lang] ?? TAGLINES.fr
 taglinesRef.current = tl
 clearTimeout(animRef.current)
 tagIdxRef.current = 0
 isAnimRef.current = false
 setDisplayText(tl[0] ?? '')
 setIsTyping(false)
 scheduleNext(4000)
 return () => clearTimeout(animRef.current)
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [lang])

 function scheduleNext(delay) {
 clearTimeout(animRef.current)
 animRef.current = setTimeout(startCycle, delay)
 }
 function startCycle() {
 const from = taglinesRef.current[tagIdxRef.current]
 const nextIdx = (tagIdxRef.current + 1) % taglinesRef.current.length
 eraseChar(from, taglinesRef.current[nextIdx], nextIdx, 0)
 }
 function eraseChar(from, to, nextIdx, pos) {
 isAnimRef.current = true
 setIsTyping(false)
 setDisplayText(from.slice(pos))
 if (pos < from.length) {
 animRef.current = setTimeout(() => eraseChar(from, to, nextIdx, pos + 1), 30)
 } else {
 typeChar(to, nextIdx, 0)
 }
 }
 function typeChar(text, nextIdx, pos) {
 setDisplayText(text.slice(0, pos))
 setIsTyping(pos > 0 && pos <= text.length)
 if (pos < text.length) {
 animRef.current = setTimeout(() => typeChar(text, nextIdx, pos + 1), 40)
 } else {
 isAnimRef.current = false
 setIsTyping(false)
 tagIdxRef.current = nextIdx
 scheduleNext(4000)
 }
 }

 // ⚠️ Cette accroche s'ANIME entre `normalColor` et `activeColor` (transition
 // 0,7 s). axe-core ne photographie qu'UN instant : sur l'accueil il a releve
 // `#d37b30` a 2,92:1 — une couleur qui n'existe dans AUCUN etat stable, car
 // les deux bouts valent 3,21:1 et 2,82:1. La mesure tombait ENTRE les deux.
 // 🥇 Verifier les DEUX bouts suffit (la luminance interpolee reste entre
 // celles des extremites), SAUF s'ils encadrent la luminance du fond : la
 // trajectoire traverserait alors un 1:1 invisible. Ici les deux sont plus
 // sombres que le creme, donc le pire cas est bien a une extremite.
 // Clair : alpha 0.60 -> 0.75 (4,68:1) et `--color-brand-500` ->
 // `--link-accent` (4,64:1). Sombre : deja conforme, inchange.
 const normalColor = darkMode ? 'rgba(180,160,140,0.80)' : 'rgba(90,60,30,0.75)'
 const activeColor = darkMode ? '#FFB370' : 'var(--link-accent)'
 const textColor = isTyping ? activeColor : normalColor

 return (
 <div className="flex items-center gap-2 min-w-0">
 {/* Le nom du site pour les lecteurs d'écran — en `<p>` et NON en `<h1>` :
 l'en-tête est monté sur toutes les routes, et un `<h1>` ici donnait un
 second titre de premier niveau à chaque page portant déjà le sien, qui
 nommait le SITE et non la page. Le nom reste annoncé, il cesse d'être un
 titre. Garde-fou : `src/test/unit/a11y-un-seul-h1.test.jsx`. */}
 <p className="sr-only">Fridge+</p>
 <button
 onClick={onReset}
 style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}
 className="flex items-center gap-1 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-warm-400)] focus-visible:ring-offset-2 rounded-md"
 aria-label={HOME_LABEL[lang] ?? HOME_LABEL.fr}
 >
 <span aria-hidden="true" className="text-3xl lg:text-4xl font-bold tracking-tight text-[var(--color-charcoal)]">Fridge</span>
 <span aria-hidden="true" className="text-3xl lg:text-4xl font-bold" style={{ color: 'var(--color-brand-500)' }}>+</span>
 </button>

 <div className="hidden sm:flex items-center gap-2 min-w-0" aria-hidden="true">
 <span style={{ color: 'var(--color-warm-500)', fontWeight: 600, fontSize: '14px', flexShrink: 0, opacity: 0.5 }}>—</span>
 <p
 onMouseEnter={() => {
 setHover(true)
 if (!isAnimRef.current) {
 clearTimeout(animRef.current)
 startCycle()
 }
 }}
 onMouseLeave={() => setHover(false)}
 style={{
 margin: 0,
 fontSize: 'clamp(15px, 1.3vw, 18px)',
 fontWeight: hover ? 700 : 500,
 color: textColor,
 minHeight: '22px',
 cursor: 'default',
 textDecorationLine: hover ? 'underline' : 'none',
 textDecorationColor: darkMode ? 'rgba(255,179,112,0.50)' : 'rgba(224,120,32,0.40)',
 textUnderlineOffset: '3px',
 transition: 'color 0.7s ease, font-weight 0.15s ease',
 userSelect: 'none',
 letterSpacing: '0.01em',
 whiteSpace: 'nowrap',
 overflow: 'hidden',
 textOverflow: 'ellipsis',
 }}
 >
 {displayText}
 </p>
 </div>
 </div>
 )
}
