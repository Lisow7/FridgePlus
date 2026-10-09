import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

// Audit du 2026-10-04, A11Y-10 : les 14 entrées du panneau admin portaient
// `role="tab"` sans `tablist`, sans `tabpanel`, sans flèches — un motif ARIA
// promis et non tenu. Ce sont des sections, choisies comme des pages : une
// navigation nommée, et la section ouverte marquée `aria-current="page"`.
// Et la croix disait « Close », en anglais, sans dire quoi.

vi.mock('@features/admin/providers/admin-provider', async () => {
  const { useState } = await import('react')
  return {
    AdminProvider: ({ children }) => children,
    useAdmin: () => {
      const [section, setSection] = useState('dashboard')
      return { section, setSection, pendingCount: 0, supportBadge: 2, healthCount: 0, reportsCount: 0, setFocusEditId: () => {} }
    },
  }
})
vi.mock('@features/admin/components/dashboard', () => ({ default: () => null }))
vi.mock('@features/admin/components/sections/journal-section', () => ({ default: () => null }))
vi.mock('@features/admin/components/sections/notifications-section', () => ({ default: () => null }))
vi.mock('@features/admin/components/sections/data-quality-section', () => ({ default: () => null }))
vi.mock('@features/admin/components/sections/reports-section', () => ({ default: () => null }))
vi.mock('@features/admin/components/sections/pricing-section', () => ({ default: () => null }))
vi.mock('@features/admin/components/sections/community-section', () => ({ default: () => null }))
vi.mock('@features/admin/components/sections/recipe-reviews-section', () => ({ default: () => null }))
vi.mock('@features/admin/components/sections/custom-recipes-section', () => ({ default: () => null }))
vi.mock('@features/admin/components/sections/users-section', () => ({ default: () => null }))
vi.mock('@features/admin/components/sections/ingredients-section', () => ({ default: () => null }))
vi.mock('@features/admin/components/sections/base-recipes-section', () => ({ default: () => null }))
vi.mock('@features/admin/components/sections/support-section', () => ({ default: () => null }))
vi.mock('@features/admin/components/sections/features-section', () => ({ default: () => null }))
vi.mock('@features/admin/components/admin-help-modal', () => ({ default: () => null }))

import AdminPanel from '@features/admin/components/admin-panel'

const largeur = window.innerWidth
afterEach(() => { window.innerWidth = largeur })

describe.each([
  ['bureau (barre latérale)', 1024],
  ['téléphone (barre d’onglets)', 390],
])('panneau admin, %s', (_nom, l) => {
  it('les sections forment une navigation nommée ; l’ouverte est marquée « page courante »', () => {
    window.innerWidth = l
    render(<AdminPanel onClose={() => {}} />)
    const nav = screen.getByRole('navigation', { name: 'Sections du panneau admin' })
    const accueil = within(nav).getByRole('button', { name: /Tableau de bord/ })
    expect(accueil).toHaveAttribute('aria-current', 'page')

    fireEvent.click(within(nav).getByRole('button', { name: /Support/ }))
    expect(within(nav).getByRole('button', { name: /Support/ })).toHaveAttribute('aria-current', 'page')
    expect(accueil).not.toHaveAttribute('aria-current')
    // Les 14 sections, ni plus ni moins (le guide et la croix sont hors de la navigation).
    expect(within(nav).getAllByRole('button')).toHaveLength(14)
  })

  it('aucun onglet orphelin (`role="tab"` sans liste d’onglets)', () => {
    window.innerWidth = l
    render(<AdminPanel onClose={() => {}} />)
    expect(screen.queryAllByRole('tab')).toEqual([])
  })

  it('la croix dit ce qu’elle ferme, en français', () => {
    window.innerWidth = l
    const onClose = vi.fn()
    render(<AdminPanel onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Fermer le panneau admin' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
