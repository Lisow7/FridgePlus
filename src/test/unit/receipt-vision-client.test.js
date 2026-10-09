import { describe, it, expect, vi, beforeEach } from 'vitest'

const invokeMock = vi.fn()
vi.mock('@shared/lib/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args) => invokeMock(...args) },
  },
}))

const { scanReceiptImage } = await import('../../features/receipt-scan/lib/receipt-vision-client.js')

describe('scanReceiptImage', () => {
  beforeEach(() => { invokeMock.mockReset() })

  it('appelle scan-receipt avec le bon payload et renvoie les blocks', async () => {
    invokeMock.mockResolvedValueOnce({ data: { blocks: [{ boundingBox: {}, paragraphs: [] }] }, error: null })
    const result = await scanReceiptImage('BASE64DATA')
    expect(invokeMock).toHaveBeenCalledWith('scan-receipt', { body: { image_base64: 'BASE64DATA' } })
    expect(result.blocks).toHaveLength(1)
  })

  it('throw avec le code d\'erreur si quota dépassé', async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: { message: 'quota_exceeded' } })
    await expect(scanReceiptImage('BASE64DATA')).rejects.toMatchObject({ message: 'quota_exceeded' })
  })

  it('throw avec le code d\'erreur si rate-limité', async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: { message: 'rate_limited' } })
    await expect(scanReceiptImage('BASE64DATA')).rejects.toMatchObject({ message: 'rate_limited' })
  })
})
