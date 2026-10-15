import LoadErrorNotice from '@shared/ui/load-error-notice'

// « Ton activité n'a pas pu être chargée » — pour les onglets Activité et
// Récompenses du profil.
//
// Avant le 2026-10-04 un chargement raté affichait leur état VIDE (« Aucune
// statistique pour l'instant », tous les paliers verrouillés) : la personne
// croyait avoir perdu son historique (audit CPT-11).
const I18N = {
  fr: {
    message: 'Ton activité n’a pas pu être chargée.',
    hint: 'Rien n’est perdu : c’est le chargement qui a échoué.',
    retry: 'Réessayer',
  },
  en: {
    message: 'Your activity could not be loaded.',
    hint: 'Nothing is lost: only the loading failed.',
    retry: 'Try again',
  },
}

export default function ProfileLoadError({ lang = 'fr', onRetry, textColor, mutedColor }) {
  const t = I18N[lang] ?? I18N.fr
  return (
    <LoadErrorNotice
      message={t.message} hint={t.hint} retryLabel={t.retry} onRetry={onRetry}
      textColor={textColor} mutedColor={mutedColor}
    />
  )
}
