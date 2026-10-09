import { Suspense, lazy } from 'react'
import { LuMic } from 'react-icons/lu'
import VoiceMiniPanel from '@features/voice/components/voice-mini-panel'
import VoiceConsentDialog from '@shared/ui/voice-consent-dialog'
import { Z_INDEX } from '@shared/lib/z-index'
import { useDialogue } from '@shared/hooks/use-dialogue'

const VoiceConfirmPanel = lazy(() => import('@features/voice/components/voice-confirm-panel'))

// Composant orchestrant les 5 overlays de la reconnaissance vocale :
//   1. Mini panneau « écoute en cours » (transcript live + matched)
//   2. Panneau de confirmation post-écoute (ingrédients à valider)
//   3. Dialog « fermer la fenêtre ? » (modale ouverte → écoute bloquée)
//   4. Toast d'erreur (microphone refusé, offline, navigateur non supporté)
//   5. Toast undo après ajout vocal (snapshot pour rollback)
//
// Sprint 10 S10.a.15 — extrait depuis App.jsx (~70 lignes JSX). Tous
// les états (voice, voiceToast, modals) et handlers proviennent de
// `useVoiceFlow` côté App.jsx ; ce composant n'est qu'une vue.

const VOICE_ERROR_I18N = {
  'not-supported': {
    fr: 'Reconnaissance vocale non supportée. Essaie Chrome, Edge ou Safari.',
    en: 'Voice recognition not supported. Try Chrome, Edge or Safari.',
  },
  'permission-denied': {
    fr: "Accès au microphone refusé. Vérifie les réglages de ton navigateur.",
    en: 'Microphone access denied. Check your browser settings.',
  },
  offline: {
    fr: 'Reconnaissance vocale indisponible hors connexion.',
    en: 'Voice recognition unavailable offline.',
  },
}

const VOICE_MODAL_I18N = {
  fr: {
    title: 'Fermer la fenêtre actuelle ?',
    body: 'La reconnaissance vocale nécessite de fermer la fenêtre actuelle. Tu veux continuer ?',
    cancel: 'Annuler',
    confirm: 'Continuer',
  },
  en: {
    title: 'Close current window?',
    body: 'Voice recognition requires closing the current window. Do you want to continue?',
    cancel: 'Cancel',
    confirm: 'Continue',
  },
}

const VOICE_ADDED_I18N = {
  fr: n => `${n} ingrédient${n > 1 ? 's' : ''} ajouté${n > 1 ? 's' : ''} au frigo`,
  en: n => `${n} ingredient${n > 1 ? 's' : ''} added to fridge`,
}

const VOICE_UNDO_I18N = { fr: 'Annuler', en: 'Undo' }

