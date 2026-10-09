import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useReceiptScanFlow } from '@app/hooks/use-receipt-scan-flow'

// Régression 2026-07-11 : (1) un vrai échec en prod remontait comme
// 'scan_failed' générique sans qu'on sache lequel des codes précis de
// l'Edge Function avait déclenché — jamais de télémétrie Sentry non plus ;
// (2) le toast d'erreur ne disparaissait jamais tout seul (seul le X le
// fermait), contrairement au reste de l'app (5000ms par défaut).

const mockCompress   = vi.hoisted(() => vi.fn())
const mockScan       = vi.hoisted(() => vi.fn())
const mockExtract    = vi.hoisted(() => vi.fn())
const mockMatch      = vi.hoisted(() => vi.fn())
const mockLogError   = vi.hoisted(() => vi.fn())
const mockSetConsent = vi.hoisted(() => vi.fn())

vi.mock('@shared/lib/media/compress-image', () => ({ compressImageToBase64: mockCompress }))
vi.mock('@features/receipt-scan/lib/receipt-vision-client', () => ({ scanReceiptImage: mockScan }))
vi.mock('@features/receipt-scan/lib/receipt-line-parser', () => ({ extractProductLabels: mockExtract }))
vi.mock('@features/receipt-scan/lib/receipt-matcher', () => ({ matchReceiptLabels: mockMatch }))
vi.mock('@shared/lib/observability/sentry', () => ({ logError: mockLogError }))
vi.mock('@shared/hooks/use-consent', () => ({
  hasConsentedSync: () => true,
  useConsent: () => ({ setReceiptScanConsent: mockSetConsent }),
}))

function setup() {
  const modals = { receiptReview: { open: vi.fn(), close: vi.fn() } }
  const { result } = renderHook(() => useReceiptScanFlow({
    lang: 'fr', modals, ingredients: [], user: { id: 'u1' }, addStockBatch: vi.fn(),
  }))
  return { result, modals }
}

describe('useReceiptScanFlow — gestion d\'erreur', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCompress.mockResolvedValue('base64data')
  })

  it('préserve un code d\'erreur précis (ex: vision_unreachable) au lieu de l\'écraser en scan_failed', async () => {
    mockScan.mockRejectedValue(new Error('vision_unreachable'))
    const { result } = setup()

    await act(async () => { await result.current.handleFileSelected(new File([], 'r.jpg')) })

    expect(result.current.receiptScanError).toBe('vision_unreachable')
    expect(result.current.receiptScanStage).toBe('error')
  })

  it('un code inconnu retombe bien sur scan_failed (comportement de secours conservé)', async () => {
    mockScan.mockRejectedValue(new Error('some_totally_new_error'))
    const { result } = setup()

    await act(async () => { await result.current.handleFileSelected(new File([], 'r.jpg')) })

    expect(result.current.receiptScanError).toBe('scan_failed')
  })

  it('log l\'erreur dans Sentry (avant ce fix : silencieuse, aucune télémétrie)', async () => {
    const err = new Error('vision_key_missing')
    mockScan.mockRejectedValue(err)
    const { result } = setup()

    await act(async () => { await result.current.handleFileSelected(new File([], 'r.jpg')) })

    expect(mockLogError).toHaveBeenCalledWith(err, { tag: 'receipt-scan.scan' })
  })

  it('le toast d\'erreur se ferme tout seul après 5000ms (avant ce fix : jamais)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockScan.mockRejectedValue(new Error('scan_failed'))
    const { result } = setup()

    await act(async () => { await result.current.handleFileSelected(new File([], 'r.jpg')) })
    expect(result.current.receiptScanStage).toBe('error')

    await act(async () => { vi.advanceTimersByTime(5000) })

    expect(result.current.receiptScanStage).toBe('idle')
    expect(result.current.receiptScanError).toBe(null)
    vi.useRealTimers()
  })
})
