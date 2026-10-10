import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

const confirmMock = vi.fn()
vi.mock('@shared/ui/confirm-dialog/confirm-provider', () => ({
  useConfirm: () => confirmMock,
}))
vi.mock('@features/admin/api/admin', () => ({
  adminGetImportQueue: vi.fn().mockResolvedValue({
    data: [{ id: 'row1', status: 'valid', batch_id: 'lot-2026-07', parsed_data: { name: { fr: 'Ma recette' } }, errors: [] }],
    count: 1, error: null,
  }),
  adminPublishStaged: vi.fn().mockResolvedValue({ error: null }),
  adminRejectStaged: vi.fn(),
  adminBatchPublishValid: vi.fn().mockResolvedValue({ published: 1, failed: [], error: null }),
  adminReRunValidators: vi.fn(),
}))
vi.mock('@features/admin/components/sections/import-metrics', () => ({ default: () => null }))

import ImportQueueTab from '@features/admin/components/sections/import-queue-tab'

describe('ImportQueueTab — publication', () => {
  it('publier une recette appelle useConfirm() (neutre, pas danger)', async () => {
    confirmMock.mockResolvedValue(false)
    render(<ImportQueueTab />)
    await waitFor(() => screen.getByText('Ma recette'))
    fireEvent.click(screen.getByText('Publier'))
    await waitFor(() => expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Publier la recette "Ma recette" ?',
    })))
    expect(confirmMock.mock.calls[0][0].danger).not.toBe(true)
  })

  it('publier tous les valides du batch appelle useConfirm() avec le nom du batch', async () => {
    confirmMock.mockResolvedValue(false)
    render(<ImportQueueTab />)
    await waitFor(() => screen.getByText('Ma recette'))
    fireEvent.change(screen.getByDisplayValue('Tous batches'), { target: { value: 'lot-2026-07' } })
    fireEvent.click(screen.getByText('Publier tous valides du batch'))
    // Le nombre de recettes valides du lot est compté avant la question (ADM-17 (4)) :
    // la liste moquée en rend une.
    await waitFor(() => expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Publier la recette valide du batch "lot-2026-07" ?',
    })))
  })
})
