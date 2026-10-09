import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RecipeShareSheet from '@features/recipes/components/recipe-share-sheet'

vi.mock('@shared/hooks/use-qr-code', () => ({ useQrCode: () => 'data:image/png;base64,XX' }))
vi.mock('@features/recipes/lib/recipe-print', () => ({ buildRecipePrintHtml: () => '<html></html>' }))
const printSpy = vi.fn()
vi.mock('@shared/lib/print/print-document', () => ({ printHtmlDocument: (...a) => printSpy(...a) }))

const recipe = { id: 'caprese', name: { fr: 'Caprese' } }

describe('RecipeShareSheet', () => {
  it('rend Imprimer toujours', () => {
    render(<RecipeShareSheet open recipe={recipe} lang="fr" shareUrl="x" isShareable={false} onClose={() => {}} />)
    expect(screen.getByRole('button', { name: /imprimer/i })).toBeInTheDocument()
  })
  it('cache Copier le lien et QR si non partageable', () => {
    render(<RecipeShareSheet open recipe={recipe} lang="fr" shareUrl="x" isShareable={false} onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: /copier le lien/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /qr/i })).not.toBeInTheDocument()
  })
  it('montre Copier + QR si partageable', () => {
    render(<RecipeShareSheet open recipe={recipe} lang="fr" shareUrl="https://x/recipe/caprese" isShareable onClose={() => {}} />)
    expect(screen.getByRole('button', { name: /copier le lien/i })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /qr/i })).toBeInTheDocument()
  })
  it('imprime au clic Imprimer', () => {
    render(<RecipeShareSheet open recipe={recipe} lang="fr" shareUrl="x" isShareable onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /imprimer/i }))
    expect(printSpy).toHaveBeenCalled()
  })
})
