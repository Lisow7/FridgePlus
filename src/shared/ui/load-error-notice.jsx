import Button from '@shared/ui/button'

// « … n'a pas pu être chargé » + « Réessayer » — l'état d'une zone dont le
// chargement a échoué.
//
// Trois états à ne pas confondre : en cours, chargé (éventuellement vide), PAS
// CHARGÉ. Jusqu'au 2026-10-04 beaucoup de lectures rendaient du vide sur
// erreur, et les écrans affichaient leur état vide (« Aucun avis », « Aucune
// statistique ») : la personne croyait qu'il n'y avait rien, ou qu'elle avait
// tout perdu. Ce composant est l'affichage commun du troisième état ; les
// textes viennent de l'appelant, qui sait ce qu'il chargeait.
//
//   <LoadErrorNotice message="Les avis n'ont pas pu être chargés."
//                    retryLabel="Réessayer" onRetry={recharger} />
export default function LoadErrorNotice({ message, hint = null, retryLabel, onRetry, textColor, mutedColor }) {
  return (
    <div role="alert" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
      <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, color: textColor }}>
        <strong style={{ fontWeight: 700 }}>{message}</strong>
        {hint && <>{' '}<span style={{ color: mutedColor }}>{hint}</span></>}
      </p>
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>{retryLabel}</Button>}
    </div>
  )
}
