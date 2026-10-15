// src/app/hooks/use-receipt-scan-flow.js
//
// Hook d'orchestration du flow "photo de ticket de caisse" — mirroir de
// use-voice-flow.js. États : idle -> consent -> processing -> review (ou
// error). Le consentement est contextuel et indépendant du bandeau cookies
// global (comme la voix), stocké via hasConsentedSync('receiptScan').
//
// Contrairement à la voix, cette fonctionnalité nécessite un compte (l'Edge
// Function scan-receipt exige un JWT). On informe l'invité DÈS le clic sur
// "Photo du ticket" (stage 'login-required') plutôt que de le laisser
// traverser tout le parcours (consentement, photo, compression) pour se
// faire bloquer tardivement par l'Edge Function — même pattern que
// leftovers-modal.jsx (🔒 + message + bouton Se connecter).

import { useState, useCallback, useEffect } from 'react'
import { hasConsentedSync, useConsent } from '@shared/hooks/use-consent'
import { compressImageToBase64 } from '@shared/lib/media/compress-image'
import { scanReceiptImage } from '@features/receipt-scan/lib/receipt-vision-client'
import { extractProductLabels } from '@features/receipt-scan/lib/receipt-line-parser'
import { matchReceiptLabels } from '@features/receipt-scan/lib/receipt-matcher'
import { logError } from '@shared/lib/observability/sentry'

// Doit couvrir tous les codes que l'Edge Function scan-receipt peut renvoyer
// (supabase/functions/scan-receipt/index.ts) — un code absent de cette liste
// s'écrase silencieusement en 'scan_failed' générique ci-dessous, masquant la
// vraie cause (retour utilisateur 2026-07-11 : erreur réelle rencontrée sur
// un vrai ticket, impossible à diagnostiquer car réduite à ce message générique).
const ERROR_CODES = new Set([
  'quota_exceeded', 'user_quota_exceeded', 'rate_limited', 'unauthorized', 'invalid_token', 'vision_error', 'scan_failed',
  'vision_key_missing', 'vision_unreachable', 'image_too_large', 'image_base64_required',
  'quota_check_failed', 'invalid_json', 'method_not_allowed',
  // Le drapeau « receipt_scan » éteint côté serveur (décision du 2026-10-08), ou illisible.
  'feature_disabled', 'flag_unavailable',
])

export function useReceiptScanFlow({ lang, modals, ingredients, user, addStockBatch }) {
  const { setReceiptScanConsent } = useConsent()
  const [stage, setStage] = useState('idle') // idle | login-required | consent | processing | error
  const [error, setError] = useState(null)
  const [matched, setMatched] = useState([])
  const [ambiguous, setAmbiguous] = useState([])
  const [unmatchedCount, setUnmatchedCount] = useState(0)
  const [receiptToast, setReceiptToast] = useState(null)

  const openReceiptScan = useCallback(() => {
    setError(null)
    setStage(user ? 'consent' : 'login-required')
  }, [user])

  const handleReceiptLoginRequiredClose = useCallback(() => {
    setStage('idle')
  }, [])

  const handleReceiptConsentCancel = useCallback(() => {
    setStage('idle')
  }, [])

  const handleFileSelected = useCallback(async (file) => {
    if (!hasConsentedSync('receiptScan')) setReceiptScanConsent(true)
    setStage('processing')
    try {
      const base64 = await compressImageToBase64(file)
      const visionResponse = await scanReceiptImage(base64)
      const labels = extractProductLabels(visionResponse)
      const result = await matchReceiptLabels(labels, { lang, ingredients })
      setMatched(result.matched)
      setAmbiguous(result.ambiguous)
      setUnmatchedCount(result.unmatchedCount)
      setStage('idle')
      modals.receiptReview.open()
    } catch (err) {
      // Avant ce fix : erreur jamais remontée à Sentry (juste un setState) —
      // angle mort identique à celui trouvé sur les notifications push. Sans
      // ça, un vrai échec en prod (comme celui du 2026-07-11) reste sans
      // aucune donnée de diagnostic.
      logError(err, { tag: 'receipt-scan.scan' })
      setError(ERROR_CODES.has(err?.message) ? err.message : 'scan_failed')
      setStage('error')
    }
  }, [lang, ingredients, modals, setReceiptScanConsent])

  const handleReceiptAdd = useCallback((ids) => {
    modals.receiptReview.close()
    setMatched([]); setAmbiguous([]); setUnmatchedCount(0)
    if (ids.length === 0) return
    addStockBatch(ids)
    setReceiptToast({ count: ids.length })
    setTimeout(() => setReceiptToast(null), 5000)
  }, [modals, addStockBatch])

  const handleReceiptCancel = useCallback(() => {
    modals.receiptReview.close()
    setMatched([]); setAmbiguous([]); setUnmatchedCount(0)
  }, [modals])

  const dismissError = useCallback(() => { setError(null); setStage('idle') }, [])

  // Retour utilisateur 2026-07-11 : "elle ne disparaît pas, elle reste" — ce
  // toast d'erreur était le seul de l'app sans auto-fermeture (contrairement
  // à receiptToast ci-dessus et à la convention par défaut de toast-provider.jsx,
  // 5000ms). Le X manuel reste disponible pour fermer plus tôt.
  useEffect(() => {
    if (stage !== 'error') return
    const timer = setTimeout(dismissError, 5000)
    return () => clearTimeout(timer)
  }, [stage, dismissError])

  return {
    receiptScanStage: stage,
    receiptScanError: error,
    matched, ambiguous, unmatchedCount, receiptToast,
    openReceiptScan,
    handleReceiptLoginRequiredClose,
    handleReceiptConsentCancel,
    handleFileSelected,
    handleReceiptAdd,
    handleReceiptCancel,
    dismissError,
  }
}
