import { useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
 LuUser, LuShield, LuLogOut,
 LuHandHeart, LuMessageCircleQuestion, LuShoppingCart,
} from 'react-icons/lu'
import AvatarImg from '@shared/ui/avatar-img'
import { getBanner } from '@shared/lib/banners'
import MenuShell from '@shared/ui/menu-shell'
import Tooltip from '@shared/ui/tooltip'
import CountBadge from '@shared/ui/count-badge'
import TierBadge from '@shared/ui/tier-badge'
import { useDropdownMenu } from '@shared/hooks/use-dropdown-menu'
import { useWindowWidth } from '@shared/hooks/use-window-width'
import LangThemePrefs from '@shared/ui/lang-theme-prefs'
import {
 PROFILE_LABEL, ADMIN_LABEL, SIGN_OUT_LABEL, USER_MENU_LABEL,
 COMMUNITY_LABEL, SUPPORT_LABEL, CART_LABEL, isCartDisabled,
} from './constants'

// Menu utilisateur : carte d'identité + actions, theming Fridge+.
//
// Choix visuels (cohérence avec le branding orange) :
// • En-tête avatar+pseudo dans un bandeau orange dégradé
// • Hover items en orange subtil (rgba 247,168,94, 0.12)
// • Labels de section en orange-warm muet (au lieu du gris générique)
// • Indicateur de section : barre orange verticale 2px à gauche du label
// • Bouton « Se déconnecter » en rouge atténué (action sortante)
// • Séparateurs : gradient orange→transparent→orange (subtil, branded)
//
// Structure (3 zones visuelles, plus claires que les 5 d'avant) :
// 1. En-tête : Avatar + pseudo (toujours en haut)
// 2. Actions : Compte (Profil/Admin) + Navigation (Communauté/Support)
// 3. Préférences : Langue + Thème
// 4. Sortie : Déconnexion (séparée, action terminale)
//
// A11y :
// - role="menu" + role="menuitem" / role="menuitemradio"
// - useFocusTrap : Tab piège, Escape ferme + retour focus au trigger
// - Click outside ferme
//
// Responsive :
// - Rendu à toutes les tailles pour les utilisateurs connectés ; le conteneur
// (MenuShell) est un bottom sheet sur mobile (<640) et un dropdown sur
// tablette/desktop (≥640).

const SECTIONS_I18N = {
 account: { fr: 'Compte', en: 'Account'},
 nav: { fr: 'Navigation', en: 'Navigation'},
 prefs: { fr: 'Préférences', en: 'Preferences'},
}

function SectionLabel({ children, darkMode }) {
 return (
 <p style={{
 fontSize: '12px', fontWeight: 700,
 color: darkMode ? 'rgba(247,168,94,0.95)' : '#B85000',
 textTransform: 'uppercase', letterSpacing: '0.08em',
 padding: '8px 12px 6px',
 margin: 0,
 display: 'flex', alignItems: 'center', gap: '8px',
 }}>
 <span aria-hidden="true" style={{
 display: 'inline-block',
 width: '3px', height: '13px',
 background: 'linear-gradient(180deg, #F7A85E 0%, #D46A10 100%)',
 borderRadius: '2px',
 }} />
 {children}
 </p>
 )
}

