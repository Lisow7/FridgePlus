import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import PackSelector from '@features/cart/components/pack-selector'

// fr-tomate has no specific pack in packSizes.js, so it uses the 'vegetables'
// default: [{ size: 1, unit: 'pcs', price: 0.50 }, { size: 500, unit: 'g', price: 1.20 }, { size: 1, unit: 'kg', price: 2.20 }]
// The 500g pack → 2.40 €/kg, the 1kg pack → 2.20 €/kg.
const baseProps = {
  ingredientId: 'fr-tomate',
  subcat: 'vegetables',
  currentSize: 250,
  currentUnit: 'g',
  currentLabel: '250 g',
  lang: 'fr',
  darkMode: false,
  multiplier: 1,
  requiredAmount: 500,
}

describe('PackSelector — multiplier stepper', () => {
  it('renders the current multiplier', () => {
    render(<PackSelector {...baseProps} multiplier={2} />)
    expect(screen.getByText('× 2')).toBeInTheDocument()
  })

  it('calls onChangeMultiplier(+1) when ⊕ clicked', () => {
    const onChangeMultiplier = vi.fn()
    render(<PackSelector {...baseProps} multiplier={2} onChangeMultiplier={onChangeMultiplier} />)
    fireEvent.click(screen.getByLabelText(/augmenter le nombre de packs/i))
    expect(onChangeMultiplier).toHaveBeenCalledWith(3)
  })

  it('calls onChangeMultiplier(-1) when ⊖ clicked, clamped to 1 — does NOT fire at 1', () => {
    const onChangeMultiplier = vi.fn()
    render(<PackSelector {...baseProps} multiplier={1} onChangeMultiplier={onChangeMultiplier} />)
    fireEvent.click(screen.getByLabelText(/diminuer le nombre de packs/i))
    expect(onChangeMultiplier).not.toHaveBeenCalled() // already at 1
  })

  it('decrements from 3 to 2', () => {
    const onChangeMultiplier = vi.fn()
    render(<PackSelector {...baseProps} multiplier={3} onChangeMultiplier={onChangeMultiplier} />)
    fireEvent.click(screen.getByLabelText(/diminuer le nombre de packs/i))
    expect(onChangeMultiplier).toHaveBeenCalledWith(2)
  })
})

describe('PackSelector — a11y live region', () => {
  it('contains an aria-live="polite" region announcing pack + multiplier', () => {
    render(<PackSelector {...baseProps} multiplier={2} />)
    const live = document.querySelector('[aria-live="polite"]')
    expect(live).not.toBeNull()
    expect(live.textContent).toMatch(/250.*g.*×.*2/i)
  })
})

describe('PackSelector — unit price label in dropdown', () => {
  it('shows €/kg for g-based packs when price is set', () => {
    render(<PackSelector {...baseProps} />)
    // The trigger button for fr-tomate with currentSize=250, currentUnit=g is
    // labelled "Choisir un conditionnement : 250 g". But since 250g is NOT in the
    // packs list (packs are 1pcs/500g/1kg), hasAlternatives=true and the trigger renders.
    // Click the trigger to open the dropdown.
    const trigger = screen.getByRole('button', { name: /choisir un conditionnement/i })
    fireEvent.click(trigger)
    // packs of vegetables have prices; expect "€/kg" suffix on at least one option
    const options = screen.getAllByRole('option')
    expect(options.some(o => /€\/kg/.test(o.textContent))).toBe(true)
  })
})

describe('PackSelector — auto-recompute multiplier when pack changes', () => {
  it('calls onChangeMultiplier with ceil(required / newSize) when pack changes', () => {
    const onChangePack = vi.fn()
    const onChangeMultiplier = vi.fn()
    render(
      <PackSelector
        {...baseProps}
        requiredAmount={500}
        onChangePack={onChangePack}
        onChangeMultiplier={onChangeMultiplier}
      />
    )
    const trigger = screen.getByRole('button', { name: /choisir un conditionnement/i })
    fireEvent.click(trigger)
    // pick the 1kg pack from the dropdown — should compute ceil(500/1000) = 1
    const opt = screen.getAllByRole('option').find(o => /1\s?kg/i.test(o.textContent))
    expect(opt).toBeTruthy()
    // Click the button inside the option li (the actual click handler is on the button)
    const btn = within(opt).getByRole('button')
    fireEvent.click(btn)
    expect(onChangePack).toHaveBeenCalled()
    expect(onChangeMultiplier).toHaveBeenCalledWith(1) // ceil(500/1000) = 1
  })

  it('computes ceil(500/500) = 1 for 500g pack', () => {
    const onChangePack = vi.fn()
    const onChangeMultiplier = vi.fn()
    render(
      <PackSelector
        {...baseProps}
        requiredAmount={500}
        onChangePack={onChangePack}
        onChangeMultiplier={onChangeMultiplier}
      />
    )
    const trigger = screen.getByRole('button', { name: /choisir un conditionnement/i })
    fireEvent.click(trigger)
    // 500g pack
    const opt = screen.getAllByRole('option').find(o => /500\s?g/i.test(o.textContent))
    expect(opt).toBeTruthy()
    const btn = within(opt).getByRole('button')
    fireEvent.click(btn)
    expect(onChangeMultiplier).toHaveBeenCalledWith(1) // ceil(500/500) = 1
  })

  it('computes ceil(1200/500) = 3 for required=1200, pack=500g', () => {
    const onChangePack = vi.fn()
    const onChangeMultiplier = vi.fn()
    render(
      <PackSelector
        {...baseProps}
        requiredAmount={1200}
        onChangePack={onChangePack}
        onChangeMultiplier={onChangeMultiplier}
      />
    )
    const trigger = screen.getByRole('button', { name: /choisir un conditionnement/i })
    fireEvent.click(trigger)
    const opt = screen.getAllByRole('option').find(o => /500\s?g/i.test(o.textContent))
    expect(opt).toBeTruthy()
    const btn = within(opt).getByRole('button')
    fireEvent.click(btn)
    expect(onChangeMultiplier).toHaveBeenCalledWith(3) // ceil(1200/500) = 3
  })
})
