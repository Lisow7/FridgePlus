import { HELP_I18N as I18N, FEATURES_I18N } from '@features/onboarding/i18n/help-guide-i18n'
import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  LuCircleHelp, LuX, LuCompass, LuTelescope, LuChevronDown,
  LuScrollText, LuHeadphones, LuChevronRight, LuMap, LuMessageCircleQuestion,
} from 'react-icons/lu'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import { useRecipeForm } from '@shared/contexts/recipe-form-context'
import { useFeatureFlag } from '@shared/contexts/feature-flags-provider'
import Button from '@shared/ui/button'
import Tooltip from '@shared/ui/tooltip'
import FabGlyph from '@shared/ui/fab-glyph'
import { FeatureIcon } from '@features/onboarding/lib/feature-icon'
import { CURRENT_VERSION } from '@shared/lib/version'
// eslint-disable-next-line import/no-restricted-paths -- CTA PWA réutilisé (DRY), demandé bien visible à côté de la version (2026-07-11)
import { InstallButton, usePwaInstallable } from '@features/pwa'

// Modale « Aide & infos » — hub d'aide épuré (refonte PR help-modal-refonte).
// Rôle : le point de repère où l'utilisateur se fait guider ou trouve une
// réponse. Structure minimaliste : visite guidée → explorer (replié) → FAQ →
// support. Langage universel (pas de jargon). Supprimé de l'ancienne version :
// les tuiles « Explorer » brutes (navigation nue) et les raccourcis clavier.
//
// « Explorer les fonctionnalités » : replié par défaut (aucune surcharge) ;
// déplié = liste par accès, chaque feature explique + guide. Bouton contextuel :
// cliquable, ou « Créer un compte » (feature à compte), ou « Voir ce qui
// arrive » (premium en pause). Jamais un bouton mort.

// ── i18n ─────────────────────────────────────────────────────────────────────

// Fonctionnalités listées dans « Explorer », par accès (aligné sur feature-tiers).
// target = destination de navigation quand la feature est accessible ('home' =
// juste fermer la modale, la feature est sur l'écran d'accueil).

const GROUP_ORDER = ['free', 'account', 'soon']

// Fonctionnalités RÉELLEMENT bloquées pour un invité (→ « Créer un compte »).
// Les autres du groupe « compte » (favoris, communauté, créer) restent
// utilisables sans compte (le compte ajoute sync/publication) → « Y aller ».
// `receipt` : l'Edge Function scan-receipt exige un JWT (cf. use-receipt-scan-flow.js).
const ACCOUNT_REQUIRED = new Set(['profile', 'receipt'])

