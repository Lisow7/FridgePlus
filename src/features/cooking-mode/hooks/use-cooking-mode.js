// src/features/cooking-mode/hooks/use-cooking-mode.js
//
// Orchestrateur principal du mode cuisine. Compose les sous-hooks :
// useVoiceListener (STT), useSpeechSynthesis (TTS), useStepTimer, useWakeLock.
// Utilise cookingReducer comme state machine.
//
// Spec : la conception « cooking-mode-vocal » du 2026-05-19

import { useReducer, useEffect, useCallback, useMemo, useState, useRef } from 'react'
import { useConsent } from '@shared/hooks/use-consent'
import { cookingReducer, initialCookingState } from '../lib/cooking-state-reducer.js'
import { parseDurations } from '../lib/duration-parser.js'
import { useVoiceListener } from './use-voice-listener.js'
import { useSpeechSynthesis } from './use-speech-synthesis.js'
import { useStepTimer } from './use-step-timer.js'
import { useWakeLock } from './use-wake-lock.js'

// Textes de synthèse vocale (TTS) — annoncés à voix haute pendant la session,
// pas affichés à l'écran. Même règle i18n que le reste : dictionnaire fr/en.
const I18N = {
  fr: {
    timeElapsed: 'Temps ecoule !',
    timeLeft: (min, sec) => `Il reste ${min} minutes ${sec} secondes`,
    stepPrefix: (stepNum, total) => `Etape ${stepNum} sur ${total}. `,
  },
  en: {
    timeElapsed: 'Time elapsed!',
    timeLeft: (min, sec) => `${min} minutes ${sec} seconds left`,
    stepPrefix: (stepNum, total) => `Step ${stepNum} of ${total}. `,
  },
}

