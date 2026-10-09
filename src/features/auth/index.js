// Feature auth — façade publique.
// AuthProvider + useAuth = utilisés dans 31+ fichiers.
//
// Sprint 9 (S9.a.1 + S9.a.5c) : la majorité des modules auth a été
// déplacée en `shared/` (provider, hook MFA, API MFA, modales MFA,
// i18n MFA) pour respecter le flux unidirectionnel Bulletproof React.
// Cette façade conserve les re-exports pour compat ascendante.

// AuthModal retiré Sprint 11 S11.b.5 — remplacé par les pages routées
// /login, /signup, /auth/recovery (cf. routes-config.js).
// BannedScreen non réexporté ici : seul consommateur = lazy() dans
// app-modals-root.jsx — un réexport statique du barrel neutraliserait ce
// code-splitting (Rollup INEFFECTIVE_DYNAMIC_IMPORT). Importer directement
// '@features/auth/components/banned-screen' si besoin statique.

// Les modales MFA, `useMFA`, l'API et les textes MFA ne sont PLUS réexportés
// (2026-10-06) : main.jsx importait ce baril pour le seul AuthProvider, et ils
// entraient au démarrage de chaque visiteur (~4 Ko compressés). Personne ne les
// lisait par ici : les importer directement depuis `@shared/`.
// Garde-fou : `src/test/unit/demarrage-sans-poids-mort.test.js`.

// Re-exports depuis shared/ (Sprint 9)
export { AuthProvider, useAuth }         from '@shared/contexts/auth-provider'
