import { forwardRef } from 'react'
import { cn } from '@shared/lib/cn'

// Sprint 8 PR S8.a — Design system `<Button>`.
//
// Composant réutilisable selon le pattern shadcn/ui adapté à Fridge+ :
//   - Variants typés (primary / secondary / ghost / danger / link)
//   - Tailles (sm / md / lg / icon)
//   - Loading state, disabled state, focus visible, ARIA out of the box
//   - className user-override possible (passé à `cn()`)
//   - Compatible refs (forwardRef)
//
// Usage :
//   <Button>Texte</Button>
//   <Button variant="secondary" size="lg" onClick={...}>Annuler</Button>
//   <Button variant="danger" disabled>Supprimer</Button>
//   <Button variant="ghost" size="icon" aria-label="Fermer"><LuX /></Button>
//   <Button loading>Sauvegarde…</Button>
//
// Couleurs : alignées sur les tokens CSS variables du projet
// (cf. `src/index.css` — `--color-warm-600` = `#B85000` AA-compliant).
// Pourquoi pas CVA : pour un projet de cette taille, un objet plain
// suffit ; pas besoin d'ajouter une dépendance.

const VARIANTS = {
  // Primary — fond plein #B85000 (`--color-warm-600`, doc "AA-compliant"
  // ci-dessous). Remplace l'ancien dégradé signature #F7A85E->#D46A10 :
  // texte blanc dessus tombait à ~2:1 (côté clair) / ~3.6:1 (côté foncé),
  // sous le seuil WCAG AA 4.5:1 — illisible par endroits (retour
  // utilisateur 2026-07-11, généralisé à tous les boutons primary après
  // correction ciblée réussie sur Installer l'app / Contacter le support).
  primary:   'bg-[#B85000] text-white shadow-[0_2px_8px_rgba(184,80,0,0.20)] hover:opacity-90 active:scale-[0.98]',
  secondary: 'bg-transparent text-[var(--color-charcoal)] border border-[var(--color-warm-600)] hover:bg-[var(--color-warm-600)]/10 active:scale-[0.98]',
  ghost:     'bg-transparent text-[var(--color-charcoal)] hover:bg-[var(--color-warm-600)]/10 active:bg-[var(--color-warm-600)]/15',
  danger:    'bg-[#DC2626] text-white hover:opacity-90 active:scale-[0.98]',
  link:      'bg-transparent text-[var(--color-warm-600)] underline-offset-2 hover:underline',
}

const SIZES = {
  sm:   'h-8 px-3 text-xs',
  md:   'h-10 px-4 text-sm',
  lg:   'h-12 px-6 text-base',
  icon: 'h-10 w-10 p-0',
}

const BASE = [
  'inline-flex items-center justify-center gap-2',
  // Jamais sous 24 × 24 px, même quand un site retire la taille (`h-auto
  // w-auto p-0`) : WCAG 2.2, 2.5.8 (audit du 2026-10-04, A11Y-13).
  'min-h-6 min-w-6',
  'font-semibold rounded-lg',
  'cursor-pointer select-none',
  'transition-[opacity,transform,background-color] duration-150',
  'disabled:opacity-50 disabled:pointer-events-none',
  // Focus : la règle `:focus-visible` d'index.css (un contour, qui reste
  // visible en contraste élevé, contrairement à l'anneau `ring` — audit du
  // 2026-10-04, A11Y-02 et A11Y-18).
  'font-[inherit]',
].join(' ')

const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled,
    type = 'button',
    className,
    children,
    ...rest
  },
  ref
) {
  const variantCls = VARIANTS[variant] ?? VARIANTS.primary
  const sizeCls = SIZES[size] ?? SIZES.md

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading ? 'true' : undefined}
      className={cn(BASE, variantCls, sizeCls, className)}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="inline-block h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin"
        />
      )}
      {children}
    </button>
  )
})

export default Button
