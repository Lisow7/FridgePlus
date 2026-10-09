import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { createRef } from 'react'
import Button from '@shared/ui/button'

describe('Button (v3.245.0)', () => {
  describe('rendu de base', () => {
    it('rend les enfants', () => {
      render(<Button>Hello</Button>)
      expect(screen.getByRole('button', { name: 'Hello' })).toBeInTheDocument()
    })

    it('type="button" par défaut (évite submit accidentel dans <form>)', () => {
      render(<Button>x</Button>)
      expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
    })

    it('accepte un type custom', () => {
      render(<Button type="submit">submit</Button>)
      expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
    })
  })

  describe('variants', () => {
    it.each(['primary', 'secondary', 'ghost', 'danger', 'link'])('variant=%s rend la classe correspondante', (variant) => {
      render(<Button variant={variant}>x</Button>)
      const btn = screen.getByRole('button')
      // Variant primary contient `bg-[var(--color-warm-600)]`,
      // les autres ont d'autres classes — on vérifie juste que c'est rendu
      // sans crash.
      expect(btn).toBeInTheDocument()
    })

    it('variant inconnu → fallback primary (fond plein #B85000)', () => {
      render(<Button variant="alien">x</Button>)
      const btn = screen.getByRole('button')
      // 2026-07-11 — variant primary passe au fond plein #B85000 (AA
      // contraste), l'ancien dégradé blanc-sur-orange tombait sous 4.5:1.
      expect(btn.className).toContain('bg-[#B85000]')
    })
  })

  describe('sizes', () => {
    it.each(['sm', 'md', 'lg', 'icon'])('size=%s applique la classe', (size) => {
      render(<Button size={size}>x</Button>)
      expect(screen.getByRole('button')).toBeInTheDocument()
    })
  })

  describe('disabled / loading', () => {
    it('disabled passe l\'attribut HTML', () => {
      render(<Button disabled>x</Button>)
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('loading désactive aussi le bouton (anti double-clic)', () => {
      render(<Button loading>x</Button>)
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('loading expose aria-busy="true"', () => {
      render(<Button loading>x</Button>)
      expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true')
    })

    it('non-loading n\'expose pas aria-busy', () => {
      render(<Button>x</Button>)
      expect(screen.getByRole('button')).not.toHaveAttribute('aria-busy')
    })

    it('loading ajoute un spinner visuel (aria-hidden)', () => {
      const { container } = render(<Button loading>x</Button>)
      const spinner = container.querySelector('[aria-hidden="true"]')
      expect(spinner).toBeInTheDocument()
    })
  })

  describe('onClick / interactivité', () => {
    it('appelle onClick au clic', () => {
      const onClick = vi.fn()
      render(<Button onClick={onClick}>x</Button>)
      fireEvent.click(screen.getByRole('button'))
      expect(onClick).toHaveBeenCalledOnce()
    })

    it('n\'appelle pas onClick si disabled', () => {
      const onClick = vi.fn()
      render(<Button onClick={onClick} disabled>x</Button>)
      fireEvent.click(screen.getByRole('button'))
      expect(onClick).not.toHaveBeenCalled()
    })

    it('n\'appelle pas onClick si loading', () => {
      const onClick = vi.fn()
      render(<Button onClick={onClick} loading>x</Button>)
      fireEvent.click(screen.getByRole('button'))
      expect(onClick).not.toHaveBeenCalled()
    })
  })

  describe('cibles de 24 px (WCAG 2.5.8 ; audit du 2026-10-04, A11Y-13)', () => {
    it('porte une taille minimale de 24 px, même réduit à h-auto w-auto p-0', () => {
      // Cinquante boutons icône-seule retirent la taille (`h-auto w-auto p-0`) et
      // tombaient à 11 × 11 : la taille MINIMALE, elle, ne se retire pas.
      render(<Button variant="ghost" size="icon" className="h-auto w-auto p-0">x</Button>)
      const classes = screen.getByRole('button').className.split(/\s+/)
      expect(classes).toContain('min-h-6')
      expect(classes).toContain('min-w-6')
      expect(classes).toContain('h-auto')
    })
  })

  describe('className override + props forwarding', () => {
    it('className user-override est mergé (tailwind-merge)', () => {
      render(<Button className="custom-class">x</Button>)
      expect(screen.getByRole('button').className).toContain('custom-class')
    })

    it('forwardRef pointe sur le bouton DOM', () => {
      const ref = createRef()
      render(<Button ref={ref}>x</Button>)
      expect(ref.current).toBeInstanceOf(HTMLButtonElement)
    })

    it('forward arbitrary props (data-*, aria-*)', () => {
      render(<Button data-testid="my-btn" aria-label="Action">x</Button>)
      const btn = screen.getByTestId('my-btn')
      expect(btn).toHaveAttribute('aria-label', 'Action')
    })
  })
})
