import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useQrCode } from '@shared/hooks/use-qr-code'

vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(() => Promise.resolve('data:image/png;base64,XX')) } }))

describe('useQrCode', () => {
  it('retourne null puis le dataURL', async () => {
    const { result } = renderHook(() => useQrCode('https://x/recipe/1'))
    await waitFor(() => expect(result.current).toBe('data:image/png;base64,XX'))
  })
  it('retourne null si url vide', () => {
    const { result } = renderHook(() => useQrCode(null))
    expect(result.current).toBeNull()
  })
})
