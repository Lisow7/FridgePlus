import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LangThemePrefs from '@shared/ui/lang-theme-prefs'

describe('LangThemePrefs', () => {
  it('rend un radiogroup langue avec FR et EN', () => {
    render(<LangThemePrefs lang="fr" />)
    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
    expect(screen.getByRole('menuitemradio', { name: 'Français' })).toBeInTheDocument()
    expect(screen.getByRole('menuitemradio', { name: /English/ })).toBeInTheDocument()
  })

  it('marque la langue active avec aria-checked', () => {
    render(<LangThemePrefs lang="fr" />)
    expect(screen.getByRole('menuitemradio', { name: 'Français' })).toHaveAttribute('aria-checked', 'true')
  })

  it('EN accessible à tous (launch bilingue FR+EN)', () => {
    render(<LangThemePrefs lang="fr" />)
    expect(screen.getByRole('menuitemradio', { name: /English/ })).not.toBeDisabled()
  })

  it('appelle onLangChange au clic sur une langue accessible', async () => {
    const onLangChange = vi.fn()
    const user = userEvent.setup()
    render(<LangThemePrefs lang="fr" isAdmin onLangChange={onLangChange} />)
    await user.click(screen.getByRole('menuitemradio', { name: 'English' }))
    expect(onLangChange).toHaveBeenCalledWith('en')
  })

  it('appelle onDarkModeToggle au clic sur le thème', async () => {
    const onDarkModeToggle = vi.fn()
    const user = userEvent.setup()
    render(<LangThemePrefs lang="fr" darkMode={false} onDarkModeToggle={onDarkModeToggle} />)
    await user.click(screen.getByRole('menuitem', { name: /Mode sombre/ }))
    expect(onDarkModeToggle).toHaveBeenCalledOnce()
  })
})
