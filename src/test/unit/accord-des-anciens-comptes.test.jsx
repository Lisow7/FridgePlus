import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const mockAuth = vi.hoisted(() => ({ current: null }))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => mockAuth.current }))

import AccordDesAnciensComptes from '@features/auth/components/accord-des-anciens-comptes'

// Décision du 2026-10-07, choix d'Antoine : les comptes créés avant le
// 4 octobre n'ont aucune date d'accord aux conditions. À leur prochaine
// connexion, une fenêtre par-dessus l'app (« fenetre ») le leur redemande une
// fois ; qui refuse peut se déconnecter ou supprimer son compte
// (« deconnexion_ou_suppression »).

const CASE = /J['’]ai au moins 16 ans et j['’]accepte/

function rendre(chemin = '/') {
  return render(
    <MemoryRouter initialEntries={[chemin]}>
      <Routes>
        <Route path="*" element={<AccordDesAnciensComptes lang="fr" />} />
      </Routes>
      <Routes>
        <Route path="/profile/compte" element={<p>Page Compte</p>} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockAuth.current = { user: { id: 'u1' }, recordSignupConsent: vi.fn(async () => ({ error: null })), signOut: vi.fn() }
})

describe('fenêtre « Confirme ton accord » des comptes d’avant le 4 octobre', () => {
  it('une vraie boîte de dialogue, nommée, qu’Échap ne ferme pas', () => {
    rendre()
    const dialogue = screen.getByRole('dialog', { name: 'Confirme ton accord' })
    expect(dialogue).toHaveAttribute('aria-modal', 'true')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByRole('dialog', { name: 'Confirme ton accord' })).toBeInTheDocument()
  })

  it('les conditions et la politique s’ouvrent à côté, sans quitter la fenêtre', () => {
    rendre()
    expect(screen.getByRole('link', { name: 'Conditions Générales d’Utilisation' })).toHaveAttribute('target', '_blank')
    expect(screen.getByRole('link', { name: 'Politique de confidentialité' })).toHaveAttribute('target', '_blank')
  })

  it('sans la case, « Continuer » dit ce qui manque et n’enregistre rien', async () => {
    rendre()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Continuer' })) })
    expect(screen.getByRole('alert')).toHaveTextContent(/coche la case/i)
    expect(mockAuth.current.recordSignupConsent).not.toHaveBeenCalled()
  })

  it('case cochée puis « Continuer » : l’accord est daté par la base', async () => {
    rendre()
    fireEvent.click(screen.getByRole('checkbox', { name: CASE }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Continuer' })) })
    expect(mockAuth.current.recordSignupConsent).toHaveBeenCalledTimes(1)
  })

  it('si l’enregistrement échoue, la fenêtre le dit et reste', async () => {
    mockAuth.current.recordSignupConsent = vi.fn(async () => ({ error: { message: 'réseau' } }))
    rendre()
    fireEvent.click(screen.getByRole('checkbox', { name: CASE }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Continuer' })) })
    expect(screen.getByRole('alert')).toHaveTextContent(/pas pu être enregistré/i)
    expect(screen.getByRole('dialog', { name: 'Confirme ton accord' })).toBeInTheDocument()
  })

  it('« Se déconnecter » déconnecte', async () => {
    rendre()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' })) })
    expect(mockAuth.current.signOut).toHaveBeenCalledTimes(1)
  })

  it('« Supprimer mon compte » mène à Profil → Compte & sécurité, où la fenêtre s’efface', async () => {
    rendre()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Supprimer mon compte' })) })
    expect(screen.getByText('Page Compte')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Confirme ton accord' })).toBeNull()
  })

  it('les pages légales, la page Compte et la page Accessibilité restent lisibles : pas de fenêtre dessus', () => {
    // `/accessibilite` dit comment signaler un obstacle : une fenêtre bloquante
    // ne doit pas se poser précisément sur elle.
    for (const chemin of ['/legal', '/profile/compte', '/accessibilite']) {
      const { unmount } = rendre(chemin)
      expect(screen.queryByRole('dialog', { name: 'Confirme ton accord' }), chemin).toBeNull()
      unmount()
    }
  })
})
