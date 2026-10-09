import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Les écrans de la suppression de compte (audit du 2026-10-04, lot 4 :
// BDD-04, CPT-04 ; maquettes validées par Antoine le 2026-10-05).
//
// « En cours de suppression » : à la reconnexion pendant les 30 jours, le choix
// est EXPLICITE — plus d'annulation en silence. « Compte désactivé » : après
// la suppression, la date d'effacement et comment revenir en arrière (il
// n'existait AUCUN message de succès).

const auth = vi.hoisted(() => ({ valeur: {} }))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => auth.valeur }))
vi.mock('@shared/contexts/ui-provider', () => ({ useUI: () => ({ lang: 'fr', darkMode: false }) }))
const naviguer = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async (original) => ({ ...(await original()), useNavigate: () => naviguer }))

import PorteDuCompteSupprime from '@features/auth/components/porte-du-compte-supprime'
import SuppressionEnCours from '@features/auth/components/suppression-en-cours'
import CompteDesactive from '@features/auth/components/compte-desactive'

const annulerLaSuppression = vi.fn()
const signOut = vi.fn()
const oublierCompteDesactive = vi.fn()
const APP = <p>L’application</p>

function poser(valeur) {
  auth.valeur = { user: null, profile: null, compteDesactive: null, annulerLaSuppression, signOut, oublierCompteDesactive, ...valeur }
}

beforeEach(() => {
  annulerLaSuppression.mockReset().mockResolvedValue({ error: null })
  signOut.mockReset()
  oublierCompteDesactive.mockReset()
  naviguer.mockReset()
})

describe('la porte du compte supprimé', () => {
  it('compte ordinaire : l’application', () => {
    poser({ user: { id: 'u-1' }, profile: { id: 'u-1', deleted_at: null } })
    render(<MemoryRouter><PorteDuCompteSupprime>{APP}</PorteDuCompteSupprime></MemoryRouter>)
    expect(screen.getByText('L’application')).toBeInTheDocument()
  })

  it('compte en cours de suppression : l’écran du choix, et rien de l’application', async () => {
    poser({ user: { id: 'u-1' }, profile: { id: 'u-1', deleted_at: '2026-10-05T10:00:00.000Z' } })
    render(<MemoryRouter><PorteDuCompteSupprime>{APP}</PorteDuCompteSupprime></MemoryRouter>)
    expect(screen.queryByText('L’application')).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Ton compte est en cours de suppression' })).toBeInTheDocument()
  })

  // Le module `main.jsx` ne se monte pas sous Vitest : sa forme se lit.
  it('main.jsx : la porte enveloppe tout ce qui lit le compte (DataProvider compris)', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const main = readFileSync(resolve(process.cwd(), 'src/main.jsx'), 'utf8').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    expect(main).toMatch(/<PorteDuCompteSupprime>\s*<DataProvider>/)
    expect(main).toMatch(/<\/DataProvider>\s*<\/PorteDuCompteSupprime>/)
  })

  it('juste après la suppression : « Compte désactivé », même déconnecté', async () => {
    poser({ compteDesactive: { effaceLe: '2026-11-04T10:00:00.000Z' } })
    render(<MemoryRouter><PorteDuCompteSupprime>{APP}</PorteDuCompteSupprime></MemoryRouter>)
    expect(screen.queryByText('L’application')).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Compte désactivé' })).toBeInTheDocument()
  })
})

describe('« Ton compte est en cours de suppression »', () => {
  const monter = () => {
    poser({ user: { id: 'u-1' }, profile: { id: 'u-1', deleted_at: '2026-10-05T10:00:00.000Z' } })
    return render(<MemoryRouter><SuppressionEnCours /></MemoryRouter>)
  }

  it('dit la date d’effacement : la date de suppression + 30 jours', () => {
    monter()
    expect(screen.getByText('4 novembre 2026')).toBeInTheDocument()
    expect(screen.getByText(/tes recettes, ton frigo et tes listes/)).toBeInTheDocument()
  })

  it('« Annuler la suppression » : le seul geste qui annule', async () => {
    monter()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Annuler la suppression' })) })
    expect(annulerLaSuppression).toHaveBeenCalledTimes(1)
  })

  it('l’annulation est refusée : c’est dit, et l’écran reste', async () => {
    annulerLaSuppression.mockResolvedValue({ error: { message: 'boom' } })
    monter()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Annuler la suppression' })) })
    expect(screen.getByRole('alert')).toHaveTextContent(/n’a pas pu être annulée/)
  })

  it('« Me déconnecter » : déconnecte, sans rien annuler', async () => {
    monter()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Me déconnecter' })) })
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(annulerLaSuppression).not.toHaveBeenCalled()
  })
})

describe('« Compte désactivé »', () => {
  const monter = () => {
    poser({ compteDesactive: { effaceLe: '2026-11-04T10:00:00.000Z' } })
    return render(<MemoryRouter><CompteDesactive /></MemoryRouter>)
  }

  it('dit la date d’effacement, comment annuler, et l’e-mail parti', () => {
    monter()
    expect(screen.getByText('4 novembre 2026')).toBeInTheDocument()
    expect(screen.getByText(/reconnecte-toi avant cette date/)).toBeInTheDocument()
    expect(screen.getByText(/Un e-mail de confirmation, avec un lien d’annulation, vient de partir/)).toBeInTheDocument()
  })

  it('« Retour à l’accueil » : oublie l’écran et ramène à l’accueil', () => {
    monter()
    fireEvent.click(screen.getByRole('button', { name: 'Retour à l’accueil' }))
    expect(oublierCompteDesactive).toHaveBeenCalledTimes(1)
    expect(naviguer).toHaveBeenCalledWith('/', { replace: true })
  })
})
