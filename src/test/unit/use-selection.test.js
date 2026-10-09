import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSelection } from '@features/admin/hooks/use-selection'

describe('useSelection — sélection multiple', () => {
  it('toggle ajoute puis retire', () => {
    const { result } = renderHook(() => useSelection())
    act(() => result.current.toggle('a'))
    expect(result.current.isSelected('a')).toBe(true)
    expect(result.current.count).toBe(1)
    act(() => result.current.toggle('a'))
    expect(result.current.isSelected('a')).toBe(false)
    expect(result.current.count).toBe(0)
  })

  it('ids expose la liste sélectionnée', () => {
    const { result } = renderHook(() => useSelection())
    act(() => { result.current.toggle('a'); })
    act(() => { result.current.toggle('b'); })
    expect(result.current.ids.sort()).toEqual(['a', 'b'])
  })

  it('toggleAll : tout sélectionner puis tout désélectionner', () => {
    const { result } = renderHook(() => useSelection())
    act(() => result.current.toggleAll(['a', 'b', 'c']))
    expect(result.current.count).toBe(3)
    act(() => result.current.toggleAll(['a', 'b', 'c']))
    expect(result.current.count).toBe(0)
  })

  it('clear vide la sélection', () => {
    const { result } = renderHook(() => useSelection())
    act(() => result.current.toggleAll(['a', 'b']))
    act(() => result.current.clear())
    expect(result.current.count).toBe(0)
  })
})