// ── Composant principal ───────────────────────────────────────────────────────
export default function HelpGuide({
  lang = 'fr',
  darkMode = false,
  onShowChangelog,
  onShowSupport,
  onShowLegal,
  // Navigation « Explorer ». `isPremium` n'est plus reçu ici : il ne servait
  // qu'à choisir l'étape finale de la visite, qui se monte maintenant sur
  // `/guide` et y lit l'abonnement elle-même.
  user,
  onShowAuth,
  onShowCommunity,
  onShowRecipes,
  onShowProfile,
  onShowUpgrade,
  // Navigation « Explorer » : actions de la vue frigo
  onOpenFridge,
  onVoiceToggle,
  onShowLeftovers,
  defaultOpen = false,
}) {
  const [open, setOpen]                     = useState(defaultOpen)
  const [exploreOpen, setExploreOpen]       = useState(false)
  const [selectedFeat, setSelectedFeat]     = useState(null)
  const dialogRef                           = useRef(null)
  const t                                   = I18N[lang] ?? I18N.fr
  const receiptScanEnabled                  = useFeatureFlag('receipt_scan', false)
  // « Scan du ticket de caisse » masqué tant que le flag n'est pas activé —
  // même gating que l'entrée du menu FAB (fridge-fab.jsx), pour ne pas lister
  // une fonctionnalité pas encore accessible (chantier H, 2026-07-09).
  const features                            = (FEATURES_I18N[lang] ?? FEATURES_I18N.fr).filter(f => f.id !== 'receipt' || receiptScanEnabled)
  const navigate                            = useNavigate()
  const location                            = useLocation()
  const { openCreate }                      = useRecipeForm()

  const tourSeen = (() => { try { return !!localStorage.getItem('fridge-tour-v1') } catch { return false } })()

  useFocusTrap(dialogRef, { active: open, onEscape: () => setOpen(false) })
  useCloseOnBackButton(open, () => setOpen(false))
  const { installable: pwaInstallable } = usePwaInstallable()

  // Couleurs thème
  const border   = darkMode ? 'var(--color-dark-surface)' : 'var(--color-border-warm)'
  const modalBg  = darkMode ? '#0F1925' : '#FFFFFF'
  const mutedTxt = 'var(--color-muted)'
  const hoverBg  = darkMode ? 'var(--color-dark-surface)' : '#F5ECE0'
  const rowHov   = darkMode ? 'rgba(224,120,32,0.10)' : 'rgba(224,120,32,0.06)'
  const detailBg = darkMode ? 'rgba(224,120,32,0.07)' : '#FFF8F0'

  // Bouton contextuel d'une feature : cliquable / créer un compte / voir premium.
  // Les actions « accueil » (frigo/voix/restes) pilotent l'état de la vue frigo →
  // on navigue à l'accueil PUIS on agit (la modale s'ouvre depuis n'importe où).
  function featureCta(f) {
    const close = () => { setOpen(false); setSelectedFeat(null) }
    const goHome = () => { if (location.pathname !== '/') navigate('/') }
    if (f.tier === 'soon') return { label: t.cta_soon, onClick: () => { close(); onShowUpgrade?.() } }
    if (ACCOUNT_REQUIRED.has(f.id) && !user) return { label: t.cta_signup, onClick: () => { close(); onShowAuth?.('register') } }

    const homeActions = { fridge: onOpenFridge, voice: onVoiceToggle, leftovers: onShowLeftovers }
    if (homeActions[f.id]) return { label: t.cta_go, onClick: () => { close(); goHome(); homeActions[f.id]?.() } }

    // Aperçu du frigo / scan ticket : pas de handler dédié (le premier vit
    // dans le menu FAB, le second derrière le flag receipt_scan) — on se
    // contente de ramener à l'accueil, où l'entrée se trouve concrètement.
    if (f.id === 'inventory' || f.id === 'receipt') {
      return { label: t.cta_go, onClick: () => { close(); goHome() } }
    }

    // Favoris : ouvre le panneau Recettes AVEC le filtre « Favoris » pré-activé.
    // Le filtre est encodé dans l'URL (param `primary`), lu au mount par
    // use-recipe-filters → deep-link direct, pas besoin de handler dédié.
    if (f.id === 'favorites') {
      return { label: t.cta_go, onClick: () => { close(); navigate({ pathname: '/', search: '?recettes=1&primary=favorites' }) } }
    }

    // Écrans qui s'ouvrent depuis n'importe quelle route (navigation propre).
    const navActions = { recipes: onShowRecipes, community: onShowCommunity, create: openCreate, profile: onShowProfile }
    const fn = navActions[f.id]
    return { label: fn ? t.cta_go : t.cta_close, onClick: () => { close(); fn?.() } }
  }

  return (
    <>
      {/* ── Bouton "?" ─────────────────────────────────────────────── */}
      <Tooltip text={t.btn_label} darkMode={darkMode} disabled={open}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(v => !v)}
          aria-label={t.btn_label}
          aria-expanded={open}
          aria-haspopup="dialog"
          className="h-11 w-11 rounded-[11px] p-0 hover:bg-transparent"
          style={{
            background: open ? hoverBg : 'transparent',
            color: open ? 'var(--color-warm-600)' : mutedTxt,
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = hoverBg; e.currentTarget.style.color = 'var(--color-warm-600)' }}
          onMouseLeave={e => {
            if (!open) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = mutedTxt }
          }}
        >
          <LuCircleHelp size={20} aria-hidden="true" />
        </Button>
      </Tooltip>

      {/* ── Modale ─────────────────────────────────────────────────── */}
      {open && createPortal(
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={t.title}
          className="fp-modal-backdrop"
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(18,10,4,0.45)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          <style>{`
            .hg-scroll::-webkit-scrollbar{display:none}
          `}</style>
          <div
            onClick={e => e.stopPropagation()}
            className="fp-modal-panel"
            style={{
              width: '100%', maxWidth: 480,
              maxHeight: '88vh',
              background: modalBg,
              borderRadius: 22,
              boxShadow: darkMode ? '0 20px 60px rgba(0,0,0,0.6)' : '0 20px 60px rgba(0,0,0,0.14)',
              border: `1px solid ${border}`,
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '18px 22px 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <LuMap size={17} aria-hidden="true" style={{ color: 'var(--color-warm-600)' }} />
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-charcoal)' }}>{t.title}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label={t.close}
                className="h-auto w-auto rounded-md p-1 hover:bg-transparent"
                style={{ color: mutedTxt, transition: 'background .15s' }}
                onMouseEnter={e => e.currentTarget.style.background = hoverBg}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <LuX size={20} aria-hidden="true" />
              </Button>
            </div>

            {/* Body scrollable */}
            <div className="hg-scroll" style={{ overflowY: 'auto', padding: '2px 22px 4px', flex: 1, scrollbarWidth: 'none', msOverflowStyle: 'none' }}>

              {/* ── Visite guidée (CTA principal) ─────────────────── */}
              {/* Mène désormais vers la PAGE `/guide` au lieu d'ouvrir la
                  visite par-dessus la modale. Deux raisons :
                  · le contenu du guide devient une URL — lisible sans lancer
                    de parcours, partageable, et indexable par Google ;
                  · la visite interactive n'est pas perdue : `/guide` propose
                    de la lancer, et c'est elle qui monte `TourWizard`. */}
              <Button
                variant="ghost"
                onClick={() => { setOpen(false); navigate('/guide') }}
                aria-label={`${t.tour_title} — ${tourSeen ? t.tour_sub_seen : t.tour_sub_new}`}
                className="mb-3 h-auto w-full justify-between rounded-2xl border-[1.5px] px-4 py-3.5 hover:bg-transparent"
                style={{
                  gap: 8,
                  background: darkMode
                    ? 'linear-gradient(135deg,rgba(247,168,94,.12) 0%,rgba(212,106,16,.06) 100%)'
                    : 'linear-gradient(135deg,rgba(247,168,94,.14) 0%,rgba(212,106,16,.06) 100%)',
                  borderColor: darkMode ? 'rgba(212,106,16,.28)' : 'rgba(212,106,16,.22)',
                  color: darkMode ? 'var(--color-brand-400)' : '#B05010',
                  transition: 'background .15s, box-shadow .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 18px rgba(212,106,16,.12)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 13, minWidth: 0 }}>
                  <LuCompass size={22} aria-hidden="true" style={{ flexShrink: 0 }} />
                  <span style={{ textAlign: 'left', minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14.5, fontWeight: 800 }}>
                      <FabGlyph size={16} style={{ marginRight: 8 }} />
                      {t.tour_title}
                    </span>
                    <span style={{ display: 'block', fontSize: 12, fontWeight: 500, opacity: 0.72, marginTop: 1 }}>
                      {tourSeen ? t.tour_sub_seen : t.tour_sub_new}
                    </span>
                  </span>
                </span>
                <LuChevronRight size={16} aria-hidden="true" style={{ opacity: 0.55, flexShrink: 0 }} />
              </Button>

              {/* ── Explorer les fonctionnalités (replié) ─────────── */}
              <Button
                variant="ghost"
                onClick={() => setExploreOpen(v => !v)}
                aria-expanded={exploreOpen}
                className="mb-4 h-auto w-full justify-between rounded-2xl border px-4 py-3 text-sm font-bold hover:bg-transparent"
                style={{ gap: 8, borderColor: border, color: 'var(--color-charcoal)', transition: 'background .15s' }}
                onMouseEnter={e => e.currentTarget.style.background = rowHov}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <LuTelescope size={17} aria-hidden="true" style={{ color: 'var(--color-warm-600)' }} />
                  {t.explore}
                </span>
                <LuChevronDown
                  size={16} aria-hidden="true"
                  style={{ opacity: 0.6, transition: 'transform .18s', transform: exploreOpen ? 'rotate(180deg)' : 'none' }}
                />
              </Button>

              {exploreOpen && (
                <div style={{ marginBottom: 16 }}>
                  {GROUP_ORDER.map(groupKey => (
                    <div key={groupKey} style={{ marginBottom: 4 }}>
                      <div style={{
                        fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
                        color: mutedTxt, margin: '6px 2px 7px',
                      }}>
                        {t.grp[groupKey]}
                      </div>
                      {features.filter(f => f.tier === groupKey).map(f => {
                        const isSel = selectedFeat === f.id
                        const cta = featureCta(f)
                        const locked = (ACCOUNT_REQUIRED.has(f.id) && !user) ? t.note_account : (f.tier === 'soon' ? t.note_soon : null)
                        return (
                          <div key={f.id} style={{ marginBottom: 7 }}>
                            <button
                              type="button"
                              onClick={() => setSelectedFeat(isSel ? null : f.id)}
                              aria-expanded={isSel}
                              style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: 11,
                                padding: '11px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                                border: `1px solid ${isSel ? 'rgba(224,120,32,0.45)' : border}`,
                                background: isSel ? detailBg : 'transparent',
                                fontFamily: 'inherit', transition: 'background .15s, border-color .15s',
                              }}
                              onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = rowHov }}
                              onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
                            >
                              {/* Icône Lucide = celle du menu du bouton orange (spec 2026-09-11) ;
                                  l'emoji du dictionnaire sert encore à la visite guidée. */}
                              <span style={{ flexShrink: 0, display: 'flex', color: 'var(--color-warm-600)' }}>
                                <FeatureIcon id={f.id} size={19} />
                              </span>
                              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: 'var(--color-charcoal)' }}>{f.name}</span>
                              {f.tier !== 'free' && (
                                <span style={{
                                  flexShrink: 0, fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 6,
                                  background: f.tier === 'soon' ? 'rgba(224,120,32,0.12)' : 'rgba(120,140,170,0.14)',
                                  color: f.tier === 'soon' ? '#B05010' : (darkMode ? '#9FB4CE' : '#5C6B80'),
                                }}>
                                  {t.badge[f.tier]}
                                </span>
                              )}
                            </button>

                            {isSel && (
                              <div style={{
                                border: `1px dashed rgba(224,120,32,0.4)`, borderRadius: 12,
                                background: detailBg, padding: '12px 13px', margin: '6px 0 2px',
                              }}>
                                <p style={{ margin: '0 0 10px', fontSize: 12.5, lineHeight: 1.5, color: darkMode ? 'rgba(255,255,255,0.78)' : '#5c4f3f' }}>
                                  {f.detail}
                                </p>
                                {locked && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10, fontSize: 11, fontWeight: 700, color: mutedTxt }}>
                                    🔒 {locked}
                                  </div>
                                )}
                                <Button
                                  onClick={cta.onClick}
                                  className="h-auto rounded-[9px] bg-none bg-[#B85000] px-3.5 py-2 text-[12.5px] font-extrabold text-white"
                                  style={{ gap: 5 }}
                                >
                                  {cta.label} →
                                </Button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}

              {/* ── Questions fréquentes → page /faq ──────────────── */}
              {/* La FAQ était dépliée ici, en accordéon. Elle est sortie sur sa
                  propre page pour la même raison que le guide : un accordéon
                  dans une modale n'a pas d'URL, donc il n'existe ni pour un
                  moteur de recherche, ni pour qui veut envoyer la réponse à
                  quelqu'un. Les questions elles-mêmes n'ont pas bougé — `/faq`
                  rend `HELP_I18N.faq` puis la FAQ détaillée du service. */}
              <Button
                variant="ghost"
                onClick={() => { setOpen(false); navigate('/faq') }}
                className="mb-4 h-auto w-full justify-between rounded-2xl border px-4 py-3 text-sm font-bold hover:bg-transparent"
                style={{ gap: 8, borderColor: border, color: 'var(--color-charcoal)', transition: 'background .15s' }}
                onMouseEnter={e => e.currentTarget.style.background = rowHov}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <LuMessageCircleQuestion size={17} aria-hidden="true" style={{ color: 'var(--color-warm-600)' }} />
                  {t.faq_link}
                </span>
                <LuChevronRight size={16} aria-hidden="true" style={{ opacity: 0.55, flexShrink: 0 }} />
              </Button>

            </div>

            {/* ── Footer — support + liens ────────────────────────── */}
            <div style={{
              padding: '14px 18px 18px',
              flexShrink: 0,
            }}>
              {/* Bouton support — mis en évidence. Fond plein #B85000
                  (`--color-warm-600`, doc "AA-compliant" dans button.jsx),
                  pas le dégradé `#F7A85E → #D46A10` utilisé avant : blanc
                  dessus tombait à ~2-3.6:1 selon la zone du dégradé, sous
                  le seuil WCAG AA 4.5:1 — illisible par endroits (retour
                  utilisateur 2026-07-11). Sous-titre repassé en blanc
                  plein (l'opacité 0.85 précédente retombait à ~4:1, encore
                  sous le seuil, même sur fond plein). */}
              {onShowSupport && (
                <Button
                  onClick={() => { setOpen(false); onShowSupport() }}
                  className="h-auto w-full justify-start rounded-2xl bg-none bg-[#B85000] px-4 py-3.5"
                  style={{
                    gap: 14,
                    boxShadow: '0 5px 18px rgba(184,80,0,0.28)',
                    transition: 'box-shadow .2s, transform .1s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 7px 26px rgba(184,80,0,0.45)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 5px 18px rgba(184,80,0,0.28)'; e.currentTarget.style.transform = 'none' }}
                >
                  <LuHeadphones size={22} aria-hidden="true" style={{ color: '#fff', flexShrink: 0 }} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                      {t.support_btn}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#fff', marginTop: 2 }}>
                      {t.support_sub}
                    </div>
                  </div>
                </Button>
              )}

              {/* Liens secondaires — centrés, discrets */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                marginTop: 13, fontSize: 11, color: mutedTxt,
              }}>
                {onShowLegal && (
                  <>
                    <Button
                      variant="ghost"
                      onClick={() => { setOpen(false); onShowLegal() }}
                      className="h-auto rounded-none bg-transparent p-0 text-[11px] hover:bg-transparent"
                      style={{ color: mutedTxt, transition: 'color .15s' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--color-charcoal)'}
                      onMouseLeave={e => e.currentTarget.style.color = mutedTxt}
                    >
                      {t.legal_link}
                    </Button>
                    <span aria-hidden="true" style={{ opacity: 0.5 }}>·</span>
                  </>
                )}
                <span>v{CURRENT_VERSION}</span>
                {pwaInstallable && (
                  <span style={{ marginLeft: 2 }}>
                    <InstallButton lang={lang} darkMode={darkMode} />
                  </span>
                )}
                {onShowChangelog && (
                  <>
                    <span aria-hidden="true" style={{ opacity: 0.5 }}>·</span>
                    <Button
                      variant="ghost"
                      onClick={() => { setOpen(false); onShowChangelog() }}
                      className="h-auto rounded-none bg-transparent p-0 text-[11px] hover:bg-transparent"
                      style={{ gap: 4, color: mutedTxt, transition: 'color .15s' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--color-charcoal)'}
                      onMouseLeave={e => e.currentTarget.style.color = mutedTxt}
                    >
                      <LuScrollText size={11} aria-hidden="true" />
                      {t.changelog_link}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

    </>
  )
}
