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

// Re-exports depuis shared/ (Sprint 9)
export { AuthProvider, useAuth }         from '@shared/contexts/auth-provider'
export { default as MFAEnrollModal }     from '@shared/ui/mfa-enroll-modal'
export { default as MFAChallengeModal }  from '@shared/ui/mfa-challenge-modal'
export { useMFA }                        from '@shared/hooks/use-mfa'
export * from '@shared/api/mfa'
export { MFA_I18N }                      from '@shared/lib/i18n/mfa-i18n'
