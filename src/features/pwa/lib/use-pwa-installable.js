import { useEffect, useState } from 'react'

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true
}

// Capture globale, hors React — `beforeinstallprompt` ne se déclenche
// qu'UNE FOIS par chargement de page, potentiellement avant que React ait
// fini de monter jusqu'au composant qui l'écoutait (HelpGuide, plusieurs
// providers d'abord dans main.jsx). Un `window.addEventListener` posé dans
// un `useEffect` classique arrive trop tard et rate l'événement pour de
// bon — retour utilisateur 2026-07-11 : le menu natif Chrome proposait
// bien l'installation (Chrome garde son propre état interne), mais notre
// bouton restait invisible faute d'avoir capturé l'event. Ce module
// s'attache dès son évaluation — importé transitivement dès le haut de
// main.jsx (App.jsx), donc avant le tout premier rendu React.
let capturedPrompt = null
let capturedInstalled = false
const subscribers = new Set()

function notify() {
  subscribers.forEach((fn) => fn())
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    capturedPrompt = e
    notify()
  })
  window.addEventListener('appinstalled', () => {
    capturedInstalled = true
    capturedPrompt = null
    notify()
  })
}

// Détection partagée « l'app peut être proposée à l'installation » — utilisée
// par <InstallButton> (le bouton lui-même) et par toute page qui veut
// afficher un bloc dédié ailleurs que dans le footer (ex. page Aide &
// Mentions légales, 2026-07-10 — le bouton y a été déplacé pour désengorger
// le footer mobile, qui retombait sur 2 lignes).
export function usePwaInstallable() {
  const ios = isIos()
  const [, bump] = useState(0)
  const [installed, setInstalledState] = useState(() => isStandalone() || capturedInstalled)

  useEffect(() => {
    const onChange = () => {
      if (capturedInstalled) setInstalledState(true)
      bump((n) => n + 1)
    }
    subscribers.add(onChange)
    return () => subscribers.delete(onChange)
  }, [])

  function setDeferredPrompt(value) {
    capturedPrompt = value
    bump((n) => n + 1)
  }

  function setInstalled(value) {
    capturedInstalled = value
    setInstalledState(value)
  }

  return {
    installable: !installed && (ios || !!capturedPrompt),
    ios,
    installed,
    deferredPrompt: capturedPrompt,
    setDeferredPrompt,
    setInstalled,
  }
}
