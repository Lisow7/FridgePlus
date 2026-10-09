// Tests unit — CPHeader (en-tête de l'espace communauté), extrait de
// community-page.jsx (audit front §2). Dernier bloc du découpage.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { CPHeader } from '@features/community/components/community-header'
import { COMMUNITY_I18N } from '@shared/lib/i18n/community-i18n'

const t = {
  title: 'Communauté', backToFeed: 'Retour au fil', newPostBtn: 'Nouveau post',
  loginToPost: 'Connecte-toi pour publier', mutedBanner: 'Tu es muté',
  termsDeclinedBanner: 'Charte refusée', prefsCommunityTitle: 'Charte',
  searchAria: 'Rechercher', searchPh: 'Rechercher un post…',
  themeLight: 'Mode clair', themeDark: 'Mode sombre',
}
const base = {
  view: 'feed', onBack: vi.fn(), onCompose: vi.fn(),
  showSearch: false, setShowSearch: vi.fn(), search: '', setSearch: vi.fn(),
  canInteract: true, muteStatus: { muted: false }, user: { id: 'u1' },
  t, isMobile: false, darkMode: false,
}

describe('CPHeader', () => {
  it('vue feed : titre en majuscules et bouton de publication', () => {
    render(<CPHeader {...base} />)
    expect(screen.getByText('COMMUNAUTÉ')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nouveau post' })).toBeEnabled()
  })

  it('vue détail : le titre laisse place au libellé de retour', () => {
    render(<CPHeader {...base} view="detail" />)
    expect(screen.queryByText('COMMUNAUTÉ')).not.toBeInTheDocument()
    expect(screen.getAllByText('Retour au fil').length).toBeGreaterThan(0)
  })

  it('le bouton retour appelle onBack', () => {
    const onBack = vi.fn()
    render(<CPHeader {...base} onBack={onBack} />)
    fireEvent.click(screen.getByRole('button', { name: 'Retour au fil' }))
    expect(onBack).toHaveBeenCalled()
  })

  it('la recherche se bascule et son champ n’apparaît qu’ouverte, sur le feed', () => {
    const setShowSearch = vi.fn()
    const { rerender } = render(<CPHeader {...base} setShowSearch={setShowSearch} />)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }))
    expect(setShowSearch).toHaveBeenCalled()

    rerender(<CPHeader {...base} showSearch />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()

    rerender(<CPHeader {...base} showSearch view="detail" />)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('visiteur non connecté : invitation à se connecter, pas de bouton publier', () => {
    render(<CPHeader {...base} user={null} />)
    expect(screen.getByText('Connecte-toi pour publier')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nouveau post' })).not.toBeInTheDocument()
  })

  it('membre muté : bouton publier désactivé et explique pourquoi', () => {
    render(<CPHeader {...base} canInteract={false} muteStatus={{ muted: true }} />)
    const btn = screen.getByRole('button', { name: 'Nouveau post' })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('title', 'Tu es muté')
  })

  it('boutons optionnels : thème et charte seulement si leurs handlers sont fournis', () => {
    const { rerender } = render(<CPHeader {...base} />)
    expect(screen.queryByRole('button', { name: 'Charte' })).not.toBeInTheDocument()

    const onToggleDarkMode = vi.fn()
    const onShowCharter = vi.fn()
    rerender(<CPHeader {...base} onToggleDarkMode={onToggleDarkMode} onShowCharter={onShowCharter} />)
    fireEvent.click(screen.getByRole('button', { name: 'Charte' }))
    expect(onShowCharter).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Mode sombre' }))
    expect(onToggleDarkMode).toHaveBeenCalled()
  })

  // Régression : recherche et bascule de thème avaient leurs libellés écrits en
  // français dans le JSX — ils restaient en français quelle que soit la langue.
  it('en anglais : recherche, thème et champ de saisie sont traduits', () => {
    const en = COMMUNITY_I18N.en
    const { rerender } = render(<CPHeader {...base} t={en} onToggleDarkMode={vi.fn()} showSearch />)

    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dark mode' })).toBeInTheDocument()
    // Libellé visible + exemple grisé (décision du 2026-10-06).
    expect(screen.getByLabelText('Search posts')).toHaveAttribute('placeholder', 'e.g. risotto, pancake batter')

    rerender(<CPHeader {...base} t={en} onToggleDarkMode={vi.fn()} showSearch darkMode />)
    expect(screen.getByRole('button', { name: 'Light mode' })).toBeInTheDocument()
  })
})
