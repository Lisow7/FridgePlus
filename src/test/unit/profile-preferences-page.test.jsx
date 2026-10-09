import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@shared/contexts/auth-provider', () => ({
  useAuth: () => ({
    updateProfile: vi.fn(),
    allergenPrefs: ['gluten'],
    updateAllergenPrefs: vi.fn(() => Promise.resolve({})),
  }),
}))

vi.mock('@shared/hooks/use-subscription', () => ({
  // Test user = Premium pour que la section Budget (Premium-gated) soit rendue.
  useSubscription: () => ({ hasPremiumAccess: true }),
}))

vi.mock('@shared/contexts/ui-provider', () => ({
  useLang:     () => ({ lang: 'fr', setLang: vi.fn() }),
  useDarkMode: () => ({ darkMode: false, toggleDarkMode: vi.fn() }),
}))

vi.mock('@shared/contexts/data-provider', () => ({
  useAllergenTypes: () => ({
    gluten:  { icon: '🌾', labels: { fr: 'Gluten',    en: 'Gluten' } },
    peanuts: { icon: '🥜', labels: { fr: 'Arachides', en: 'Peanuts' } },
  }),
  useCountries: () => ({
    FR: { names: { fr: 'France',     en: 'France' },         flag: '🇫🇷' },
    US: { names: { fr: 'États-Unis', en: 'United States' },  flag: '🇺🇸' },
  }),
}))

vi.mock('@features/profile/components/allergen-picker', () => ({
  default: () => <div data-testid="allergen-picker" />,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useOutletContext: () => ({
      lang: 'fr', darkMode: false,
      profile: { country_code: 'FR', monthly_budget: 300 },
    }),
  }
})

import ProfilePreferencesPage from '@features/profile/pages/profile-preferences-page'

describe('ProfilePreferencesPage (Sprint 11 S11.a.3)', () => {
  it('rend le titre Préférences et les 4 sections', () => {
    render(<MemoryRouter><ProfilePreferencesPage /></MemoryRouter>)
    expect(screen.getByRole('heading', { level: 1, name: /préférences/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /langue/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /pays/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /allergènes/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /budget/i })).toBeInTheDocument()
  })

  it('affiche le budget actif si défini', () => {
    render(<MemoryRouter><ProfilePreferencesPage /></MemoryRouter>)
    expect(screen.getByText(/300 € \/ mois/)).toBeInTheDocument()
  })

  it('monte AllergenPicker', () => {
    render(<MemoryRouter><ProfilePreferencesPage /></MemoryRouter>)
    expect(screen.getByTestId('allergen-picker')).toBeInTheDocument()
  })

  it('liste les pays disponibles avec leur drapeau', () => {
    render(<MemoryRouter><ProfilePreferencesPage /></MemoryRouter>)
    expect(screen.getByRole('option', { name: /France/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /États-Unis/ })).toBeInTheDocument()
  })
})
