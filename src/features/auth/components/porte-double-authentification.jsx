import { lazy, Suspense } from 'react'
import { useAuth } from '@shared/contexts/auth-provider'

// La porte de la double authentification (audit du 2026-10-04, CPT-01,
// CPT-02 ; maquette validée par Antoine le 2026-10-05).
//
// Montée dans `main.jsx` juste sous `AuthProvider` : tant que le code est dû
// (session au mot de passe seul d'un compte protégé — connexion, retour de
// Google, lien « mot de passe oublié »), RIEN d'autre n'est rendu. Ni l'app, ni
// le catalogue, ni la synchronisation du frigo : aucune activité du compte
// avant le code.
//
// L'écran est chargé à la demande : il ne pèse rien au démarrage, pour tous
// ceux qui n'ont pas de code à donner. Pendant son chargement, un fond nu —
// jamais l'application.
const VerificationEnDeuxEtapes = lazy(() => import('./verification-en-deux-etapes'))

export default function PorteDoubleAuthentification({ children }) {
  const { mfaRequired } = useAuth()
  if (!mfaRequired) return children
  return (
    <Suspense fallback={<div style={{ minHeight: '100dvh', background: 'var(--color-cream)' }} />}>
      <VerificationEnDeuxEtapes />
    </Suspense>
  )
}
