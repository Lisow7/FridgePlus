import { useState, useRef, useLayoutEffect, useEffect } from 'react'
import { LuHeart } from 'react-icons/lu'
import Button from '@shared/ui/button'
import { pickReactionPickerSide } from '@features/community/lib/emoji-picker-direction'
import { getC, CD, CL } from './community-theme'

// Barre de réaction émoji d'un post/reply — extraite de community-page.jsx
// (2026-07-25, audit front §2). Feuille avec état local (picker ouvert + côté
// d'ouverture) ; ne rend aucun autre composant communauté.
const EMOJIS = ['❤️', '😋', '🔥', '😮', '👏']

const I18N = {
  fr: { removeReaction: 'Retirer ma réaction', react: 'Réagir' },
  en: { removeReaction: 'Remove my reaction', react: 'React' },
}

export function EmojiReactionBar({ myReaction, totalCount, canReact, disabledReason = null, onReact, darkMode, size = 'sm', lang = 'fr' }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSide, setPickerSide] = useState('right')
  const wrapRef = useRef(null)
  const C = getC(darkMode)
  const isLg = size === 'lg'
  const pad = isLg ? '6px 12px' : '4px 8px'
  const fs  = isLg ? '15px' : '14px'
  const iconSz = isLg ? 16 : 14
  // v3.417 — aria-label / tooltip explicites pour le toggle direct.
  // v3.418 — quand désactivé, explique pourquoi (muté / charte non signée)
  // au lieu de rester muet, même pattern que le tooltip du bouton Composer.
  const t = I18N[lang] ?? I18N.fr
  const triggerLabel = !canReact && disabledReason
    ? disabledReason
    : myReaction
      ? t.removeReaction
      : t.react

  // Choix du côté d'ouverture — cf. spec pickReactionPickerSide : à droite
  // par défaut (n'a jamais recouvert le texte du post), fallback au-dessus
  // (comportement historique) seulement si la place à droite manque
  // (mobile étroit, bouton proche du bord). Mesuré à l'ouverture pour éviter
  // un flash au mauvais endroit.
  useLayoutEffect(() => {
    if (!pickerOpen || !wrapRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    const spaceRight = window.innerWidth - rect.right
    setPickerSide(pickReactionPickerSide(spaceRight))
  }, [pickerOpen])

  // Click outside ferme le picker (mobile + desktop sans hover).
  useEffect(() => {
    if (!pickerOpen) return
    const onDocPointer = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setPickerOpen(false)
    }
    document.addEventListener('mousedown', onDocPointer)
    document.addEventListener('touchstart', onDocPointer)
    return () => {
      document.removeEventListener('mousedown', onDocPointer)
      document.removeEventListener('touchstart', onDocPointer)
    }
  }, [pickerOpen])

  return (
    <div
      ref={wrapRef}
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => { if (canReact) setPickerOpen(true) }}
      onMouseLeave={() => setPickerOpen(false)}
    >
      <Button variant="ghost"
        onClick={e => {
          e.stopPropagation()
          if (!canReact) return
          // v3.417 PR-C — Re-clic sur le trigger quand on a déjà une réaction
          // = toggle off direct (handleReact retire si current === emoji).
          // Évite le 2-clics « ouvrir picker → re-cliquer même emoji ».
          // Pour changer d'emoji : hover ouvre toujours le picker (desktop)
          // ou bien retirer puis re-cliquer pour le réouvrir (mobile).
          if (myReaction) { onReact(myReaction); setPickerOpen(false); return }
          setPickerOpen(v => !v)
        }}
        disabled={!canReact}
        aria-pressed={!!myReaction}
        aria-label={triggerLabel}
        title={triggerLabel}
        className="h-auto rounded-md border font-semibold disabled:opacity-50 hover:bg-transparent"
        style={{
          gap: '5px',
          padding: pad,
          background: myReaction ? C.magentaDim : 'transparent',
          borderColor: myReaction ? C.magenta : 'transparent',
          color: myReaction ? C.magenta : C.mid,
          fontSize: fs,
          transition: 'all .15s',
        }}
      >
        {myReaction
          ? <span style={{ fontSize: isLg ? '16px' : '14px', lineHeight: 1 }}>{myReaction}</span>
          : <LuHeart size={iconSz} fill="none" strokeWidth={2.5} />
        }
        {totalCount > 0 && <span>{totalCount}</span>}
      </Button>

      {pickerOpen && canReact && (
        // Ouverture à droite par défaut (pickerSide==='right') : sur la même
        // ligne que le bouton, dans l'espace déjà vide entre le compteur de
        // réponses et les boutons de droite — ne recouvre jamais le texte du
        // post au-dessus (audit UX 2026-07-17, chevauchement confirmé en
        // conditions réelles sur les posts courts). paddingLeft = pont
        // invisible identique au rôle de l'ancien paddingBottom (garde le
        // picker "collé" au bouton pour éviter que onMouseLeave ferme le
        // picker quand le curseur traverse le gap).
        //
        // Fallback au-dessus (pickerSide==='above', comportement historique)
        // seulement si la mesure au moment de l'ouverture montre trop peu de
        // place à droite (mobile étroit, bouton proche du bord). left:0 (au
        // lieu de centré) : le ❤ étant toujours à gauche de la barre
        // d'action, centrer le picker le faisait dépasser le viewport à
        // gauche en DetailView — aligné à gauche, il reste dans la fenêtre.
        <div
          onClick={e => e.stopPropagation()}
          style={pickerSide === 'right'
            ? { position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)', paddingLeft: '6px', zIndex: 20 }
            : { position: 'absolute', bottom: '100%', left: 0, paddingBottom: '6px', zIndex: 20 }
          }
        >
          <div style={{
            background: darkMode ? CD.surface : CL.surface,
            border: `1px solid ${darkMode ? CD.border : CL.border}`,
            borderRadius: '14px', padding: '6px 8px',
            display: 'flex', gap: '2px',
            boxShadow: '0 8px 28px rgba(0,0,0,0.28)',
            whiteSpace: 'nowrap',
            animation: 'cp-fade-up 0.15s ease both',
          }}>
            {EMOJIS.map(emoji => (
              <Button
                key={emoji}
                variant="ghost"
                onClick={(e) => { e.stopPropagation(); onReact(emoji); setPickerOpen(false) }}
                aria-pressed={emoji === myReaction}
                title={emoji}
                className="h-auto rounded-lg border-[1.5px] px-1.5 py-1 text-xl leading-none hover:bg-transparent"
                style={{
                  background: emoji === myReaction ? C.magentaDim : 'transparent',
                  borderColor: emoji === myReaction ? C.magenta : 'transparent',
                  transition: 'transform .12s, background .12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.28)'; e.currentTarget.style.background = C.orangeDim }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = emoji === myReaction ? C.magentaDim : 'transparent' }}
              >
                {emoji}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
