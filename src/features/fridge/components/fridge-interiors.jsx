import { useIngredients } from '@shared/contexts/data-provider'
import { SUBCATEGORY_COLORS } from '@shared/static/subcategory-colors'
import FoodIcon from '@shared/ui/food-icon'
import { LuX } from 'react-icons/lu'
import Button from '@shared/ui/button'
import { COLORS, COLORS_DARK } from './fridge-door-colors'
import { compterEnStock } from '@features/fridge/lib/compter-en-stock'

// Intérieurs du frigo multi-portes, extraits de `fridge-multi-door.jsx` (570 l),
// qui ne garde plus que le châssis et l'animation des portes.
//
// Les quatre composants sont des DÉPLACEMENTS LITTÉRAUX — aucun caractère du
// JSX n'a changé, ce qui se prouve par `diff` contre HEAD.
//
// ⚠️ `Hinges` est exporté parce que le châssis l'utilise aussi (2 fois) : le
// laisser au parent aurait créé un import enfant → parent.
//
// ⚠️ Ce fichier n'exporte QUE des composants — les couleurs partagées vivent
// dans `fridge-door-colors.js` pour ne pas déclencher
// `react-refresh/only-export-components`.

export function Hinges({ side, topOffsets = ['8%', '38%'], hidden = false }) {
  return topOffsets.map((top, i) => (
    <div key={i} style={{
      position: 'absolute', top, [side]: '-4px', zIndex: 30,
      width: '8px', height: '22px', borderRadius: '3px',
      background: side === 'left'
        ? 'linear-gradient(90deg, #5A6A74 0%, #A8BAC4 30%, #D0DCE2 52%, #98A8B2 72%, #68787E 100%)'
        : 'linear-gradient(270deg, #5A6A74 0%, #A8BAC4 30%, #D0DCE2 52%, #98A8B2 72%, #68787E 100%)',
      boxShadow: `${side === 'left' ? '2' : '-2'}px 2px 4px rgba(0,0,0,0.35)`,
      border: '1px solid rgba(80,100,112,0.55)',
      opacity: hidden ? 0 : 1,
      transition: 'opacity 0.3s',
    }}>
      <div style={{
        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
        width: '5px', height: '5px', borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 30%, #DCE8EE 0%, #607080 100%)',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)',
      }} />
    </div>
  ))
}

function DrawerHandle() {
  return (
    <div style={{
      position: 'absolute', bottom: '6px', left: '50%', transform: 'translateX(-50%)',
      width: '50px', height: '5px', borderRadius: '3px',
      background: 'linear-gradient(90deg, #8A9AAA 0%, #C0CCD8 40%, #D8E4EC 60%, #B0BCC8 80%, #8A9AAA 100%)',
      boxShadow: '0 2px 4px rgba(0,0,0,0.20)',
    }} />
  )
}

const CLOSE_DRAWER_LABEL = { fr: 'Fermer le tiroir', en: 'Close drawer', es: 'Cerrar el cajón', de: 'Schublade schließen', ja: '引き出しを閉じる' }
const CLOSE_COMPARTMENT_LABEL = { fr: 'Fermer le compartiment', en: 'Close compartment', es: 'Cerrar el compartimento', de: 'Fach schließen', ja: 'コンパートメントを閉じる' }

