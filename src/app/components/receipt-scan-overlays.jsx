// src/app/components/receipt-scan-overlays.jsx
//
// Orchestre les overlays du scan de ticket : écran de consentement, indicateur
// de traitement, panneau de relecture, toast d'erreur, toast de succès.
// Mirroir de voice-overlays.jsx.

import { Suspense, lazy, useRef } from 'react'
import { ReceiptConsentScreen } from '@features/receipt-scan'
import { Z_INDEX } from '@shared/lib/z-index'
import { CIBLE_MINIMALE } from '@shared/lib/cible-minimale'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'

const ReceiptReviewPanel = lazy(() => import('@features/receipt-scan/components/receipt-review-panel'))

const ERROR_I18N = {
  quota_exceeded: { fr: 'Quota mensuel de scans atteint — réessaie le mois prochain.', en: 'Monthly scan quota reached — try again next month.' },
  user_quota_exceeded: { fr: 'Tu as utilisé tes 30 scans du mois — réessaie le mois prochain.', en: 'You have used your 30 scans this month — try again next month.' },
  rate_limited:   { fr: 'Trop de scans en peu de temps — patiente un instant.', en: 'Too many scans in a short time — please wait a moment.' },
  unauthorized:   { fr: 'Connecte-toi pour utiliser cette fonctionnalité.', en: 'Log in to use this feature.' },
  invalid_token:  { fr: 'Connecte-toi pour utiliser cette fonctionnalité.', en: 'Log in to use this feature.' },
  vision_error:   { fr: "Impossible de lire ce ticket, réessaie avec une autre photo.", en: 'Could not read this receipt, try another photo.' },
  image_too_large: { fr: 'Photo trop volumineuse, réessaie avec une autre.', en: 'Photo too large, try another one.' },
  vision_unreachable: { fr: 'Problème de connexion, réessaie dans un instant.', en: 'Connection problem, try again in a moment.' },
  scan_failed:    { fr: 'Une erreur est survenue, réessaie.', en: 'Something went wrong, please try again.' },
  // vision_key_missing, image_base64_required, quota_check_failed,
  // invalid_json, method_not_allowed : bugs internes non actionnables par
  // l'utilisateur, pas de message dédié — retombent sur scan_failed (cf.
  // fallback ci-dessous), mais restent un code distinct côté Sentry.
}

const LOGIN_REQUIRED_I18N = {
  fr: { text: 'Connecte-toi pour scanner ton ticket de caisse.', button: 'Se connecter', close: 'Fermer' },
  en: { text: 'Log in to scan your receipt.', button: 'Log in', close: 'Close' },
}

const PROCESSING_I18N = { fr: 'Lecture du ticket…', en: 'Reading the receipt…' }
const ADDED_I18N = {
  fr: n => `${n} ingrédient${n > 1 ? 's' : ''} ajouté${n > 1 ? 's' : ''} au frigo`,
  en: n => `${n} ingredient${n > 1 ? 's' : ''} added to fridge`,
}

