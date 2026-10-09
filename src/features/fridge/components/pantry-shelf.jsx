import { useState, useEffect } from 'react'
import { useIngredients } from '@shared/contexts/data-provider'
import { SUBCATEGORY_COLORS } from '@shared/static/subcategory-colors'
import { useWindowWidth } from '@shared/hooks/use-window-width'
import FoodIcon from '@shared/ui/food-icon'
import { LuX } from 'react-icons/lu'
import Button from '@shared/ui/button'
import { compterEnStock } from '@features/fridge/lib/compter-en-stock'

const SECTION_COLORS = {
  dry:    { bg: '#FEF8E8', text: '#936614' },
  spices: { bg: '#F5E6D3', text: '#8A5810' },
}

const SECTION_COLORS_DARK = {
  dry:    { bg: '#231E10', text: '#D4B860' },
  spices: { bg: '#261505', text: '#D49030' },
}

const CLOSE_SECTION_LABEL = { fr: 'Fermer la section', en: 'Close section', es: 'Cerrar la sección', de: 'Bereich schließen', ja: 'セクションを閉じる' }

export default function PantryShelf({ sections, onSubcategoryClick, stock = new Set(), label = 'Garde-manger', closeSignal = 0, onOpenChange, darkMode = false, noAutoScale = false, lang = 'fr' }) {
  const closeSectionLabel = CLOSE_SECTION_LABEL[lang] ?? CLOSE_SECTION_LABEL.fr
  const INGREDIENTS = useIngredients()
  const windowWidth = useWindowWidth()
  const isSmall  = !noAutoScale && windowWidth < 1280
  const baseWidth = isSmall ? 400 : 240
  const scale = isSmall
    ? Math.min(
        (windowWidth - 48) / baseWidth,
        (window.innerHeight - 250) / 680,
        windowWidth >= 768 ? 1.6 : windowWidth >= 640 ? 1.5 : 1
      )
    : 1

  const [openSectionId, setOpenSectionId] = useState(null)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (closeSignal > 0) setOpenSectionId(null) }, [closeSignal])
  useEffect(() => { onOpenChange?.(openSectionId !== null) }, [openSectionId, onOpenChange])

  const handleSectionClick = (section) => {
    setOpenSectionId((prev) => (prev === section.id ? null : section.id))
  }

  const pantryBg     = darkMode ? '#1C2010' : '#F5EDD8'
  const pantryBorder = darkMode ? '#282215' : '#E8D9C0'

  return (
    <div style={isSmall ? { width: `${baseWidth * scale}px`, height: `${680 * scale}px`, position: 'relative', flexShrink: 0 } : {}}>
    <div style={isSmall ? { position: 'absolute', top: 0, left: 0, transformOrigin: 'top left', transform: `scale(${scale})` } : {}}>
    <div
      className="flex flex-col rounded-3xl overflow-hidden"
      style={{
        width: `${baseWidth}px`, height: '680px',
        background: pantryBg,
        transition: 'background 0.3s ease',
        boxShadow: isSmall
          ? '0 2px 8px rgba(0,0,0,0.07), 0 6px 18px -4px rgba(0,0,0,0.08), 0 14px 36px -8px rgba(0,0,0,0.09)'
          : '0 1px 3px rgba(0,0,0,0.05), 0 4px 14px rgba(0,0,0,0.06), 0 16px 40px rgba(0,0,0,0.05), 0 32px 64px -12px rgba(0,0,0,0.07)',
      }}
    >
      {/* Titre */}
      <div className="px-3 py-2.5 text-center shrink-0" style={{ borderBottom: `1px solid ${pantryBorder}` }}>
        <span className="text-sm font-semibold text-[var(--color-muted)] uppercase tracking-widest">
          {label}
        </span>
      </div>

      {/* Sections */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {sections.map((section, i) => {
          const colors = darkMode
            ? (SECTION_COLORS_DARK[section.id] ?? { bg: '#231E10', text: '#D4B860' })
            : (SECTION_COLORS[section.id]      ?? { bg: '#FEF8E8', text: '#936614' })
          const isExpanded = openSectionId === section.id

          return (
            <div
              key={section.id}
              className="overflow-hidden"
              style={{
                flex: isExpanded ? Math.max(section.subcategories.length * 0.9, 3) : 1,
                background: colors.bg,
                borderBottom: i < sections.length - 1 ? `1px solid ${pantryBorder}` : 'none',
                transition: 'flex 0.45s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s ease',
              }}
            >
              {isExpanded ? (
                <div className="flex flex-col h-full">
                  <Button
                    variant="ghost"
                    onClick={() => setOpenSectionId(null)}
                    aria-label={closeSectionLabel}
                    className="h-auto w-full shrink-0 justify-start gap-2 rounded-none px-3 py-1.5 hover:brightness-95 hover:bg-transparent"
                    style={{ borderBottom: `1px solid ${colors.text}22`, transition: 'all 0.15s' }}
                  >
                    <FoodIcon id={section.id} size={isSmall ? 22 : 18} color={colors.text} />
                    <span style={{ color: colors.text, fontSize: isSmall ? '20px' : '16px', fontWeight: 700 }}>
                      {section.label}
                    </span>
                    <LuX className="close-x ml-auto" size={isSmall ? 18 : 16} style={{ color: colors.text, opacity: 0.45, flexShrink: 0 }} />
                  </Button>
                  <div className="flex flex-col gap-1 p-1.5 flex-1">
                    {section.subcategories.map((sub, idx) => {
                      const subCount = compterEnStock(INGREDIENTS, sub.id, stock)
                      const subColors = SUBCATEGORY_COLORS[sub.id] ?? colors
                      return (
                        <Button
                          key={sub.id}
                          variant="ghost"
                          onClick={() => onSubcategoryClick?.(section, sub)}
                          className="relative h-auto w-full flex-1 justify-start gap-2 rounded-lg px-3 hover:brightness-95 hover:bg-transparent"
                          style={{
                            minHeight: isSmall ? '52px' : undefined,
                            background: `${subColors.bg}cc`,
                            border: darkMode ? `1px solid ${subColors.text}40` : 'none',
                            boxShadow: '0 3px 8px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.07)',
                            animation: 'tile-enter 0.32s cubic-bezier(0.4,0,0.2,1) both',
                            animationDelay: `${idx * 55}ms`,
                            transition: 'all 0.15s',
                          }}
                        >
                          <FoodIcon id={sub.id} size={isSmall ? 24 : 26} color={subColors.text} />
                          <span style={{ color: subColors.text, fontSize: isSmall ? '20px' : '22px', fontWeight: 600, lineHeight: 1.25 }}>
                            {sub.label}
                          </span>
                          {subCount > 0 && (
                            <div style={{
                              marginLeft: 'auto',
                              minWidth: '24px', height: '24px', borderRadius: '12px',
                              background: subColors.text, color: 'white',
                              fontSize: '16px', fontWeight: 700,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              padding: '0 6px',
                              boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                            }}>
                              {subCount}
                            </div>
                          )}
                        </Button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  onClick={() => handleSectionClick(section)}
                  className="relative h-full w-full flex-col justify-center gap-1.5 rounded-none bg-transparent hover:brightness-95 hover:bg-transparent"
                  style={{ paddingBottom: '24px', transition: 'all 0.15s' }}
                >
                  <FoodIcon id={section.id} size={isSmall ? 52 : 40} color={colors.text} />
                  <span style={{ fontSize: isSmall ? '22px' : '18px', fontWeight: 600, textAlign: 'center', lineHeight: 1.25, color: colors.text }}>
                    {section.label}
                  </span>
                  {/* ⛔ NE PAS remettre `opacity-70` ici. Mesure axe-core : avec
                      elle, ce texte tombait a 3,44 et 3,19:1 en clair, 3,17 et
                      3,25:1 en sombre — sous le 4,5:1 exige, des QUATRE cotes.
                      🔴 Et `opacity: 1` est la SEULE valeur qui les fait tous
                      passer : 0.80 -> 3,72 a 4,31 · 0.85 -> 4,03 a 4,88 ·
                      0.90 -> 4,36 a 5,48 · 1.00 -> 5,05 a 7,03. La raison est
                      que le versant sombre demande d'ECLAIRCIR quand le clair
                      demande d'ASSOMBRIR : aucune opacite intermediaire ne
                      satisfait les deux. */}
                  <span className="text-sm text-[var(--color-muted)] text-center leading-tight px-2">
                    {section.desc}
                  </span>
                  <div className="fp-poignee" style={{
                    position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)',
                    width: '44px', height: '5px', borderRadius: '3px',
                    background: `linear-gradient(90deg, ${colors.text}44 0%, ${colors.text}99 35%, ${colors.text}bb 50%, ${colors.text}99 65%, ${colors.text}44 100%)`,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.12)',
                  }} />
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </div>
    </div>
    </div>
  )
}
