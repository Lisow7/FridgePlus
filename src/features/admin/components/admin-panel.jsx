import { useState, useEffect, useRef } from 'react'
import {
  LuX, LuShield, LuBookOpen,
  LuLayoutDashboard, LuUsers, LuLeaf, LuDatabase, LuActivity,
  LuBan, LuTag, LuMessageSquare, LuStar, LuBell, LuHeartHandshake,
  LuChevronRight, LuToggleRight,
} from 'react-icons/lu'
import { AdminProvider, useAdmin } from '../providers/admin-provider'
import Button from '@shared/ui/button'
import { useDialogue } from '@shared/hooks/use-dialogue'
import Dashboard from './dashboard'
import JournalSection from './sections/journal-section'
import NotificationsSection from './sections/notifications-section'
import DataQualitySection from './sections/data-quality-section'
import ReportsSection from './sections/reports-section'
import PricingSection from './sections/pricing-section'
import CommunitySection from './sections/community-section'
import RecipeReviewsAdminSection from './sections/recipe-reviews-section'
import CustomRecipesSection from './sections/custom-recipes-section'
import UsersSection from './sections/users-section'
import IngredientsSection from './sections/ingredients-section'
import BaseRecipesSection from './sections/base-recipes-section'
import SupportSection from './sections/support-section'
import FeaturesSection from './sections/features-section'
import AdminHelpModal from './admin-help-modal'

function useIsMobile(bp = 640) {
  const [mobile, setMobile] = useState(() => window.innerWidth < bp)
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < bp)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [bp])
  return mobile
}

// ── Sidebar nav config ────────────────────────────────────────────────────────

function buildNav(lang, badges) {
  const { pendingCount, supportBadge, healthCount, reportsCount } = badges
  return [
    {
      key: 'dashboard',
      label: 'Tableau de bord',
      icon: <LuLayoutDashboard size={15} />,
    },
    {
      group: 'Modération',
      items: [
        { key:'recipes',   label: 'Recettes +',    icon: <LuBookOpen size={15} />,       badge: pendingCount || null },
        { key:'reports',   label: 'Signalements',    icon: <LuBan size={15} />,            badge: reportsCount || null },
        { key:'reviews',   label: 'Avis',            icon: <LuStar size={15} /> },
        { key:'community', label: 'Communauté',    icon: <LuMessageSquare size={15} /> },
      ],
    },
    {
      group: 'Catalogue',
      items: [
        { key:'ingredients', label: 'Ingrédients', icon: <LuLeaf size={15} /> },
        { key:'base',        label: 'Recettes base', icon: <LuDatabase size={15} /> },
        { key:'pricing',     label: 'Tarifs',          icon: <LuTag size={15} /> },
        { key:'quality',     label: 'Qualité',         icon: <LuShield size={15} />, badge: healthCount || null },
      ],
    },
    {
      group: 'Utilisateurs',
      items: [
        { key:'users',   label: 'Utilisateurs',  icon: <LuUsers size={15} /> },
        { key:'support', label: 'Support',                         icon: <LuHeartHandshake size={15} />, badge: supportBadge || null },
      ],
    },
    {
      group: 'Système',
      items: [
        { key:'journal',       label: 'Journal',                               icon: <LuActivity size={15} /> },
        { key:'notifications', label: 'Notifications', icon: <LuBell size={15} /> },
        { key:'features',      label: 'Fonctionnalités',    icon: <LuToggleRight size={15} /> },
      ],
    },
  ]
}

// ── Badge pill ────────────────────────────────────────────────────────────────

