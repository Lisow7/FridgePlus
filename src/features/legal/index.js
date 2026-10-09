// Feature legal — façade publique
// Phase 3 restructuration architecture.
export { default as ConfidentialityPanel } from './components/confidentiality-panel'
export { default as CookieBanner }         from './components/cookie-banner'
export { default as CookieModal }          from './components/cookie-modal'
// LegalPage non réexporté ici : seul consommateur = lazy() dans
// routes-config.js — un réexport statique du barrel neutraliserait ce
// code-splitting (Rollup INEFFECTIVE_DYNAMIC_IMPORT). Importer directement
// '@features/legal/pages/legal-page' si besoin statique.
// Hook déplacé vers shared/ (Sprint 9 S9.a.5) — utilisé hors legal (sentry).
export { useConsent, hasConsentedSync, getConsentSync, CONSENT_VERSION } from '@shared/hooks/use-consent'
export { I18N as CONSENT_I18N }            from './i18n/consent-i18n'
export { getLegalSection, getTranslationFallbackNote } from './data/legal-content'
