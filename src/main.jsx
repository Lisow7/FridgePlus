import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import AccountSync from '@app/components/account-sync'
import BandeauSessionPerdue from '@app/components/bandeau-session-perdue'
import { effacerLesClesAbandonnees } from '@shared/lib/auth/cles-abandonnees'
// Directement, et non par le baril `@features/auth` : il réexportait les deux
// modales MFA et `useMFA`, qui entraient au démarrage de chaque visiteur (~4 Ko).
import { AuthProvider } from '@shared/contexts/auth-provider'
import PorteDoubleAuthentification from '@features/auth/components/porte-double-authentification'
import PorteDuCompteSupprime from '@features/auth/components/porte-du-compte-supprime'
import { DataProvider } from '@shared/contexts/data-provider'
import { FeatureFlagsProvider } from '@shared/contexts/feature-flags-provider'
import { UIProvider } from '@shared/contexts/ui-provider'
import { ToastProvider } from '@shared/ui/toast/toast-provider'
import { ConfirmProvider } from '@shared/ui/confirm-dialog/confirm-provider'
import { SessionStateProvider } from '@app/contexts/session-state-provider'
import { RecipeFormProvider } from '@app/contexts/recipe-form-provider'
import { DeletingRecipeProvider } from '@app/contexts/deleting-recipe-provider'
import ErrorBoundary from '@app/error/error-boundary'
import { initSentry } from '@shared/lib/observability/sentry'
import { ROUTES } from '@routes/routes-config'
import { prechargerLaRoute } from '@routes/precharger-la-route'
import { installerLaRecuperation } from '@features/pwa/lib/version-perimee'

// Avant tout chargement paresseux : un fichier disparu après un déploiement
// active la version neuve au lieu de laisser l'ancienne coincée (SEO-08).
installerLaRecuperation()

// L'adresse que gardait « Se souvenir de moi », en clair : effacée chez tous.
effacerLesClesAbandonnees()

// Phase 11 PR P11.c.5 — Différer initSentry() après idle.
// Avant (v3.225.0) : initSentry() appelé immédiatement → l'import
// dynamique de `@sentry/react` se résolvait pendant le critical path
// Lighthouse, qui comptait le chunk (132 KiB transfer) dans le bundle
// init même si techniquement chargé async.
// Maintenant : `requestIdleCallback` (fallback setTimeout 2s pour
// Safari/anciens navigateurs) → Sentry démarre quand le browser est
// idle, après le first paint + first interactive. Lighthouse ne compte
// plus le chunk dans le critical path.
// Trade-off : erreurs survenant entre boot et idle (~2-3s mobile) non
// remontées. Acceptable car ErrorBoundary affiche un fallback.
function deferSentry() {
  if (typeof window === 'undefined') return
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => { void initSentry() }, { timeout: 5000 })
  } else {
    setTimeout(() => { void initSentry() }, 2000)
  }
}
deferSentry()

// Helper de test des ErrorBoundary (uniquement en dev). Expose
// window.__crashApp() et window.__crashAdmin() dans la console pour
// déclencher les fallbacks sans modifier de fichier source.
if (import.meta.env.DEV) {
  import('@features/admin/lib/dev-crash-trigger').then(m => m.setupDevCrashTrigger())
}

// Introduction de react-router-dom pour les pages publiques
// (/legal, /changelog, /404). Le `basename` est lu depuis la config Vite :
// GitHub Pages sert sous `/FridgePlus/`, Vercel sous `/`. La même variable
// est déjà utilisée par le SW PWA pour `start_url` et `navigateFallback`,
// donc tout reste cohérent. `import.meta.env.BASE_URL` se termine par `/`,
// React Router veut un basename SANS slash final → on trim.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

// ErrorBoundary global au-dessus des providers : si un crash
// survient dans Auth/DataContext ou dans un sous-arbre non couvert par un
// boundary local, on affiche un fallback propre au lieu d'un écran blanc.
// La langue est hardcodée à 'fr' ici car on n'a pas encore accès au lang
// prop avant le rendu de App ; au pire l'écran d'erreur reste en FR.
//
// La page de la route courante est chargée AVANT le premier rendu (audit du
// 2026-10-04, PERF-05) : sur une page pré-rendue, React remplace le HTML servi
// par la page directement — avant, il posait un squelette le temps de la
// télécharger (texte, squelette, texte). Jamais plus de 3 s d'attente, et
// rien à attendre pour l'accueil.
prechargerLaRoute(window.location.pathname, ROUTES, import.meta.env.BASE_URL).then(() => createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Sans `lang` : le filet lit la langue du visiteur (il est au-dessus du fournisseur). */}
    <ErrorBoundary level="app">
      <BrowserRouter basename={basename}>
        <UIProvider>
          <ToastProvider>
            <ConfirmProvider>
            <AuthProvider>
              {/* Double authentification (audit du 2026-10-04, CPT-01) : tant
                  que le code est dû, rien d'autre ne se monte. */}
              <PorteDoubleAuthentification>
              {/* Suppression de compte (audit du 2026-10-04, lot 4) : « compte
                  désactivé », puis le choix explicite à la reconnexion. */}
              <PorteDuCompteSupprime>
              <DataProvider>
                {/* Vague 0 — FeatureFlagsProvider : charge les feature flags
                    (lecture publique) et les expose via useFeatureFlag. */}
                <FeatureFlagsProvider>
                {/* Sprint 11 S11.c.2 — SessionStateProvider :
                    lifte stock + favorites en context global pour
                    qu'ils soient accessibles depuis n'importe quelle
                    route (RecipePage cold-load, etc.) */}
                <SessionStateProvider>
                  {/* Sprint 11 S11.e.1 — RecipeFormProvider : state
                      du form de création/édition recette custom,
                      consommable depuis n'importe quelle route. */}
                  <RecipeFormProvider>
                    {/* Sprint 11 S11.e.2 — DeletingRecipeProvider :
                        state du dialog confirm suppression custom recipe. */}
                    <DeletingRecipeProvider>
                      <AccountSync />
                      <BandeauSessionPerdue />
                      <App />
                    </DeletingRecipeProvider>
                  </RecipeFormProvider>
                </SessionStateProvider>
                </FeatureFlagsProvider>
              </DataProvider>
              </PorteDuCompteSupprime>
              </PorteDoubleAuthentification>
            </AuthProvider>
            </ConfirmProvider>
          </ToastProvider>
        </UIProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
))
