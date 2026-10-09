import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Décision du 2026-10-06, choix d'Antoine (« allergenes = case ») : « le
// RGPD demande un accord explicite pour une donnée de santé ». Pour un compte,
// une case avant le premier enregistrement ; la décocher retire l'accord et
// efface les allergènes. Un invité garde les siens sur son appareil : pas de case.

const etat = vi.hoisted(() => ({ auth: null, confirme: true }))
const signaler = vi.hoisted(() => vi.fn())
const picker = vi.hoisted(() => ({ props: null }))

vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => etat.auth }))
vi.mock('@shared/hooks/use-save-error-toast', () => ({ useSaveErrorToast: () => signaler }))
vi.mock('@shared/ui/confirm-dialog/confirm-provider', () => ({ useConfirm: () => vi.fn(async () => etat.confirme) }))
vi.mock('@shared/hooks/use-subscription', () => ({ useSubscription: () => ({ hasPremiumAccess: true }) }))
vi.mock('@shared/contexts/ui-provider', () => ({
  useLang: () => ({ lang: 'fr', setLang: vi.fn() }),
  useDarkMode: () => ({ darkMode: false, toggleDarkMode: vi.fn() }),
}))
vi.mock('@shared/contexts/data-provider', () => ({
  useAllergenTypes: () => ({
    gluten: { icon: '🌾', labels: { fr: 'Gluten', en: 'Gluten' } },
    lait: { icon: '🥛', labels: { fr: 'Lait', en: 'Milk' } },
  }),
  useCountries: () => ({ FR: { names: { fr: 'France', en: 'France' }, flag: '🇫🇷' } }),
}))
vi.mock('@features/profile/components/allergen-picker', () => ({
  default: (props) => { picker.props = props; return <div data-testid="picker" /> },
}))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useOutletContext: () => ({ lang: 'fr', darkMode: false, profile: { country_code: 'FR', fridge_shape: 'top-freezer' } }) }
})

import AllergenPrefsChips from '@features/recipes/components/filters/allergen-prefs-chips'
import ProfilePreferencesPage from '@features/profile/pages/profile-preferences-page'

const TEXTE = /J'accepte que Fridge\+ enregistre mes allergènes pour filtrer les recettes\. Ce sont des données de santé ; je peux les effacer à tout moment\./

function compte(accord, autres = {}) {
  return {
    user: { id: 'u1' }, allergenPrefs: [], allergenConsentAt: accord,
    updateAllergenPrefs: vi.fn().mockResolvedValue({ error: null }),
    acceptAllergenConsent: vi.fn().mockResolvedValue({ error: null }),
    withdrawAllergenConsent: vi.fn().mockResolvedValue({ error: null }),
    updateProfile: vi.fn().mockResolvedValue({ error: null }),
    ...autres,
  }
}

beforeEach(() => { signaler.mockReset(); etat.confirme = true; picker.props = null })

