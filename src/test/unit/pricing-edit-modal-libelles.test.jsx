import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import PricingEditModal from '@features/admin/components/sections/pricing-edit-modal'

// Décision du 2026-10-06 (« libellés = visibles ») : dans « Éditer les
// prix », le nom d'un champ de prix est ce que l'écran montre — l'en-tête de
// la langue (un groupe) et le format écrit à gauche du champ —, plus un
// « Prix » grisé qui s'efface dès qu'on tape.
const PACKS = { fr: [{ size: 500, unit: 'g', price: 2.49 }, { size: 1, unit: 'kg', price: 4.2 }], en: [{ size: 500, unit: 'g', price: 2.1 }] }

describe('modale des prix (admin) — libellés visibles', () => {
  it('chaque prix est nommé par son format, dans le groupe de sa langue', () => {
    render(<PricingEditModal ingredient={{ id: 'vg-oignon', label: 'Oignon' }} currentPacks={PACKS} onSave={vi.fn()} onClose={vi.fn()} />)
    const fr = screen.getByRole('group', { name: 'FR 🇫🇷' })
    expect(within(fr).getByLabelText('500 g')).toHaveValue('2.49')
    expect(within(fr).getByLabelText('1 kg')).toHaveValue('4.2')
    const en = screen.getByRole('group', { name: 'EN 🇬🇧' })
    expect(within(en).getByLabelText('500 g')).toHaveValue('2.1')
    for (const champ of screen.getAllByRole('textbox')) expect(champ).not.toHaveAttribute('placeholder')
  })
})