export default function UserMenu({
 lang = 'fr',
 darkMode = false,
 profile,
 isAdmin = false,
 pendingCount = 0,
 onLangChange,
 onDarkModeToggle,
 onShowProfile: _onShowProfile,
 onShowAdmin,
 onShowCommunity: _onShowCommunity,
 onShowSupport,
 basketCount = 0,
 hasPremiumAccess = false,
 onShowUpgrade,
 onSignOut,
}) {
 const windowWidth = useWindowWidth()
 const isMobile = windowWidth < 640
 const isMobileOrTablet = windowWidth < 1024
 const cartDisabled = isCartDisabled(lang)
 const navigate = useNavigate()
 const triggerRef = useRef(null)
 const { open, setOpen, menuRef, dropPos } = useDropdownMenu(triggerRef)

 // Palette branded — orange Fridge+ partout, subtil mais identifiable
 const hoverBg = darkMode ? 'rgba(247,168,94,0.10)' : 'rgba(212,106,16,0.07)'
 const triggerHoverBg = darkMode ? '#1E3045' : '#F5ECE0'
 const dropBg = darkMode ? '#131E2C' : '#FDFAF6'
 const sep = darkMode ? 'var(--color-dark-border)' : 'rgba(212,106,16,0.15)'
 // En-tête du menu = bannière du profil + voile sombre composé (lisibilité texte blanc).
 const headerBg = `linear-gradient(rgba(0,0,0,0.10), rgba(0,0,0,0.34)), ${getBanner(profile?.banner_id).value}`
 const fg = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
 const muted = darkMode ? 'rgba(240,232,220,0.6)' : 'rgba(44,26,14,0.55)'

 const itemStyle = {
 width: '100%', display: 'flex', alignItems: 'center', gap: '11px',
 padding: '11px 14px', borderRadius: '8px',
 border: 'none', cursor: 'pointer', textAlign: 'left',
 background: 'transparent',
 color: fg,
 fontSize: '14px', fontWeight: 600,
 transition: 'background 0.15s, color 0.15s',
 fontFamily: 'inherit',
 }

 const handleClick = (cb) => () => {
 cb?.()
 setOpen(false)
 }

 const handleThemeToggle = () => {
 setOpen(false)
 setTimeout(() => onDarkModeToggle?.(), 80)
 }

 return (
 <div style={{ position: 'relative' }}>
 <Tooltip text={USER_MENU_LABEL[lang] ?? USER_MENU_LABEL.fr} darkMode={darkMode} disabled={open}>
 <button
 ref={triggerRef}
 onClick={() => setOpen(v => !v)}
 aria-label={USER_MENU_LABEL[lang] ?? USER_MENU_LABEL.fr}
 aria-expanded={open}
 aria-haspopup="menu"
 style={{
 width: '44px', height: '44px', borderRadius: '11px',
 border: 'none',
 background: open ? triggerHoverBg : 'transparent',
 cursor: 'pointer',
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 transition: 'background 0.15s',
 position: 'relative',
 padding: 0,
 }}
 onMouseEnter={e => { if (!open) e.currentTarget.style.background = triggerHoverBg }}
 onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'transparent' }}
 >
 <AvatarImg avatarId={profile?.avatar_id} size={32} />
 </button>
 </Tooltip>

 <MenuShell
 ref={menuRef}
 open={open}
 onClose={() => setOpen(false)}
 ariaLabel={USER_MENU_LABEL[lang] ?? USER_MENU_LABEL.fr}
 dropPos={dropPos}
 darkMode={darkMode}
 >
 {/* ─── En-tête : Avatar + pseudo (carte d'identité) ─── */}
 {profile?.username && (
 <div style={{
 display: 'flex', alignItems: 'center', gap: '12px',
 padding: '14px 14px 13px',
 background: headerBg,
 borderBottom: `1px solid ${sep}`,
 }}>
 <div style={{
 borderRadius: '50%',
 padding: '2px',
 background: 'var(--gradient-warm)',
 flexShrink: 0,
 }}>
 <div style={{
 borderRadius: '50%',
 background: dropBg,
 padding: '2px',
 }}>
 <AvatarImg avatarId={profile?.avatar_id} size={32} />
 </div>
 </div>
 <div style={{ flex: 1, overflow: 'hidden' }}>
 <div style={{
 fontSize: '15px', fontWeight: 700,
 color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.55)',
 overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
 }}>
 {profile.username}
 </div>
 {isAdmin && (
 <div style={{
 fontSize: '11px', fontWeight: 700,
 color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.5)',
 textTransform: 'uppercase', letterSpacing: '0.08em',
 marginTop: '3px',
 display: 'flex', alignItems: 'center', gap: '4px',
 }}>
 <LuShield size={11} aria-hidden="true" />
 <span>Admin</span>
 </div>
 )}
 </div>
 </div>
 )}

 {/* ─── Actions : Compte + Navigation regroupés ─── */}
 <div style={{ padding: '8px 6px 6px' }}>
 <SectionLabel darkMode={darkMode}>{SECTIONS_I18N.account[lang] ?? SECTIONS_I18N.account.fr}</SectionLabel>

 <Link
 to="/profile"
 role="menuitem"
 onClick={() => setOpen(false)}
 style={{ ...itemStyle, textDecoration: 'none' }}
 onMouseEnter={e => e.currentTarget.style.background = hoverBg}
 onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
 >
 <LuUser size={17} aria-hidden="true" style={{ color: muted, flexShrink: 0 }} />
 <span>{PROFILE_LABEL[lang] ?? PROFILE_LABEL.fr}</span>
 </Link>

 {isAdmin && (
 <button
 role="menuitem"
 onClick={handleClick(onShowAdmin)}
 style={{ ...itemStyle, color: 'var(--color-warm-600)' }}
 onMouseEnter={e => e.currentTarget.style.background = hoverBg}
 onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
 >
 <LuShield size={17} aria-hidden="true" style={{ flexShrink: 0 }} />
 <span style={{ flex: 1 }}>{ADMIN_LABEL[lang] ?? ADMIN_LABEL.fr}</span>
 <CountBadge count={pendingCount} />
 </button>
 )}

 </div>

 {/* ─── Navigation : Communauté (mobile/tablette) + Support (tous) ─── */}
 {(isMobileOrTablet || onShowSupport || !cartDisabled) && (
 <>
 <div role="separator" aria-hidden="true" style={{
 height: '1px',
 background: darkMode
 ? 'linear-gradient(90deg, transparent, rgba(247,168,94,0.25), transparent)'
 : 'linear-gradient(90deg, transparent, rgba(212,106,16,0.20), transparent)',
 margin: '2px 0',
 }} />
 <div style={{ padding: '8px 6px 6px' }}>
 <SectionLabel darkMode={darkMode}>{SECTIONS_I18N.nav[lang] ?? SECTIONS_I18N.nav.fr}</SectionLabel>

 {/* Panier — tous breakpoints — navigue vers /cart (premium) ou ouvre upgrade */}
 {!cartDisabled && (
 <button
 role="menuitem"
 onClick={() => {
 setOpen(false)
 if (!hasPremiumAccess) { onShowUpgrade?.(); return }
 navigate('/cart')
 }}
 style={{ ...itemStyle, position: 'relative' }}
 onMouseEnter={e => e.currentTarget.style.background = hoverBg}
 onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
 >
 <LuShoppingCart size={17} aria-hidden="true" style={{ color: muted, flexShrink: 0 }} />
 <span style={{ flex: 1 }}>{CART_LABEL[lang] ?? CART_LABEL.fr}</span>
 {hasPremiumAccess ? <CountBadge count={basketCount} /> : <TierBadge tier="soon" lang={lang} />}
 </button>
 )}

 {isMobile && (
 <Link
 to="/community"
 role="menuitem"
 onClick={() => setOpen(false)}
 style={{ ...itemStyle, textDecoration: 'none' }}
 onMouseEnter={e => e.currentTarget.style.background = hoverBg}
 onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
 >
 <LuHandHeart size={17} aria-hidden="true" style={{ color: muted, flexShrink: 0 }} />
 <span>{COMMUNITY_LABEL[lang] ?? COMMUNITY_LABEL.fr}</span>
 </Link>
 )}

 {onShowSupport && (
 <button
 role="menuitem"
 onClick={handleClick(onShowSupport)}
 style={itemStyle}
 onMouseEnter={e => e.currentTarget.style.background = hoverBg}
 onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
 >
 <LuMessageCircleQuestion size={17} aria-hidden="true" style={{ color: muted, flexShrink: 0 }} />
 <span>{SUPPORT_LABEL[lang] ?? SUPPORT_LABEL.fr}</span>
 </button>
 )}
 </div>
 </>
 )}

 <div role="separator" aria-hidden="true" style={{
 height: '1px',
 background: darkMode
 ? 'linear-gradient(90deg, transparent, rgba(247,168,94,0.25), transparent)'
 : 'linear-gradient(90deg, transparent, rgba(212,106,16,0.20), transparent)',
 margin: '2px 0',
 }} />

 {/* ─── Préférences : Langue + Thème ─── */}
 <div style={{ padding: '8px 10px 10px' }}>
 <SectionLabel darkMode={darkMode}>{SECTIONS_I18N.prefs[lang] ?? SECTIONS_I18N.prefs.fr}</SectionLabel>
 <LangThemePrefs
  lang={lang}
  onLangChange={onLangChange}
  darkMode={darkMode}
  onDarkModeToggle={handleThemeToggle}
  isAdmin={isAdmin}
 />
 </div>

 <div role="separator" aria-hidden="true" style={{
 height: '1px',
 background: darkMode
 ? 'linear-gradient(90deg, transparent, rgba(247,168,94,0.25), transparent)'
 : 'linear-gradient(90deg, transparent, rgba(212,106,16,0.20), transparent)',
 margin: '2px 0',
 }} />

 {/* ─── Sortie : Déconnexion ─── */}
 <div style={{ padding: '6px 6px 8px' }}>
 <button
 role="menuitem"
 onClick={handleClick(onSignOut)}
 style={{
 ...itemStyle,
 color: 'var(--color-danger-text)',
 }}
 onMouseEnter={e => {
 e.currentTarget.style.background = darkMode
 ? 'rgba(220,38,38,0.10)'
 : 'rgba(220,38,38,0.07)'
 }}
 onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
 >
 <LuLogOut size={15} aria-hidden="true" style={{ color: 'var(--color-danger-text)', flexShrink: 0 }} />
 <span>{SIGN_OUT_LABEL[lang] ?? SIGN_OUT_LABEL.fr}</span>
 </button>
 </div>
 </MenuShell>
 </div>
 )
}
