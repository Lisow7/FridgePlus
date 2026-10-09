import LoadErrorNotice from '@shared/ui/load-error-notice'

// L'état d'une liste du panneau qui n'a PAS pu être lue — jamais son état vide
// (audit du 2026-10-04, ADM-08). « Accès refusé » seulement pour un vrai refus
// de droits (42501) : deux écrans le disaient pour n'importe quelle erreur,
// coupure réseau comprise.
export default function ChargementRate({ error, onRetry, lang = 'fr', message }) {
  const fr = lang === 'fr'
  const cause = error?.code === '42501'
    ? (fr ? 'Accès refusé par la base.' : 'Access denied by the database.')
    : (error?.message || (fr ? 'Erreur inconnue.' : 'Unknown error.'))
  return (
    <div style={{ padding: '20px 0' }}>
      <LoadErrorNotice
        message={message ?? (fr ? 'Le chargement a échoué.' : 'Loading failed.')}
        hint={cause}
        retryLabel={fr ? 'Réessayer' : 'Try again'}
        onRetry={onRetry}
        textColor="var(--color-danger)"
      />
    </div>
  )
}
