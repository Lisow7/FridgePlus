import { LuChevronLeft, LuChevronRight } from 'react-icons/lu'
import Button from '@shared/ui/button'
import { useLang } from '@shared/contexts/ui-provider'

// Primitive `Pagination` — Sprint 9 S9.b.4.
//
// Atomic component pour la pagination préc/suiv simple (pattern dupliqué
// dans 5+ sections admin : journal, users, ingredients, base-recipes,
// notifications).
//
// API :
//   <Pagination
//     page={page}                  // 0-indexed
//     totalPages={Math.ceil(count / PER_PAGE)}
//     onPageChange={setPage}
//     itemsCount={count}           // optionnel, affiche "(N entrées)"
//     itemsLabel="utilisateurs"    // optionnel, libellé
//   />
//
// Variantes :
//   - mode="label" (défaut) : boutons "← Préc." / "Suiv. →" avec texte
//   - mode="icon"           : boutons chevron icon-only

const NEUTRAL_BORDER = 'var(--color-border-soft, #EDE4D4)'
const NEUTRAL_MUTED  = 'var(--color-muted, #7A6A52)'
const NEUTRAL_TEXT   = 'var(--color-text, #2C1A0E)'

const I18N = {
  fr: { prev: 'Page précédente', next: 'Page suivante' },
  en: { prev: 'Previous page', next: 'Next page' },
}

export default function Pagination({
  page,
  totalPages,
  onPageChange,
  itemsCount = null,
  itemsLabel = '',
  mode = 'label',
  border = NEUTRAL_BORDER,
  muted = NEUTRAL_MUTED,
  text = NEUTRAL_TEXT,
  className = '',
}) {
  const { lang } = useLang()
  const t = I18N[lang] ?? I18N.fr

  if (totalPages <= 1) return null

  const canPrev = page > 0
  const canNext = page < totalPages - 1

  const prevBtn = mode === 'icon' ? <LuChevronLeft size={14} /> : '← Préc.'
  const nextBtn = mode === 'icon' ? <LuChevronRight size={14} /> : 'Suiv. →'

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        marginTop: 4,
      }}
    >
      <Button
        variant="ghost"
        size={mode === 'icon' ? 'icon' : undefined}
        onClick={() => onPageChange(Math.max(0, page - 1))}
        disabled={!canPrev}
        aria-label={t.prev}
        className={`h-auto ${mode === 'icon' ? 'w-auto px-2.5 py-1.5' : 'px-3 py-1.5'} rounded-lg border bg-transparent text-xs hover:bg-transparent`}
        style={{ borderColor: border, color: text }}
      >
        {prevBtn}
      </Button>

      <span style={{ fontSize: 13, color: muted }}>
        Page {page + 1} / {totalPages}
        {itemsCount != null && (
          <span style={{ opacity: 0.6 }}> ({itemsCount}{itemsLabel ? ` ${itemsLabel}` : ''})</span>
        )}
      </span>

      <Button
        variant="ghost"
        size={mode === 'icon' ? 'icon' : undefined}
        onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
        disabled={!canNext}
        aria-label={t.next}
        className={`h-auto ${mode === 'icon' ? 'w-auto px-2.5 py-1.5' : 'px-3 py-1.5'} rounded-lg border bg-transparent text-xs hover:bg-transparent`}
        style={{ borderColor: border, color: text }}
      >
        {nextBtn}
      </Button>
    </div>
  )
}
