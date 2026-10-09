import { useRef, useState, useMemo, useId } from 'react'
import { createPortal } from 'react-dom'
import { LuX, LuSearch, LuBookOpen, LuArrowRight, LuChevronRight } from 'react-icons/lu'
import { ADMIN_HELP } from '../data/admin-help-content'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import Button from '@shared/ui/button'
import { texteLisible } from '@shared/lib/couleurs/texte-lisible'

// Guide admin 2 colonnes.
// Sidebar groupée + recherche + légende risque. Contenu riche avec
// cartes d'action colorées par niveau de risque, workflow, astuces et avertissements.
//
// Pourquoi createPortal vers document.body : le wrapper admin a un
// backdrop-filter qui crée un stacking context, ce qui confine
// position:fixed à l'intérieur du panneau. Le portal contourne ça.

const GROUPS = [
  { key: 'accueil',      label: 'Accueil',       tabs: ['dashboard'] },
  { key: 'contenu',      label: 'Contenu',        tabs: ['base', 'recipes', 'reviews'] },
  { key: 'moderation',   label: 'Modération',     tabs: ['community', 'reports'] },
  { key: 'utilisateurs', label: 'Utilisateurs',   tabs: ['users', 'support'] },
  { key: 'catalogue',    label: 'Catalogue',      tabs: ['ingredients', 'quality', 'pricing'] },
  { key: 'systeme',      label: 'Système',        tabs: ['journal', 'notifications'] },
]

const RISK = {
  safe:    { label: 'Sûr',          color: '#15803D', bg: 'rgba(34,197,94,0.10)',  dot: '#22C55E', stripe: '#22C55E' },
  caution: { label: 'Attention',    color: '#B45309', bg: 'rgba(245,158,11,0.12)', dot: '#F59E0B', stripe: '#F59E0B' },
  danger:  { label: 'Irréversible', color: '#B91C1C', bg: 'rgba(239,68,68,0.12)',  dot: '#EF4444', stripe: '#EF4444' },
}

function sectionWorstRisk(sections = []) {
  if (sections.some(s => s.risk === 'danger'))  return RISK.danger.dot
  if (sections.some(s => s.risk === 'caution')) return RISK.caution.dot
  return RISK.safe.dot
}

