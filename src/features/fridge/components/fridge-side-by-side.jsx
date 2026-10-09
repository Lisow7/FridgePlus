import { useState, useEffect } from 'react'
import DoorOpenHint from './door-open-hint'
import { useIngredients } from '@shared/contexts/data-provider'
import { SUBCATEGORY_COLORS } from '@shared/static/subcategory-colors'
import FoodIcon from '@shared/ui/food-icon'
import { LuX } from 'react-icons/lu'
import { useWindowWidth } from '@shared/hooks/use-window-width'
import { isLeftoverExpired } from '@features/fridge/api/leftovers'
import Button from '@shared/ui/button'

const COLORS = {
  freezer:   { bg: '#E8F4F8', text: '#5B9AAE' },
  fresh:     { bg: '#E8F5E9', text: '#7BB078' },
  leftovers: { bg: '#F5F5F5', text: '#9E9E9E' },
  vegetable: { bg: '#F1F5E8', text: '#6B8E23' },
  crisper:   { bg: '#F1F5E8', text: '#6B8E23' },
}

const COLORS_DARK = {
  freezer:   { bg: '#182535', text: '#6AAFCA' },
  fresh:     { bg: '#162515', text: '#8CC488' },
  leftovers: { bg: '#1E2020', text: '#909090' },
  vegetable: { bg: '#182215', text: '#85A040' },
  crisper:   { bg: '#182215', text: '#85A040' },
}

