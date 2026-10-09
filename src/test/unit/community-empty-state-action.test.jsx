// Audit d'intuitivité du 2026-10-02 : sur mobile, la communauté vide était une
// impasse — « Sois le premier à lancer la discussion ! » sans aucun bouton
// (l'en-tête n'a pas la place pour « Connecte-toi pour publier »). L'état vide
// porte désormais l'action qui débloque la suite.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EmptyState } from '@features/community/components/community-feed-states'

const t = { emptyFeed: 'Pas encore de post dans cette catégorie. Sois le premier à lancer la discussion !' }

describe('communauté — état vide avec une action', () => {
  it('propose l’action donnée, et la déclenche', () => {
    const onClick = vi.fn()
    render(<EmptyState t={t} darkMode={false} action={{ label: 'Connecte-toi pour publier', onClick }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Connecte-toi pour publier' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('sans action (ex. compte muet), garde le seul message', () => {
    render(<EmptyState t={t} darkMode={false} />)
    expect(screen.getByText(/Sois le premier/)).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
