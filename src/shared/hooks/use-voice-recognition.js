import { useState, useRef, useEffect, useCallback } from 'react'
import { useIngredients } from '@shared/contexts/data-provider'
import {
  normalize, buildLookup, buildGroupInfo, buildFlatList, buildFuseIndex, findMatches,
} from '@shared/lib/matching/ingredient-text-matcher'

// Ré-export pour compat : `normalize` est utilisé par des features non liées
// à la voix (recipe-form-modal.jsx, use-cooking-voice.js) qui l'importent
// depuis ce fichier. Source de vérité = ingredient-text-matcher.js.
export { normalize }

// Runtime japonais désactivé suite à v3.3.18.
// Le chargement CDN kuromoji (~3,5 Mo) ne se déclenche plus, mais les exports
// `toKatakana`, `getKuromojiTokenizer`, `tokenizeJapanese` sont conservés en
// stubs no-op pour ne pas casser RecipeFormModal et les tests qui les importent.
// Pour réactiver le runtime JA après DeepL Pro, restaurer ce fichier depuis
// l'historique git pré-PR #90.

// Sprint 7 PR S7.g — Alignement FR/EN.
export const LANG_TO_LOCALE = {
  fr: 'fr-FR', en: 'en-US',
}

// Stubs no-op (v3.3.19) — les fonctions runtime JA ne font plus rien.
// Maintenus pour que RecipeFormModal et les tests qui importent ces noms
// continuent de fonctionner sans modification (leur usage était conditionné
// à `lang === 'ja'`, branche désormais inatteignable depuis v3.3.18).
export function toKatakana(s) { return s }
export function getKuromojiTokenizer() { return Promise.resolve(null) }
export function tokenizeJapanese() { return [] }

// ─── Hook principal ──────────────────────────────────────────────────────────