// Écran "connexion requise" — mêmes garanties a11y que les autres modales
// du projet (focus trap + Escape), pattern repris de leftovers-modal.jsx.
function LoginRequiredOverlay({ lang, darkMode, onClose, onShowAuth }) {
  const t = LOGIN_REQUIRED_I18N[lang] ?? LOGIN_REQUIRED_I18N.fr
  const dialogRef = useRef(null)
  useFocusTrap(dialogRef, { active: true, onEscape: onClose })
  useCloseOnBackButton(true, onClose)

  return (
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: Z_INDEX.MODAL, background: 'rgba(15,8,2,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t.text}
        onClick={e => e.stopPropagation()}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', background: darkMode ? '#0F1923' : '#FDFAF6', borderRadius: '16px', padding: '32px 24px', maxWidth: '320px', width: '100%', boxShadow: '0 16px 48px rgba(0,0,0,0.25)' }}
      >
        <span style={{ fontSize: '48px' }}>🔒</span>
        <p style={{ fontSize: '15px', color: darkMode ? '#7A90A8' : '#7A5F56', textAlign: 'center', margin: 0 }}>{t.text}</p>
        <button
          onClick={() => { onClose?.(); onShowAuth?.() }}
          style={{ border: 'none', borderRadius: '10px', padding: '11px 28px', fontSize: '14px', fontWeight: 800, color: '#fff', cursor: 'pointer', background: 'linear-gradient(135deg,#2E4A6A,#1A2F48)' }}
        >
          {t.button}
        </button>
        <button onClick={onClose} aria-label={t.close} style={{ ...CIBLE_MINIMALE, background: 'none', border: 'none', color: darkMode ? '#7A90A8' : '#7A5F56', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}>
          {t.close}
        </button>
      </div>
    </div>
  )
}

export default function ReceiptScanOverlays({
  lang, darkMode, stock,
  receiptScanStage, receiptScanError, matched, ambiguous, unmatchedCount, receiptToast,
  receiptReviewOpen,
  onConsentFileSelected, onConsentCancel,
  onReceiptAdd, onReceiptCancel,
  onDismissError,
  onLoginRequiredClose, onShowAuth,
}) {
  return (
    <>
      {receiptScanStage === 'login-required' && (
        <LoginRequiredOverlay lang={lang} darkMode={darkMode} onClose={onLoginRequiredClose} onShowAuth={onShowAuth} />
      )}

      {receiptScanStage === 'consent' && (
        <ReceiptConsentScreen lang={lang} darkMode={darkMode} onFileSelected={onConsentFileSelected} onCancel={onConsentCancel} />
      )}

      {receiptScanStage === 'processing' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: Z_INDEX.MODAL, background: 'rgba(15,8,2,0.86)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="animate-spin" style={{ width: '44px', height: '44px', borderRadius: '50%', border: '4px solid rgba(247,168,94,0.18)', borderTopColor: '#F7A85E', margin: '0 auto 18px' }} />
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#F5EBDD' }}>{PROCESSING_I18N[lang] ?? PROCESSING_I18N.fr}</div>
          </div>
        </div>
      )}

      {receiptReviewOpen && (
        <Suspense fallback={null}>
          <ReceiptReviewPanel
            lang={lang} darkMode={darkMode}
            matched={matched} ambiguous={ambiguous} unmatchedCount={unmatchedCount}
            stock={stock} onAdd={onReceiptAdd} onCancel={onReceiptCancel}
          />
        </Suspense>
      )}

      {receiptScanStage === 'error' && receiptScanError && (() => {
        const msg = (ERROR_I18N[receiptScanError] ?? ERROR_I18N.scan_failed)[lang] ?? (ERROR_I18N[receiptScanError] ?? ERROR_I18N.scan_failed).fr
        return (
          <div style={{ position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)', zIndex: Z_INDEX.TOAST, background: darkMode ? 'var(--color-dark-surface)' : '#FFF3E0', border: '1.5px solid rgba(217,119,6,0.4)', borderRadius: '10px', padding: '12px 18px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', maxWidth: 'calc(100vw - 32px)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-charcoal)' }}>{msg}</span>
            <button onClick={onDismissError} style={{ ...CIBLE_MINIMALE, background: 'none', border: 'none', color: '#B85000', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>✕</button>
          </div>
        )
      })()}

      {receiptToast && (
        <div style={{ position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)', zIndex: Z_INDEX.TOAST, background: darkMode ? '#1A2535' : '#FDFAF6', border: `1.5px solid ${darkMode ? '#243650' : '#E2D8CC'}`, borderRadius: '10px', padding: '12px 16px', boxShadow: '0 4px 20px rgba(0,0,0,0.14)', maxWidth: 'calc(100vw - 32px)' }}>
          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-charcoal)' }}>{(ADDED_I18N[lang] ?? ADDED_I18N.fr)(receiptToast.count)}</span>
        </div>
      )}
    </>
  )
}
