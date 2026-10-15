import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Décision du 2026-10-08 (audit du 2026-10-04, CPT) : aucun écran ne
// permettait de changer d'adresse e-mail — la fonction existait, jamais
// appelée, et l'e-mail « Confirme ton nouvel email » aussi. Un parcours dans
// « Identifiants » (Compte & sécurité), sous l'adresse masquée : nouvelle
// adresse, lien de confirmation. Un compte Google ne le voit pas — son adresse
// est celle de Google (l'app apprend d'abord à le reconnaître). Textes de la
// maquette validée.

const m = vi.hoisted(() => ({ user: { id: 'u1', email: 'bob@test.com', app_metadata: { provider: 'email', providers: ['email'] } }, updateEmail: vi.fn() }))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ user: m.user, updateEmail: m.updateEmail }) }))

import ChangerDAdresse from '@features/profile/components/changer-d-adresse'
import { estUnCompteGoogle } from '@shared/lib/auth/compte-google'

beforeEach(() => {
  m.user = { id: 'u1', email: 'bob@test.com', app_metadata: { provider: 'email', providers: ['email'] } }
  m.updateEmail.mockReset().mockResolvedValue({ error: null })
})

const champ = () => screen.getByRole('textbox', { name: 'Nouvelle adresse e-mail' })
const envoyer = () => fireEvent.click(screen.getByRole('button', { name: 'Envoyer le lien de confirmation' }))

describe('reconnaître un compte Google', () => {
  it('par ses fournisseurs de connexion', () => {
    expect(estUnCompteGoogle({ app_metadata: { provider: 'google', providers: ['google'] } })).toBe(true)
    expect(estUnCompteGoogle({ app_metadata: { provider: 'email', providers: ['email', 'google'] } })).toBe(true)
    expect(estUnCompteGoogle({ app_metadata: { provider: 'google' } })).toBe(true)
    expect(estUnCompteGoogle({ app_metadata: { provider: 'email', providers: ['email'] } })).toBe(false)
    expect(estUnCompteGoogle(null)).toBe(false)
  })
})

describe('changer d’adresse e-mail', () => {
  it('la nouvelle adresse, le bouton, et ce qui se passe d’ici là', () => {
    render(<ChangerDAdresse lang="fr" />)
    expect(champ()).toHaveAttribute('placeholder', 'nouvelle.adresse@exemple.fr')
    expect(screen.getByText('Ton adresse actuelle reste valable jusqu’à ce que tu cliques sur le lien.')).toBeInTheDocument()
  })

  it('envoie le lien, et dit où le trouver', async () => {
    render(<ChangerDAdresse lang="fr" />)
    fireEvent.change(champ(), { target: { value: '  nouvelle@test.com ' } })
    envoyer()
    await waitFor(() => expect(m.updateEmail).toHaveBeenCalledWith('nouvelle@test.com'))
    expect(await screen.findByRole('status')).toHaveTextContent('Ouvre le lien reçu à nouvelle@test.com pour confirmer.')
  })

  it('une adresse qui n’en est pas une, ou la même : refusé sans rien envoyer', () => {
    render(<ChangerDAdresse lang="fr" />)
    fireEvent.change(champ(), { target: { value: 'pas-une-adresse' } })
    envoyer()
    expect(screen.getByRole('alert')).toHaveTextContent('Cette adresse n’a pas l’air valide.')
    fireEvent.change(champ(), { target: { value: 'BOB@test.com' } })
    envoyer()
    expect(screen.getByRole('alert')).toHaveTextContent('C’est déjà ton adresse.')
    expect(m.updateEmail).not.toHaveBeenCalled()
  })

  it('adresse déjà prise par un autre compte : c’est dit', async () => {
    m.updateEmail.mockResolvedValue({ error: { code: 'email_exists', status: 422, message: 'A user with this email address has already been registered' } })
    render(<ChangerDAdresse lang="fr" />)
    fireEvent.change(champ(), { target: { value: 'prise@test.com' } })
    envoyer()
    expect(await screen.findByRole('alert')).toHaveTextContent('Cette adresse est déjà utilisée par un autre compte.')
  })

  it('trop de demandes : réessayer plus tard', async () => {
    m.updateEmail.mockResolvedValue({ error: { code: 'over_email_send_rate_limit', status: 429, message: 'rate limit' } })
    render(<ChangerDAdresse lang="fr" />)
    fireEvent.change(champ(), { target: { value: 'nouvelle@test.com' } })
    envoyer()
    expect(await screen.findByRole('alert')).toHaveTextContent('Trop de demandes d’un coup : réessaie dans quelques minutes.')
  })

  it('autre échec : le dire', async () => {
    m.updateEmail.mockResolvedValue({ error: { code: 'network_error', message: 'Failed to fetch' } })
    render(<ChangerDAdresse lang="fr" />)
    fireEvent.change(champ(), { target: { value: 'nouvelle@test.com' } })
    envoyer()
    expect(await screen.findByRole('alert')).toHaveTextContent('Le lien n’a pas pu partir. Réessaie dans un instant.')
  })

  it('un compte Google ne voit pas le parcours : son adresse se change chez Google', () => {
    m.user = { id: 'u1', email: 'bob@gmail.com', app_metadata: { provider: 'google', providers: ['google'] } }
    render(<ChangerDAdresse lang="fr" />)
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByText('Ton adresse est celle de ton compte Google : elle se change chez Google.')).toBeInTheDocument()
  })

  it('en anglais aussi', () => {
    render(<ChangerDAdresse lang="en" />)
    expect(screen.getByRole('textbox', { name: 'New email address' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send the confirmation link' })).toBeInTheDocument()
  })
})
