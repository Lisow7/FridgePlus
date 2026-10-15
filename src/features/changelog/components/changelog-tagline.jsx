import { useState, useEffect, useRef } from 'react'

const TAGLINES = {
  fr: [
    'Ce qu’on a cuisiné pour toi.',
    'Les dernières touches apportées à ton assistant.',
    'Du nouveau dans ton frigo.',
    'Toujours mieux, toujours pour toi.',
    'Tes retours. Nos améliorations.',
  ],
  en: [
    'What we’ve been cooking for you.',
    'The latest touches to your assistant.',
    'Something new in your fridge.',
    'Always better, always for you.',
    'Your feedback. Our improvements.',
  ],
}

export default function ChangelogTagline({ lang = 'fr', darkMode = false }) {
  const getTaglines = () => TAGLINES[lang] ?? TAGLINES.fr

  const [displayText, setDisplayText] = useState(() => getTaglines()[0] ?? '')
  const [isTyping, setIsTyping] = useState(false)
  const tagIdxRef  = useRef(0)
  const animRef    = useRef(null)
  const isAnimRef  = useRef(false)
  const tagsRef    = useRef(getTaglines())

  useEffect(() => {
    const tl = TAGLINES[lang] ?? TAGLINES.fr
    tagsRef.current = tl
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
    const from    = tagsRef.current[tagIdxRef.current]
    const nextIdx = (tagIdxRef.current + 1) % tagsRef.current.length
    eraseChar(from, tagsRef.current[nextIdx], nextIdx, 0)
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

  // ⚠️ Ce texte s'ANIME : il alterne entre `normalColor` et `activeColor`, avec
  // une transition de 0,7 s. axe-core ne capture qu'UN instant — il a mesure
  // `normalColor` et n'a jamais vu `activeColor`. Un contraste correct doit
  // donc tenir aux DEUX bouts.
  //
  // Bonne nouvelle demontrable : il suffit de verifier les deux extremites.
  // L'interpolation RGB fait varier chaque canal de facon monotone, et la
  // luminance relative est croissante en chaque canal ⇒ la luminance
  // intermediaire reste ENTRE celles des deux bouts. Tant que les deux sont du
  // MEME cote du fond, le pire ratio est atteint a une extremite.
  // 🔴 Le corollaire est le vrai piege : si un bout est plus SOMBRE que le fond
  // et l'autre plus CLAIR, la trajectoire traverse la luminance du fond et
  // passe par 1:1 — invisible — alors que les deux bouts sont conformes.
  //
  // Sombre : 0.75 rendait `#8b7e72` = 4,4996:1, sous le seuil de 4 MILLIEMES.
  // 0.76 rend 4,60:1. Les deux bouts sont plus clairs que le fond `#0f1923`
  // (`#FFB370` = 10,08:1), la trajectoire est donc sure.
  // Clair : les DEUX bouts etaient sous le seuil — `normalColor` a 2,81:1 et
  // `activeColor` a 2,69:1. Corriges ensemble, sans quoi la moitie du cycle
  // serait restee illisible : alpha 0.55 -> 0.76 (4,68:1) et
  // `--color-brand-500` -> `--link-accent` (4,66:1).
  // 🔴 `--color-brand-500` est la couleur PRIMAIRE de l'app : elle reste en
  // place partout ailleurs. Elle n'est simplement pas lisible en TEXTE sur le
  // creme — c'est `--link-accent` qui porte ce role (voir `index.css`).
  const normalColor = darkMode ? 'rgba(180,160,140,0.76)' : 'rgba(90,60,30,0.76)'
  const activeColor = darkMode ? '#FFB370' : 'var(--link-accent)'

  return (
    <p
      aria-live="polite"
      aria-atomic="true"
      style={{
        margin: 0,
        fontSize: '14px',
        fontWeight: 500,
        color: isTyping ? activeColor : normalColor,
        minHeight: '22px',
        letterSpacing: '0.01em',
        userSelect: 'none',
        transition: 'color 0.7s ease',
      }}
    >
      {displayText}
    </p>
  )
}
