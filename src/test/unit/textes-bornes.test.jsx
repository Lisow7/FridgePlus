import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

// Audit du 2026-10-04, BDD-10 : la base borne désormais les textes libres
// (migration 20261005_journal_et_textes_bornes.sql). Une saisie plus longue que
// la borne serait refusée par la base, et le message tapé perdu sur une erreur
// générique : chaque zone de texte concernée s'arrête AVANT la borne.

vi.mock('@shared/ui/confirm-dialog/confirm-provider', () => ({ useConfirm: () => vi.fn() }))
vi.mock('@features/support/api/support', () => ({
  getUserTickets: vi.fn(() => Promise.resolve([{ id: 't1', title: 'Mon ticket', status: 'open', updated_at: '2026-01-01' }])),
  getTicketMessages: vi.fn().mockResolvedValue({ messages: [], error: null }),
  createTicket: vi.fn(), sendUserMessage: vi.fn(), markTicketReadByUser: vi.fn().mockResolvedValue({ error: null }),
  deleteUserMessage: vi.fn(), deleteUserTicket: vi.fn(), updateTicketTitle: vi.fn(),
  searchBaseRecipes: vi.fn(), searchCommunityRecipes: vi.fn(), searchIngredients: vi.fn(), searchUsersForReport: vi.fn(),
  adminReplyTicket: vi.fn(),
}))
vi.mock('@shared/api/reports', () => ({ createReport: vi.fn() }))
vi.mock('@shared/hooks/use-moderation', () => ({ moderateContent: vi.fn() }))
vi.mock('@features/support/data/support-self-help', () => ({ getSelfHelp: () => [] }))

import SupportPanel from '@features/support/components/support-panel'
import SupportFormView from '@features/support/components/support-form-view'
import SupportTicketDetail from '@features/admin/components/sections/support-ticket-detail'
import ReportThread from '@features/admin/components/sections/report-thread'
import ReasonSelector, { formatReason } from '@features/admin/components/shared/reason-selector'
import { MESSAGE_SUPPORT_MAX, RAISON_DETAILS_MAX } from '@shared/lib/longueurs-maximales'

// La borne telle que la base l'applique : lue dans la DERNIÈRE migration qui
// pose la contrainte, pour qu'un changement de borne en base se voie ici.
function borneEnBase(contrainte, motif) {
  const dossier = resolve(process.cwd(), 'supabase/migrations')
  const fichiers = readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort()
  for (const f of fichiers.reverse()) {
    const sql = readFileSync(resolve(dossier, f), 'utf8')
    if (!sql.includes(contrainte)) continue
    const m = sql.slice(sql.indexOf(contrainte)).match(motif)
    if (m) return Number(m[1])
  }
  throw new Error(`contrainte ${contrainte} introuvable dans supabase/migrations`)
}

const theme = { darkMode: false, modalBg: '#fff', border: '#ccc', text: '#000', muted: '#666', inputBg: '#fff' }
const ctx = (category) => ({
  newFlow: { category, target: null, searchQuery: '', searchResults: [], searchLoading: false, reasonKey: '', details: '', freeTitle: '' },
  setNewFlow: vi.fn(), error: null, setError: vi.fn(), goToConfirm: vi.fn(), setView: vi.fn(),
})
const t = { cats: {}, reasons: {}, searchPlaceholders: {} }

describe('Messages de support : 5 000 caractères, comme la base', () => {
  it('la longueur permise à l\'écran ne dépasse pas la borne de la base', () => {
    const borne = borneEnBase('support_messages_content_longueur', /char_length\(content\) <= (\d+)/)
    expect(MESSAGE_SUPPORT_MAX).toBeLessThanOrEqual(borne)
    expect(MESSAGE_SUPPORT_MAX).toBe(5000)
  })

  it.each([
    ['un signalement', { id: 'report_recipe', flow: 'report' }],
    ['un bug', { id: 'bug', flow: 'bug', emoji: '🐛' }],
    ['une question libre', { id: 'question', flow: 'free' }],
  ])('formulaire de nouveau ticket — %s', (_, category) => {
    const { container } = render(<SupportFormView ctx={ctx(category)} theme={theme} t={t} />)
    const zones = container.querySelectorAll('textarea')
    expect(zones.length).toBeGreaterThan(0)
    for (const zone of zones) expect(zone.maxLength).toBe(MESSAGE_SUPPORT_MAX)
  })

  it('réponse de l\'utilisateur dans son ticket', async () => {
    render(<SupportPanel userId="u1" lang="fr" onClose={vi.fn()} />)
    await waitFor(() => screen.getByText('Mon ticket'))
    fireEvent.click(screen.getByText('Mon ticket'))
    expect((await screen.findByLabelText('Ta réponse au support')).maxLength).toBe(MESSAGE_SUPPORT_MAX)
  })

  it('réponse de l\'admin dans un ticket', () => {
    render(
      <SupportTicketDetail
        detail={{ id: 't1', status: 'open', type: 'question', title: 'Un ticket', created_at: '2026-01-01' }}
        statusCfg={{ open: { label: 'Ouvert', color: '#000', bg: '#fff' } }} typeCfg={{}} fmtDate={() => ''}
        messages={[]} messagesError={null} onRetryMessages={vi.fn()}
        hoveredMsgId={null} setHoveredMsgId={vi.fn()} bottomRef={{ current: null }}
        reply="" setReply={vi.fn()} sending={false} replyError={null}
        onBack={vi.fn()} onSetStatus={vi.fn()} onRequestDelete={vi.fn()} onDeleteMessage={vi.fn()} onReply={vi.fn()}
        feedback={null} modaleSuppression={null} lang="fr" darkMode={false} fg="#000" muted="#666" border="#ccc"
      />,
    )
    expect(screen.getByLabelText('Votre réponse').maxLength).toBe(MESSAGE_SUPPORT_MAX)
  })

  it('réponse de l\'admin à un signalement', async () => {
    render(<ReportThread reportId="r-1" lang="fr" />)
    expect((await screen.findByLabelText('Répondre au signalement')).maxLength).toBe(MESSAGE_SUPPORT_MAX)
  })
})

describe('Raison d\'un accès à une donnée sensible : tient dans le journal', () => {
  it('la zone des précisions s\'arrête à RAISON_DETAILS_MAX caractères', () => {
    render(<ReasonSelector category="sensitive-data" value="other" details="" onChange={vi.fn()} onDetailsChange={vi.fn()} lang="fr" />)
    expect(screen.getByPlaceholderText(/Précisions/).maxLength).toBe(RAISON_DETAILS_MAX)
  })

  // Le pire cas : le libellé le plus long, et des précisions dont CHAQUE
  // caractère est échappé en \u00XX (6 octets) — la base mesure le texte du
  // JSON, avec l'espace qu'elle met après les deux-points.
  it('au pire, les métadonnées tiennent sous la borne de la base', () => {
    const borne = borneEnBase('activity_logs_tailles', /octet_length\(metadata::text\) <= (\d+)/)
    const libelles = ['support-ticket', 'security-investigation', 'rgpd-request', 'legal-request', 'other', 'rgpd-art20-request']
    const pire = Math.max(...libelles.map((value) => {
      const reason = formatReason({ value, details: '\u0001'.repeat(RAISON_DETAILS_MAX), lang: 'fr' })
      return Buffer.byteLength(JSON.stringify({ reason }).replace('":', '": '))
    }))
    expect(pire).toBeLessThanOrEqual(borne)
  })
})
