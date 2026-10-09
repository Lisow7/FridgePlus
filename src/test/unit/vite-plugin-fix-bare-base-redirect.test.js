import { describe, it, expect, vi } from 'vitest'
import { createBareBaseRedirectMiddleware } from '../../../vite-plugin-fix-bare-base-redirect.js'

function mockRes() {
  return { writeHead: vi.fn(), end: vi.fn() }
}

describe('createBareBaseRedirectMiddleware', () => {
  it('base sans slash final ("/") : ne crée aucun middleware (rien à corriger)', () => {
    expect(createBareBaseRedirectMiddleware('/')).toBeNull()
  })

  it('requête exactement égale au base sans son slash final → redirige 301 vers base + slash', () => {
    const middleware = createBareBaseRedirectMiddleware('/FridgePlus/')
    const req = { url: '/FridgePlus' }
    const res = mockRes()
    const next = vi.fn()

    middleware(req, res, next)

    expect(res.writeHead).toHaveBeenCalledWith(301, { Location: '/FridgePlus/' })
    expect(res.end).toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
  })

  it('requête base sans slash + query string → redirige en préservant la query string', () => {
    const middleware = createBareBaseRedirectMiddleware('/FridgePlus/')
    const req = { url: '/FridgePlus?recettes=1' }
    const res = mockRes()
    const next = vi.fn()

    middleware(req, res, next)

    expect(res.writeHead).toHaveBeenCalledWith(301, { Location: '/FridgePlus/?recettes=1' })
    expect(res.end).toHaveBeenCalled()
  })

  it('requête déjà avec le slash final → laisse passer (next), aucune redirection', () => {
    const middleware = createBareBaseRedirectMiddleware('/FridgePlus/')
    const req = { url: '/FridgePlus/' }
    const res = mockRes()
    const next = vi.fn()

    middleware(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.writeHead).not.toHaveBeenCalled()
  })

  it('requête vers une route imbriquée (pas le base exact) → laisse passer (next)', () => {
    const middleware = createBareBaseRedirectMiddleware('/FridgePlus/')
    const req = { url: '/FridgePlus/some/nested/path' }
    const res = mockRes()
    const next = vi.fn()

    middleware(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.writeHead).not.toHaveBeenCalled()
  })
})
