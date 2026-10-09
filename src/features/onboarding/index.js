// Feature onboarding — façade publique
// Phase 3 restructuration architecture.
// Ajout WelcomeScreen (PR 8.6.3).
export { default as HelpGuide }      from './components/help-guide'
// TourWizard et WelcomeScreen ne passent plus par ici : importés par le baril, ils
// partaient dans le démarrage (global-overlays charge la bienvenue à la demande).
export { hasSeenWelcome, markWelcomeSeen, shouldOpenWelcome } from './lib/welcome-storage'
export { default as GettingStartedCard } from './components/getting-started-card'
export { default as GettingStartedContainer } from './components/getting-started-container'
export { markSuggestionOpened } from './lib/getting-started-storage'