export default function VoiceOverlays({
  voice,
  voiceToast,
  voiceConfirmOpen,
  voiceModalOpen,
  voiceConsentOpen,
  onVoiceConsentAccept,
  onVoiceConsentRefuse,
  onVoiceModalClose,
  onVoiceModalConfirm,
  onVoiceAdd,
  onVoiceCancel,
  onVoiceToggle,
  onVoiceUndo,
  stock,
  lang,
  darkMode,
}) {
  // Une vraie boîte de dialogue : rôle, nom, focus piégé, Échap (A11Y-01).
  const dialogueMicro = useDialogue({ onClose: onVoiceModalClose, actif: voiceModalOpen })
  return (
    <>
      {voiceConsentOpen && (
        <VoiceConsentDialog
          lang={lang}
          darkMode={darkMode}
          onAccept={onVoiceConsentAccept}
          onRefuse={onVoiceConsentRefuse}
        />
      )}

      {voice.isListening && (
        <VoiceMiniPanel
          lang={lang}
          transcript={voice.transcript}
          matchedIngredients={voice.matchedIngredients}
          onStop={() => voice.stop(true)}
          darkMode={darkMode}
        />
      )}

      {voiceConfirmOpen && (
        <Suspense fallback={null}>
          <VoiceConfirmPanel
            lang={lang}
            matchedIngredients={voice.matchedIngredients}
            stock={stock}
            onAdd={onVoiceAdd}
            onCancel={onVoiceCancel}
            onResumeVoice={onVoiceToggle}
            isListening={voice.isListening}
            darkMode={darkMode}
          />
        </Suspense>
      )}

      {voiceModalOpen && (() => {
        const mt = VOICE_MODAL_I18N[lang] ?? VOICE_MODAL_I18N.fr
        const bg = darkMode ? '#0F1923' : '#FDFAF6'
        const brd = darkMode ? 'var(--color-dark-surface)' : 'var(--color-border-warm)'
        const muted = darkMode ? '#7A90A8' : '#7A5F56'
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: Z_INDEX.MODAL, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div {...dialogueMicro.proprietes} className="fp-modal-panel" style={{ background: bg, borderRadius: '16px', border: `1.5px solid ${brd}`, padding: '24px', maxWidth: '360px', width: '100%', boxShadow: '0 16px 48px rgba(0,0,0,0.25)' }}>
              <h3 id={dialogueMicro.titreId} style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-charcoal)', marginBottom: '8px' }}>{mt.title}</h3>
              <p style={{ fontSize: '14px', color: muted, marginBottom: '20px', lineHeight: 1.5 }}>{mt.body}</p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={onVoiceModalClose} style={{ flex: 1, padding: '11px', borderRadius: '10px', border: `1.5px solid ${brd}`, background: darkMode ? 'var(--color-dark-surface)' : '#F5EDE0', color: 'var(--color-charcoal)', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{mt.cancel}</button>
                <button onClick={onVoiceModalConfirm} style={{ flex: 1, padding: '11px', borderRadius: '10px', border: 'none', background: 'var(--gradient-deep)', color: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{mt.confirm}</button>
              </div>
            </div>
          </div>
        )
      })()}

      {voice.error && (() => {
        const msg = (VOICE_ERROR_I18N[voice.error] ?? {})[lang] ?? (VOICE_ERROR_I18N[voice.error] ?? {}).fr ?? ''
        return (
          <div style={{ position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)', zIndex: Z_INDEX.TOAST, background: darkMode ? 'var(--color-dark-surface)' : '#FFF3E0', border: `1.5px solid rgba(229,53,53,0.4)`, borderRadius: '10px', padding: '12px 18px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '10px', maxWidth: 'calc(100vw - 32px)', animation: 'menu-slide-down 0.2s ease both' }}>
            <LuMic size={16} style={{ color: '#E53535', flexShrink: 0 }} />
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-charcoal)' }}>{msg}</span>
          </div>
        )
      })()}

      {voiceToast && (() => {
        const addedMsg = (VOICE_ADDED_I18N[lang] ?? VOICE_ADDED_I18N.fr)(voiceToast.count)
        const undoLabel = VOICE_UNDO_I18N[lang] ?? VOICE_UNDO_I18N.fr
        return (
          <div style={{ position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)', zIndex: Z_INDEX.TOAST, background: darkMode ? '#1A2535' : '#FDFAF6', border: `1.5px solid ${darkMode ? '#243650' : '#E2D8CC'}`, borderRadius: '10px', padding: '12px 16px', boxShadow: '0 4px 20px rgba(0,0,0,0.14)', display: 'flex', alignItems: 'center', gap: '12px', maxWidth: 'calc(100vw - 32px)', animation: 'menu-slide-down 0.2s ease both' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-charcoal)' }}>{addedMsg}</span>
            <button onClick={onVoiceUndo} style={{ padding: '5px 12px', borderRadius: '7px', border: '1.5px solid rgba(229,53,53,0.4)', background: 'rgba(229,53,53,0.08)', color: '#E53535', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{undoLabel}</button>
          </div>
        )
      })()}
    </>
  )
}
