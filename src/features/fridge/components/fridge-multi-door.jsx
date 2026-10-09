// ⚠️ CE LAYOUT DORT — ET CE N'EST PAS DU CODE MORT. Décision du 2026-08-09.
//
// Ce composant n'est rendu que si `layout.type === 'multi-door'` (fridge.jsx).
// Répartition réelle, mesurée en base (`fridge_layouts`) le 2026-08-09 :
//
//     fr, es, de → top-freezer     en → side-by-side     ja → multi-door
//
// Donc : **seul le japonais** l'atteint. Or `ja` est retiré du sélecteur de
// langue (« temporairement retiré en attendant DeepL Pro », cf. App.jsx).
// Le layout reste servi par la base, mais aucun utilisateur ne l'atteint
// aujourd'hui. Décision assumée : on le laisse dormir, on ne le supprime pas.
//
// ⚠️ `fridge-layouts.js` (statique) ne déclare que `fr` et `en` : le lien
// `ja → multi-door` est INVISIBLE à la lecture du code, il faut interroger la
// base. C'est pourquoi ce commentaire existe.
//
// ⚠️ POUR LE TESTER : une QA en français ne montre RIEN de ce fichier. Faire
// `localStorage.setItem('fridge-lang','ja')` puis recharger ; signature de
// contrôle au rendu : 8 charnières (`div` en `zIndex: 30`).

import { useState, useEffect } from 'react'
import { useWindowWidth } from '@shared/hooks/use-window-width'
import { COLORS, COLORS_DARK } from './fridge-door-colors'
import { Hinges, DrawerSection, FreshInterior } from './fridge-interiors'

const OPEN_DOOR_LABEL = {
  fr: { left: 'Ouvrir la porte gauche du frigo', right: 'Ouvrir la porte droite du frigo' },
  en: { left: 'Open the left fridge door', right: 'Open the right fridge door' },
  es: { left: 'Abrir la puerta izquierda del refrigerador', right: 'Abrir la puerta derecha del refrigerador' },
  de: { left: 'Linke Kühlschranktür öffnen', right: 'Rechte Kühlschranktür öffnen' },
  ja: { left: '冷蔵庫の左扉を開く', right: '冷蔵庫の右扉を開く' },
}

