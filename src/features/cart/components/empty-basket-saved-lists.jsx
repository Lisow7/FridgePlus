import { LuListChecks, LuPackage, LuChevronRight } from 'react-icons/lu'
import Button from '@shared/ui/button'

// Section « Mes listes récentes » de l'empty state du panier, extraite de
// `empty-basket-state.jsx` le 2026-07-30 (§2 audit front : aucun fichier
// composant > 500 lignes).
//
// Présentationnel : `recentLists` et `loadingId` restent dans le parent, qui
// les charge et pilote `onLoad`. Les deux helpers de formatage descendent ici
// car ils n'étaient utilisés que par cette section.

function formatDate(iso, lang) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang, {
      day: 'numeric', month: 'short',
    })
  } catch {
    return iso.slice(0, 10)
  }
}

// Sprint 4 PR S4.d. Avant : `count <= 1` traitait `0` comme
// singulier dans toutes les langues, ce qui produit «0 item» en EN/ES/DE
// au lieu de «0 items / 0 elementos / 0 Einträge». La règle correcte :
//   - FR : singulier pour 0 et 1, pluriel ≥ 2 (`count <= 1`)
//   - EN, ES, DE : singulier UNIQUEMENT pour 1, pluriel pour 0 et ≥ 2
//     (`count === 1`)
//   - JA : pas de pluriel, les deux clés portent le même texte
function pluralizeItems(count, t, lang) {
  const isSingular = lang === 'fr' ? count <= 1 : count === 1
  const key = isSingular ? 'items' : 'items_plural'
  return t[key].replace('{{n}}', count)
}

export default function EmptyBasketSavedLists({
  recentLists, loadingId, onLoad, onOpenLists, isActiveListMode,
  lang, darkMode, t,
  fg, muted, border, sectionBg, cardBg,
}) {
  return (
    <>
      {/* ─── 2. Mes listes récentes (action principale) ──────────────── */}
      <section
        aria-labelledby="my-recent-lists-title"
        style={{
          display: 'flex', flexDirection: 'column', gap: '8px',
          padding: '14px',
          background: sectionBg,
          border: `1.5px solid ${border}`,
          borderRadius: '14px',
        }}
      >
        {/* Header section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span aria-hidden="true" style={{
            width: '28px', height: '28px', borderRadius: '8px',
            background: 'var(--gradient-warm)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#2C1A0E',
          }}>
            <LuListChecks size={14} />
          </span>
          <h3
            id="my-recent-lists-title"
            style={{
              margin: 0, fontSize: '13px', fontWeight: 700,
              color: fg, letterSpacing: '0.01em',
            }}
          >
            {isActiveListMode ? t.myListsTitleActive : t.myListsTitle}
          </h3>
        </div>

        {/* Empty state listes */}
        {recentLists.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '10px',
            padding: '14px 12px',
            border: `1px dashed ${border}`,
            borderRadius: '10px',
            fontSize: '12px', color: muted,
            textAlign: 'center', lineHeight: 1.5,
          }}>
            <span>{t.noListsYet}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
              {onOpenLists && (
                <Button
                  variant="ghost"
                  onClick={onOpenLists}
                  className="h-auto gap-1.5 rounded-lg border-[1.5px] px-3 py-2 text-xs font-bold text-[var(--color-warm-600)] hover:bg-[var(--color-warm-600)]/10"
                  style={{ borderColor: darkMode ? 'rgba(247,168,94,0.40)' : 'rgba(212,106,16,0.40)' }}
                >
                  <LuListChecks size={12} aria-hidden="true" />
                  <span>{t.ctaSeeMyLists}</span>
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Cards listes : pastille + nom + meta + chevron load */}
        {recentLists.map(list => {
          const itemsCount = Array.isArray(list.items) ? list.items.length : 0
          const isClickable = !!onLoad
          const isLoading = loadingId === list.id
          const ariaLabel = t.loadAria
            .replace('{{name}}', list.name)
            .replace('{{count}}', pluralizeItems(itemsCount, t, lang))
          return (
            <Button
              key={list.id}
              variant="ghost"
              type="button"
              onClick={() => onLoad(list)}
              disabled={!isClickable || isLoading}
              aria-label={ariaLabel}
              className="h-auto justify-start rounded-[10px] border-[1.5px] px-3 py-2.5 text-left hover:bg-transparent disabled:opacity-60"
              style={{
                gap: '12px',
                background: cardBg,
                borderColor: border,
                color: fg,
                transition: 'transform 0.15s, background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => {
                if (!isClickable || isLoading) return
                e.currentTarget.style.background = darkMode
                  ? 'rgba(247,168,94,0.14)'
                  : 'rgba(212,106,16,0.08)'
                e.currentTarget.style.borderColor = darkMode
                  ? 'rgba(247,168,94,0.50)'
                  : 'rgba(212,106,16,0.40)'
                e.currentTarget.style.transform = 'translateX(2px)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = cardBg
                e.currentTarget.style.borderColor = border
                e.currentTarget.style.transform = 'translateX(0)'
              }}
            >
              {/* Pastille colorée à gauche */}
              <span aria-hidden="true" style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: darkMode
                  ? 'linear-gradient(135deg, rgba(247,168,94,0.22) 0%, rgba(212,106,16,0.12) 100%)'
                  : 'linear-gradient(135deg, rgba(247,168,94,0.20) 0%, rgba(212,106,16,0.10) 100%)',
                color: darkMode ? 'var(--color-brand-400)' : '#C05010',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <LuPackage size={17} strokeWidth={1.8} />
              </span>

              {/* Texte */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '14px', fontWeight: 600,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  color: fg,
                }}>
                  {list.name}
                </div>
                <div style={{
                  fontSize: '11px', color: muted, marginTop: '2px',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                  <span>{pluralizeItems(itemsCount, t, lang)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatDate(list.updated_at, lang)}</span>
                </div>
              </div>

              {/* Chevron load à droite */}
              {isClickable && (
                <span aria-hidden="true" style={{
                  color: darkMode ? 'var(--color-brand-400)' : '#C05010',
                  flexShrink: 0,
                  opacity: isLoading ? 0.5 : 1,
                }}>
                  <LuChevronRight size={18} />
                </span>
              )}
            </Button>
          )
        })}

      </section>
    </>
  )
}
