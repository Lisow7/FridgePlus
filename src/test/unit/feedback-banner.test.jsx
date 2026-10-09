import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import FeedbackBanner from '@features/admin/components/shared/feedback-banner'

describe('FeedbackBanner — primitive unifiée', () => {
  it('null si pas de feedback', () => {
    const { container } = render(<FeedbackBanner feedback={null} />)
    expect(container.firstChild).toBeNull()
  })
  it('forme {ok,msg}', () => {
    const { getByText } = render(<FeedbackBanner feedback={{ ok: true, msg: 'Enregistré' }} />)
    expect(getByText('Enregistré')).toBeInTheDocument()
  })
  it('forme {type,text} (communauté/avis)', () => {
    const { getByText } = render(<FeedbackBanner feedback={{ type: 'error', text: 'Échec' }} />)
    expect(getByText('Échec')).toBeInTheDocument()
  })
})
