import { describe, it, expect, vi, beforeEach } from 'vitest'

const invokeMock = vi.fn()
vi.mock('@shared/lib/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args) => invokeMock(...args) },
    rpc: vi.fn(),
  },
}))

const { sendAnnouncementPush } = await import('../../features/notifications/api/notifications.js')

describe('sendAnnouncementPush', () => {
  beforeEach(() => { invokeMock.mockReset() })

  it('appelle send-announcement-push avec le type et les titres/corps fr+en', async () => {
    invokeMock.mockResolvedValueOnce({ data: { processed: 1, sent: 1, errors: 0 }, error: null })
    const result = await sendAnnouncementPush({
      type: 'announcement',
      titleFr: 'Titre FR',
      titleEn: 'Title EN',
      bodyFr: 'Corps FR',
      bodyEn: 'Body EN',
    })
    expect(invokeMock).toHaveBeenCalledWith('send-announcement-push', {
      body: {
        type: 'announcement',
        title: { fr: 'Titre FR', en: 'Title EN' },
        body: { fr: 'Corps FR', en: 'Body EN' },
      },
    })
    expect(result.data.sent).toBe(1)
  })

  it('retombe sur le titre/corps FR si EN absent', async () => {
    invokeMock.mockResolvedValueOnce({ data: { processed: 0, sent: 0, errors: 0 }, error: null })
    await sendAnnouncementPush({ type: 'maintenance', titleFr: 'Titre FR', bodyFr: 'Corps FR' })
    expect(invokeMock).toHaveBeenCalledWith('send-announcement-push', {
      body: {
        type: 'maintenance',
        title: { fr: 'Titre FR', en: 'Titre FR' },
        body: { fr: 'Corps FR', en: 'Corps FR' },
      },
    })
  })

  it('body reste null si aucun corps saisi', async () => {
    invokeMock.mockResolvedValueOnce({ data: {}, error: null })
    await sendAnnouncementPush({ type: 'announcement', titleFr: 'Titre FR' })
    expect(invokeMock).toHaveBeenCalledWith('send-announcement-push', {
      body: { type: 'announcement', title: { fr: 'Titre FR', en: 'Titre FR' }, body: null },
    })
  })

  it('renvoie l\'erreur telle quelle si invoke échoue', async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: { message: 'forbidden' } })
    const result = await sendAnnouncementPush({ type: 'announcement', titleFr: 'Titre FR' })
    expect(result.error).toMatchObject({ message: 'forbidden' })
  })
})
