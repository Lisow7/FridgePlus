import { useAuth } from '@shared/contexts/auth-provider'
import { useAllergenTypes } from '@shared/contexts/data-provider'
import { useSaveErrorToast } from '@shared/hooks/use-save-error-toast'
import AllergenConsent from '@shared/ui/allergen-consent'
import FilterChips from './filter-chips'

const I18N = {
  fr: {
    label: 'Mes allergènes',
    hintGuest: 'Signalés sur les cartes — gardés sur cet appareil.',
    hintUser: 'Signalés sur les cartes — enregistrés dans ton profil.',
  },
  en: {
    label: 'My allergens',
    hintGuest: 'Flagged on the cards — kept on this device.',
    hintUser: 'Flagged on the cards — saved to your profile.',
  },
}

const ALLERGEN_COLORS = { border: '#C0392B', bg: 'rgba(192,57,43,0.10)', text: '#A93226' }

// P7 (audit d'intuitivité du 2026-10-02) : les allergènes ne se réglaient que
// dans /profile/preferences, réservé aux comptes. `updateAllergenPrefs` les
// garde déjà sur l'appareil pour un invité et dans le profil pour un compte :
// la section est donc ouverte à tous, là où l'on choisit ses recettes.
// Préférence, pas filtre : « Tout effacer » du tiroir n'y touche pas.
export default function AllergenPrefsChips({ lang = 'fr', darkMode = false }) {
  const { user, allergenPrefs = [], updateAllergenPrefs, allergenConsentAt } = useAuth()
  // Un compte sans accord : la case d'abord (décision du 2026-10-06).
  const sansAccord = !!user && !allergenConsentAt
  const allergenTypes = useAllergenTypes() ?? {}
  const t = I18N[lang] ?? I18N.fr
  const signalerEchec = useSaveErrorToast()

  if (Object.keys(allergenTypes).length === 0) return null

  // Si l'écriture est refusée, le fournisseur remet la puce comme avant ; ici
  // on le dit — sur un allergène, un réglage qui ne tient pas doit se voir.
  const toggle = async (key) => {
    if (sansAccord) return
    const resultat = await updateAllergenPrefs?.(
      allergenPrefs.includes(key) ? allergenPrefs.filter(k => k !== key) : [...allergenPrefs, key],
    )
    if (resultat?.error) signalerEchec('setting')
  }

  return (
    <div className="flex flex-col gap-1.5">
      <FilterChips
        label={t.label}
        values={new Set(allergenPrefs)}
        onToggle={toggle}
        options={Object.entries(allergenTypes).map(([key, a]) => ({
          value: key,
          label: `${a?.icon ? `${a.icon} ` : ''}${a?.labels?.[lang] ?? a?.labels?.fr ?? key}`,
        }))}
        darkMode={darkMode}
        getColor={() => ALLERGEN_COLORS}
        disabled={sansAccord}
      />
      <AllergenConsent lang={lang} />
      <p className="text-xs" style={{ color: 'var(--color-muted)', margin: 0 }}>
        {user ? t.hintUser : t.hintGuest}
      </p>
    </div>
  )
}
