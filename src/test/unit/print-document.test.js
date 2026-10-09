import { describe, it, expect, vi, beforeEach } from 'vitest'
import { printHtmlDocument } from '@shared/lib/print/print-document'

describe('printHtmlDocument', () => {
  beforeEach(() => {
    global.URL.createObjectURL = vi.fn(() => 'blob:fake')
    global.URL.revokeObjectURL = vi.fn()
  })
  it('ouvre une fenêtre sur un blob HTML', () => {
    const open = vi.fn(() => ({}))
    vi.stubGlobal('open', open)
    printHtmlDocument('<h1>Hi</h1>')
    expect(URL.createObjectURL).toHaveBeenCalledOnce()
    expect(open).toHaveBeenCalledWith('blob:fake', '_blank', expect.stringContaining('width='))
  })
  it('ne jette pas si window.open renvoie null (popup bloqué)', () => {
    vi.stubGlobal('open', vi.fn(() => null))
    expect(() => printHtmlDocument('<h1>Hi</h1>')).not.toThrow()
    expect(URL.revokeObjectURL).toHaveBeenCalled()
  })
})
