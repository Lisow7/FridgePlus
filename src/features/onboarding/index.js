// Feature onboarding — façade publique
// Phase 3 restructuration architecture.
// Ajout WelcomeScreen (PR 8.6.3).
export { default as HelpGuide }      from './components/help-guide'
export { default as TourWizard }     from './components/tour-wizard'
export { default as WelcomeScreen } from './components/welcome-screen'
export { hasSeenWelcome, markWelcomeSeen, shouldOpenWelcome } from './lib/welcome-storage'
export { default as GettingStartedCard } from './components/getting-started-card'
export { default as GettingStartedContainer } from './components/getting-started-container'
export { markSuggestionOpened } from './lib/getting-started-storage'
