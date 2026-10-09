import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SearchInput from '@features/admin/components/shared/search-input'

describe('SearchInput — primitive', () => {
  it('onChange reçoit la chaîne (pas l’event)', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    const { getByRole } = render(<SearchInput value="" onChange={onChange} placeholder="Rechercher…" />)
    await user.type(getByRole('textbox'), 'a')
    expect(onChange).toHaveBeenCalledWith('a')
  })
  it('bouton effacer appelle onChange("")', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    const { getByLabelText } = render(<SearchInput value="abc" onChange={onChange} />)
    await user.click(getByLabelText('Effacer la recherche'))
    expect(onChange).toHaveBeenCalledWith('')
  })
  it('pas de bouton effacer si vide', () => {
    const { queryByLabelText } = render(<SearchInput value="" onChange={() => {}} />)
    expect(queryByLabelText('Effacer la recherche')).toBeNull()
  })
  // Décision du 2026-10-06 (« libellés = visibles ») : le nom du champ se
  // lit à l'écran, il ne s'efface pas quand on tape.
  it('le libellé se voit et nomme le champ', () => {
    const { getByLabelText, getByText } = render(<SearchInput value="lisa" onChange={() => {}} label="Rechercher un pseudo" />)
    expect(getByLabelText('Rechercher un pseudo')).toHaveValue('lisa')
    const libelle = getByText('Rechercher un pseudo')
    expect(libelle.tagName).toBe('LABEL')
    expect(libelle).not.toHaveClass('sr-only')
  })
})