function Hinges({ side, hidden = false }) {
  return ['14%', '76%'].map((top, i) => (
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

const isToday = (dateStr) => new Date(dateStr).toDateString() === new Date().toDateString()
// today = créés aujourd'hui ; thisweek = vue d'ensemble = tous les actifs
const getActiveCount = (leftovers, view) => leftovers.filter(l => {
  if (isLeftoverExpired(l.expires_at)) return false
  return view === 'today' ? isToday(l.created_at) : true
}).length

const CLOSE_COMPARTMENT_LABEL = { fr: 'Fermer le compartiment', en: 'Close compartment', es: 'Cerrar el compartimento', de: 'Fach schließen', ja: 'コンパートメントを閉じる' }

// `narrow` : la porte GAUCHE ne fait que 193px — la grille 2 colonnes y
// débordait (un `1fr` ne descend jamais sous le min-content du libellé,
// « Poisson congelé » rognait donc la colonne, constaté par l'user le
// 2026-08-27). En étroit : 1 colonne — la porte gauche n'héberge que le
// congélateur, sa vue étendue a toute la hauteur pour 6 tuiles.
function CompartmentInterior({ c, openCompartmentId, setOpenCompartmentId, onSubcategoryClick, stock, isMobile, darkMode = false, leftovers = [], expiredLeftoversCount = 0, lang = 'fr', narrow = false }) {
  const INGREDIENTS = useIngredients()
  const palette = darkMode ? COLORS_DARK : COLORS
  const colors = palette[c.id] ?? (darkMode ? { bg: '#1A2535', text: '#6B9BAE' } : { bg: '#EBF3FA', text: '#6B8E8E' })
  const isExpanded = openCompartmentId === c.id
  const isLeftovers = c.id === 'leftovers'
  const totalStock = isLeftovers
    ? leftovers.filter(l => !isLeftoverExpired(l.expires_at)).length
    : c.subcategories.reduce(
        (sum, sub) => sum + (INGREDIENTS[sub.id] ?? []).filter(i => stock.has(i.id)).length, 0
      )
  const showExpiredBadge = isLeftovers && expiredLeftoversCount > 0

  return (
    <div style={{
      flex: isExpanded ? Math.max(c.flex * 2.5, 4) : c.flex,
      background: colors.bg, borderRadius: '14px', overflow: 'hidden',
      border: darkMode ? `1px solid ${colors.text}40` : 'none',
      transition: 'flex 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
    }}>
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
            <span style={{ fontSize: isMobile ? '20px' : '16px', fontWeight: 700, color: colors.text }}>{c.label}</span>
            <LuX className="close-x" size={isMobile ? 18 : 16} style={{ marginLeft: 'auto', color: colors.text, opacity: 0.45, flexShrink: 0 }} />
          </Button>
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', padding: '6px', flex: 1, overflowY: 'auto' }}>
              {c.subcategories.map((sub, idx) => {
                const subCount = (sub.id === 'today' || sub.id === 'thisweek')
                  ? getActiveCount(leftovers, sub.id)
                  : (INGREDIENTS[sub.id] ?? []).filter(i => stock.has(i.id)).length
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
                      animationDelay: `${idx * 45}ms`,
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
            <div style={{ display: 'grid', gridTemplateColumns: narrow ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))', gap: '4px', padding: '4px', flex: 1, ...(narrow ? { overflowY: 'auto' } : {}) }}>
              {c.subcategories.map((sub, idx) => {
                const subCount = (sub.id === 'today' || sub.id === 'thisweek')
                  ? getActiveCount(leftovers, sub.id)
                  : (INGREDIENTS[sub.id] ?? []).filter(i => stock.has(i.id)).length
                const subColors = SUBCATEGORY_COLORS[sub.id] ?? colors
                return (
                  <Button
                    key={sub.id}
                    variant="ghost"
                    onClick={() => onSubcategoryClick?.(c, sub)}
                    className="relative h-auto w-full flex-col justify-center gap-1 rounded-[10px] px-1 py-1.5 hover:bg-transparent"
                    style={{
                      background: `${subColors.bg}cc`,
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
                        fontSize: '18px', fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                      }}>{subCount}</div>
                    )}
                    <FoodIcon id={sub.id} size={32} color={subColors.text} />
                    <span style={{ fontSize: '22px', fontWeight: 600, color: subColors.text, textAlign: 'center', lineHeight: 1.2, overflowWrap: 'anywhere', maxWidth: '100%' }}>
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
          className="relative h-full w-full flex-col justify-center gap-1.5 rounded-none bg-transparent hover:bg-transparent"
        >
          <FoodIcon
            id={c.id}
            size={isMobile
              ? ((c.flex ?? 1) >= 2 ? 50 : (c.flex ?? 1) >= 1.5 ? 44 : 36)
              : ((c.flex ?? 1) >= 2 ? 42 : (c.flex ?? 1) >= 1.5 ? 36 : 30)
            }
            color={colors.text}
          />
          <span style={{
            fontSize: isMobile
              ? ((c.flex ?? 1) >= 1.5 ? '22px' : '19px')
              : ((c.flex ?? 1) >= 1.5 ? '16px' : '14px'),
            fontWeight: 600,
            color: colors.text,
            textAlign: 'center',
            lineHeight: 1.2,
            padding: '0 6px',
          }}>
            {c.label}
          </span>
          {totalStock > 0 && (
            <span style={{
              position: 'absolute', right: '8px', fontSize: '13px', fontWeight: 700,
              padding: '2px 6px', borderRadius: '999px',
              background: 'white', color: colors.text, boxShadow: '0 1px 6px rgba(0,0,0,0.14)',
            }}>{totalStock}</span>
          )}
          {showExpiredBadge && (
            <span style={{
              position: 'absolute', top: '8px', left: '8px', fontSize: '12px', fontWeight: 700,
              padding: '2px 7px', borderRadius: '999px',
              background: 'var(--color-danger)', color: 'white', boxShadow: '0 1px 8px rgba(220,38,38,0.45)',
            }}>⚠️ {expiredLeftoversCount}</span>
          )}
        </Button>
      )}
    </div>
  )
}

const OPEN_COMPARTMENT_LABEL = { fr: 'ouvrir le compartiment', en: 'open the compartment', es: 'abrir el compartimento', de: 'Fach öffnen', ja: 'コンパートメントを開く' }

export default function FridgeSideBySide({ layout, lang = 'fr', onSubcategoryClick, stock = new Set(), onDoorChange, doorCloseSignal, doorOpenSignal = 0, darkMode = false, leftovers = [], expiredLeftoversCount = 0, noAutoScale = false }) {
  const openCompartmentLabel = OPEN_COMPARTMENT_LABEL[lang] ?? OPEN_COMPARTMENT_LABEL.fr
  const windowWidth = useWindowWidth()
  const isMobile = !noAutoScale && windowWidth < 1024
  const needsScale = !noAutoScale && windowWidth < 1280
  const scale = needsScale ? Math.min(
    (windowWidth - 48) / 500,
    (window.innerHeight - 250) / 680,
    windowWidth >= 768 ? 1.6 : windowWidth >= 640 ? 1.5 : 1
  ) : 1

  const [leftOpen, setLeftOpen]        = useState(false)
  const [rightOpen, setRightOpen]      = useState(false)
  const [openLeftCompartmentId, setOpenLeftId]   = useState(null)
  const [openRightCompartmentId, setOpenRightId] = useState(null)

  const freezer   = layout.fridge.find(c => c.id === 'freezer') ?? layout.fridge[0]
  const freshSide = layout.fridge.filter(c => c.id !== 'freezer')
  const anyOpen   = leftOpen || rightOpen

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (!leftOpen)  setOpenLeftId(null)  }, [leftOpen])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (!rightOpen) setOpenRightId(null) }, [rightOpen])

  useEffect(() => { onDoorChange?.(leftOpen || rightOpen) }, [leftOpen, rightOpen, onDoorChange])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (doorCloseSignal > 0) { setLeftOpen(false); setRightOpen(false) } }, [doorCloseSignal])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (doorOpenSignal > 0) setLeftOpen(true) }, [doorOpenSignal])

  const handleOpenLeft  = () => { setLeftOpen(true);  setOpenLeftId(null) }
  const handleOpenRight = () => { setRightOpen(true); setOpenRightId(null) }

  const leftDoorStyle = {
    position: 'absolute', top: 0, left: 0, width: '193px', height: '100%',
    transform: leftOpen ? 'translateX(calc(-100% + 10px))' : 'translateX(0)',
    clipPath: leftOpen ? 'inset(0 0 0 calc(100% - 10px))' : 'inset(0 0 0 0)',
    transition: 'transform 0.55s cubic-bezier(0.4, 0, 0.2, 1), clip-path 0.55s cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: leftOpen ? 1 : 20,
    pointerEvents: leftOpen ? 'none' : 'auto',
  }

  const rightDoorStyle = {
    position: 'absolute', top: 0, right: 0, width: '293px', height: '100%',
    transform: rightOpen ? 'translateX(calc(100% - 10px))' : 'translateX(0)',
    clipPath: rightOpen ? 'inset(0 calc(100% - 10px) 0 0)' : 'inset(0 0 0 0)',
    transition: 'transform 0.55s cubic-bezier(0.4, 0, 0.2, 1), clip-path 0.55s cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: rightOpen ? 1 : 20,
    pointerEvents: rightOpen ? 'none' : 'auto',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      <div style={needsScale ? { width: `${500 * scale}px`, height: `${680 * scale}px`, position: 'relative', flexShrink: 0 } : {}}>
        <div style={needsScale ? { position: 'absolute', top: 0, left: 0, transformOrigin: 'top left', transform: `scale(${scale})` } : {}}>
          <div style={{ perspective: '1800px', perspectiveOrigin: '50% 50%' }}>
            <div style={{
              position: 'relative', width: '500px', height: '680px',
              background: darkMode ? '#1A2535' : '#E8EEF5', borderRadius: '28px',
              boxShadow: darkMode
                ? (anyOpen ? '0 0 80px 30px rgba(185,228,255,0.18), 0 0 180px 90px rgba(168,218,255,0.08), 0 0 300px 150px rgba(155,208,255,0.03), 0 2px 10px rgba(0,0,0,0.35), 0 6px 24px rgba(0,0,0,0.28)' : '0 2px 10px rgba(0,0,0,0.35), 0 6px 24px rgba(0,0,0,0.28), 0 20px 48px rgba(0,0,0,0.22)')
                : (isMobile ? '0 2px 8px rgba(0,0,0,0.07), 0 6px 18px -4px rgba(0,0,0,0.09), 0 14px 36px -8px rgba(0,0,0,0.10)' : '0 1px 3px rgba(0,0,0,0.06), 0 6px 18px rgba(0,0,0,0.07), 0 20px 50px rgba(0,0,0,0.06), 0 42px 84px -12px rgba(0,0,0,0.09)'),
              ...(isMobile ? { overflow: 'hidden' } : {}),
            }}>

              {/* Néon gauche (congélateur) */}
              <div style={{ position: 'absolute', top: '6px', left: '10px', width: '171px', height: '8px', display: 'flex', alignItems: 'center', zIndex: 10, opacity: leftOpen ? 1 : 0, transition: 'opacity 0.35s ease' }}>
                <div style={{ width: '7px', height: '11px', borderRadius: '2px', flexShrink: 0, background: leftOpen ? '#A8C8DC' : (darkMode ? '#2A3D52' : '#9AAAB8'), transition: 'background 0.2s' }} />
                <div style={{ flex: 1, height: '7px', borderRadius: '3.5px', background: leftOpen ? 'linear-gradient(180deg, #FFFFFF 0%, #E4F5FF 100%)' : (darkMode ? '#243648' : '#BCC8D4'), boxShadow: leftOpen ? '0 0 6px 2px rgba(210,240,255,0.95), 0 0 16px 6px rgba(185,230,255,0.60), 0 0 32px 12px rgba(165,220,255,0.30)' : 'none', transition: 'background 0.15s, box-shadow 0.4s' }} />
                <div style={{ width: '7px', height: '11px', borderRadius: '2px', flexShrink: 0, background: leftOpen ? '#A8C8DC' : (darkMode ? '#2A3D52' : '#9AAAB8'), transition: 'background 0.2s' }} />
              </div>

              {/* Néon droit (frais) */}
              <div style={{ position: 'absolute', top: '6px', left: '207px', right: '10px', height: '8px', display: 'flex', alignItems: 'center', zIndex: 10, opacity: rightOpen ? 1 : 0, transition: 'opacity 0.35s ease' }}>
                <div style={{ width: '7px', height: '11px', borderRadius: '2px', flexShrink: 0, background: rightOpen ? '#A8C8DC' : (darkMode ? '#2A3D52' : '#9AAAB8'), transition: 'background 0.2s' }} />
                <div style={{ flex: 1, height: '7px', borderRadius: '3.5px', background: rightOpen ? 'linear-gradient(180deg, #FFFFFF 0%, #E4F5FF 100%)' : (darkMode ? '#243648' : '#BCC8D4'), boxShadow: rightOpen ? '0 0 6px 2px rgba(210,240,255,0.95), 0 0 16px 6px rgba(185,230,255,0.60), 0 0 32px 12px rgba(165,220,255,0.30)' : 'none', transition: 'background 0.15s, box-shadow 0.4s' }} />
                <div style={{ width: '7px', height: '11px', borderRadius: '2px', flexShrink: 0, background: rightOpen ? '#A8C8DC' : (darkMode ? '#2A3D52' : '#9AAAB8'), transition: 'background 0.2s' }} />
              </div>

              {/* Halos indépendants — dark mode uniquement */}
              {leftOpen && darkMode && (
                <div style={{
                  position: 'absolute', top: 0, left: 0, width: '193px', bottom: 0,
                  borderRadius: '28px 0 0 28px', pointerEvents: 'none', zIndex: 10,
                  background: 'linear-gradient(180deg, rgba(215,242,255,0.22) 0%, rgba(208,238,255,0.11) 22%, rgba(200,234,255,0.05) 45%, rgba(195,230,255,0.02) 65%, transparent 85%)',
                  animation: 'fridge-light 0.55s ease-out both',
                }} />
              )}
              {rightOpen && darkMode && (
                <div style={{
                  position: 'absolute', top: 0, right: 0, width: '293px', bottom: 0,
                  borderRadius: '0 28px 28px 0', pointerEvents: 'none', zIndex: 10,
                  background: 'linear-gradient(180deg, rgba(215,242,255,0.22) 0%, rgba(208,238,255,0.11) 22%, rgba(200,234,255,0.05) 45%, rgba(195,230,255,0.02) 65%, transparent 85%)',
                  animation: 'fridge-light 0.55s ease-out both',
                }} />
              )}

              {/* Séparateur vertical central */}
              <div style={{
                position: 'absolute', top: 0, bottom: 0, left: '193px',
                width: '14px', background: darkMode ? 'var(--color-dark-surface)' : '#D2DCE8', zIndex: 5,
              }} />

              {/* Intérieur gauche — Freezer */}
              <div
                data-testid="fridge-compartments-left"
                inert={!leftOpen}
                style={{
                  position: 'absolute', top: 0, left: 0, width: '193px', height: '100%',
                  padding: '36px 6px 10px 10px', boxSizing: 'border-box',
                  display: 'flex', flexDirection: 'column',
                }}>
                <CompartmentInterior c={freezer} narrow openCompartmentId={openLeftCompartmentId} setOpenCompartmentId={setOpenLeftId} onSubcategoryClick={onSubcategoryClick} stock={stock} isMobile={isMobile} darkMode={darkMode} leftovers={leftovers} expiredLeftoversCount={expiredLeftoversCount} lang={lang} />
              </div>

              {/* Intérieur droit */}
              <div
                data-testid="fridge-compartments-right"
                inert={!rightOpen}
                style={{
                  position: 'absolute', top: 0, right: 0, width: '293px', height: '100%',
                  padding: '36px 10px 10px 8px', boxSizing: 'border-box',
                  display: 'flex', flexDirection: 'column', gap: '6px',
                }}>
                {freshSide.map(c => (
                  <CompartmentInterior key={c.id} c={c} openCompartmentId={openRightCompartmentId} setOpenCompartmentId={setOpenRightId} onSubcategoryClick={onSubcategoryClick} stock={stock} isMobile={isMobile} darkMode={darkMode} leftovers={leftovers} expiredLeftoversCount={expiredLeftoversCount} lang={lang} />
                ))}
              </div>

              <Hinges side="left" hidden={leftOpen} />

              {/* Porte gauche */}
              <div style={leftDoorStyle}>
                <div
                  role="button"
                  tabIndex={leftOpen ? -1 : 0}
                  onClick={handleOpenLeft}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpenLeft() } }}
                  aria-label={`${freezer.label} — ${openCompartmentLabel}`}
                  style={{
                  position: 'absolute', inset: 0, cursor: 'pointer',
                  background: darkMode ? 'linear-gradient(155deg, #1E2E42 0%, #141F2E 100%)' : 'linear-gradient(155deg, #FAF8F5 0%, #F0EAE0 100%)',
                  borderRadius: '28px 0 0 28px',
                  boxShadow: darkMode ? '2px 4px 24px rgba(0,0,0,0.35)' : '2px 4px 24px rgba(0,0,0,0.10)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  pointerEvents: leftOpen ? 'none' : 'auto',
                }}>
                  <div style={{ position: 'absolute', top: '32px', left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2px', opacity: darkMode ? 0.35 : 0.22, userSelect: 'none' }}>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: darkMode ? '#8AACCA' : '#1C2830' }}>Fridge</span>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-brand-500)' }}>+</span>
                  </div>
                  {/* Libellé + logo du compartiment retirés de la porte FERMÉE :
                      ils réapparaissent à l'ouverture → doublon (la marque « Fridge+ »
                      + la poignée suffisent côté fermé). cf. audit i18n bilingue. */}
                  <div style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', width: '6px', height: '96px', borderRadius: '3px', background: 'linear-gradient(180deg, #F5A45A 0%, #E07820 100%)', boxShadow: '1px 0 4px rgba(0,0,0,0.18)' }} />
                </div>
              </div>

              <Hinges side="right" hidden={rightOpen} />

              {/* Porte droite */}
              <div style={rightDoorStyle}>
                <div
                  role="button"
                  tabIndex={rightOpen ? -1 : 0}
                  onClick={handleOpenRight}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpenRight() } }}
                  aria-label={`${freshSide[0]?.label ?? ''} — ${openCompartmentLabel}`}
                  style={{
                  position: 'absolute', inset: 0, cursor: 'pointer',
                  background: darkMode ? 'linear-gradient(155deg, #1E2E42 0%, #141F2E 100%)' : 'linear-gradient(155deg, #FAF8F5 0%, #F0EAE0 100%)',
                  borderRadius: '0 28px 28px 0',
                  boxShadow: darkMode ? '-2px 4px 24px rgba(0,0,0,0.35)' : '-2px 4px 24px rgba(0,0,0,0.10)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  pointerEvents: rightOpen ? 'none' : 'auto',
                }}>
                  <div style={{ position: 'absolute', top: '32px', left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2px', opacity: darkMode ? 0.35 : 0.22, userSelect: 'none' }}>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: darkMode ? '#8AACCA' : '#1C2830' }}>Fridge</span>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-brand-500)' }}>+</span>
                  </div>
                  {/* Libellé + logo retirés de la porte FERMÉE (doublon à l'ouverture). */}
                  <DoorOpenHint lang={lang} darkMode={darkMode} show={stock.size === 0} />
                  <div style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', width: '6px', height: '96px', borderRadius: '3px', background: 'linear-gradient(180deg, #F5A45A 0%, #E07820 100%)', boxShadow: '-1px 0 4px rgba(0,0,0,0.18)' }} />
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
