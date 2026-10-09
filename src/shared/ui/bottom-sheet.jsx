import { useRef } from 'react'
import { LuX } from 'react-icons/lu'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import { Z_INDEX } from '@shared/lib/z-index'

// Feuille basse — la coquille qui manquait (audit 2026-08-28).
//
// 🔴 Pourquoi elle existe : le dépôt compte 41 boîtes de dialogue et 6
// seulement utilisaient `reusable-modal`. Ce n'était pas de la paresse — cette
// coquille-là fige trois tailles CENTRÉES et ne sait pas exprimer une feuille
// ancrée en bas, ce dont la moitié des écrans mobiles a besoin. Chacun a donc
// réécrit la sienne, et les défauts se sont multipliés avec les copies :
//
//   • ni piège de focus, ni gestion du bouton RETOUR d'Android ;
//   • noms accessibles manquants sur les boutons de fermeture ;
//   • ancrage `bottom: 0` sans réserver l'espace du bandeau cookies, qui les
//     recouvre donc entièrement sur mobile (cf. `use-bottom-inset`) ;
//   • z-index au pifomètre, hors de l'échelle centralisée.
//
// Cette coquille règle les quatre d'un coup, pour toute feuille qui l'adopte.
//
// ⛔ Ne pas réécrire une feuille à la main : ajouter ici ce qui manque.

export default function BottomSheet({
  title,
  onClose,
  closeLabel,
  darkMode = false,
  children,
  maxHeightVh = 88,
}) {
  const panneauRef = useRef(null)
  // Les deux vont TOUJOURS ensemble : le piège couvre le clavier, la seconde
  // couvre le geste natif du mobile. Câbler l'un sans l'autre laisse le bouton
  // retour d'Android quitter la page au lieu de fermer la feuille.
  useFocusTrap(panneauRef, { active: true, onEscape: onClose })
  useCloseOnBackButton(true, onClose)

  const fond  = darkMode ? '#0F1923' : '#FDFAF6'
  const texte = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted = darkMode ? '#A0A8B8' : '#7A6A52'

  return (
    <>
      <div
        className="fixed inset-0"
        style={{ zIndex: Z_INDEX.MODAL_BACKDROP, background: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panneauRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed left-0 right-0 rounded-t-[16px] p-5 overflow-y-auto"
        style={{
          // 🔴 `--fp-bottom-inset` réserve la hauteur du bandeau cookies. Sans
          // lui, une feuille ancrée en bas passe DESSOUS et devient
          // inutilisable sur mobile — c'est le défaut qui a frappé la
          // production deux fois en deux jours.
          bottom: 'var(--fp-bottom-inset, 0px)',
          zIndex: Z_INDEX.MODAL,
          maxHeight: `${maxHeightVh}vh`,
          background: fond,
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold" style={{ color: texte }}>{title}</h2>
          <button
            onClick={onClose}
            aria-label={closeLabel}
            className="p-1 rounded-[8px] bg-transparent border-none cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
            style={{ color: muted }}
          >
            <LuX size={18} />
          </button>
        </div>
        {children}
      </div>
    </>
  )
}
