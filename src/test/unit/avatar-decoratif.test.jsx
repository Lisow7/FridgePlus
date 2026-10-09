import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AvatarImg from '@shared/ui/avatar-img'

// Audit du 2026-10-04, A11Y-19 : le garde-fou axe connecté a relevé
// `image-alt` (critique) sur CHAQUE écran — l'avatar de l'en-tête. `alt` valait
// l'identifiant (« chef-1 », lu tel quel), et disparaissait quand le compte
// n'avait pas encore choisi d'avatar. L'avatar accompagne toujours un nom ou
// un bouton déjà nommé : il est décoratif.

describe('AvatarImg', () => {
  it('décoratif par défaut : alt vide, même sans avatar choisi', () => {
    const { container } = render(<AvatarImg avatarId={undefined} />)
    expect(container.querySelector('img')).toHaveAttribute('alt', '')
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('avec un avatar : toujours décoratif, jamais l’identifiant lu à voix haute', () => {
    const { container } = render(<AvatarImg avatarId="chef-1" />)
    expect(container.querySelector('img')).toHaveAttribute('alt', '')
  })

  it('un nom quand l’avatar est seul à dire qui c’est', () => {
    render(<AvatarImg avatarId="chef-1" alt="Avatar de Bob" />)
    expect(screen.getByRole('img', { name: 'Avatar de Bob' })).toBeInTheDocument()
  })
})
