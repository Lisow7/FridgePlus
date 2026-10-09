import '@testing-library/jest-dom'
import { configure } from '@testing-library/react'

// Les GABARITS de mesure sont invisibles aux requêtes de texte, comme ils le sont
// déjà à l'œil (`visibility:hidden`) et aux lecteurs d'écran (`aria-hidden` +
// `inert`).
//
// Un gabarit est un élément rendu UNIQUEMENT pour imposer une dimension. La
// visite guidée en rend un qui empile les cinq étapes dans la même cellule de
// grille, pour que les cinq panneaux fassent la taille du plus haut
// (2026-09-12). Son texte est donc un doublon du contenu réel : sans cette
// ligne, `getByText` en trouve deux et échoue, et chaque test devrait se
// souvenir de l'artefact. C'est à l'artefact de se taire, pas aux tests de le
// contourner.
// ⚠️ `[data-gabarit] *` autant que `[data-gabarit]` : `ignore` filtre le nœud
// candidat LUI-MÊME, jamais ses ancêtres. Sans l'étoile, le `<h2>` à
// l'intérieur du gabarit reste trouvable et `getByText` en voit deux.
configure({ defaultIgnore: 'script, style, [data-gabarit], [data-gabarit] *' })

// jsdom ne supporte pas scrollIntoView ni scrollTo
window.HTMLElement.prototype.scrollIntoView = vi.fn()
window.HTMLElement.prototype.scrollTo       = vi.fn()

// matchMedia : Footer / responsiveness l'utilisent pour détecter prefers-color-scheme
// Default : aucune media-query ne matche (environnement « light »).
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),    // legacy
    removeListener: vi.fn(), // legacy
    dispatchEvent: vi.fn(),
  })
}

// ResizeObserver / IntersectionObserver : non implémentés par jsdom.
if (!window.ResizeObserver) {
  window.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} }
}
if (!window.IntersectionObserver) {
  window.IntersectionObserver = class {
    constructor() {}
    observe(){} unobserve(){} disconnect(){} takeRecords(){ return [] }
  }
}

// Web Speech API + Wake Lock pour cooking-mode (jsdom ne fournit pas ces APIs)
if (typeof globalThis.SpeechRecognition === 'undefined') {
  globalThis.SpeechRecognition = class MockSpeechRecognition {
    constructor() {
      this.continuous = false
      this.interimResults = false
      this.lang = ''
      this._listeners = {}
    }
    addEventListener(event, handler) { this._listeners[event] = handler }
    removeEventListener(event) { delete this._listeners[event] }
    start() {}
    stop() {}
    abort() {}
  }
  globalThis.webkitSpeechRecognition = globalThis.SpeechRecognition
}

if (typeof globalThis.speechSynthesis === 'undefined') {
  globalThis.speechSynthesis = {
    speak: vi.fn(),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: () => [{ lang: 'fr-FR', name: 'Fr' }, { lang: 'en-US', name: 'En' }],
  }
  globalThis.SpeechSynthesisUtterance = class MockUtterance {
    constructor(text) { this.text = text; this.onend = null }
  }
}

if (typeof globalThis.navigator !== 'undefined' && !globalThis.navigator.wakeLock) {
  globalThis.navigator.wakeLock = {
    request: vi.fn(() => Promise.resolve({ release: vi.fn(() => Promise.resolve()) })),
  }
}
