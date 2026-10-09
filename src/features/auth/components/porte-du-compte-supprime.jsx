import { lazy, Suspense } from 'react'
import { useAuth } from '@shared/contexts/auth-provider'

// Les écrans de la suppression de compte (audit du 2026-10-04, lot 4 ;
// maquettes validées par Antoine le 2026-10-05), à la place de l'application :
//   · « Compte désactivé », juste après la suppression — même déconnecté ;
//   · « Ton compte est en cours de suppression », à la reconnexion pendant les
//     30 jours : le choix explicite qui remplace l'annulation silencieuse.
// Montée dans `main.jsx` sous AuthProvider ; écrans chargés à la demande.
const CompteDesactive = lazy(() => import('./compte-desactive'))
const SuppressionEnCours = lazy(() => import('./suppression-en-cours'))

const FOND = <div style={{ minHeight: '100dvh', background: 'var(--color-cream)' }} />

export default function PorteDuCompteSupprime({ children }) {
  const { user, profile, compteDesactive } = useAuth()
  if (compteDesactive) return <Suspense fallback={FOND}><CompteDesactive /></Suspense>
  if (user && profile?.deleted_at) return <Suspense fallback={FOND}><SuppressionEnCours /></Suspense>
  return children
}
