import { useEffect, useState } from 'react'
import { LuRefreshCw, LuX } from 'react-icons/lu'
import Button from '@shared/ui/button'
import { Z_INDEX } from '@shared/lib/z-index'
import { creerRetourDOnglet } from '../lib/au-retour-d-onglet'

// Bandeau qui s'affiche quand vite-plugin-pwa détecte un service worker
// avec une nouvelle version en attente. L'utilisateur clique pour
// recharger la page et activer la nouvelle version.
//
// L'API `useRegisterSW` (depuis virtual:pwa-register/react) gère le cycle
// de vie du SW : registerSW(), needRefresh, offlineReady, updateServiceWorker.
//
// Stratégie « prompt » : on attend l'OK user (au lieu d'un reload silencieux)
// pour ne pas perdre de saisies en cours dans un formulaire.

const I18N = {
  fr: {
    title:   'Nouvelle version disponible',
    message: 'Recharger pour profiter des dernières améliorations.',
    reload:  'Recharger',
    later:   'Plus tard',
    offlineReady: 'Fridge+ est prêt à fonctionner hors-ligne.',
  },
  en: {
    title:   'New version available',
    message: 'Reload to get the latest improvements.',
    reload:  'Reload',
    later:   'Later',
    offlineReady: 'Fridge+ is ready to work offline.',
  },
}

// Vérification active toutes les 60 min (pattern officiel vite-plugin-pwa
// pour les SPA : sans ça, une nouvelle version du service worker n'est
// jamais détectée dans un onglet resté ouvert — aucune navigation ne
// redéclenche le check natif du navigateur). Le retour de focus sur
// l'onglet (visibilitychange) rattrape plus vite un cas fréquent : un
// onglet resté longtemps en arrière-plan.
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000
const VISIBILITY_CHECK_THROTTLE_MS = 60 * 1000

export default function UpdatePrompt({ lang = 'fr', darkMode = false }) {
  const t = I18N[lang] ?? I18N.fr
  const [needRefresh,    setNeedRefresh]    = useState(false)
  const [offlineReady,   setOfflineReady]   = useState(false)
  const [updateSW,       setUpdateSW]       = useState(() => () => Promise.resolve())

  useEffect(() => {
    // Import dynamique de l'API du plugin (le module virtuel n'existe qu'au
    // build, on l'importe à l'exécution pour ne pas casser le dev/test).
    let cancelled = false
    let intervalId = null
    let onVisibilityChange = null
    ;(async () => {
      try {
        const mod = await import(/* @vite-ignore */ 'virtual:pwa-register/react')
        if (cancelled) return
        // eslint-disable-next-line no-unused-vars -- module check (registerSW non-hook utilisé en dessous)
        const { useRegisterSW } = mod
        // useRegisterSW est un hook : on ne peut pas l'appeler ici. À la
        // place on appelle l'API non-hook : registerSW(opts) qui retourne
        // une fonction updateSW.
        const { registerSW } = await import(/* @vite-ignore */ 'virtual:pwa-register')
        const update = registerSW({
          onNeedRefresh()  { setNeedRefresh(true) },
          onOfflineReady() { setOfflineReady(true) },
          onRegisteredSW(swUrl, registration) {
            if (cancelled || !registration) return

            async function checkForUpdate() {
              if (registration.installing) return
              if (typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine) return
              try {
                const resp = await fetch(swUrl, {
                  cache: 'no-store',
                  headers: { cache: 'no-store', 'cache-control': 'no-cache' },
                })
                if (resp?.status === 200) await registration.update()
              } catch {
                // Réseau indisponible : on retentera au prochain check
                // périodique ou au prochain retour de focus.
              }
            }

            intervalId = setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS)

            onVisibilityChange = creerRetourDOnglet({
              registration,
              verifier: checkForUpdate,
              onVersionEnAttente: () => setNeedRefresh(true),
              document,
              delaiMs: VISIBILITY_CHECK_THROTTLE_MS,
            })
            document.addEventListener('visibilitychange', onVisibilityChange)
          },
        })
        if (cancelled) return
        setUpdateSW(() => update)
      } catch {
        // Module virtuel absent en dev (devOptions.enabled: false) — silent
        if (import.meta.env.DEV) console.info('[PWA] dev mode, SW disabled')
      }
    })()
    return () => {
      cancelled = true
      if (intervalId) clearInterval(intervalId)
      if (onVisibilityChange) document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  if (!needRefresh && !offlineReady) return null

  const bg = darkMode ? '#1A2F48' : '#FFFFFF'
  const fg = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const border = darkMode ? 'var(--color-dark-border)' : 'var(--color-border-warm)'

  return (
    <div style={{
      position: 'fixed', bottom: 'calc(16px + var(--fp-bottom-inset, 0px))', right: 16,
      // 🔴 z-index 9999 en dur AVANT le 2026-08-28 : ce message informatif se
      // peignait PAR-DESSUS la feuille du menu (z 1200) et couvrait la bascule
      // de thème. Un avis passif ne doit jamais recouvrir une surface avec
      // laquelle l'utilisateur est en train d'interagir — d'où le retour sur
      // l'échelle, sous les feuilles et les modales.
      zIndex: Z_INDEX.BANNER,
      maxWidth: 360, padding: '14px 16px',
      background: bg, color: fg,
      border: `1px solid ${border}`, borderRadius: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
      display: 'flex', flexDirection: 'column', gap: 10,
      animation: 'pwa-slide-up 0.25s ease-out',
    }}>
      <style>{`@keyframes pwa-slide-up { from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }`}</style>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
            {needRefresh ? t.title : '✓ Fridge+'}
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.4, opacity: 0.85 }}>
            {needRefresh ? t.message : t.offlineReady}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => { setNeedRefresh(false); setOfflineReady(false) }}
          aria-label={t.later}
          className="h-auto w-auto p-0.5 hover:bg-transparent"
          style={{ color: fg, opacity: 0.6, flexShrink: 0 }}
        >
          <LuX size={16} />
        </Button>
      </div>
      {needRefresh && (
        <Button
          onClick={() => {
            void updateSW(true)
            // Filet de sécurité : workbox-window (utilisé en interne par
            // vite-plugin-pwa) ne recharge la page que si son event
            // `controlling` arrive avec `isUpdate: true` — un flag qu'il
            // dérive de son propre état interne, qui peut rester à `false`
            // dans une fenêtre d'app installée (desktop) restée ouverte
            // longtemps. Résultat vu en usage réel (2026-07-11) : le
            // signal skip-waiting part, la nouvelle version s'active, mais
            // rien ne recharge — aucune erreur console pour le signaler.
            // On force nous-mêmes le rechargement si la librairie ne l'a
            // pas déjà fait (si elle l'a fait, la page a navigué et ce
            // timer ne s'exécute jamais).
            setTimeout(() => window.location.reload(), 1500)
          }}
          className="h-auto self-start rounded-lg bg-[#B85000] px-3.5 py-2 text-[13px] font-bold text-white"
          style={{ gap: '6px' }}
        >
          <LuRefreshCw size={14} />
          {t.reload}
        </Button>
      )}
    </div>
  )
}
