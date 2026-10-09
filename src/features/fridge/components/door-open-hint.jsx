import { LuHand } from 'react-icons/lu'

const I18N = {
  fr: 'Touche pour ouvrir',
  en: 'Tap to open',
}

// P2 (audit d'intuitivité du 2026-10-02) : la porte fermée était un panneau
// muet — rien n'invitait à la toucher, même après 8 s. Tant que le frigo est
// vide (nouveau venu), la porte le dit ; une fois rempli, elle se tait.
// Décoratif pour les lecteurs d'écran : la porte porte déjà son nom
// (« Ouvrir le frigo »), le répéter ici le ferait lire deux fois.
export default function DoorOpenHint({ lang = 'fr', darkMode = false, show = true }) {
  if (!show) return null
  return (
    <div
      aria-hidden="true"
      className="absolute left-0 right-0 flex flex-col items-center gap-1.5 select-none pointer-events-none"
      // Tiers haut, sous le logo : centrée, elle tombait sous la carte d'accueil sur mobile
      style={{ top: '26%', color: darkMode ? '#C9B79C' : '#8A5A18' }}
    >
      <LuHand size={22} style={{ opacity: 0.8 }} />
      <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.01em' }}>{I18N[lang] ?? I18N.fr}</span>
    </div>
  )
}
