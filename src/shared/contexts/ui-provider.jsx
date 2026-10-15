import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { SUPPORTED_LANGS, langueDuVisiteur } from '@shared/lib/i18n/langues'

// Sprint 6 PR S6.a — Refactor App.jsx (Piste D).
//
// Centralise `lang` + `darkMode` (deux states UI globaux infrequemment
// changés) dans un Context unique. Évite le prop drilling vers Header,
// Footer, Panels et toutes les modales.
//
// Pourquoi Context (et pas Zustand) :
//   - lang/darkMode changent rarement → re-renders globaux acceptables
//   - Pas besoin de sélecteurs fins (Zustand serait surdimensionné)
//   - Context est zéro-cost (built-in React)
//   - Cohérent avec les patterns du projet (AuthProvider, DataProvider)
//
// Migration progressive :
//   1. App.jsx consume via useLang() / useDarkMode() au lieu de useState
//   2. Les composants enfants gardent provisoirement leurs props `lang`
//      et `darkMode` pour ne pas casser le rendu (pas de big-bang).
//   3. Au fil des touches, chaque composant peut basculer sur les hooks.

const UIContext = createContext(null)

// Sprint 7 PR S7.a — Réduction à FR + EN.
// L'audit a montré que ES / DE / JA n'étaient pas exploités en
// pratique : duplication massive (76 fichiers avec clés inutilisées),
// charge maintenance disproportionnée. On garde FR et EN.
//
// Un premier visiteur est en français tant qu'il n'a pas choisi (décision du
// 2026-10-08 : la langue du navigateur n'est plus lue). Filet pour les comptes
// existants : un réglage enregistré qui n'est plus proposé (es/de/ja) devient
// EN — la personne avait exprimé une préférence non francophone.
// La liste elle-même vit dans `@shared/lib/i18n/langues` (elle y FAIT FOI).

// 🔴 Doit rester ÉGAL à la durée déclarée dans `index.css` pour
// `html[data-transition] *`. Si les deux divergent, soit la transition est
// coupée avant la fin, soit l'attribut traîne et fige les survols.
export const DUREE_BASCULE_THEME_MS = 260

function detectLang() {
  const langue = langueDuVisiteur()
  // L'ancien réglage non proposé est migré vers EN une fois pour toutes.
  try {
    const saved = localStorage.getItem('fridge-lang')
    if (saved && !SUPPORTED_LANGS.has(saved)) localStorage.setItem('fridge-lang', 'en')
  } catch { /* stockage indisponible */ }
  return langue
}

function detectDarkMode() {
  try {
    const saved = localStorage.getItem('fridge-theme')
    const isDark = saved === 'dark'
    if (isDark) document.documentElement.setAttribute('data-theme', 'dark')
    return isDark
  } catch { return false }
}

export function UIProvider({ children }) {
  const [lang, setLangState] = useState(detectLang)
  const [darkMode, setDarkModeState] = useState(detectDarkMode)
  // Source de vérité pour le toggle, lisible sans dépendre du cycle de rendu.
  // Permet de garder `toggleDarkMode` stable (`useCallback` à dépendances vides)
  // tout en calculant la valeur suivante HORS de l'updater — voir le commentaire
  // détaillé sur `toggleDarkMode` plus bas.
  const darkModeRef = useRef(darkMode)
  // Minuteur de fin de bascule, annulable si l'utilisateur rebascule aussitôt.
  const finTransitionRef = useRef(null)

  // Sprint 7 PR S7.a — accepte FR ou EN (les seules langues
  // supportées désormais). Pour le launch FR-only, ce sont les seules
  // valeurs valides. Les codes ja/es/de éventuels d'anciennes sessions
  // sont rejetés ici (et migrés à EN par detectLang au boot).
  const setLang = useCallback((code) => {
    if (!SUPPORTED_LANGS.has(code)) return
    try { localStorage.setItem('fridge-lang', code) } catch {}
    setLangState(code)
  }, [])

  // Toggle darkMode avec View Transitions API quand disponible (Chrome/Safari)
  // pour un fondu enchaîné natif. Fallback synchrone sinon.
  //
  // 🔴 Les effets de bord vivaient AUTREFOIS dans l'updater de `setDarkModeState`.
  // Un updater doit être PUR : React se réserve le droit de le rejouer, et c'est
  // exactement ce que fait `StrictMode` en développement. Mesuré avant correction,
  // sur UN SEUL clic : `startViewTransition` appelée **2 fois**, `data-theme` posé
  // **2 fois**, et la première transition avortée — `AbortError: Transition was
  // skipped` dans la console, donc un fondu interrompu en plein vol.
  // ⇒ L'état se calcule à partir de `darkMode`, et les effets de bord se font
  // ICI, une seule fois, hors de l'updater.
  const toggleDarkMode = useCallback(() => {
    const next = !darkModeRef.current
    darkModeRef.current = next
    setDarkModeState(next)

    // ⛔ PLUS de `document.startViewTransition` ici — c'était un fondu d'IMAGES
    // (deux instantanés de la page qui se croisent). Remplacé par un GLISSEMENT
    // des couleurs : `data-transition` fait porter à TOUS les éléments la même
    // transition, la même durée et la même courbe (voir `index.css`), si bien
    // que la page entière se dégrade vers le nouveau thème d'un seul tenant.
    //
    // Mesuré sur la prod : le fondu d'images laissait 16 ms d'étalement, le
    // glissement 0 ms — et il fonctionne dans TOUS les navigateurs, là où les
    // View Transitions manquent encore à Firefox.
    document.documentElement.setAttribute('data-transition', next ? 'to-dark' : 'to-light')

    // Le changement de tokens doit intervenir APRÈS que la règle de transition
    // est posée, sinon les couleurs sauteraient sans s'animer.
    requestAnimationFrame(() => {
      try { localStorage.setItem('fridge-theme', next ? 'dark' : 'light') } catch {}
      document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light')
    })

    // ⚠️ Une bascule peut en interrompre une autre (double clic) : on annule le
    // retrait programmé, sinon le premier minuteur couperait la transition en
    // cours. Doit rester synchronisé avec la durée déclarée dans `index.css`.
    clearTimeout(finTransitionRef.current)
    finTransitionRef.current = setTimeout(() => {
      document.documentElement.removeAttribute('data-transition')
    }, DUREE_BASCULE_THEME_MS + 40)
  }, [])

  // Sync document.documentElement.lang à chaque changement de langue.
  // Important pour le SEO et les lecteurs d'écran : indique au navigateur
  // / aux crawlers la langue du contenu rendu.
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  // Mémoïsation : évite que les consumers re-render à chaque render du
  // Provider (référence stable tant que lang/darkMode inchangés).
  const value = useMemo(() => ({
    lang, setLang,
    darkMode, toggleDarkMode,
  }), [lang, setLang, darkMode, toggleDarkMode])

  return (
    <UIContext.Provider value={value}>
      {children}
    </UIContext.Provider>
  )
}

// Hooks d'accès : préfèrer ces hooks à `useContext(UIContext)` direct
// pour bénéficier de l'erreur explicite si utilisé hors Provider.

export function useUI() {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUI() doit être utilisé dans un <UIProvider>')
  return ctx
}

export function useLang() {
  const { lang, setLang } = useUI()
  return { lang, setLang }
}

export function useDarkMode() {
  const { darkMode, toggleDarkMode } = useUI()
  return { darkMode, toggleDarkMode }
}
