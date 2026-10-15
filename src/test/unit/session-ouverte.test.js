import { describe, it, expect, beforeEach } from 'vitest'
import { marquerLaSessionOuverte, oublierLaSessionOuverte, laSessionEtaitOuverte } from '@shared/lib/auth/session-ouverte'

// Le témoin de session ouverte (décision du 2026-10-08) : sans
// stockage (navigation privée stricte), il se tait — jamais une exception.
beforeEach(() => { localStorage.clear() })

describe('le témoin de session ouverte', () => {
  it('se pose, se lit, s’oublie', () => {
    expect(laSessionEtaitOuverte()).toBe(false)
    marquerLaSessionOuverte()
    expect(laSessionEtaitOuverte()).toBe(true)
    oublierLaSessionOuverte()
    expect(laSessionEtaitOuverte()).toBe(false)
  })

  it('un stockage refusé ne lève jamais', () => {
    const { setItem, getItem, removeItem } = Storage.prototype
    const refuse = () => { throw new Error('SecurityError') }
    Object.assign(Storage.prototype, { setItem: refuse, getItem: refuse, removeItem: refuse })
    try {
      expect(() => marquerLaSessionOuverte()).not.toThrow()
      expect(() => oublierLaSessionOuverte()).not.toThrow()
      expect(laSessionEtaitOuverte()).toBe(false)
    } finally {
      Object.assign(Storage.prototype, { setItem, getItem, removeItem })
    }
  })
})
