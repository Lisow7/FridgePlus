import { useState, useRef, useId } from 'react'
import { LuDownload } from 'react-icons/lu'
import Button from '@shared/ui/button'
import { usePwaInstallable } from '../lib/use-pwa-installable'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'

// Bouton « Installer l'app » qui apparaît dans le footer quand le navigateur
// signale que l'app est installable (event `beforeinstallprompt` Chromium /
// Edge / Samsung). Sur iOS Safari, on n'a pas l'event — un message s'affiche
// pour expliquer la procédure manuelle (Partager → Sur l'écran d'accueil).

const I18N = {
  fr: {
    install:    'Installer l\'app',
    iosTitle:   'Installer Fridge+ sur iPhone',
    iosStep1:   'Touche le bouton Partager (carré avec flèche).',
    iosStep2:   'Choisis « Sur l\'écran d\'accueil ».',
    iosStep3:   'Touche « Ajouter ».',
    iosClose:   'Fermer',
  },
  en: {
    install:    'Install app',
    iosTitle:   'Install Fridge+ on iPhone',
    iosStep1:   'Tap the Share button (square with arrow).',
    iosStep2:   'Choose “Add to Home Screen”.',
    iosStep3:   'Tap “Add”.',
    iosClose:   'Close',
  },
}

// bg-[#B85000] (pas le dégradé partagé `variant="primary"` du design
// system) : le blanc sur ce dégradé tombe à ~2:1 côté clair et ~3.6:1
// côté foncé, sous le seuil WCAG AA 4.5:1 pour du texte normal — retour
// utilisateur 2026-07-11 (illisible). #B85000 est le token
// `--color-warm-600` déjà documenté "AA-compliant" dans button.jsx ;
// blanc dessus ≈ 5:1. `bg-none` annule l'image de dégradé du variant
// (background-image et background-color se superposent sinon, le
// dégradé resterait visible par-dessus la couleur pleine).
export default function InstallButton({ lang = 'fr', darkMode = false }) {
  const t = I18N[lang] ?? I18N.fr
  const [showIosHelp, setShowIosHelp] = useState(false)
  // Overlay plein écran = dialogue : rôle + piège de focus + Escape
  // (audit clavier 2026-08-25 — il ne se fermait qu au clic).
  const iosHelpRef = useRef(null)
  // Le nom du dialogue est son titre (A11Y-08 : il n'en avait pas).
  const iosTitreId = useId()
  useFocusTrap(iosHelpRef, { active: showIosHelp, onEscape: () => setShowIosHelp(false) })
  // 🔴 Le piège de focus seul ne suffisait pas (audit 2026-08-28) : sur Android,
  // le bouton RETOUR du système quittait la page au lieu de fermer ce dialogue.
  // C'était la seule vraie boîte de dialogue du dépôt à câbler l'un sans l'autre.
  // ⛔ Les deux vont toujours ensemble : `useFocusTrap` couvre le clavier,
  // `useCloseOnBackButton` couvre le geste natif du mobile.
  useCloseOnBackButton(showIosHelp, () => setShowIosHelp(false))
  const { installed, ios, deferredPrompt, setDeferredPrompt, setInstalled } = usePwaInstallable()

  // Déjà installée → ne rien afficher
  if (installed) return null

  // iOS : pas d'event → bouton pour ouvrir le mini-guide
  if (ios) {
    return (
      <>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowIosHelp(true)}
          className="h-auto gap-1.5 rounded-lg bg-none bg-[#B85000] px-3 py-1.5 text-xs"
        >
          <LuDownload size={14} />
          {t.install}
        </Button>
        {showIosHelp && (
          <div
            ref={iosHelpRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={iosTitreId}
            onClick={() => setShowIosHelp(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
              zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 16,
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: darkMode ? '#1A2F48' : '#FFFFFF',
                color: darkMode ? 'var(--color-bg-warm)' : '#2C1A0E',
                padding: '20px 22px', borderRadius: 14, maxWidth: 400, width: '100%',
                fontSize: 14, lineHeight: 1.5,
              }}
            >
              <h3 id={iosTitreId} style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{t.iosTitle}</h3>
              <ol style={{ paddingLeft: 20, marginBottom: 14 }}>
                <li style={{ marginBottom: 6 }}>{t.iosStep1}</li>
                <li style={{ marginBottom: 6 }}>{t.iosStep2}</li>
                <li>{t.iosStep3}</li>
              </ol>
              <Button
                onClick={() => setShowIosHelp(false)}
                className="h-auto rounded-lg bg-[#B85000] px-4 py-2 text-[13px] font-bold text-white"
              >
                {t.iosClose}
              </Button>
            </div>
          </div>
        )}
      </>
    )
  }

  // Chromium / Edge : pas de prompt en attente → ne rien afficher
  if (!deferredPrompt) return null

  async function handleInstall() {
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setInstalled(true)
    }
    setDeferredPrompt(null)
  }

  return (
    <Button
      variant="primary"
      size="sm"
      onClick={handleInstall}
      className="h-auto gap-1.5 rounded-lg bg-none bg-[#B85000] px-3 py-1.5 text-xs"
    >
      <LuDownload size={14} />
      {t.install}
    </Button>
  )
}
