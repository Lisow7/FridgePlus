// src/features/cooking-mode/hooks/use-speech-synthesis.js
//
// Wrapper speechSynthesis. Lit un texte vocalement, désactive le micro
// pendant la lecture (via callback), réactive ensuite.
//
// ⚠️ Pièges Web Speech gérés ici (cf. recherche bonnes pratiques) :
//   1. Les voix se chargent en async → on écoute `voiceschanged` plutôt
//      que de lire getVoices() une seule fois (souvent vide au 1er appel).
//   2. Le 1er speak() doit partir d'un GESTE utilisateur, sinon le
//      navigateur le bloque. Comme nos speak() partent d'effets (pas de
//      geste direct), on expose `unlock()` à appeler dans le onClick
//      "Commencer" : il prime le moteur dans le geste → les speak()
//      ultérieurs (effets, commandes vocales) marchent toute la session.
//
// Spec : la conception « cooking-mode-vocal » du 2026-05-19

import { useEffect, useRef, useCallback, useState } from 'react'

const LANG_TO_LOCALE = { fr: 'fr-FR', en: 'en-US' }

export function useSpeechSynthesis({ lang = 'fr', onStart, onEnd } = {}) {
  const [supported] = useState(
    () => typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined'
  )
  const [speaking, setSpeaking] = useState(false)
  const voicesRef = useRef([])
  const unlockedRef = useRef(false)
  const currentUtteranceRef = useRef(null)
  const onStartRef = useRef(onStart)
  const onEndRef = useRef(onEnd)

  useEffect(() => { onStartRef.current = onStart }, [onStart])
  useEffect(() => { onEndRef.current = onEnd }, [onEnd])

  // Chargement async des voix : getVoices() est souvent vide au 1er appel,
  // les voix arrivent via l'événement voiceschanged.
  useEffect(() => {
    if (!supported) return
    const load = () => { voicesRef.current = speechSynthesis.getVoices() }
    load()
    speechSynthesis.addEventListener?.('voiceschanged', load)
    return () => speechSynthesis.removeEventListener?.('voiceschanged', load)
  }, [supported])

  const pickBestVoice = useCallback(() => {
    const voices = voicesRef.current
    if (!voices?.length) return null
    const locale = LANG_TO_LOCALE[lang] || 'fr-FR'
    return voices.find(v => v.lang === locale)
        || voices.find(v => v.lang?.startsWith(lang))
        || null
  }, [lang])

  // Prime le moteur TTS DANS un geste utilisateur (1er clic). Indispensable :
  // sans ça, le 1er speak() déclenché par un effet est bloqué par le navigateur.
  const unlock = useCallback(() => {
    if (!supported || unlockedRef.current) return
    unlockedRef.current = true
    try {
      speechSynthesis.resume()
      const primer = new SpeechSynthesisUtterance(' ')
      primer.volume = 0
      speechSynthesis.speak(primer)
    } catch { /* no-op */ }
  }, [supported])

  const speak = useCallback((text) => {
    if (!supported || !text) return
    // Chrome laisse parfois le moteur en pause → resume avant de parler.
    speechSynthesis.resume()
    if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = LANG_TO_LOCALE[lang] || 'fr-FR'
    const voice = pickBestVoice()
    if (voice) utterance.voice = voice
    utterance.onstart = () => {
      setSpeaking(true)
      onStartRef.current?.()
    }
    utterance.onend = () => {
      setSpeaking(false)
      currentUtteranceRef.current = null
      onEndRef.current?.()
    }
    currentUtteranceRef.current = utterance
    speechSynthesis.speak(utterance)
  }, [lang, supported, pickBestVoice])

  const cancel = useCallback(() => {
    speechSynthesis?.cancel()
    setSpeaking(false)
    currentUtteranceRef.current = null
  }, [])

  useEffect(() => () => { speechSynthesis?.cancel() }, [])

  return { supported, speaking, speak, cancel, unlock }
}