export default function AdminHelpModal({ tabKey, darkMode = false, onClose }) {
  const [activeTab, setActiveTab] = useState(tabKey ?? 'dashboard')
  const [search, setSearch]       = useState('')
  const rechercheId = useId()

  const dialogRef = useRef(null)
  useFocusTrap(dialogRef, { active: true, onEscape: onClose })
  useCloseOnBackButton(true, onClose)

  const fg        = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  // Le jeton atténué commun : #7A6A52 faisait 4,42:1 sur le fond du guide (A11Y-03).
  const muted     = 'var(--color-muted)'
  const bg        = darkMode ? '#0F1925' : '#FDFAF6'
  const border    = darkMode ? 'var(--color-dark-surface)' : 'var(--color-border-warm)'
  const cardBg    = darkMode ? '#131E2C' : '#FFFFFF'
  const sidebarBg = darkMode ? '#0B1520' : '#F2EBE0'

  const content = ADMIN_HELP[activeTab] ?? ADMIN_HELP.dashboard

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return GROUPS
    return GROUPS.map(g => ({
      ...g,
      tabs: g.tabs.filter(k => {
        const h = ADMIN_HELP[k]
        return h && (
          h.title.toLowerCase().includes(q) ||
          h.badge?.toLowerCase().includes(q)
        )
      }),
    })).filter(g => g.tabs.length > 0)
  }, [search])

  const hasDanger  = content.sections?.some(s => s.risk === 'danger')
  const hasCaution = content.sections?.some(s => s.risk === 'caution')

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-help-title"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 90,
        background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(5px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 880, maxHeight: '90dvh',
          background: bg, color: fg, borderRadius: 16,
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
          overflow: 'hidden',
        }}
      >

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{
          flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '13px 18px',
          borderBottom: `1px solid ${border}`,
        }}>
          <LuBookOpen size={17} style={{ color: 'var(--color-brand-500)', flexShrink: 0 }} />
          <h3 id="admin-help-title" style={{ margin: 0, fontSize: 14, fontWeight: 800, flex: 1, color: fg }}>
            Guide admin Fridge+
          </h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Fermer le guide"
            type="button"
            className="h-auto w-auto rounded-md bg-transparent p-1 hover:bg-transparent"
            style={{ color: muted }}
          >
            <LuX size={16} />
          </Button>
        </div>

        {/* ── Corps : sidebar + contenu ───────────────────────────────────── */}
        <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', overflow: 'hidden' }}>

          {/* Sidebar */}
          <aside style={{
            width: 216, flexShrink: 0,
            background: sidebarBg,
            borderRight: `1px solid ${border}`,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}>

            {/* Recherche */}
            <div style={{ padding: '10px 10px 8px', flexShrink: 0 }}>
              {/* Libellé visible (décision du 2026-10-06), le texte grisé en exemple. */}
              <label htmlFor={rechercheId} style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', marginBottom: 4 }}>Rechercher dans le guide</label>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 9px', borderRadius: 8,
                border: `1px solid ${border}`, background: bg,
              }}>
                <LuSearch size={11} style={{ color: muted, flexShrink: 0 }} />
                <input
                  id={rechercheId}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="ex. : Recettes"
                  style={{
                    background: 'transparent', border: 'none', outline: 'none',
                    color: fg, fontSize: 12, width: '100%', fontFamily: 'inherit',
                  }}
                />
              </div>
            </div>

            {/* Navigation groupée : le sujet ouvert est la « page courante » (A11Y-10 :
                des onglets ARIA sans liste d'onglets, ni panneau, ni flèches). */}
            <nav aria-label="Sujets du guide" style={{ flex: '1 1 auto', overflowY: 'auto', paddingBottom: 8 }}>
              {filteredGroups.map(group => (
                <div key={group.key}>
                  <p style={{
                    margin: 0, padding: '7px 12px 2px',
                    fontSize: 9, fontWeight: 800, letterSpacing: '0.09em',
                    color: muted, textTransform: 'uppercase',
                  }}>
                    {group.label}
                  </p>
                  {group.tabs.map(k => {
                    const h = ADMIN_HELP[k]
                    if (!h) return null
                    const isActive = activeTab === k
                    const dot = sectionWorstRisk(h.sections)
                    return (
                      <Button
                        key={k}
                        variant="ghost"
                        aria-current={isActive ? 'page' : undefined}
                        onClick={() => { setActiveTab(k); setSearch('') }}
                        type="button"
                        className="h-auto w-full justify-start rounded-none px-3 py-1.5 text-left hover:bg-transparent"
                        style={{
                          gap: 7,
                          paddingLeft: 9,
                          background: isActive
                            ? (darkMode ? 'rgba(224,120,32,0.14)' : 'rgba(224,120,32,0.09)')
                            : 'transparent',
                          borderLeft: `3px solid ${isActive ? 'var(--color-brand-500)' : 'transparent'}`,
                          color: isActive ? texteLisible('var(--color-brand-500)') : fg,
                        }}
                      >
                        <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>{h.icon}</span>
                        <span style={{
                          fontSize: 12, fontWeight: isActive ? 700 : 500,
                          flex: 1, lineHeight: 1.25,
                          color: isActive ? texteLisible('var(--color-brand-500)') : fg,
                        }}>
                          {h.title}
                        </span>
                        <span style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: dot, flexShrink: 0,
                        }} />
                      </Button>
                    )
                  })}
                </div>
              ))}

              {filteredGroups.length === 0 && (
                <p style={{ padding: '12px', fontSize: 12, color: muted, fontStyle: 'italic', margin: 0 }}>
                  Aucun résultat.
                </p>
              )}
            </nav>

            {/* Légende risque */}
            <div style={{
              flexShrink: 0,
              padding: '9px 12px',
              borderTop: `1px solid ${border}`,
            }}>
              <p style={{
                margin: '0 0 4px', fontSize: 9, fontWeight: 800,
                color: muted, textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                Niveau de risque
              </p>
              {Object.entries(RISK).map(([k, r]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: r.dot, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: muted }}>{r.label}</span>
                </div>
              ))}
            </div>
          </aside>

          {/* Zone de contenu */}
          <div style={{
            flex: 1, minWidth: 0,
            overflowY: 'auto',
            padding: '20px 22px',
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>

            {/* En-tête section */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 22, lineHeight: 1 }}>{content.icon}</span>
                <h4 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: fg }}>{content.title}</h4>
                {content.badge && (
                  <span style={{
                    padding: '2px 7px', borderRadius: 4,
                    background: darkMode ? 'rgba(224,120,32,0.15)' : 'rgba(224,120,32,0.10)',
                    color: texteLisible('var(--color-brand-500)'), fontSize: 9, fontWeight: 800,
                    textTransform: 'uppercase', letterSpacing: '0.07em',
                  }}>
                    {content.badge}
                  </span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: 13, color: muted, lineHeight: 1.6 }}>
                {content.description}
              </p>
            </div>

            {/* Chips de risque */}
            {(hasDanger || hasCaution) && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {hasDanger && (
                  <span style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                    background: RISK.danger.bg, color: texteLisible(RISK.danger.color),
                  }}>
                    🔴 Actions irréversibles dans cet onglet
                  </span>
                )}
                {hasCaution && (
                  <span style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                    background: RISK.caution.bg, color: texteLisible(RISK.caution.color),
                  }}>
                    🟡 Actions à confirmer avant d'exécuter
                  </span>
                )}
              </div>
            )}

            {/* Cartes d'action */}
            {content.sections?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <p style={{
                  margin: '0 0 2px', fontSize: 10, fontWeight: 800,
                  color: muted, textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>
                  Actions & fonctions
                </p>
                {content.sections.map((s, i) => {
                  const r = RISK[s.risk] ?? RISK.safe
                  return (
                    <div
                      key={i}
                      style={{
                        padding: '10px 12px 10px 15px',
                        borderRadius: 10,
                        border: `1px solid ${border}`,
                        background: cardBg,
                        display: 'flex', gap: 10, alignItems: 'flex-start',
                        position: 'relative', overflow: 'hidden',
                      }}
                    >
                      <div style={{
                        position: 'absolute', left: 0, top: 0, bottom: 0,
                        width: 3, background: r.stripe,
                      }} />
                      <span style={{ fontSize: 17, lineHeight: 1.3, flexShrink: 0 }}>{s.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: fg }}>{s.title}</p>
                          <span style={{
                            padding: '1px 7px', borderRadius: 4,
                            fontSize: 10, fontWeight: 700,
                            background: r.bg, color: texteLisible(r.color),
                          }}>
                            {r.label}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: 12, color: muted, lineHeight: 1.55 }}>{s.body}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Workflow recommandé */}
            {content.workflow?.length > 0 && (
              <div style={{
                padding: '12px 14px', borderRadius: 10,
                border: `1px solid ${darkMode ? '#1C3822' : '#D6EDD8'}`,
                background: darkMode ? 'rgba(34,197,94,0.05)' : 'rgba(34,197,94,0.05)',
              }}>
                <p style={{
                  margin: '0 0 8px', fontSize: 10, fontWeight: 800,
                  color: texteLisible('#15803D'), textTransform: 'uppercase', letterSpacing: '0.08em',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <LuArrowRight size={11} /> Workflow recommandé
                </p>
                <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {content.workflow.map((step, i) => (
                    <li key={i} style={{ fontSize: 12, color: fg, lineHeight: 1.55 }}>{step}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* Astuces */}
            {content.tips?.length > 0 && (
              <div style={{
                padding: '11px 13px', borderRadius: 10,
                border: `1px solid ${darkMode ? '#3A2510' : '#F5DFC4'}`,
                background: darkMode ? 'rgba(224,120,32,0.06)' : 'rgba(224,120,32,0.05)',
                borderLeft: '3px solid #E07820',
              }}>
                <p style={{
                  margin: '0 0 6px', fontSize: 10, fontWeight: 800,
                  color: texteLisible('var(--color-brand-500)'), textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>
                  💡 Astuces
                </p>
                <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {content.tips.map((tip, i) => (
                    <li key={i} style={{ fontSize: 12, color: fg, lineHeight: 1.55 }}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Points d'attention */}
            {content.warnings?.length > 0 && (
              <div style={{
                padding: '11px 13px', borderRadius: 10,
                border: `1px solid ${darkMode ? '#3A1010' : '#F5CECE'}`,
                background: darkMode ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.04)',
                borderLeft: '3px solid #EF4444',
              }}>
                <p style={{
                  margin: '0 0 6px', fontSize: 10, fontWeight: 800,
                  color: texteLisible('#B91C1C'), textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>
                  ⚠️ Points d'attention
                </p>
                <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {content.warnings.map((w, i) => (
                    <li key={i} style={{ fontSize: 12, color: fg, lineHeight: 1.55 }}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Note RGPD */}
            {content.rgpd && (
              <div style={{
                padding: '10px 13px', borderRadius: 10,
                border: `1px solid ${darkMode ? '#1E1A38' : '#DDD6F5'}`,
                background: darkMode ? 'rgba(124,92,175,0.07)' : 'rgba(124,92,175,0.04)',
                borderLeft: '3px solid #7C5CAF',
              }}>
                <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: darkMode ? '#B0A0D0' : '#5B4585' }}>
                  🔒 <strong>RGPD</strong> — {content.rgpd}
                </p>
              </div>
            )}

            {/* Navigation rapide vers section suivante */}
            {(() => {
              const allTabs = GROUPS.flatMap(g => g.tabs)
              const idx = allTabs.indexOf(activeTab)
              const next = allTabs[idx + 1]
              const nextContent = next ? ADMIN_HELP[next] : null
              if (!nextContent) return null
              return (
                <Button
                  variant="ghost"
                  onClick={() => setActiveTab(next)}
                  type="button"
                  className="mt-0.5 h-auto justify-start rounded-[10px] bg-transparent px-3 py-2 hover:bg-transparent"
                  style={{
                    gap: 8,
                    border: `1px dashed ${border}`,
                    color: muted,
                  }}
                >
                  <span style={{ fontSize: 10, flex: 1, textAlign: 'left', fontWeight: 600 }}>
                    Section suivante : {nextContent.icon} {nextContent.title}
                  </span>
                  <LuChevronRight size={13} />
                </Button>
              )
            })()}

          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div style={{
          flexShrink: 0,
          padding: '10px 18px',
          borderTop: `1px solid ${border}`,
          display: 'flex', justifyContent: 'flex-end',
        }}>
          <Button
            onClick={onClose}
            type="button"
            className="h-auto rounded-lg bg-[#B85000] px-[18px] py-1.5 text-[13px] font-bold text-white"
          >
            Fermer le guide
          </Button>
        </div>

      </div>
    </div>,
    document.body
  )
}
