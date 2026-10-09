import { describe, it, expect } from 'vitest'
import { SUPPORT_QUICK_REPLIES, quickReplyText } from '@features/admin/data/support-quick-replies'

describe('support-quick-replies', () => {
  it('ids uniques + label/text fr+en présents', () => {
    const ids = SUPPORT_QUICK_REPLIES.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(SUPPORT_QUICK_REPLIES.length).toBeGreaterThanOrEqual(4)
    for (const q of SUPPORT_QUICK_REPLIES) {
      expect(q.label.fr).toBeTruthy()
      expect(q.label.en).toBeTruthy()
      expect(q.text.fr).toBeTruthy()
      expect(q.text.en).toBeTruthy()
    }
  })
  it('quickReplyText renvoie le texte dans la langue', () => {
    const first = SUPPORT_QUICK_REPLIES[0]
    expect(quickReplyText(first.id, 'fr')).toBe(first.text.fr)
    expect(quickReplyText(first.id, 'en')).toBe(first.text.en)
  })
  it('quickReplyText fallback fr si lang inconnue', () => {
    const first = SUPPORT_QUICK_REPLIES[0]
    expect(quickReplyText(first.id, 'xx')).toBe(first.text.fr)
  })
  it('quickReplyText renvoie vide si id inconnu', () => {
    expect(quickReplyText('nope', 'fr')).toBe('')
  })
})
