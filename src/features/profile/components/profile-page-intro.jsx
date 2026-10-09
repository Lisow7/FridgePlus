import { useEffect, useRef } from 'react'

// ProfilePageIntro — en-tête de sous-page Profile.
// Sprint 11 — pattern UI commun de la refonte UX (cf. spec §3.1).
//
// Rend le h1 et le paragraphe d'intro de l'onglet. Focus auto sur le h1
// au mount (a11y) — annonce le changement de contexte aux lecteurs
// d'écran. Le h1 est focusable via tabIndex=-1 (programmatique only).

export default function ProfilePageIntro({ title, description, darkMode = false }) {
  const h1Ref = useRef(null)
  const textColor  = darkMode ? '#EBE4D8' : '#2d1b00'
  const mutedColor = darkMode ? '#7A90A8' : '#6A4F45'

  useEffect(() => {
    h1Ref.current?.focus?.()
  }, [title])

  return (
    <header style={{ marginBottom: '24px' }}>
      <h1
        ref={h1Ref}
        data-profile-h1
        tabIndex={-1}
        style={{
          fontSize: '22px',
          fontWeight: 800,
          color: textColor,
          marginBottom: '8px',
          outline: 'none',
        }}
      >
        {title}
      </h1>
      <p style={{
        margin: 0,
        fontSize: '14px',
        color: mutedColor,
        lineHeight: 1.55,
      }}>
        {description}
      </p>
    </header>
  )
}
