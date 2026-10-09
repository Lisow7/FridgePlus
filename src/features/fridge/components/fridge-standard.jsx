import { useState, useEffect } from 'react'
import { useIngredients } from '@shared/contexts/data-provider'
import { SUBCATEGORY_COLORS } from '@shared/static/subcategory-colors'
import FoodIcon from '@shared/ui/food-icon'
import { LuX } from 'react-icons/lu'
import { useWindowWidth } from '@shared/hooks/use-window-width'
import { isLeftoverExpired } from '@features/fridge/api/leftovers'
import Button from '@shared/ui/button'
import { compterEnStock } from '@features/fridge/lib/compter-en-stock'

const COMPARTMENT_COLORS = {
  freezer:   { bg: '#E8F4F8', text: '#5B9AAE' },
  fresh:     { bg: '#E8F5E9', text: '#7BB078' },
  leftovers: { bg: '#F5F5F5', text: '#9E9E9E' },
  vegetable: { bg: '#F1F5E8', text: '#6B8E23' },
  crisper:   { bg: '#F1F5E8', text: '#6B8E23' },
}

const COMPARTMENT_COLORS_DARK = {
  freezer:   { bg: '#182535', text: '#6AAFCA' },
  fresh:     { bg: '#162515', text: '#8CC488' },
  leftovers: { bg: '#1E2020', text: '#909090' },
  vegetable: { bg: '#182215', text: '#85A040' },
  crisper:   { bg: '#182215', text: '#85A040' },
}

const isToday = (dateStr) => new Date(dateStr).toDateString() === new Date().toDateString()
// today = créés aujourd'hui ; thisweek = vue d'ensemble = tous les actifs
const getActiveCount = (leftovers, view) => leftovers.filter(l => {
  if (isLeftoverExpired(l.expires_at)) return false
  return view === 'today' ? isToday(l.created_at) : true
}).length

const OPEN_LABEL = { fr: 'Ouvrir le frigo', en: 'Open the fridge', es: 'Abrir el refrigerador', de: 'Kühlschrank öffnen', ja: '冷蔵庫を開ける' }
const EXPIRED_LABEL = { fr: 'Expiré', en: 'Expired', es: 'Caducado', de: 'Abgelaufen', ja: '期限切れ' }
const CLOSE_COMPARTMENT_LABEL = { fr: 'Fermer le compartiment', en: 'Close compartment', es: 'Cerrar el compartimento', de: 'Fach schließen', ja: 'コンパートメントを閉じる' }