function Badge({ count }) {
  return (
    <span style={{ background:'#E53535', color:'white', fontSize:10, fontWeight:700, minWidth:16, height:16, borderRadius:8, padding:'0 4px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
      {count}
    </span>
  )
}

// ── Sidebar (desktop) ─────────────────────────────────────────────────────────

// Les sections se choisissent comme des pages : une navigation nommée, et la
// section ouverte marquée `aria-current="page"` (audit du 2026-10-04, A11Y-10 :
// c'étaient des onglets ARIA (rôle `tab`) sans `tablist`, sans `tabpanel`, sans flèches —
// un motif ARIA promis et non tenu).
function Sidebar({ nav, activeKey, onSelect, darkMode, nomNav }) {
  const bg        = darkMode ? '#0B1623' : '#F0E4D0'
  // Libellés de groupe : 2,9:1 en clair comme en sombre, mesuré par axe le
  // 2026-10-08 → les teintes profondes (décision du 2026-10-06), ≥ 5,5:1.
  const groupClr  = darkMode ? '#7A90A8' : '#6B5444'
  const textClr   = darkMode ? '#A8C0D4' : '#5A4030'
  const activeClr = darkMode ? '#C8D8E8' : '#2C1A0E'
  const activeBg  = darkMode ? 'rgba(224,120,32,0.12)' : 'rgba(224,120,32,0.10)'

  const renderItem = (item) => {
    const isActive = item.key === activeKey
    return (
      <Button
        key={item.key}
        variant="ghost"
        aria-current={isActive ? 'page' : undefined}
        onClick={() => onSelect(item.key)}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
        className="h-auto w-full justify-start rounded-lg text-left hover:bg-transparent"
        style={{
          gap: 8,
          padding: '7px 12px 7px 14px',
          borderLeft: isActive ? '3px solid #E07820' : '3px solid transparent',
          background: isActive ? activeBg : 'transparent',
          color: isActive ? activeClr : textClr,
          fontWeight: isActive ? 700 : 500,
          fontSize: 13,
          transition: 'background 0.15s, color 0.15s',
        }}
      >
        <span style={{ flexShrink:0, opacity: isActive ? 1 : 0.7 }}>{item.icon}</span>
        <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.label}</span>
        {item.badge && <Badge count={item.badge} />}
      </Button>
    )
  }

  return (
    <nav aria-label={nomNav} style={{ width:188, flexShrink:0, background:bg, display:'flex', flexDirection:'column', gap:2, overflowY:'auto', padding:'8px 6px' }}>
      {nav.map((entry, i) => {
        if (entry.key) return renderItem(entry)
        return (
          <div key={i}>
            {i > 0 && <div style={{ height:1, background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)', margin:'6px 8px' }} />}
            <div style={{ fontSize:10, fontWeight:700, color:groupClr, textTransform:'uppercase', letterSpacing:'0.08em', padding:'4px 14px 2px' }}>
              {entry.group}
            </div>
            {entry.items.map(renderItem)}
          </div>
        )
      })}
    </nav>
  )
}

// ── Tab bar (mobile) ──────────────────────────────────────────────────────────

function MobileTabBar({ nav, activeKey, onSelect, darkMode, nomNav }) {
  const bg      = darkMode ? '#0B1623' : '#F0E4D0'
  const textClr = darkMode ? '#A8C0D4' : '#5A4030'
  // eslint-disable-next-line no-unused-vars
  const activeClr = darkMode ? '#C8D8E8' : '#2C1A0E'

  const flatItems = nav.flatMap(entry => entry.key ? [entry] : (entry.items ?? []))
  // La section ouverte est amenée en vue : 14 sections pour ~350 px, et la
  // section mémorisée s'ouvrait hors de la barre (Journal à 782 px, mesuré le
  // 2026-10-08). « nearest » en vertical : seule la barre défile.
  const barre = useRef(null)
  useEffect(() => {
    barre.current?.querySelector('[aria-current="page"]')?.scrollIntoView?.({ block: 'nearest', inline: 'center' })
  }, [activeKey])

  return (
    <nav ref={barre} aria-label={nomNav} style={{ display:'flex', overflowX:'auto', gap:2, background:bg, padding:'4px 6px', flexShrink:0, borderBottom: `1px solid ${darkMode ? '#1A2F48' : '#DDD0C0'}` }}>
      {flatItems.map(item => {
        const isActive = item.key === activeKey
        return (
          <Button
            key={item.key}
            variant="ghost"
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onSelect(item.key)}
            className="relative h-auto flex-shrink-0 flex-col items-center gap-0.5 rounded-lg px-2.5 py-1.5 text-[10px] hover:bg-transparent"
            style={{
              background: isActive ? (darkMode ? 'rgba(224,120,32,0.15)' : 'rgba(224,120,32,0.12)') : 'transparent',
              color: isActive ? 'var(--color-brand-500)' : textClr,
              fontWeight: isActive ? 700 : 500,
            }}
          >
            {item.icon}
            <span style={{ whiteSpace:'nowrap' }}>{item.label}</span>
            {item.badge && (
              <span style={{ position:'absolute', top:3, right:5, background:'#E53535', color:'white', fontSize:9, fontWeight:700, minWidth:13, height:13, borderRadius:7, padding:'0 2px', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {item.badge}
              </span>
            )}
          </Button>
        )
      })}
    </nav>
  )
}

// ── Section header (titre + description) ─────────────────────────────────────

const SECTION_TITLES = {
  fr: {
    dashboard:     ['Tableau de bord',   "Vue d'ensemble de l'activité"],
    recipes:       ['Recettes +',        'Modérez les recettes de la communauté'],
    reports:       ['Signalements',      'Contenus signalés par les utilisateurs'],
    reviews:       ['Avis',              'Évaluations laissées sur les recettes'],
    community:     ['Communauté',        'Modérez les posts et les échanges'],
    ingredients:   ['Ingrédients',       'Gérez le catalogue des ingrédients'],
    base:          ['Recettes officielles','Catalogue des recettes du frigo officiel'],
    pricing:       ['Tarifs',            'Vue et édition des prix par ingrédient'],
    quality:       ['Qualité données',   'Détectez les recettes et ingrédients incomplets'],
    users:         ['Utilisateurs',      'Gérez les accès et consultez les profils'],
    support:       ['Support',           'Répondez aux tickets utilisateurs'],
    journal:       ['Journal',           'Historique des actions admin — append-only'],
    notifications: ['Notifications',     'Centre de pilotage et alertes'],
    features:      ['Fonctionnalités',   'Active/désactive les features en prod'],
  },
}

// ── Inner panel ───────────────────────────────────────────────────────────────

function AdminPanelInner({ onClose, lang = 'fr', darkMode = false }) {
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('crashadmin')) {
    throw new Error('Dev crash trigger: admin-level (ErrorBoundary section)')
  }

  const isMobile = useIsMobile()
  const { section, setSection, pendingCount, supportBadge, healthCount, reportsCount, setFocusEditId } = useAdmin()
  const [showHelp, setShowHelp] = useState(false)
  // Une vraie boîte de dialogue : rôle, nom, focus piégé, Échap (A11Y-01).
  // L'aide s'ouvre par-dessus avec son propre piège : la pile des pièges
  // (use-focus-trap) ne fait agir que le sommet.
  const dialogue = useDialogue({ onClose, nom: 'Fridge+ Admin' })

  const modalBg   = darkMode ? '#111E2D' : '#FDFAF6'
  const border    = darkMode ? '#1E3048' : '#DDD0C0'
  const textColor = darkMode ? '#C8D8E8' : '#1A0F00'
  const muted     = darkMode ? '#7A90A8' : '#5C4033'

  const nav = buildNav(lang, { pendingCount, supportBadge, healthCount, reportsCount })
  const nomNav = 'Sections du panneau admin'
  const sectionTitles = SECTION_TITLES.fr
  const [sectionTitle, sectionDesc] = sectionTitles[section] ?? [section, '']

  function renderSection() {
    switch (section) {
      case 'dashboard':     return <Dashboard lang={lang} darkMode={darkMode} />
      case 'recipes':       return <CustomRecipesSection lang={lang} darkMode={darkMode} />
      case 'users':         return <UsersSection lang={lang} darkMode={darkMode} />
      case 'journal':       return <JournalSection lang={lang} darkMode={darkMode} />
      case 'notifications': return <NotificationsSection lang={lang} darkMode={darkMode} />
      case 'quality':       return (
        <DataQualitySection darkMode={darkMode}
          onEditRecipe={(id, origin) => {
            // Recette communauté : pas d'éditeur dédié ici → on amène l'admin
            // sur la section de modération Recettes+ (drill-down complet = Lot 2).
            if (origin === 'community') { setSection('recipes') }
            else { setFocusEditId(id); setSection('base') }
          }}
          onEditIngredient={(id) => { setFocusEditId(id); setSection('ingredients') }}
        />
      )
      case 'reports':    return <ReportsSection darkMode={darkMode} />
      case 'pricing':    return <PricingSection lang={lang} darkMode={darkMode} />
      case 'community':  return <CommunitySection darkMode={darkMode} />
      case 'reviews':    return <RecipeReviewsAdminSection darkMode={darkMode} />
      case 'ingredients': return <IngredientsSection lang={lang} darkMode={darkMode} isMobile={isMobile} />
      case 'base':        return <BaseRecipesSection lang={lang} darkMode={darkMode} isMobile={isMobile} />
      case 'support':     return <SupportSection lang={lang} darkMode={darkMode} />
      case 'features':    return <FeaturesSection lang={lang} darkMode={darkMode} />
      default:            return <Dashboard lang={lang} darkMode={darkMode} />
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center fp-modal-backdrop"
        style={{ padding: isMobile ? '6px' : '16px', background:'rgba(18,10,4,0.62)', backdropFilter:'blur(6px)' }}
        onClick={onClose}
      >
        <div
          {...dialogue.proprietes}
          onClick={e => e.stopPropagation()}
          className="fp-modal-panel"
          style={{
            width: isMobile ? '100%' : '1100px', maxWidth:'100%',
            // `dvh` : en `vh`, le bas du panneau passait sous la barre d'adresse.
            height: isMobile ? '98dvh' : '92dvh',
            display:'flex', flexDirection:'column',
            background: modalBg,
            borderRadius: isMobile ? '16px' : '22px',
            border:`1px solid ${border}`,
            boxShadow: darkMode ? '0 20px 60px rgba(0,0,0,0.65)' : '0 20px 60px rgba(0,0,0,0.18)',
            overflow:'hidden',
          }}
        >
          {/* ── Header ── */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding: isMobile ? '12px 14px' : '14px 20px', borderBottom:`1px solid ${border}`, flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <LuShield size={16} style={{ color:'var(--color-brand-500)' }} />
              <span style={{ fontSize:15, fontWeight:800, color:textColor, letterSpacing:'-0.01em' }}>
                Fridge+ <span style={{ color: darkMode ? 'var(--color-brand-500)' : 'var(--color-warm-600)' }}>Admin</span>
              </span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <Button
                variant="ghost"
                onClick={() => setShowHelp(true)}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-brand-500)'; e.currentTarget.style.borderColor = 'var(--color-brand-500)' }}
                onMouseLeave={e => { e.currentTarget.style.color = muted; e.currentTarget.style.borderColor = border }}
                className="h-auto rounded-lg border bg-transparent px-2.5 py-1 text-xs font-semibold hover:bg-transparent"
                style={{ gap: 5, borderColor: border, color: muted }}
              >
                <LuBookOpen size={13} /> Guide
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label={'Fermer le panneau admin'}
                className="h-auto w-auto bg-transparent p-1 opacity-65 hover:bg-transparent"
                style={{ color: muted }}
              >
                <LuX size={17} />
              </Button>
            </div>
          </div>

          {/* ── Mobile tab bar ── */}
          {isMobile && <MobileTabBar nav={nav} activeKey={section} onSelect={setSection} darkMode={darkMode} nomNav={nomNav} />}

          {/* ── Body ── */}
          <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

            {/* Sidebar (desktop only) */}
            {!isMobile && (
              <Sidebar nav={nav} activeKey={section} onSelect={setSection} darkMode={darkMode} nomNav={nomNav} />
            )}

            {/* Séparateur */}
            {!isMobile && <div style={{ width:1, background:border, flexShrink:0 }} />}

            {/* Contenu */}
            <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

              {/* Section header */}
              {section !== 'dashboard' && (
                <div style={{ padding: isMobile ? '10px 14px 8px' : '14px 20px 10px', borderBottom:`1px solid ${border}`, flexShrink:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <h2 style={{ margin:0, fontSize:15, fontWeight:800, color:textColor }}>{sectionTitle}</h2>
                    {(pendingCount > 0 && section === 'recipes') && <Badge count={pendingCount} />}
                    {(supportBadge > 0 && section === 'support') && <Badge count={supportBadge} />}
                    {(healthCount > 0 && section === 'quality') && <Badge count={healthCount} />}
                    {(reportsCount > 0 && section === 'reports') && <Badge count={reportsCount} />}
                  </div>
                  {sectionDesc && <p style={{ margin:'2px 0 0', fontSize:12, color:muted }}>{sectionDesc}</p>}
                </div>
              )}

              {/* Breadcrumb retour dashboard (sections profondes) */}
              {section !== 'dashboard' && !isMobile && (
                <Button
                  variant="ghost"
                  onClick={() => setSection('dashboard')}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--color-brand-500)'}
                  onMouseLeave={e => e.currentTarget.style.color = muted}
                  className="h-auto justify-start rounded-none bg-transparent px-5 py-1 text-[11px] hover:bg-transparent"
                  style={{ gap: 4, color: muted, borderBottom: `1px solid ${border}` }}
                >
                  <LuChevronRight size={10} style={{ transform:'rotate(180deg)' }} />
                  {'Tableau de bord'}
                </Button>
              )}

              {/* Section content */}
              <div style={{ flex:1, overflowY:'auto', padding: isMobile ? '12px 14px 16px' : '16px 20px 20px' }}>
                {renderSection()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showHelp && (
        <AdminHelpModal tabKey={section} darkMode={darkMode} onClose={() => setShowHelp(false)} />
      )}
    </>
  )
}

// ── Export public ─────────────────────────────────────────────────────────────

export default function AdminPanel({ onClose, lang = 'fr', darkMode = false }) {
  return (
    <AdminProvider>
      <AdminPanelInner onClose={onClose} lang={lang} darkMode={darkMode} />
    </AdminProvider>
  )
}