describe('tiroir des filtres : la case avant le premier allergène', () => {
  it('compte sans accord : la case est là, décochée, et les puces ne répondent pas', () => {
    etat.auth = compte(null)
    render(<AllergenPrefsChips lang="fr" />)
    expect(screen.getByRole('checkbox', { name: TEXTE })).not.toBeChecked()
    const gluten = screen.getByRole('button', { name: /Gluten/ })
    expect(gluten).toBeDisabled()
    fireEvent.click(gluten)
    expect(etat.auth.updateAllergenPrefs).not.toHaveBeenCalled()
  })

  it('cocher la case donne l’accord', async () => {
    etat.auth = compte(null)
    render(<AllergenPrefsChips lang="fr" />)
    fireEvent.click(screen.getByRole('checkbox', { name: TEXTE }))
    await waitFor(() => expect(etat.auth.acceptAllergenConsent).toHaveBeenCalledTimes(1))
    expect(signaler).not.toHaveBeenCalled()
  })

  it('accord refusé par la base : « Pas enregistré »', async () => {
    etat.auth = compte(null, { acceptAllergenConsent: vi.fn().mockResolvedValue({ error: { message: 'Failed to fetch' } }) })
    render(<AllergenPrefsChips lang="fr" />)
    fireEvent.click(screen.getByRole('checkbox', { name: TEXTE }))
    await waitFor(() => expect(signaler).toHaveBeenCalledWith('setting'))
  })

  it('la case se coche tout de suite pendant l’enregistrement, et revient si la base refuse', async () => {
    let refuser
    etat.auth = compte(null, { acceptAllergenConsent: vi.fn(() => new Promise((r) => { refuser = () => r({ error: { message: 'Failed to fetch' } }) })) })
    render(<AllergenPrefsChips lang="fr" />)
    const accord = screen.getByRole('checkbox', { name: TEXTE })
    fireEvent.click(accord)
    expect(accord).toBeChecked()
    refuser()
    await waitFor(() => expect(accord).not.toBeChecked())
    expect(signaler).toHaveBeenCalledWith('setting')
  })

  it('avec l’accord : la case est cochée, et les puces enregistrent', async () => {
    etat.auth = compte('2026-10-06T12:00:00Z')
    render(<AllergenPrefsChips lang="fr" />)
    expect(screen.getByRole('checkbox', { name: TEXTE })).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: /Gluten/ }))
    await waitFor(() => expect(etat.auth.updateAllergenPrefs).toHaveBeenCalledWith(['gluten']))
  })

  it('décocher, puis confirmer : l’accord est retiré (et les allergènes effacés)', async () => {
    etat.auth = compte('2026-10-06T12:00:00Z', { allergenPrefs: ['gluten'] })
    render(<AllergenPrefsChips lang="fr" />)
    fireEvent.click(screen.getByRole('checkbox', { name: TEXTE }))
    await waitFor(() => expect(etat.auth.withdrawAllergenConsent).toHaveBeenCalledTimes(1))
  })

  it('décocher, puis renoncer : rien ne change', async () => {
    etat.confirme = false
    etat.auth = compte('2026-10-06T12:00:00Z', { allergenPrefs: ['gluten'] })
    render(<AllergenPrefsChips lang="fr" />)
    fireEvent.click(screen.getByRole('checkbox', { name: TEXTE }))
    await new Promise((r) => setTimeout(r, 0))
    expect(etat.auth.withdrawAllergenConsent).not.toHaveBeenCalled()
  })

  it('invité : pas de case, ses allergènes restent sur l’appareil', () => {
    etat.auth = { user: null, allergenPrefs: [], allergenConsentAt: null, updateAllergenPrefs: vi.fn().mockResolvedValue({ error: null }) }
    render(<AllergenPrefsChips lang="fr" />)
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Gluten/ }))
    expect(etat.auth.updateAllergenPrefs).toHaveBeenCalledWith(['gluten'])
  })
})

describe('page Préférences : la même case', () => {
  const monter = () => render(<MemoryRouter><ProfilePreferencesPage /></MemoryRouter>)

  it('sans accord : la case, et le sélecteur d’allergènes grisé', () => {
    etat.auth = compte(null)
    monter()
    expect(screen.getByRole('checkbox', { name: TEXTE })).not.toBeChecked()
    expect(picker.props.disabled).toBe(true)
  })

  it('avec l’accord : le sélecteur répond', () => {
    etat.auth = compte('2026-10-06T12:00:00Z')
    monter()
    expect(screen.getByRole('checkbox', { name: TEXTE })).toBeChecked()
    expect(picker.props.disabled).toBe(false)
  })
})

describe('l’export de ses données (RGPD art. 15 et 20) contient la date de l’accord', () => {
  it('allergen_consent_at est lue avec les allergènes', async () => {
    const { readFileSync } = await import('node:fs')
    const source = readFileSync('src/features/profile/api/data-export.js', 'utf8')
    expect(source).toMatch(/'allergen_prefs, allergen_consent_at, /)
  })
})

describe('la politique dit la base légale des allergènes', () => {
  it('fr et en : accord explicite (art. 9.2.a), retirable, effacement au retrait ; l’invité les garde sur son appareil', async () => {
    const { getLegalSection } = await import('@features/legal/data/legal-content')
    const fr = JSON.stringify(getLegalSection('fr', 'privacy'))
    const en = JSON.stringify(getLegalSection('en', 'privacy'))
    expect(fr).toMatch(/Allergènes \(données de santé\) : enregistrés dans ton compte seulement avec ton accord explicite, effaçables à tout moment — un invité les garde sur son appareil/)
    expect(fr).toMatch(/Allergènes enregistrés dans ton compte → consentement explicite \(Art\. 9\.2\.a\), retirable à tout moment : ils sont alors effacés/)
    expect(en).toMatch(/Allergens \(health data\): saved to your account only with your explicit consent, deletable at any time — a guest keeps them on their device/)
    expect(en).toMatch(/Allergens saved to your account → explicit consent \(Art\. 9\.2\.a\), withdrawable at any time: they are then deleted/)
  })
})
