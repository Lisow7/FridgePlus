// src/features/cooking-mode/hooks/use-voice-listener.js
//
// Wrapper SpeechRecognition continuous. Restart auto toutes les 50s
// (workaround bug iOS Safari). Callback onIntent recoit l'intent matche.
//
// Spec : la conception « cooking-mode-vocal » du 2026-05-19

import { useEffect, useRef } from 'react'
import { matchIntent } from '../lib/intent-matcher.js'

const LANG_TO_LOCALE = { fr: 'fr-FR', en: 'en-US' }
const RESTART_INTERVAL_MS = 50_000

export function useVoiceListener({ enabled, onIntent, onTranscript, lang = 'fr' }) {
  const recognitionRef = useRef(null)
  const restartTimerRef = useRef(null)
  const onIntentRef = useRef(onIntent)
  const onTranscriptRef = useRef(onTranscript)

  useEffect(() => { onIntentRef.current = onIntent }, [onIntent])
  useEffect(() => { onTranscriptRef.current = onTranscript }, [onTranscript])

  useEffect(() => {
    if (!enabled) return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      console.warn('[voice] SpeechRecognition non supportee')
      return
    }

    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = LANG_TO_LOCALE[lang] || 'fr-FR'
    recognitionRef.current = recognition

    recognition.addEventListener('result', (ev) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const result = ev.results[i]
        if (!result.isFinal) continue
        const transcript = result[0]?.transcript ?? ''
        onTranscriptRef.current?.(transcript)
        const intent = matchIntent(transcript, lang)
        if (intent) onIntentRef.current?.(intent, transcript)
      }
    })

    recognition.addEventListener('error', (ev) => {
      console.warn('[voice] error:', ev.error)
    })

    try { recognition.start() } catch (err) { console.warn('[voice] start failed:', err) }

    restartTimerRef.current = setInterval(() => {
      try {
        recognition.stop()
        setTimeout(() => { try { recognition.start() } catch {} }, 200)
      } catch {}
    }, RESTART_INTERVAL_MS)

    return () => {
      if (restartTimerRef.current) clearInterval(restartTimerRef.current)
      try { recognition.stop() } catch {}
      recognitionRef.current = null
    }
  }, [enabled, lang])
}