export function useVoiceRecognition({ lang }) {
  const ingredients = useIngredients()
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [matchedIngredients, setMatchedIngredients] = useState([])
  const [error, setError] = useState(null)

  const recognitionRef = useRef(null)
  const silenceTimerRef = useRef(null)
  const sessionTimerRef = useRef(null)
  const isListeningRef = useRef(false)
  const matchedIdsRef = useRef(new Set())
  const onStopRef = useRef(null)
  const lookupRef = useRef(null)
  const flatListRef = useRef(null)
  const fuseRef = useRef(null)
  const groupInfoRef = useRef(null)
  const langRef = useRef(lang)
  const ingredientsRef = useRef(ingredients)

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  const isFirefox = typeof navigator !== 'undefined' &&
    /Firefox/.test(navigator.userAgent) && !isSupported

  // Les index se construisent quand la voix DÉMARRE (`preparerLesIndex`, dans
  // `start`), plus à l'ouverture de chaque page : avant, tout visiteur — FAQ
  // comprise, et même sur Firefox, sans reconnaissance vocale — parcourait
  // ≈ 650 ingrédients et téléchargeait Fuse, deux fois (au démarrage, puis à
  // l'arrivée du catalogue). Audit du 2026-10-04, PERF-06. Un changement de
  // langue ou d'ingrédients ne fait qu'oublier les index : le prochain
  // démarrage les reconstruit.
  useEffect(() => {
    ingredientsRef.current = ingredients
    langRef.current = lang
    lookupRef.current = null
    flatListRef.current = null
    fuseRef.current = null
    groupInfoRef.current = null
  }, [ingredients, lang])

  // `buildFuseIndex` est async (Fuse chargé à la demande, hors du boot) :
  // résolu en arrière-plan, prêt avant la première phrase dictée, et
  // `findMatches` tolère un index encore nul (correspondance exacte seule).
  const preparerLesIndex = useCallback(() => {
    if (flatListRef.current) return
    const ingredientsDuMoment = ingredientsRef.current
    const fl = buildFlatList(ingredientsDuMoment, langRef.current)
    flatListRef.current = fl
    lookupRef.current = buildLookup(ingredientsDuMoment, langRef.current)
    groupInfoRef.current = buildGroupInfo(ingredientsDuMoment)
    buildFuseIndex(fl).then(ix => { if (flatListRef.current === fl) fuseRef.current = ix })
  }, [])

  const clearTimers = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current)
    silenceTimerRef.current = null
    sessionTimerRef.current = null
  }, [])

  const stop = useCallback((triggerConfirm = true) => {
    isListeningRef.current = false
    clearTimers()
    setIsListening(false)
    setTranscript('')
    try { recognitionRef.current?.stop() } catch { /* noop — le micro peut déjà être arrêté */ }
    if (triggerConfirm) onStopRef.current?.()
  }, [clearTimers])

  const prevLangRef = useRef(lang)
  useEffect(() => {
    if (prevLangRef.current !== lang && isListeningRef.current) stop(true)
    prevLangRef.current = lang
  }, [lang, stop])

  const start = useCallback(({ onStop } = {}) => {
    if (!navigator.onLine) { setError('offline'); return }
    if (isFirefox || !isSupported) { setError('not-supported'); return }

    onStopRef.current = onStop
    setError(null)
    setTranscript('')
    preparerLesIndex()

    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    const rec = new SR()
    rec.lang = LANG_TO_LOCALE[langRef.current] ?? 'fr-FR'
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 3
    recognitionRef.current = rec

    const resetSilence = () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = setTimeout(() => {
        if (isListeningRef.current) stop(true)
      }, 5000)
    }

    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) {
          // Reconstruit les index à la volée si nécessaire (cas edge de démarrage rapide)
          if (!lookupRef.current) lookupRef.current = buildLookup(ingredientsRef.current, langRef.current)
          if (!flatListRef.current) {
            flatListRef.current = buildFlatList(ingredientsRef.current, langRef.current)
            // Callback synchrone : l'index arrive en arrière-plan. Ce tout
            // premier résultat se contente des correspondances exactes.
            buildFuseIndex(flatListRef.current).then(ix => { fuseRef.current = ix })
          }
          if (!groupInfoRef.current) groupInfoRef.current = buildGroupInfo(ingredientsRef.current)

          // Essaie les 3 alternatives STT pour maximiser les matches
          const seenThisResult = new Set()
          for (let alt = 0; alt < res.length; alt++) {
            const text = res[alt].transcript
            const confidence = res[0].confidence ?? 1
            const { exact, ambiguous } = findMatches(
              text, langRef.current,
              lookupRef.current, flatListRef.current, fuseRef.current,
              groupInfoRef.current,
            )

            for (const ing of exact) {
              if (!seenThisResult.has(ing.id) && !matchedIdsRef.current.has(ing.id)) {
                seenThisResult.add(ing.id)
                matchedIdsRef.current.add(ing.id)
                setMatchedIngredients(prev => [...prev, { id: ing.id, labels: ing.labels, confidence }])
              }
            }
            for (const amb of ambiguous) {
              const key = `ambig:${normalize(amb.word)}`
              if (!seenThisResult.has(key) && !matchedIdsRef.current.has(key)) {
                seenThisResult.add(key)
                matchedIdsRef.current.add(key)
                setMatchedIngredients(prev => [...prev, { ...amb, confidence }])
              }
            }
          }
        } else {
          interim += res[0].transcript
        }
      }
      setTranscript(interim)
      resetSilence()
    }

    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setError('permission-denied'); stop(false)
      } else if (e.error === 'network') {
        setError('offline'); stop(false)
      }
    }

    rec.onend = () => {
      if (isListeningRef.current) { try { rec.start() } catch { /* noop — redémarrage ignoré si déjà arrêté */ } }
    }

    rec.start()
    isListeningRef.current = true
    setIsListening(true)
    resetSilence()
    sessionTimerRef.current = setTimeout(() => {
      if (isListeningRef.current) stop(true)
    }, 5 * 60 * 1000)
  }, [isFirefox, isSupported, stop, preparerLesIndex])

  const clearAll = useCallback(() => {
    setMatchedIngredients([])
    matchedIdsRef.current = new Set()
  }, [])

  const restore = useCallback((ingredients) => {
    setMatchedIngredients(ingredients)
    matchedIdsRef.current = new Set(
      ingredients.map(i => i.ambiguous ? `ambig:${normalize(i.word)}` : i.id)
    )
  }, [])

  return {
    isListening,
    isSupported: isSupported && !isFirefox,
    isFirefox,
    transcript,
    matchedIngredients,
    error,
    jaLoading: false,   // v3.3.19 — runtime JA désactivé, toujours false
    start,
    stop,
    clearAll,
    restore,
  }
}