export default function FridgeStandard({ layout, lang = 'fr', onSubcategoryClick, stock = new Set(), onDoorChange, doorCloseSignal, doorOpenSignal = 0, darkMode = false, leftovers = [], expiredLeftoversCount = 0, noAutoScale = false }) {
  const INGREDIENTS = useIngredients()
  const windowWidth = useWindowWidth()
  const isMobile = !noAutoScale && windowWidth < 1024
  const needsScale = !noAutoScale && windowWidth < 1280
  const scale = needsScale ? Math.min(
    (windowWidth - 48) / 400,
    (window.innerHeight - 250) / 680,
    windowWidth >= 768 ? 1.6 : windowWidth >= 640 ? 1.5 : 1
  ) : 1

  const [isOpen, setIsOpen] = useState(false)
  const [openCompartmentId, setOpenCompartmentId] = useState(null)

  useEffect(() => { onDoorChange?.(isOpen) }, [isOpen, onDoorChange])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (doorCloseSignal > 0) { setIsOpen(false); setOpenCompartmentId(null) } }, [doorCloseSignal])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (doorOpenSignal > 0) setIsOpen(true) }, [doorOpenSignal])

  const handleCompartmentClick = (c) => {
    setOpenCompartmentId((prev) => (prev === c.id ? null : c.id))
  }

  const normalShadow = isMobile
    ? '0 2px 8px rgba(0,0,0,0.07), 0 6px 18px -4px rgba(0,0,0,0.09), 0 14px 36px -8px rgba(0,0,0,0.10)'
    : '0 1px 3px rgba(0,0,0,0.06), 0 6px 18px rgba(0,0,0,0.07), 0 20px 50px rgba(0,0,0,0.06), 0 42px 84px -12px rgba(0,0,0,0.09)'
  const darkShadow   = '0 2px 10px rgba(0,0,0,0.35), 0 6px 24px rgba(0,0,0,0.28), 0 20px 48px rgba(0,0,0,0.22)'
  const glowShadow   = '0 0 80px 30px rgba(185,228,255,0.18), 0 0 180px 90px rgba(168,218,255,0.08), 0 0 300px 150px rgba(155,208,255,0.03), 0 2px 10px rgba(0,0,0,0.35), 0 6px 24px rgba(0,0,0,0.28)'
  const fridgeShadow = darkMode ? (isOpen ? glowShadow : darkShadow) : normalShadow

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Wrapper mise à l'échelle mobile */}
      <div style={needsScale ? {
        width: `${400 * scale}px`,
        height: `${680 * scale}px`,
        position: 'relative',
        flexShrink: 0,
      } : {}}>
        <div style={needsScale ? {
          position: 'absolute', top: 0, left: 0,
          transformOrigin: 'top left',
          transform: `scale(${scale})`,
        } : {}}>
          <div style={{ perspective: '1600px', perspectiveOrigin: '35% 50%' }}>
            <div
              className="relative rounded-3xl"
              style={{
                width: '400px', height: '680px',
                background: darkMode ? '#1A2535' : '#E8EEF5',
                boxShadow: fridgeShadow,
                transition: 'box-shadow 0.65s ease, background 0.3s ease',
                ...(isMobile ? { overflow: 'hidden' } : {}),
              }}
            >
              {/* Néon */}
              <div style={{ position: 'absolute', top: '6px', left: '50%', transform: 'translateX(-50%)', width: '72%', height: '8px', display: 'flex', alignItems: 'center', zIndex: 10, opacity: isOpen ? 1 : 0, transition: 'opacity 0.35s ease' }}>
                <div style={{ width: '8px', height: '12px', borderRadius: '2px', flexShrink: 0, background: isOpen ? '#A8C8DC' : (darkMode ? '#2A3D52' : '#9AAAB8'), transition: 'background 0.2s' }} />
                <div style={{ flex: 1, height: '7px', borderRadius: '3.5px', background: isOpen ? 'linear-gradient(180deg, #FFFFFF 0%, #E4F5FF 100%)' : (darkMode ? '#243648' : '#BCC8D4'), boxShadow: isOpen ? '0 0 6px 2px rgba(210,240,255,0.95), 0 0 16px 6px rgba(185,230,255,0.60), 0 0 32px 12px rgba(165,220,255,0.30)' : 'none', transition: 'background 0.15s, box-shadow 0.4s' }} />
                <div style={{ width: '8px', height: '12px', borderRadius: '2px', flexShrink: 0, background: isOpen ? '#A8C8DC' : (darkMode ? '#2A3D52' : '#9AAAB8'), transition: 'background 0.2s' }} />
              </div>

              {/* Halo de lumière — dark mode uniquement */}
              {isOpen && darkMode && (
                <div
                  className="absolute inset-0 pointer-events-none rounded-3xl z-10"
                  style={{
                    background: 'linear-gradient(180deg, rgba(215,242,255,0.22) 0%, rgba(208,238,255,0.11) 22%, rgba(200,234,255,0.05) 45%, rgba(195,230,255,0.02) 65%, transparent 85%)',
                    animation: 'fridge-light 0.55s ease-out both',
                  }}
                />
              )}

              {/* Intérieur — compartiments */}
              <div
                className="absolute inset-0 flex flex-col gap-2 p-3 pt-10"
                data-testid="fridge-compartments"
                inert={!isOpen}
              >
                {layout.fridge.map((c) => {
                  const palette = darkMode
                    ? (COMPARTMENT_COLORS_DARK[c.id] ?? { bg: '#1E2E40', text: '#6B9BAE' })
                    : (COMPARTMENT_COLORS[c.id]      ?? { bg: '#EBF3FA', text: '#6B8E8E' })
                  const isExpanded = openCompartmentId === c.id
                  const isLeftovers = c.id === 'leftovers'
                  const totalStock = isLeftovers
                    ? leftovers.filter(l => !isLeftoverExpired(l.expires_at)).length
                    : c.subcategories.reduce(
                        (sum, sub) => sum + compterEnStock(INGREDIENTS, sub.id, stock), 0
                      )
                  const showExpiredBadge = isLeftovers && expiredLeftoversCount > 0

                  return (
                    <div
                      key={c.id}
                      className="rounded-2xl overflow-hidden"
                      style={{
                        flex: isExpanded ? Math.max(c.flex * 2.5, 4) : c.flex,
                        background: palette.bg,
                        border: darkMode ? `1px solid ${palette.text}40` : 'none',
                        transition: 'flex 0.45s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s ease',
                      }}
                    >
                      {isExpanded ? (
                        <div className="flex flex-col h-full">
                          <Button
                            variant="ghost"
                            onClick={() => setOpenCompartmentId(null)}
                            aria-label={CLOSE_COMPARTMENT_LABEL[lang] ?? CLOSE_COMPARTMENT_LABEL.fr}
                            className="h-auto w-full shrink-0 justify-start gap-3 rounded-none px-4 py-2 hover:brightness-95 hover:bg-transparent"
                            style={{ borderBottom: `1px solid ${palette.text}22`, transition: 'all 0.15s' }}
                          >
                            <FoodIcon id={c.id} size={22} color={palette.text} />
                            <span style={{ fontSize: isMobile ? '20px' : '16px', fontWeight: 600, color: palette.text }}>{c.label}</span>
                            <LuX className="close-x ml-auto" size={isMobile ? 18 : 16} style={{ color: palette.text, opacity: 0.45, flexShrink: 0 }} />
                          </Button>
                          {isMobile ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px', flex: 1, overflowY: 'auto' }}>
                              {c.subcategories.map((sub, idx) => {
                                const subCount = (sub.id === 'today' || sub.id === 'thisweek')
                                  ? getActiveCount(leftovers, sub.id)
                                  : compterEnStock(INGREDIENTS, sub.id, stock)
                                const subColors = SUBCATEGORY_COLORS[sub.id] ?? palette
                                return (
                                  <Button
                                    key={sub.id}
                                    variant="ghost"
                                    onClick={() => onSubcategoryClick?.(c, sub)}
                                    className="h-auto justify-start rounded-[14px] hover:bg-transparent"
                                    style={{
                                      gap: '12px',
                                      padding: '10px 14px', minHeight: '52px',
                                      background: `${subColors.bg}cc`,
                                      border: darkMode ? `1px solid ${subColors.text}40` : 'none',
                                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                      animation: 'tile-enter 0.32s cubic-bezier(0.4,0,0.2,1) both',
                                      animationDelay: `${idx * 45}ms`,
                                    }}
                                  >
                                    <FoodIcon id={sub.id} size={26} color={subColors.text} />
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
                            <div className="grid grid-cols-2 gap-2 p-2 flex-1">
                              {c.subcategories.map((sub, idx) => {
                                const subCount = (sub.id === 'today' || sub.id === 'thisweek')
                                  ? getActiveCount(leftovers, sub.id)
                                  : compterEnStock(INGREDIENTS, sub.id, stock)
                                const subColors = SUBCATEGORY_COLORS[sub.id] ?? palette
                                return (
                                  <Button
                                    key={sub.id}
                                    variant="ghost"
                                    onClick={() => onSubcategoryClick?.(c, sub)}
                                    className="relative h-auto w-full flex-col justify-center gap-1.5 rounded-xl hover:brightness-95 hover:bg-transparent"
                                    style={{
                                      background: `${subColors.bg}cc`,
                                      border: darkMode ? `1px solid ${subColors.text}40` : 'none',
                                      boxShadow: '0 3px 8px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.07)',
                                      animation: 'tile-enter 0.32s cubic-bezier(0.4,0,0.2,1) both',
                                      animationDelay: `${idx * 55}ms`,
                                      transition: 'all 0.15s',
                                    }}
                                  >
                                    {subCount > 0 && (
                                      <div style={{
                                        position: 'absolute', top: '5px', right: '5px',
                                        minWidth: '22px', height: '22px', borderRadius: '11px',
                                        background: subColors.text, color: 'white',
                                        fontSize: '18px', fontWeight: 700,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
                                        boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                                      }}>{subCount}</div>
                                    )}
                                    <FoodIcon id={sub.id} size={34} color={subColors.text} />
                                    {!(windowWidth < 640 && c.id === 'freezer') && (
                                      <span className="font-semibold text-center leading-tight px-1" style={{ color: subColors.text, fontSize: '22px' }}>
                                        {sub.label}
                                      </span>
                                    )}
                                  </Button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          onClick={() => handleCompartmentClick(c)}
                          className="relative h-full w-full flex-col justify-center gap-1.5 rounded-none bg-transparent hover:brightness-95 hover:bg-transparent"
                          style={{ transition: 'all 0.15s' }}
                        >
                          <FoodIcon
                            id={c.id}
                            size={isMobile
                              ? ((c.flex ?? 1) >= 2 ? 50 : (c.flex ?? 1) >= 1.5 ? 46 : 40)
                              : ((c.flex ?? 1) >= 2 ? 44 : (c.flex ?? 1) >= 1.5 ? 40 : 32)
                            }
                            color={palette.text}
                          />
                          <span style={{
                            fontSize: isMobile
                              ? ((c.flex ?? 1) >= 1.5 ? '22px' : '19px')
                              : ((c.flex ?? 1) >= 1.5 ? '24px' : '22px'),
                            fontWeight: 600, color: palette.text,
                            textAlign: 'center', lineHeight: 1.2, padding: '0 8px',
                          }}>
                            {c.label}
                          </span>
                          {totalStock > 0 && (
                            <span
                              className="absolute right-4 font-bold px-2 py-0.5 rounded-full"
                              style={{
                                fontSize: '13px',
                                background: darkMode ? palette.text + '25' : 'white',
                                color: palette.text,
                                boxShadow: '0 1px 6px rgba(0,0,0,0.14)',
                              }}
                            >
                              {totalStock}
                            </span>
                          )}
                          {showExpiredBadge && (
                            <span
                              className="absolute font-bold px-2 py-0.5 rounded-full"
                              style={{
                                top: '8px', left: '10px',
                                fontSize: '12px',
                                background: 'var(--color-danger)',
                                color: 'white',
                                boxShadow: '0 1px 8px rgba(220,38,38,0.45)',
                              }}
                              title={EXPIRED_LABEL[lang] ?? EXPIRED_LABEL.fr}
                            >
                              ⚠️ {expiredLeftoversCount}
                            </span>
                          )}
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Charnières */}
              {['12%', '76%'].map((top, i) => (
                <div
                  key={i}
                  className="absolute"
                  style={{
                    top, left: '-4px',
                    width: '8px', height: '22px',
                    borderRadius: '3px',
                    background: darkMode
                      ? 'linear-gradient(90deg, #2A3A44 0%, #4A5E6A 30%, #6A7E8A 52%, #4A5E6A 72%, #2A3A44 100%)'
                      : 'linear-gradient(90deg, #5A6A74 0%, #A8BAC4 30%, #D0DCE2 52%, #98A8B2 72%, #68787E 100%)',
                    boxShadow: '2px 2px 4px rgba(0,0,0,0.35), inset 0 1px 2px rgba(255,255,255,0.4)',
                    border: '1px solid rgba(80,100,112,0.55)',
                    opacity: isOpen ? 0 : 1,
                    transition: 'opacity 0.3s',
                  }}
                >
                  <div style={{
                    position: 'absolute', left: '50%', top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '5px', height: '5px', borderRadius: '50%',
                    background: 'radial-gradient(circle at 35% 30%, #DCE8EE 0%, #607080 100%)',
                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)',
                  }} />
                </div>
              ))}

              {/* Porte */}
              <div
                className="absolute inset-0"
                style={{
                  transform: isOpen ? 'translateX(calc(-100% + 10px))' : 'translateX(0)',
                  clipPath: isOpen ? 'inset(0 0 0 calc(100% - 10px))' : 'inset(0 0 0 0)',
                  transition: 'transform 0.55s cubic-bezier(0.4, 0, 0.2, 1), clip-path 0.55s cubic-bezier(0.4, 0, 0.2, 1)',
                  pointerEvents: isOpen ? 'none' : 'auto',
                }}
              >
                {/* Face avant */}
                <div
                  role="button"
                  tabIndex={isOpen ? -1 : 0}
                  aria-label={OPEN_LABEL[lang] ?? OPEN_LABEL.fr}
                  className="absolute inset-0 rounded-3xl cursor-pointer"
                  style={{
                    background: darkMode
                      ? 'linear-gradient(155deg, #1E2C3D 0%, #14202E 100%)'
                      : 'linear-gradient(155deg, #FAF8F5 0%, #F0EAE0 100%)',
                    boxShadow: darkMode ? '2px 4px 24px rgba(0,0,0,0.30)' : '2px 4px 24px rgba(0,0,0,0.10)',
                    pointerEvents: isOpen ? 'none' : 'auto',
                    transition: 'background 0.3s ease',
                  }}
                  onClick={() => { setIsOpen(true); setOpenCompartmentId(null) }}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsOpen(true); setOpenCompartmentId(null) } }}
                >
                  <div className="absolute top-8 left-0 right-0 flex justify-center items-center gap-0.5 select-none" style={{ opacity: darkMode ? 0.35 : 0.22 }}>
                    <span className="text-xl font-bold" style={{ color: darkMode ? '#8AACCA' : '#808080' }}>Fridge</span>
                    <span className="text-xl font-bold" style={{ color: 'var(--color-brand-500)', opacity: 1 }}>+</span>
                  </div>
                  <div
                    className="fp-poignee absolute right-6 top-1/2 -translate-y-1/2 w-3 h-28 rounded-full"
                    style={{ background: 'linear-gradient(180deg, #F5A45A 0%, #E07820 100%)' }}
                  />
                </div>

              </div>

            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