export function useCookingMode(recipe, lang = 'fr') {
  const t = I18N[lang] ?? I18N.fr
  const steps = recipe?.steps ?? []
  const [state, dispatch] = useReducer(cookingReducer, { totalSteps: steps.length }, initialCookingState)
  // Mode "voix coupée" : l'app ne LIT plus les étapes (TTS off) mais continue
  // d'écouter les commandes vocales. Pour ne pas rester bloqué en 'speaking'
  // (qui attend la fin du TTS pour passer en 'listening'), l'effet de lecture
  // bascule immédiatement en STEP_READ quand muted.
  const [muted, setMuted] = useState(false)
  const [micEnabled, setMicEnabled] = useState(true)

  // Consentement vocal RGPD : le micro (Web Speech, audio → Google/Apple)
  // ne s'active jamais sans accord explicite. Même catégorie `voice` que le
  // micro frigo → si déjà accepté ailleurs, aucun re-prompt. Refus = le mode
  // cuisine continue au toucher + lecture vocale (dégradation gracieuse).
  const { consent, setVoiceConsent } = useConsent()
  const voiceConsented = consent.voice === true
  const [voiceConsentOpen, setVoiceConsentOpen] = useState(false)
  // declinedRef : empêche la ré-ouverture en boucle après un refus, tout en
  // permettant un nouveau prompt si l'utilisateur ré-active le micro lui-même.
  const voiceConsentDeclinedRef = useRef(false)

  const currentStep = state.currentStepIndex >= 0 ? steps[state.currentStepIndex] : null
  const currentStepText = typeof currentStep === 'string' ? currentStep : currentStep?.text ?? ''
  const durations = useMemo(() => parseDurations(currentStepText, lang), [currentStepText, lang])

  const synth = useSpeechSynthesis({
    lang,
    onEnd: () => {
      if (state.status === 'speaking') dispatch({ type: 'STEP_READ' })
    },
  })

  const timer = useStepTimer({
    onComplete: () => {
      synth.speak(t.timeElapsed)
    },
  })

  const handleIntent = useCallback((intent) => {
    const isParam = typeof intent === 'object'
    const intentName = isParam ? intent.intent : intent

    switch (intentName) {
      case 'next': dispatch({ type: 'NEXT_STEP' }); break
      case 'previous': dispatch({ type: 'PREVIOUS_STEP' }); break
      case 'repeat': dispatch({ type: 'REPEAT_STEP' }); break
      case 'firstStep': dispatch({ type: 'JUMP_TO_STEP', step: 1 }); break
      case 'lastStep': dispatch({ type: 'JUMP_TO_STEP', step: state.totalSteps }); break
      case 'jumpToStep': dispatch({ type: 'JUMP_TO_STEP', step: intent.step }); break
      case 'pause': dispatch({ type: 'PAUSE_SESSION' }); synth.cancel(); break
      case 'resume': dispatch({ type: 'RESUME_SESSION' }); break
      case 'stop': dispatch({ type: 'STOP' }); break
      case 'startTimer':
        if (durations[0] && timer.state !== 'running') timer.start(durations[0].seconds)
        break
      case 'pauseTimer': timer.pause(); break
      case 'cancelTimer': timer.cancel(); break
      case 'resetTimer': if (durations[0]) timer.start(durations[0].seconds); break
      case 'addTime':
        if (intent.amount && intent.unit) {
          const factor = intent.unit.startsWith('minute') ? 60 : 1
          timer.addTime(intent.amount * factor)
        }
        break
      case 'customTimer':
        if (intent.amount && intent.unit) {
          const factor = intent.unit.startsWith('minute') ? 60 : 1
          timer.start(intent.amount * factor)
        }
        break
      case 'timeLeft':
        if (timer.state === 'running') {
          const min = Math.floor(timer.secondsLeft / 60)
          const sec = timer.secondsLeft % 60
          synth.speak(t.timeLeft(min, sec))
        }
        break
      // Mute persistant : "tais-toi / silence" coupe la lecture pour de bon
      // (l'écoute des commandes continue). "reparle / redis tout" la réactive
      // et relit l'étape courante.
      case 'mute': setMuted(true); synth.cancel(); break
      case 'resumeSpeech': setMuted(false); dispatch({ type: 'REPEAT_STEP' }); break
      default: break
    }
  }, [state.totalSteps, durations, timer, synth, t])

  // micEnabled : coupe l'écoute (reconnaissance). NB : une fois le micro
  // coupé, il ne peut être réactivé QUE par un tap (rien n'écoute pour
  // entendre une commande). Distinct de `muted` qui ne coupe que la lecture.
  //
  // On écoute dès que le micro est ON et que l'app ne parle pas (peu importe
  // le statut exact). NE PAS lier au seul statut 'listening' : il dépend de
  // la fin du TTS (onEnd) pour passer de 'speaking' à 'listening', donc s'il
  // se bloque (ou après un toggle micro/voix), l'écoute ne redémarrerait
  // jamais. Découplé → réactivation immédiate au clic.
  const sessionActive = state.status !== 'idle' && state.status !== 'finished'
  // Gate RGPD : l'écoute n'est activée que si le consentement vocal est donné.
  const voiceEnabled = micEnabled && sessionActive && !synth.speaking && voiceConsented
  useVoiceListener({
    enabled: voiceEnabled,
    lang,
    onIntent: handleIntent,
  })

  // Demande le consentement vocal au démarrage de la session si le micro est
  // souhaité mais pas encore consenti (et pas refusé pour cette session).
  useEffect(() => {
    if (sessionActive && micEnabled && !voiceConsented && !voiceConsentDeclinedRef.current) {
      setVoiceConsentOpen(true)
    }
  }, [sessionActive, micEnabled, voiceConsented])

  const onVoiceConsentAccept = useCallback(() => {
    setVoiceConsent(true)
    setVoiceConsentOpen(false)
  }, [setVoiceConsent])

  const onVoiceConsentRefuse = useCallback(() => {
    voiceConsentDeclinedRef.current = true
    setMicEnabled(false)        // micro coupé → UI cohérente, cuisine au toucher
    setVoiceConsentOpen(false)
  }, [])

  useWakeLock(state.status !== 'idle' && state.status !== 'finished')

  useEffect(() => {
    if (state.status !== 'speaking') return
    if (!currentStepText) return
    // Voix coupée → on saute la lecture et on passe directement à l'écoute.
    if (muted) {
      dispatch({ type: 'STEP_READ' })
      return
    }
    const stepNum = state.currentStepIndex + 1
    const prefix = t.stepPrefix(stepNum, state.totalSteps)
    synth.speak(prefix + currentStepText)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, state.currentStepIndex])

  const handlers = {
    // unlock() prime le moteur TTS DANS le geste du clic (sinon le 1er
    // speak(), déclenché par l'effet ci-dessus, est bloqué par le navigateur).
    start: () => { synth.unlock(); dispatch({ type: 'START' }) },
    stop: () => dispatch({ type: 'STOP' }),
    next: () => dispatch({ type: 'NEXT_STEP' }),
    previous: () => dispatch({ type: 'PREVIOUS_STEP' }),
    repeat: () => dispatch({ type: 'REPEAT_STEP' }),
    startTimer: () => durations[0] && timer.start(durations[0].seconds),
    pauseTimer: () => timer.pause(),
    resumeTimer: () => timer.resume(),
    cancelTimer: () => timer.cancel(),
    resetTimer: () => durations[0] && timer.start(durations[0].seconds),
    pauseSession: () => dispatch({ type: 'PAUSE_SESSION' }),
    resumeSession: () => dispatch({ type: 'RESUME_SESSION' }),
    toggleMute: () => {
      if (muted) {
        // Réactive la voix → relit l'étape courante (feedback immédiat).
        setMuted(false)
        dispatch({ type: 'REPEAT_STEP' })
      } else {
        setMuted(true)
        synth.cancel()  // coupe la lecture en cours
        // Force la sortie de 'speaking' : on ne fait PAS confiance au onEnd
        // du TTS (non fiable après cancel dans Chrome) qui laisserait le
        // statut bloqué → réactivation muette + micro coupé.
        if (state.status === 'speaking') dispatch({ type: 'STEP_READ' })
      }
    },
    toggleMic: () => setMicEnabled(m => {
      const next = !m
      // Ré-activer le micro = intention explicite → on ré-autorise le prompt
      // de consentement (au cas où l'utilisateur avait refusé puis se ravise).
      if (next) voiceConsentDeclinedRef.current = false
      return next
    }),
  }

  return {
    status: state.status,
    currentStepIndex: state.currentStepIndex,
    currentStep: currentStepText,
    progress: { current: state.currentStepIndex + 1, total: state.totalSteps },
    timer: durations[0]
      ? { active: timer.state !== 'idle', state: timer.state, secondsLeft: timer.secondsLeft, totalSeconds: durations[0].seconds, label: durations[0].label }
      : null,
    speaking: synth.speaking,
    muted,
    micEnabled,
    voiceConsentOpen,
    onVoiceConsentAccept,
    onVoiceConsentRefuse,
    handlers,
  }
}
