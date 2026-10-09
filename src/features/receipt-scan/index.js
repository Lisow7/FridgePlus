// src/features/receipt-scan/index.js
export { default as ReceiptConsentScreen } from './components/receipt-consent-screen'
// ReceiptReviewPanel non réexporté ici : seul consommateur = lazy() dans
// receipt-scan-overlays.jsx — un réexport statique du barrel neutraliserait
// ce code-splitting (Rollup INEFFECTIVE_DYNAMIC_IMPORT). Importer
// directement '@features/receipt-scan/components/receipt-review-panel' si
// besoin statique.
export { scanReceiptImage } from './lib/receipt-vision-client'
export { matchReceiptLabels } from './lib/receipt-matcher'
export { compressImageToBase64 } from '@shared/lib/media/compress-image'
