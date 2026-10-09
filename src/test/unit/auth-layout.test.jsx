import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AuthLayout from '@features/auth/components/auth-layout'

describe('AuthLayout — branding', () => {
  it('le titre rend exactement « Fridge+ » (pas « Fridge++ »)', () => {
    render(<AuthLayout lang="fr"><div /></AuthLayout>)
    const h1 = screen.getByRole('heading', { level: 1 })
    // textContent strict : « Fridge » + « + » = « Fridge+ » (le bug donnait « Fridge++ »)
    expect(h1.textContent).toBe('Fridge+')
  })

  it('idem en anglais', () => {
    render(<AuthLayout lang="en"><div /></AuthLayout>)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Fridge+')
  })
})