export function DrawerSection({ c, openDrawerId, setOpenDrawerId, onSubcategoryClick, stock, isMobile, darkMode = false, lang = 'fr' }) {
  const INGREDIENTS = useIngredients()
  const palette = darkMode ? COLORS_DARK : COLORS
  const colors = palette[c.id] ?? (darkMode ? { bg: '#1A2535', text: '#6B9BAE' } : { bg: '#EBF3FA', text: '#6B8E8E' })
  const isExpanded = openDrawerId === c.id
  const totalStock = c.subcategories.reduce(
    (sum, sub) => sum + compterEnStock(INGREDIENTS, sub.id, stock), 0
  )
  const cols = Math.min(c.subcategories.length, 4)

  return (
    <div style={{
      flex: isExpanded ? 4 : 1,
      background: colors.bg, borderRadius: '10px', overflow: 'hidden',
      transition: 'flex 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'relative',
      border: darkMode ? `1px solid ${colors.text}40` : 'none',
      boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.06), 0 2px 6px rgba(0,0,0,0.05)',
    }}>
      {isExpanded ? (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Button
            variant="ghost"
            onClick={() => setOpenDrawerId(null)}
            aria-label={CLOSE_DRAWER_LABEL[lang] ?? CLOSE_DRAWER_LABEL.fr}
            className="h-auto w-full shrink-0 justify-start rounded-none px-2.5 py-1.5 hover:bg-transparent"
            style={{ gap: '6px', borderBottom: `1px solid ${colors.text}22` }}
          >
            <FoodIcon id={c.id} size={isMobile ? 22 : 18} color={colors.text} />
            <span style={{ fontSize: isMobile ? '20px' : '15px', fontWeight: 700, color: colors.text }}>{c.label}</span>
            <LuX className="close-x" size={isMobile ? 18 : 16} style={{ marginLeft: 'auto', color: colors.text, opacity: 0.45, flexShrink: 0 }} />
          </Button>
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', padding: '6px', flex: 1, overflowY: 'auto' }}>
              {c.subcategories.map((sub, idx) => {
                const subCount = compterEnStock(INGREDIENTS, sub.id, stock)
                const subColors = SUBCATEGORY_COLORS[sub.id] ?? colors
                return (
                  <Button
                    key={sub.id}
                    variant="ghost"
                    onClick={() => onSubcategoryClick?.(c, sub)}
                    className="h-auto justify-start rounded-xl hover:bg-transparent"
                    style={{
                      gap: '10px',
                      padding: '10px 12px', minHeight: '52px',
                      background: `${subColors.bg}cc`,
                      border: darkMode ? `1px solid ${subColors.text}40` : 'none',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                      animation: 'tile-enter 0.32s cubic-bezier(0.4,0,0.2,1) both',
                      animationDelay: `${idx * 40}ms`,
                    }}
                  >
                    <FoodIcon id={sub.id} size={24} color={subColors.text} />
                    <span style={{ flex: 1, fontSize: '20px', fontWeight: 600, color: subColors.text, textAlign: 'left' }}>
                      {sub.label}
                    </span>
                    {subCount > 0 && (
                      <div style={{
                        minWidth: '28px', height: '28px', borderRadius: '14px',
                        background: subColors.text, color: 'white',
                        fontSize: '14px', fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                      }}>{subCount}</div>
                    )}
                  </Button>
                )
              })}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '4px', padding: '4px', flex: 1 }}>
              {c.subcategories.map((sub, idx) => {
                const subCount = compterEnStock(INGREDIENTS, sub.id, stock)
                const subColors = SUBCATEGORY_COLORS[sub.id] ?? colors
                return (
                  <Button
                    key={sub.id}
                    variant="ghost"
                    onClick={() => onSubcategoryClick?.(c, sub)}
                    className="relative h-auto w-full flex-col justify-center gap-1 rounded-lg p-1 hover:bg-transparent"
                    style={{
                      background: `${subColors.bg}cc`,
                      border: darkMode ? `1px solid ${subColors.text}40` : 'none',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.10)',
                      animation: 'tile-enter 0.32s cubic-bezier(0.4,0,0.2,1) both',
                      animationDelay: `${idx * 40}ms`,
                    }}
                  >
                    {subCount > 0 && (
                      <div style={{
                        position: 'absolute', top: '3px', right: '3px',
                        minWidth: '20px', height: '20px', borderRadius: '10px',
                        background: subColors.text, color: 'white',
                        fontSize: '17px', fontWeight: 700,
                        // `padding` présent sur la tuile jumelle et absent ici :
                        // un compteur à trois chiffres débordait d'un seul côté.
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                      }}>{subCount}</div>
                    )}
                    <FoodIcon id={sub.id} size={30} color={subColors.text} />
                    <span style={{ fontSize: '21px', fontWeight: 600, color: subColors.text, textAlign: 'center', lineHeight: 1.2 }}>
                      {sub.label}
                    </span>
                  </Button>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <Button
          variant="ghost"
          onClick={() => setOpenDrawerId(c.id)}
          className="relative h-full w-full flex-col justify-center gap-1 rounded-none bg-transparent hover:bg-transparent"
        >
          <FoodIcon id={c.id} size={isMobile ? 42 : 32} color={colors.text} />
          <span style={{
            fontSize: isMobile ? '20px' : '15px', fontWeight: 600, color: colors.text,
            textAlign: 'center', lineHeight: 1.2, padding: '0 8px',
          }}>
            {c.label}
          </span>
          {totalStock > 0 && (
            <span style={{
              position: 'absolute', right: '8px', top: '6px', fontSize: '13px', fontWeight: 700,
              padding: '2px 6px', borderRadius: '999px',
              background: 'white', color: colors.text, boxShadow: '0 1px 6px rgba(0,0,0,0.14)',
            }}>{totalStock}</span>
          )}
          <DrawerHandle />
        </Button>
      )}
    </div>
  )
}

