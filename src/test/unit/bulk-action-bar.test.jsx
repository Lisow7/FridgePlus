import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BulkActionBar from '@features/admin/components/shared/bulk-action-bar'

describe('BulkActionBar', () => {
  it('null si count = 0', () => {
    const { container } = render(<BulkActionBar count={0} actions={[]} />)
    expect(container.firstChild).toBeNull()
  })
  it('affiche le compte (pluriel)', () => {
    const { getByText } = render(<BulkActionBar count={3} actions={[]} onClear={() => {}} />)
    expect(getByText('3 sélectionnés')).toBeInTheDocument()
  })
  it('déclenche l’action + le clear', async () => {
    const onClick = vi.fn(); const onClear = vi.fn()
    const user = userEvent.setup()
    const { getByText, getByLabelText } = render(
      <BulkActionBar count={2} actions={[{ label: 'Approuver', onClick }]} onClear={onClear} />,
    )
    await user.click(getByText('Approuver'))
    expect(onClick).toHaveBeenCalled()
    await user.click(getByLabelText('Tout désélectionner'))
    expect(onClear).toHaveBeenCalled()
  })
})
