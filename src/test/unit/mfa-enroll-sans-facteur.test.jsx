import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UIProvider } from '@shared/contexts/ui-provider'

// La modale d'activation de la 2FA sans facteur : erreur, pas plantage.
//
// ── Comment ce défaut a été trouvé ───────────────────────────────────────
// Balayage des fonctions JUMELLES du dépôt (même nom, deux fichiers, corps
// proches mais divergents), mené le 2026-08-28 après avoir constaté que la
// classe de défaut dominante ici est « une garantie présente à un endroit,
// perdue dans sa copie ». `handleVerify` est ressorti à 78 % de similarité
// entre les deux modales MFA, avec une garde présente d'un seul côté :
//
//   mfa-challenge-modal.jsx : if (!factor?.id) { setError(...); return }
//   mfa-enroll-modal.jsx    : (rien)
//
// 🔴 Or la modale d'activation est défensive PARTOUT ailleurs — `factor?.id`
// au nettoyage, `factor?.qrCode` et `factor?.secret` à l'affichage. Elle peut
// donc être rendue sans facteur : le champ de code s'affiche, le QR non. Sans
// la garde, saisir six chiffres et valider levait une TypeError sur
// `factor.id` en plein parcours d'activation de la double authentification.
//
// Les deux modales partagent déjà le même dictionnaire, qui contient le
// message : il ne manquait que l'appel.

const mockVerify = vi.fn()

vi.mock('@shared/hooks/use-mfa', () => ({
  useMFA: () => ({ verify: mockVerify, refresh: vi.fn() }),
}))
vi.mock('@shared/api/mfa', () => ({
  unenrollFactor: vi.fn().mockResolvedValue({ error: null }),
  listMFAFactors: vi.fn().mockResolvedValue({ totp: [] }),
}))

import MFAEnrollModal from '@shared/ui/mfa-enroll-modal'

// Meme idiome que `banner-picker-modal.test.jsx` : la coquille de modale et le
// bouton consomment le contexte d'interface.
const afficher = (props) => render(<UIProvider><MFAEnrollModal {...props} /></UIProvider>)

function saisirLeCode(valeur) {
  const champ = document.querySelector('input')
  fireEvent.change(champ, { target: { value: valeur } })
}

beforeEach(() => { mockVerify.mockReset(); mockVerify.mockResolvedValue({ error: null }) })

describe('Activation 2FA — modale rendue sans facteur', () => {
  it('🔴 affiche une erreur au lieu de planter, et n\'appelle pas verify', () => {
    afficher({ factor: null, lang: 'fr', onClose: () => {}, onEnrolled: () => {} })

    saisirLeCode('123456')
    const valider = screen.getAllByRole('button').find(b => /valider|activer|vérifier/i.test(b.textContent))
    expect(valider, 'bouton de validation introuvable — le parcours a changé').toBeTruthy()
    fireEvent.click(valider)

    expect(screen.getByText(/Aucun facteur MFA actif/)).toBeInTheDocument()
    // Le cœur du test : aucun appel réseau n'est parti avec un identifiant absent.
    expect(mockVerify).not.toHaveBeenCalled()
  })

  it('avec un facteur, la validation part normalement', () => {
    afficher({ factor: { id: 'f-1', qrCode: 'data:image/png;base64,x', secret: 'SECRET' }, lang: 'fr', onClose: () => {}, onEnrolled: () => {} })

    saisirLeCode('123456')
    const valider = screen.getAllByRole('button').find(b => /valider|activer|vérifier/i.test(b.textContent))
    fireEvent.click(valider)

    expect(mockVerify).toHaveBeenCalledWith({ factorId: 'f-1', code: '123456' })
  })

  it('un code incomplet ne déclenche rien, avec ou sans facteur', () => {
    afficher({ factor: null, lang: 'fr', onClose: () => {}, onEnrolled: () => {} })
    saisirLeCode('123')
    const valider = screen.getAllByRole('button').find(b => /valider|activer|vérifier/i.test(b.textContent))
    fireEvent.click(valider)
    expect(mockVerify).not.toHaveBeenCalled()
    expect(screen.queryByText(/Aucun facteur MFA actif/)).toBeNull()
  })
})