export function FreshInterior({ c, openCompartmentId, setOpenCompartmentId, onSubcategoryClick, stock, isMobile, darkMode = false, lang = 'fr' }) {
  const INGREDIENTS = useIngredients()
  const palette = darkMode ? COLORS_DARK : COLORS
  const colors = palette[c.id] ?? (darkMode ? { bg: '#162515', text: '#8CC488' } : { bg: '#E8F5E9', text: '#7BB078' })
  const isExpanded = openCompartmentId === c.id
  const totalStock = c.subcategories.reduce(
    (sum, sub) => sum + compterEnStock(INGREDIENTS, sub.id, stock), 0
  )

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: '14px', padding: '4px', boxSizing: 'border-box' }}>
      {isExpanded ? (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Button
            variant="ghost"
            onClick={() => setOpenCompartmentId(null)}
            aria-label={CLOSE_COMPARTMENT_LABEL[lang] ?? CLOSE_COMPARTMENT_LABEL.fr}
            className="h-auto w-full shrink-0 justify-start rounded-none px-2.5 py-1.5 hover:bg-transparent"
            style={{ gap: '6px', borderBottom: `1px solid ${colors.text}22` }}
          >
            <FoodIcon id={c.id} size={isMobile ? 22 : 18} color={colors.text} />
            <span style={{ fontSize: isMobile ? '20px' : '15px', fontWeight: 700, color: colors.text }}>{c.label}</span>
            <LuX className="close-x" size={isMobile ? 18 : 16} style={{ marginLeft: 'auto', color: colors.text, opacity: 0.45, flexShrink: 0 }} />
          </Button>
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', padding: '6px', flex: 1, overflowY: 'auto' }}>
              {c.subcategories.map((sub, idx) => {
                const subCount = compterEnStock(INGREDIENTS, sub.id, stock)
                const subColors = SUBCATEGORY_COLORS[sub.id] ?? colors
                return (
                  <Button
                    key={sub.id}
                    variant="ghost"
                    onClick={() => onSubcategoryClick?.(c, sub)}
                    className="h-auto justify-start rounded-xl hover:bg-transparent"
                    style={{
                      gap: '10px',
                      padding: '10px 12px', minHeight: '52px',
                      background: `${subColors.bg}cc`,
                      border: darkMode ? `1px solid ${subColors.text}40` : 'none',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                      animation: 'tile-enter 0.32s cubic-bezier(0.4,0,0.2,1) both',
                      animationDelay: `${idx * 40}ms`,
                    }}
                  >
                    <FoodIcon id={sub.id} size={24} color={subColors.text} />
                    <span style={{ flex: 1, fontSize: '20px', fontWeight: 600, color: subColors.text, textAlign: 'left' }}>
                      {sub.label}
                    </span>
                    {subCount > 0 && (
                      <div style={{
                        minWidth: '28px', height: '28px', borderRadius: '14px',
                        background: subColors.text, color: 'white',
                        fontSize: '14px', fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                      }}>{subCount}</div>
                    )}
                  </Button>
                )
              })}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px', padding: '4px', flex: 1 }}>
              {c.subcategories.map((sub, idx) => {
                const subCount = compterEnStock(INGREDIENTS, sub.id, stock)
                const subColors = SUBCATEGORY_COLORS[sub.id] ?? colors
                return (
                  <Button
                    key={sub.id}
                    variant="ghost"
                    onClick={() => onSubcategoryClick?.(c, sub)}
                    className="relative h-auto w-full flex-col justify-center gap-1 rounded-[10px] px-1 py-1.5 hover:bg-transparent"
                    style={{
                      background: `${subColors.bg}cc`,
                      // 🔴 Cette bordure manquait ici alors que la tuile jumelle
                      // de `DrawerSection` l'avait : en thème sombre, les tuiles
                      // d'un compartiment étaient cernées et celles de l'autre
                      // non. Dérive née de la duplication du bloc (audit
                      // 2026-08-28) — les deux copies doivent rester alignées.
                      border: darkMode ? `1px solid ${subColors.text}40` : 'none',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.10)',
                      animation: 'tile-enter 0.32s cubic-bezier(0.4,0,0.2,1) both',
                      animationDelay: `${idx * 40}ms`,
                    }}
                  >
                    {subCount > 0 && (
                      <div style={{
                        position: 'absolute', top: '4px', right: '4px',
                        minWidth: '22px', height: '22px', borderRadius: '11px',
                        background: subColors.text, color: 'white',
                        fontSize: '13px', fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                      }}>{subCount}</div>
                    )}
                    <FoodIcon id={sub.id} size={24} color={subColors.text} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: subColors.text, textAlign: 'center', lineHeight: 1.2 }}>
                      {sub.label}
                    </span>
                  </Button>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <Button
          variant="ghost"
          onClick={() => setOpenCompartmentId(c.id)}
          className="relative h-full w-full flex-col justify-center gap-2 rounded-none bg-transparent hover:bg-transparent"
        >
          <FoodIcon id={c.id} size={isMobile ? 50 : 42} color={colors.text} />
          <span style={{
            fontSize: isMobile ? '22px' : '17px', fontWeight: 600, color: colors.text,
            textAlign: 'center', lineHeight: 1.2, padding: '0 12px',
          }}>
            {c.label}
          </span>
          {totalStock > 0 && (
            <span style={{
              position: 'absolute', right: '8px', top: '6px', fontSize: '13px', fontWeight: 700,
              padding: '2px 6px', borderRadius: '999px',
              background: 'white', color: colors.text, boxShadow: '0 1px 6px rgba(0,0,0,0.14)',
            }}>{totalStock}</span>
          )}
        </Button>
      )}
    </div>
  )
}
