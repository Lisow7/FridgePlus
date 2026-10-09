import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

// L'écran de la personne bannie dit le motif et la date de fin (audit du
// 2026-10-04, lot 3c-3b ; maquette validée par Antoine le 2026-10-05).
//
// Il ne disait que « Compte suspendu suite à un non-respect de nos
// conditions » : ni motif, ni date, et pas de « Se déconnecter ». Et son bouton
// « Contacter le support » ouvrait le formulaire de ticket, que la base refuse
// à un compte banni : il écrit désormais au support par e-mail.

const auth = vi.hoisted(() => ({ valeur: {} }))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => auth.valeur }))
vi.mock('@shared/contexts/ui-provider', () => ({ useUI: () => ({ lang: 'fr', darkMode: false }) }))
vi.mock('@shared/hooks/use-dialogue', () => ({ useDialogue: () => ({ titreId: 't', proprietes: { role: 'dialog' } }) }))

import BannedScreen from '@features/auth/components/banned-screen'

const signOut = vi.fn()
const deleteAccount = vi.fn()

function monter(profil, lang = 'fr') {
  auth.valeur = { profile: { banned: true, ...profil }, signOut, deleteAccount }
  return render(<BannedScreen lang={lang} darkMode={false} onShowSupport={vi.fn()} />)
}

beforeEach(() => { signOut.mockReset(); deleteAccount.mockReset().mockResolvedValue({ error: null }) })

describe('l’écran du compte suspendu', () => {
  it('bannissement daté : la date de fin dans le titre, et le motif', () => {
    monter({ banned_until: '2026-10-12T10:00:00Z', banned_reason: 'Spam — liens publicitaires répétés' })
    expect(screen.getByRole('heading', { name: 'Compte suspendu jusqu’au 12 octobre 2026' })).toBeInTheDocument()
    expect(screen.getByText('Motif')).toBeInTheDocument()
    expect(screen.getByText('Spam — liens publicitaires répétés')).toBeInTheDocument()
  })

  it('sans fin : « Compte suspendu », sans date inventée', () => {
    monter({ banned_until: null, banned_reason: 'Harcèlement' })
    expect(screen.getByRole('heading', { name: 'Compte suspendu' })).toBeInTheDocument()
    expect(screen.queryByText(/jusqu’au/)).not.toBeInTheDocument()
  })

  it('sans motif enregistré (ancien bannissement) : pas de bloc « Motif » vide', () => {
    monter({ banned_until: null, banned_reason: null })
    expect(screen.queryByText('Motif')).not.toBeInTheDocument()
  })

  it('« Contacter le support » écrit au support par e-mail (la base refuse les tickets d’un compte banni)', () => {
    monter({ banned_until: '2026-10-12T10:00:00Z', banned_reason: 'Spam' })
    expect(screen.getByRole('link', { name: 'Contacter le support' })).toHaveAttribute('href', expect.stringMatching(/^mailto:support@fridgeplus\.app/))
  })

  it('« Se déconnecter » : enfin là', async () => {
    monter({ banned_until: '2026-10-12T10:00:00Z', banned_reason: 'Spam' })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' })) })
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('le droit de supprimer son compte reste (RGPD, article 17) — sans promettre « toutes tes données »', () => {
    monter({ banned_until: '2026-10-12T10:00:00Z', banned_reason: 'Spam' })
    // La base garde l'empreinte de l'adresse jusqu'à la fin de la suspension
    // (migration 20261006_bannis_ne_se_reinscrivent_pas.sql) : l'écran le dit.
    expect(screen.queryByText(/toutes tes données/)).not.toBeInTheDocument()
    expect(screen.getByText(/supprimer ton compte et tes données/)).toBeInTheDocument()
    expect(screen.getByText(/Seule une empreinte de ton adresse e-mail/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Supprimer mon compte' })).toBeInTheDocument()
  })

  it('en anglais', () => {
    monter({ banned_until: '2026-10-12T10:00:00Z', banned_reason: 'Spam' }, 'en')
    expect(screen.getByRole('heading', { name: 'Account suspended until 12 October 2026' })).toBeInTheDocument()
  })
})
