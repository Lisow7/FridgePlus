import { useState } from 'react'
import { useAuth } from '@shared/contexts/auth-provider'
import { useConfirm } from '@shared/ui/confirm-dialog/confirm-provider'
import { useSaveErrorToast } from '@shared/hooks/use-save-error-toast'

// L'accord avant d'enregistrer ses allergènes dans son compte (décision du
// 2026-10-06, « allergenes = case » ; RGPD art. 9.2.a : une donnée de santé ne
// s'enregistre qu'avec un accord explicite). La base date l'accord ; décocher
// le retire et efface les allergènes, après confirmation. Un invité garde les
// siens sur son appareil : rien à afficher.

const I18N = {
  fr: {
    accord: "J’accepte que Fridge+ enregistre mes allergènes pour filtrer les recettes. Ce sont des données de santé ; je peux les effacer à tout moment.",
    retraitTitre: 'Retirer ton accord ?',
    retraitTexte: 'Tes allergènes enregistrés seront effacés. Tu pourras les choisir de nouveau en redonnant ton accord.',
    retraitOk: 'Retirer et effacer',
  },
  en: {
    accord: 'I agree that Fridge+ saves my allergens to filter recipes. This is health data; I can delete it at any time.',
    retraitTitre: 'Withdraw your consent?',
    retraitTexte: 'Your saved allergens will be deleted. You can choose them again by giving your consent again.',
    retraitOk: 'Withdraw and delete',
  },
}

export default function AllergenConsent(props) {
  const { user } = useAuth()
  return user ? <CaseDuCompte {...props} /> : null
}

function CaseDuCompte({ lang = 'fr', onRetire, style }) {
  const { allergenConsentAt, acceptAllergenConsent, withdrawAllergenConsent } = useAuth()
  const confirm = useConfirm()
  const signalerEchec = useSaveErrorToast()
  // La valeur visée pendant l'enregistrement : la case répond tout de suite,
  // et revient si la base refuse.
  const [enCours, setEnCours] = useState(null)
  const t = I18N[lang] ?? I18N.fr

  async function changer(e) {
    const donner = e.target.checked
    if (!donner && !(await confirm({ title: t.retraitTitre, body: t.retraitTexte, confirmLabel: t.retraitOk, danger: true }))) return
    setEnCours(donner)
    const { error } = donner ? await acceptAllergenConsent() : await withdrawAllergenConsent()
    setEnCours(null)
    if (error) signalerEchec('setting')
    else if (!donner) onRetire?.()
  }

  return (
    <label className="flex items-start gap-2 text-xs" style={{ color: 'var(--color-charcoal)', cursor: 'pointer', ...style }}>
      <input type="checkbox" checked={enCours ?? !!allergenConsentAt} onChange={changer} disabled={enCours !== null} style={{ marginTop: 2, flexShrink: 0 }} />
      <span>{t.accord}</span>
    </label>
  )
}