export default function FridgeMultiDoor({ layout, lang = 'fr', onSubcategoryClick, stock = new Set(), onDoorChange, doorCloseSignal, doorOpenSignal = 0, darkMode = false, noAutoScale = false }) {
  const openDoorLabel = OPEN_DOOR_LABEL[lang] ?? OPEN_DOOR_LABEL.fr
  const windowWidth = useWindowWidth()
  const isMobile = !noAutoScale && windowWidth < 1024
  const needsScale = !noAutoScale && windowWidth < 1280
  const scale = needsScale ? Math.min(
    (windowWidth - 48) / 400,
    (window.innerHeight - 250) / 680,
    windowWidth >= 768 ? 1.6 : windowWidth >= 640 ? 1.5 : 1
  ) : 1

  const [leftOpen, setLeftOpen]        = useState(false)
  const [rightOpen, setRightOpen]      = useState(false)
  const [openCompartmentId, setOpenId] = useState(null)
  const [openDrawerId, setOpenDrawerId] = useState(null)

  const freshSection   = layout.fridge.find(c => c.id === 'fresh') ?? layout.fridge[0]
  const drawerSections = layout.fridge.filter(c => c.id !== 'fresh')

  const anyOpen = leftOpen || rightOpen

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!leftOpen && !rightOpen) setOpenId(null)
  }, [leftOpen, rightOpen])

  useEffect(() => { onDoorChange?.(leftOpen || rightOpen) }, [leftOpen, rightOpen, onDoorChange])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (doorCloseSignal > 0) { setLeftOpen(false); setRightOpen(false); setOpenId(null); setOpenDrawerId(null) } }, [doorCloseSignal])
  // eslint-disable-next-line react-hooks/immutability
  useEffect(() => { if (doorOpenSignal > 0) handleOpenLeft() }, [doorOpenSignal])

  const handleOpenLeft  = () => { setLeftOpen(true);  setRightOpen(true);  setOpenId(null) }
  const handleOpenRight = () => { setRightOpen(true); setLeftOpen(true);   setOpenId(null) }

  const leftDoorStyle = {
    position: 'absolute', top: 0, left: 0, width: '50%', height: '100%',
    transform: leftOpen ? 'translateX(calc(-100% + 10px))' : 'translateX(0)',
    clipPath: leftOpen ? 'inset(0 0 0 calc(100% - 10px))' : 'inset(0 0 0 0)',
    transition: 'transform 0.55s cubic-bezier(0.4, 0, 0.2, 1), clip-path 0.55s cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: leftOpen ? 1 : 20,
    pointerEvents: leftOpen ? 'none' : 'auto',
  }

  const rightDoorStyle = {
    position: 'absolute', top: 0, right: 0, width: '50%', height: '100%',
    transform: rightOpen ? 'translateX(calc(100% - 10px))' : 'translateX(0)',
    clipPath: rightOpen ? 'inset(0 calc(100% - 10px) 0 0)' : 'inset(0 0 0 0)',
    transition: 'transform 0.55s cubic-bezier(0.4, 0, 0.2, 1), clip-path 0.55s cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: rightOpen ? 1 : 20,
    pointerEvents: rightOpen ? 'none' : 'auto',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>

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
          <div style={{ perspective: '1800px', perspectiveOrigin: '50% 30%' }}>
            <div style={{
              position: 'relative', width: '400px', height: '680px',
              background: darkMode ? '#1A2535' : '#E8EEF5', borderRadius: '28px',
              boxShadow: darkMode
                ? (anyOpen ? '0 0 80px 30px rgba(185,228,255,0.18), 0 0 180px 90px rgba(168,218,255,0.08), 0 0 300px 150px rgba(155,208,255,0.03), 0 2px 10px rgba(0,0,0,0.35), 0 6px 24px rgba(0,0,0,0.28)' : '0 2px 10px rgba(0,0,0,0.35), 0 6px 24px rgba(0,0,0,0.28), 0 20px 48px rgba(0,0,0,0.22)')
                : (isMobile ? '0 2px 8px rgba(0,0,0,0.07), 0 6px 18px -4px rgba(0,0,0,0.09), 0 14px 36px -8px rgba(0,0,0,0.10)' : '0 1px 3px rgba(0,0,0,0.06), 0 6px 18px rgba(0,0,0,0.07), 0 20px 50px rgba(0,0,0,0.06), 0 42px 84px -12px rgba(0,0,0,0.09)'),
              ...(isMobile ? { overflow: 'hidden' } : {}),
            }}>


              {/* Inner layout — flex column */}
              <div style={{
                position: 'absolute', top: '34px', left: '8px', right: '8px', bottom: '8px',
                display: 'flex', flexDirection: 'column', gap: '4px',
              }}>

                {/* Section fraîche — portes françaises */}
                <div style={{
                  flex: 3, position: 'relative', borderRadius: '14px',
                  background: darkMode ? COLORS_DARK.fresh.bg : COLORS.fresh.bg,
                  ...(isMobile ? { overflow: 'hidden' } : {}),
                }}>

                  {/* Néon central */}
                  <div style={{ position: 'absolute', top: '6px', left: '50%', transform: 'translateX(-50%)', width: '62%', height: '8px', display: 'flex', alignItems: 'center', zIndex: 10, opacity: anyOpen ? 1 : 0, transition: 'opacity 0.35s ease' }}>
                    <div style={{ width: '7px', height: '11px', borderRadius: '2px', flexShrink: 0, background: anyOpen ? '#A8C8DC' : (darkMode ? '#2A3D52' : '#9AAAB8'), transition: 'background 0.2s' }} />
                    <div style={{ flex: 1, height: '7px', borderRadius: '3.5px', background: anyOpen ? 'linear-gradient(180deg, #FFFFFF 0%, #E4F5FF 100%)' : (darkMode ? '#243648' : '#BCC8D4'), boxShadow: anyOpen ? '0 0 6px 2px rgba(210,240,255,0.95), 0 0 16px 6px rgba(185,230,255,0.60), 0 0 32px 12px rgba(165,220,255,0.30)' : 'none', transition: 'background 0.15s, box-shadow 0.4s' }} />
                    <div style={{ width: '7px', height: '11px', borderRadius: '2px', flexShrink: 0, background: anyOpen ? '#A8C8DC' : (darkMode ? '#2A3D52' : '#9AAAB8'), transition: 'background 0.2s' }} />
                  </div>

                  {/* Halo de la section fraîche — dark mode uniquement */}
                  {anyOpen && darkMode && (
                    <div style={{
                      position: 'absolute', inset: 0, borderRadius: '14px', pointerEvents: 'none', zIndex: 10,
                      background: 'linear-gradient(180deg, rgba(215,242,255,0.22) 0%, rgba(208,238,255,0.11) 22%, rgba(200,234,255,0.05) 45%, rgba(195,230,255,0.02) 65%, transparent 85%)',
                      animation: 'fridge-light 0.55s ease-out both',
                    }} />
                  )}

                  <div data-testid="fridge-compartments-fresh" inert={!anyOpen}>
                    <FreshInterior
                      c={freshSection}
                      openCompartmentId={openCompartmentId}
                      setOpenCompartmentId={setOpenId}
                      onSubcategoryClick={onSubcategoryClick}
                      stock={stock}
                      isMobile={isMobile}
                      darkMode={darkMode}
                      lang={lang}
                    />
                  </div>

                  {/* Porte gauche */}
                  <div style={leftDoorStyle}>
                    <div
                      role="button"
                      tabIndex={leftOpen ? -1 : 0}
                      onClick={handleOpenLeft}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpenLeft() } }}
                      aria-label={openDoorLabel.left}
                      style={{
                      position: 'absolute', inset: 0, cursor: 'pointer',
                      background: darkMode ? 'linear-gradient(155deg, #1E2E42 0%, #141F2E 100%)' : 'linear-gradient(155deg, #FAF8F5 0%, #F0EAE0 100%)',
                      borderRadius: '14px 0 0 14px',
                      backfaceVisibility: 'hidden',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      pointerEvents: leftOpen ? 'none' : 'auto',
                    }}>
                      <div style={{ position: 'absolute', top: '20px', left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2px', opacity: darkMode ? 0.35 : 0.22, userSelect: 'none' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: darkMode ? '#8AACCA' : '#1C2830' }}>Fridge</span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-brand-500)' }}>+</span>
                      </div>
                      <div style={{
                        position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)',
                        width: '6px', height: '72px', borderRadius: '3px',
                        background: 'linear-gradient(180deg, #F5A45A 0%, #E07820 100%)',
                        boxShadow: '1px 0 4px rgba(0,0,0,0.18)',
                      }} />
                    </div>
                  </div>

                  {/* Porte droite */}
                  <div style={rightDoorStyle}>
                    <div
                      role="button"
                      tabIndex={rightOpen ? -1 : 0}
                      onClick={handleOpenRight}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpenRight() } }}
                      aria-label={openDoorLabel.right}
                      style={{
                      position: 'absolute', inset: 0, cursor: 'pointer',
                      background: darkMode ? 'linear-gradient(155deg, #1E2E42 0%, #141F2E 100%)' : 'linear-gradient(155deg, #FAF8F5 0%, #F0EAE0 100%)',
                      borderRadius: '0 14px 14px 0',
                      backfaceVisibility: 'hidden',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      pointerEvents: rightOpen ? 'none' : 'auto',
                    }}>
                      <div style={{ position: 'absolute', top: '20px', left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2px', opacity: darkMode ? 0.35 : 0.22, userSelect: 'none' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: darkMode ? '#8AACCA' : '#1C2830' }}>Fridge</span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-brand-500)' }}>+</span>
                      </div>
                      <div style={{
                        position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)',
                        width: '6px', height: '72px', borderRadius: '3px',
                        background: 'linear-gradient(180deg, #F5A45A 0%, #E07820 100%)',
                        boxShadow: '-1px 0 4px rgba(0,0,0,0.18)',
                      }} />
                    </div>
                  </div>

                  {/* Séparateur central entre les deux portes */}
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0, left: 'calc(50% - 3px)',
                    width: '6px', background: darkMode ? 'var(--color-dark-surface)' : '#D2DCE8',
                    zIndex: anyOpen ? 0 : 21,
                    transition: 'opacity 0.3s',
                    opacity: anyOpen ? 0 : 1,
                  }} />

                </div>

                {/* Rail entre section fraîche et tiroirs */}
                <div style={{ height: '8px', flexShrink: 0, background: darkMode ? '#182535' : '#C8D4E0', borderRadius: '4px' }} />

                {/* Tiroirs */}
                <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {drawerSections.map(c => (
                    <DrawerSection
                      key={c.id} c={c}
                      openDrawerId={openDrawerId}
                      setOpenDrawerId={setOpenDrawerId}
                      onSubcategoryClick={onSubcategoryClick}
                      stock={stock}
                      isMobile={isMobile}
                      darkMode={darkMode}
                      lang={lang}
                    />
                  ))}
                </div>

              </div>

              {/* Charnières gauche */}
              <Hinges side="left" hidden={leftOpen} />

              {/* Charnières droite */}
              <Hinges side="right" hidden={rightOpen} />

            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
