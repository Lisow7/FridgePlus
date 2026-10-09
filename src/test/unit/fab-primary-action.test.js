import { describe, it, expect } from 'vitest'
import { getFabPrimaryAction } from '@features/fridge/lib/fab-primary-action'

describe('getFabPrimaryAction', () => {
  it('desktop frigo fermé → ouvrir frigo', () => {
    expect(getFabPrimaryAction({ isDesktop: true, activeTab: 'pantry', doorOpen: false, pantryOpen: true }))
      .toEqual({ kind: 'open-fridge', labelKey: 'open_fridge' })
  })
  it('desktop frigo ouvert → fermer frigo', () => {
    expect(getFabPrimaryAction({ isDesktop: true, activeTab: 'fridge', doorOpen: true, pantryOpen: false }))
      .toEqual({ kind: 'close-fridge', labelKey: 'close_fridge' })
  })
  it('mobile onglet frigo fermé → ouvrir frigo', () => {
    expect(getFabPrimaryAction({ isDesktop: false, activeTab: 'fridge', doorOpen: false, pantryOpen: false }))
      .toEqual({ kind: 'open-fridge', labelKey: 'open_fridge' })
  })
  it('mobile onglet frigo ouvert → fermer frigo', () => {
    expect(getFabPrimaryAction({ isDesktop: false, activeTab: 'fridge', doorOpen: true, pantryOpen: false }))
      .toEqual({ kind: 'close-fridge', labelKey: 'close_fridge' })
  })
  it('mobile onglet garde-manger avec section ouverte → fermer garde-manger', () => {
    expect(getFabPrimaryAction({ isDesktop: false, activeTab: 'pantry', doorOpen: false, pantryOpen: true }))
      .toEqual({ kind: 'close-pantry', labelKey: 'close_pantry' })
  })
  it('mobile onglet garde-manger rien d\'ouvert → null', () => {
    expect(getFabPrimaryAction({ isDesktop: false, activeTab: 'pantry', doorOpen: false, pantryOpen: false }))
      .toBeNull()
  })
})
