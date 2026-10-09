import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const updateProfile = vi.hoisted(() => vi.fn())
const updateAllergenPrefs = vi.hoisted(() => vi.fn())
const signaler = vi.hoisted(() => vi.fn())

vi.mock('@shared/contexts/auth-provider', () => ({
  useAuth: () => ({ updateProfile, allergenPrefs: ['gluten'], updateAllergenPrefs }),
}))
vi.mock('@shared/hooks/use-save-error-toast', () => ({ useSaveErrorToast: () => signaler }))
vi.mock('@shared/hooks/use-subscription', () => ({ useSubscription: () => ({ hasPremiumAccess: true }) }))
vi.mock('@shared/contexts/ui-provider', () => ({
  useLang:     () => ({ lang: 'fr', setLang: vi.fn() }),
  useDarkMode: () => ({ darkMode: false, toggleDarkMode: vi.fn() }),
}))
vi.mock('@shared/contexts/data-provider', () => ({
  useAllergenTypes: () => ({ gluten: { icon: '🌾', labels: { fr: 'Gluten', en: 'Gluten' } } }),
  useCountries: () => ({
    FR: { names: { fr: 'France', en: 'France' }, flag: '🇫🇷' },
    US: { names: { fr: 'États-Unis', en: 'United States' }, flag: '🇺🇸' },
  }),
}))
// Le sélecteur d'allergènes porte son propre bouton d'enregistrement.
vi.mock('@features/profile/components/allergen-picker', () => ({
  default: ({ onSave, isSaved }) => (
    <div>
      <button type="button" onClick={onSave}>Enregistrer les allergènes</button>
      {isSaved && <span role="status">✓ allergènes</span>}
    </div>
  ),
}))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useOutletContext: () => ({
      lang: 'fr', darkMode: false,
      profile: { country_code: 'FR', monthly_budget: 300, per_trip_budget: 60, fridge_shape: 'top-freezer' },
    }),
  }
})

import ProfilePreferencesPage from '@features/profile/pages/profile-preferences-page'

// Audit du 2026-10-04, CPT-11 : sur cette page, une écriture refusée ne disait
// rien. Les budgets ne regardaient même pas le résultat ; « Retirer » vidait le
// champ comme si c'était fait. Pour les allergènes — un réglage de sécurité
// alimentaire — la personne se croyait protégée.
const REFUS = { error: { message: 'Failed to fetch' } }
const OK = { error: null }
const monter = () => render(<MemoryRouter><ProfilePreferencesPage /></MemoryRouter>)

describe('Préférences — écriture refusée par la base', () => {
  beforeEach(() => {
    updateProfile.mockReset(); updateProfile.mockResolvedValue(OK)
    updateAllergenPrefs.mockReset(); updateAllergenPrefs.mockResolvedValue(OK)
    signaler.mockReset()
  })

  it('pays refusé : « Pas enregistré », et pas de « ✓ »', async () => {
    updateProfile.mockResolvedValue(REFUS)
    monter()
    fireEvent.change(screen.getByRole('combobox', { name: /pays/i }), { target: { value: 'US' } })
    await waitFor(() => expect(signaler).toHaveBeenCalledWith('setting'))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('pays accepté : « ✓ », et rien d’autre (témoin)', async () => {
    monter()
    fireEvent.change(screen.getByRole('combobox', { name: /pays/i }), { target: { value: 'US' } })
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument())
    expect(signaler).not.toHaveBeenCalled()
  })

  it('forme du frigo refusée : « Pas enregistré »', async () => {
    updateProfile.mockResolvedValue(REFUS)
    monter()
    fireEvent.click(screen.getAllByRole('radio')[1])
    await waitFor(() => expect(signaler).toHaveBeenCalledWith('setting'))
  })

  it('allergènes refusés : « Pas enregistré », et pas de « ✓ »', async () => {
    updateAllergenPrefs.mockResolvedValue(REFUS)
    monter()
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les allergènes' }))
    await waitFor(() => expect(signaler).toHaveBeenCalledWith('setting'))
    expect(updateAllergenPrefs).toHaveBeenCalledWith(['gluten'])
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('allergènes acceptés : « ✓ » (témoin)', async () => {
    monter()
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les allergènes' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('✓ allergènes'))
    expect(signaler).not.toHaveBeenCalled()
  })

  it('budget mensuel refusé : « Pas enregistré »', async () => {
    updateProfile.mockResolvedValue(REFUS)
    monter()
    fireEvent.change(screen.getByRole('spinbutton', { name: /budget du mois/i }), { target: { value: '250' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Enregistrer' })[0])
    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ monthly_budget: 250 }))
    await waitFor(() => expect(signaler).toHaveBeenCalledWith('setting'))
  })

  it('retrait du budget refusé : le champ garde sa valeur', async () => {
    updateProfile.mockResolvedValue(REFUS)
    monter()
    const champ = screen.getByRole('spinbutton', { name: /budget du mois/i })
    expect(champ).toHaveValue(300)
    fireEvent.click(screen.getAllByRole('button', { name: /supprimer la limite/i })[0])
    await waitFor(() => expect(signaler).toHaveBeenCalledWith('setting'))
    expect(champ).toHaveValue(300)
  })

  it('retrait du budget accepté : le champ est vidé (témoin)', async () => {
    monter()
    const champ = screen.getByRole('spinbutton', { name: /budget du mois/i })
    fireEvent.click(screen.getAllByRole('button', { name: /supprimer la limite/i })[0])
    await waitFor(() => expect(champ).toHaveValue(null))
    expect(signaler).not.toHaveBeenCalled()
  })

  it('budget par course refusé : « Pas enregistré », et « Retirer » ne vide pas le champ', async () => {
    updateProfile.mockResolvedValue(REFUS)
    monter()
    const champs = screen.getAllByRole('spinbutton')
    const parCourse = champs[1]
    expect(parCourse).toHaveValue(60)
    fireEvent.click(screen.getAllByRole('button', { name: /supprimer la limite/i })[1])
    await waitFor(() => expect(signaler).toHaveBeenCalledWith('setting'))
    expect(parCourse).toHaveValue(60)
  })

  it('un appel qui lève ne casse pas la page', async () => {
    updateProfile.mockRejectedValue(new TypeError('Failed to fetch'))
    monter()
    fireEvent.change(screen.getByRole('combobox', { name: /pays/i }), { target: { value: 'US' } })
    await waitFor(() => expect(signaler).toHaveBeenCalledWith('setting'))
  })
})
