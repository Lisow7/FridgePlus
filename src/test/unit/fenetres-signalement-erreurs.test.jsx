import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const signalerPost = vi.hoisted(() => vi.fn())
const signalerAvis = vi.hoisted(() => vi.fn())

vi.mock('@shared/api/community', () => ({
  reportPost: (...a) => signalerPost(...a), reportReply: vi.fn(), reportProfile: vi.fn(),
}))
vi.mock('@features/recipes/api/recipe-reviews', () => ({ reportReview: (...a) => signalerAvis(...a) }))

import ReportModal from '@features/community/components/report-modal'
import ReviewReportModal from '@features/recipes/components/recipe-review-report-modal'
import { REVIEWS_I18N } from '@features/recipes/i18n/recipe-reviews-i18n'

// Hors audit, trouvé le 2026-10-05. La fenêtre de signalement de la
// communauté affichait le texte BRUT de la base (« Could not find the 'body'
// column… ») ; celle d'un avis affichait « ✓ Signalement envoyé » sans même
// lire le résultat. Désormais : un message lisible, et le succès seulement
// quand le signalement est parti.
describe('Fenêtre de signalement de la communauté', () => {
  beforeEach(() => { signalerPost.mockReset() })
  const envoyer = () => {
    render(<ReportModal targetType="community_post" targetId="p-1" userId="u-bob" lang="fr" onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }))
  }

  it('envoyé : « Signalement envoyé »', async () => {
    signalerPost.mockResolvedValue({ ok: true })
    envoyer()
    expect(await screen.findByText(/Signalement envoyé/)).toBeInTheDocument()
  })

  it('refusé pour une panne : un message lisible, jamais le texte de la base', async () => {
    signalerPost.mockResolvedValue({ error: 'failed' })
    envoyer()
    expect(await screen.findByRole('alert')).toHaveTextContent('Le signalement n’a pas pu être envoyé. Réessaie.')
    expect(screen.queryByText(/Signalement envoyé/)).toBeNull()
  })

  // Les signalements ont leur propre plafond depuis le 2026-10-05 (CPT-17).
  it('plafond de signalements atteint : dit pourquoi', async () => {
    signalerPost.mockResolvedValue({ error: 'max_reports_reached' })
    envoyer()
    expect(await screen.findByRole('alert')).toHaveTextContent(/10 signalements en attente/)
  })

  it('compte restreint : dit pourquoi, et à qui écrire', async () => {
    signalerPost.mockResolvedValue({ error: 'account_restricted' })
    envoyer()
    expect(await screen.findByRole('alert')).toHaveTextContent(/support@fridgeplus\.app/)
  })

  it('un envoi qui lève : message lisible aussi', async () => {
    signalerPost.mockRejectedValue(new TypeError('Failed to fetch'))
    envoyer()
    expect(await screen.findByRole('alert')).toHaveTextContent('Le signalement n’a pas pu être envoyé. Réessaie.')
  })

  // Trouvé le 2026-10-05 en écrivant le parcours de bout en bout : le groupe
  // des motifs était un <label> qui en contenait d'autres (HTML invalide). Un
  // lecteur d'écran annonçait le premier bouton (« Spam ») avec le texte de
  // TOUS les motifs. Le groupe est maintenant un fieldset, nommé par sa légende.
  it('chaque motif est un bouton radio nommé par son seul libellé, dans un groupe nommé « Raison »', () => {
    render(<ReportModal targetType="community_post" targetId="p-1" userId="u-bob" lang="fr" onClose={vi.fn()} />)
    expect(screen.getByRole('radio', { name: 'Spam' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio', { name: /Harcèlement/ })).toHaveLength(1)
    expect(screen.getByRole('group', { name: 'Raison' })).toBeInTheDocument()
  })
})

describe('Fenêtre de signalement d’un avis', () => {
  beforeEach(() => { signalerAvis.mockReset() })
  const t = REVIEWS_I18N.fr
  const envoyer = () => {
    render(<ReviewReportModal reviewId="avis-1" userId="u-bob" t={t} darkMode={false} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: t.reportSubmit }))
  }

  it('envoyé : « Signalement envoyé »', async () => {
    signalerAvis.mockResolvedValue({ ok: true })
    envoyer()
    expect(await screen.findByText(new RegExp(t.reportSent))).toBeInTheDocument()
  })

  it('refusé : PAS de « Signalement envoyé », un message lisible à la place', async () => {
    signalerAvis.mockResolvedValue({ error: 'failed' })
    envoyer()
    expect(await screen.findByRole('alert')).toHaveTextContent('Le signalement n’a pas pu être envoyé. Réessaie.')
    expect(screen.queryByText(new RegExp(t.reportSent))).toBeNull()
  })

  it('plafond de signalements atteint : dit pourquoi', async () => {
    signalerAvis.mockResolvedValue({ error: 'max_reports_reached' })
    envoyer()
    expect(await screen.findByRole('alert')).toHaveTextContent(/10 signalements en attente/)
  })

  it('un envoi qui lève : message lisible', async () => {
    signalerAvis.mockRejectedValue(new TypeError('Failed to fetch'))
    envoyer()
    expect(await screen.findByRole('alert')).toHaveTextContent('Le signalement n’a pas pu être envoyé. Réessaie.')
  })
})
