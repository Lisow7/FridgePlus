import { useState, useEffect, useRef, useCallback } from 'react'
import { useVoiceRecognition } from '@shared/hooks/use-voice-recognition'
import { hasConsentedSync, useConsent } from '@shared/hooks/use-consent'

// Hook orchestrant le flow de reconnaissance vocale : démarrage / arrêt,
// modale de confirmation, ajout au stock, toast undo. Sprint 10 S10.a.6 —
// extrait depuis App.jsx (62 lignes consolidées).
//
// Renvoie :
//   - voice                    : l'objet retourné par useVoiceRecognition
//                                (isListening, transcript, matchedIngredients,
//                                 error, jaLoading, stop, restore, …)
//   - voiceToast               : null | { count, addedIds, savedIngredients }
//   - handleVoiceToggle        : démarre/arrête l'écoute selon le contexte
//   - handleVoiceModalConfirm  : ferme tout puis démarre l'écoute
//   - handleVoiceAdd(ids)      : ajoute au stock + déclenche le toast undo
//   - handleVoiceUndo          : annule le dernier ajout vocal
//   - handleVoiceCancel        : ferme la modale de confirmation sans ajouter
//
// Dépendances injectées (App.jsx) : modales (auth/voiceConfirm/voiceModal),
// activeSubcat + setter, showRecipes + setter, closeAllDoors, batchs
// addStockBatch/removeStockBatch.

export function useVoiceFlow({
  lang,
  modals,
  activeSubcat,
  setActiveSubcat,
  showRecipes,
  setShowRecipes,
  closeAllDoors,
  addStockBatch,
  removeStockBatch,
}) {
  const voice = useVoiceRecognition({ lang })
  const { setVoiceConsent } = useConsent()
  const [voiceToast, setVoiceToast] = useState(null)
  const [voiceConsentOpen, setVoiceConsentOpen] = useState(false)
  const voiceToastTimerRef = useRef(null)

  // Efface l'erreur vocale après 5 s
  useEffect(() => {
    if (!voice.error) return
    const t = setTimeout(() => voice.start.__resetError?.(), 5000)
    return () => clearTimeout(t)
  }, [voice.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const startListening = useCallback(() => {
    voice.start({ onStop: () => modals.voiceConfirm.open() })
  }, [voice, modals])

  // Gate RGPD : on n'écoute jamais sans consentement vocal explicite
  // (audio transmis à Google/Apple via Web Speech). Au 1er usage, on ouvre
  // le mini-dialog au lieu de démarrer. S'applique à tous les chemins qui
  // passent par openVoice (toggle header + confirmation modale).
  const openVoice = useCallback(() => {
    if (!hasConsentedSync('voice')) { setVoiceConsentOpen(true); return }
    startListening()
  }, [startListening])

  const handleVoiceConsentAccept = useCallback(() => {
    setVoiceConsent(true)
    setVoiceConsentOpen(false)
    startListening()
  }, [setVoiceConsent, startListening])

  const handleVoiceConsentRefuse = useCallback(() => {
    setVoiceConsentOpen(false)
  }, [])

  const handleVoiceToggle = useCallback(() => {
    if (voice.isListening) { voice.stop(true); return }
    // Sprint 11 S11.b.5 — `modals.auth` retiré (auth est désormais une
    // route, pas une modale) : check uniquement activeSubcat ici.
    const hasOpenModal = !!activeSubcat
    if (hasOpenModal) { modals.voiceModal.open(); return }
    if (showRecipes) setShowRecipes(false)
    closeAllDoors()
    openVoice()
  }, [voice, activeSubcat, modals, showRecipes, setShowRecipes, closeAllDoors, openVoice])

  const handleVoiceModalConfirm = useCallback(() => {
    modals.voiceModal.close()
    setActiveSubcat(null)
    setShowRecipes(false)
    closeAllDoors()
    openVoice()
  }, [modals, setActiveSubcat, setShowRecipes, closeAllDoors, openVoice])

  const handleVoiceAdd = useCallback((ids) => {
    const savedIngredients = [...voice.matchedIngredients]
    voice.clearAll()
    modals.voiceConfirm.close()
    if (ids.length === 0) return
    addStockBatch(ids)
    if (voiceToastTimerRef.current) clearTimeout(voiceToastTimerRef.current)
    setVoiceToast({ count: ids.length, addedIds: ids, savedIngredients })
    voiceToastTimerRef.current = setTimeout(() => setVoiceToast(null), 5000)
  }, [voice, modals, addStockBatch])

  const handleVoiceUndo = useCallback(() => {
    if (!voiceToast) return
    const { addedIds, savedIngredients } = voiceToast
    removeStockBatch(addedIds)
    if (savedIngredients?.length > 0) {
      voice.restore(savedIngredients)
      modals.voiceConfirm.open()
    }
    setVoiceToast(null)
  }, [voiceToast, voice, modals, removeStockBatch])

  const handleVoiceCancel = useCallback(() => {
    voice.clearAll()
    modals.voiceConfirm.close()
  }, [voice, modals])

  return {
    voice,
    voiceToast,
    voiceConsentOpen,
    handleVoiceToggle,
    handleVoiceModalConfirm,
    handleVoiceConsentAccept,
    handleVoiceConsentRefuse,
    handleVoiceAdd,
    handleVoiceUndo,
    handleVoiceCancel,
  }
}
