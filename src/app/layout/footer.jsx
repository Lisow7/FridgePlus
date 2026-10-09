import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { LuTag } from 'react-icons/lu'
import { CookieModal, CONSENT_I18N } from '@features/legal'
import { CURRENT_VERSION } from '@shared/lib/version'
import { useBottomInsetPublisher, FOOTER_HEIGHT_VAR } from '@shared/hooks/use-bottom-inset'
import { useNewRelease } from '@features/changelog'
import { pickReleaseName } from '@features/changelog/data/changelog-i18n'
import { useAuth } from '@shared/contexts/auth-provider'
import { useFeatureFlag } from '@shared/contexts/feature-flags-provider'
import { hasSeenWelcome } from '@features/onboarding/lib/welcome-storage'
import { reopenGuide, isCompleted } from '@features/onboarding/lib/getting-started-storage'
import Button from '@shared/ui/button'
import Tooltip from '@shared/ui/tooltip'
import { cn } from '@shared/lib/cn'

// Footer refondu, theming Fridge+ branded.
//
// Améliorations par rapport à v3.26.1 :
// - Séparateur supérieur en gradient orange (cohérence header)
// - Hovers en orange chaud (au lieu du charcoal générique)
// - Numéro de version cliquable sous forme de petit badge orange
// (au lieu de simple texte) → CTA plus engageant pour découvrir le
// changelog
// - Bouton fusée « Bien démarrer » : rouvre le guide d'onboarding (remplace
// les anciens réseaux sociaux). Gaté par le flag onboarding_activation +
// hasSeenWelcome (même conditions que le guide lui-même).
// - Logo discret (opacité ajustée) : signature, pas concurrent du header
//
// A11y :
// - Liens focus-visible cohérents
// - Bouton fusée : aria-label explicite

const FOOTER_I18N = {
 fr: {
 footerBtn: 'Aide & Mentions légales',
 whatsNew: 'Nouveautés disponibles',
 guideLabel: 'Bien démarrer',
 guideLink: 'Comment ça marche',
 faqLink: 'Questions fréquentes',
 },
 en: {
 footerBtn: 'Help & Legal',
 whatsNew: "What's new",
 guideLabel: 'Get started',
 guideLink: 'How it works',
 faqLink: 'FAQ',
 },
}

// ─── Sous-composants ────────────────────────────────────────────────────

// ⚠️ `axe-core` signale ce bloc en `color-contrast` (3,73:1 sur les 6 pages
// publiques, thème clair) et c'est un FAUX POSITIF assumé, pas une dette :
// WCAG 1.4.3 exempte explicitement les logotypes — « Text that is part of a
// logo or brand name has no minimum contrast requirement ». axe n'a aucun moyen
// de savoir qu'un texte est une marque, il applique la règle générale.
//
// ⚠️ MISE À JOUR 2026-08-24 : `color-contrast` n'est PLUS différée — elle est
// active dans `e2e/a11y.spec.js`, la dette étant retombée à zéro. Ces nœuds ne
// sont donc plus « à retrancher d'un décompte » : ils sont EXEMPTÉS par le
// marqueur `data-a11y-contrast-exempt` posé ci-dessous, seule exemption que le
// garde-fou accorde. Ils ne seront jamais corrigés.
//
// ⛔ Ne pas « corriger » l'opacité pour faire taire l'outil : le pied de page
// est volontairement discret, et remonter le logo au même contraste que le
// contenu inverserait la hiérarchie visuelle de la page.
// `data-a11y-contrast-exempt` n'a aucun effet à l'exécution : il DÉCLARE, à
// l'endroit même où elle s'applique, la seule exemption que le garde-fou
// `e2e/a11y.spec.js` accorde à la règle `color-contrast`. WCAG 1.4.3 exempte les
// logotypes, ce qu'axe-core ne peut pas deviner — sans ce marqueur, ces 2 nœuds
// × 6 pages feraient échouer le garde-fou sur des faux positifs.
// 🔴 Le porter sur le SPAN et non sur le conteneur : axe rapporte le nœud
// textuel, et c'est son `html` que le test inspecte.
function FooterLogo() {
 return (
 <div className="flex items-center gap-0.5 select-none" aria-hidden="true">
 <span data-a11y-contrast-exempt="logotype" className="font-semibold text-[var(--color-charcoal)]" style={{ opacity: 0.55 }}>Fridge</span>
 <span data-a11y-contrast-exempt="logotype" className="font-semibold" style={{ color: 'var(--color-brand-500)', opacity: 0.85 }}>+</span>
 </div>
 )
}

function Separator() {
 return <span aria-hidden="true" className="select-none" style={{ color: 'var(--color-muted)', opacity: 0.45 }}>·</span>
}

function FooterLink({ to, children, className = '' }) {
 return (
 <Link
 to={to}
 className={`${className} fridge-footer-link`}
 style={{ color: 'var(--color-muted)', textDecoration: 'none', transition: 'color 0.15s' }}
 onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-warm-600)' }}
 onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-muted)' }}
 >
 {children}
 </Link>
 )
}

// Sprint 8 PR S8.b — FooterButton réécrit sur <Button variant="link">.
// Migration progressive : signature stable côté call-sites, juste le moteur
// change. Le hover passe d'un handler JS à une classe Tailwind (`hover:...`).
function FooterButton({ onClick, children, className = '' }) {
 return (
 <Button
 variant="link"
 size="sm"
 onClick={onClick}
 className={cn(
  'fridge-footer-link h-auto p-0 text-[inherit] text-[var(--color-muted)] hover:text-[var(--color-warm-600)] no-underline hover:underline',
  className,
 )}
 >
 {children}
 </Button>
 )
}

function VersionBadge({ to, version, release, lang = 'fr', hasNew, onSeen }) {
 const tf = FOOTER_I18N[lang] ?? FOOTER_I18N.fr
 const releaseName = pickReleaseName(release, lang)
 const label = releaseName
  ? `${releaseName} · v${version}${hasNew ? ' — ' + tf.whatsNew : ''}`
  : `Version ${version}`
 return (
 <Link
 to={to}
 onClick={onSeen}
 aria-label={label}
 style={{
 display: 'inline-flex', alignItems: 'center', gap: '6px',
 padding: '4px 11px',
 borderRadius: '9px',
 background: 'var(--gradient-warm)',
 color: '#2C1A0E',
 fontSize: '12px', fontWeight: 800,
 textDecoration: 'none',
 letterSpacing: '0.04em',
 boxShadow: '0 2px 10px rgba(212,106,16,0.40), 0 0 0 1px rgba(255,255,255,0.18) inset',
 transition: 'transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease',
 whiteSpace: 'nowrap',
 position: 'relative',
 }}
 onMouseEnter={e => {
 e.currentTarget.style.transform = 'translateY(-1px) scale(1.04)'
 e.currentTarget.style.boxShadow = '0 6px 18px rgba(212,106,16,0.55), 0 0 0 1px rgba(255,255,255,0.22) inset'
 e.currentTarget.style.filter = 'brightness(1.06)'
 }}
 onMouseLeave={e => {
 e.currentTarget.style.transform = 'translateY(0) scale(1)'
 e.currentTarget.style.boxShadow = '0 2px 10px rgba(212,106,16,0.40), 0 0 0 1px rgba(255,255,255,0.18) inset'
 e.currentTarget.style.filter = 'brightness(1)'
 }}
 >
 <LuTag size={11} aria-hidden="true" />
 {releaseName && <span>{releaseName} ·</span>}
 <span>v{version}</span>
 {hasNew && (
  <span
  aria-hidden="true"
  style={{
  width: '7px', height: '7px',
  borderRadius: '50%',
  background: '#fff',
  boxShadow: '0 0 0 2px rgba(255,255,255,0.4)',
  animation: 'fridge-version-pulse 1.8s ease-in-out infinite',
  flexShrink: 0,
  }}
  />
 )}
 </Link>
 )
}

// Fusée « Bien démarrer » — FAB FLOTTANT (portail vers body), rouvre le guide
// d'onboarding. Sorti du footer (2026-07) pour l'alléger : icône seule 🚀, ancrée
// bas-droite, au-dessus du contenu. Rendu seulement quand le guide est dispo
// (flag + welcome vu) ; le gating vit dans le composant Footer.
function GuideRocketFab({ label, onClick, darkMode }) {
 // `--fp-footer-height` : la fusée se pose AU-DESSUS du pied de page, jamais
 // dessus. Mesuré le 2026-09-12 en 360×640 : elle recouvrait « © 2026 ».
 return createPortal(
 <span className="fixed z-[60] inline-flex" style={{ right: '16px', bottom: 'calc(16px + var(--fp-footer-height, 0px) + var(--fp-bottom-inset, 0px) + env(safe-area-inset-bottom, 0px))' }}>
 <Tooltip text={label} darkMode={darkMode}>
 <button
 type="button"
 onClick={onClick}
 aria-label={label}
 className="flex items-center justify-center rounded-2xl text-white transition-transform hover:scale-110 active:scale-95"
 style={{
  width: '48px', height: '48px', fontSize: '20px',
  background: 'linear-gradient(180deg,#F7A85E,#E8924A)',
  boxShadow: '0 6px 18px rgba(232,146,74,0.50)',
 }}
 >
 <span aria-hidden="true">🚀</span>
 </button>
 </Tooltip>
 </span>,
 document.body,
 )
}

// ─── Composant principal ────────────────────────────────────────────────

export default function Footer({ darkMode = false, lang = 'fr', isHome = true }) {
 const [showCookies, setShowCookies] = useState(false)
 // Le pied de page PUBLIE sa hauteur (`--fp-footer-height`) et les surfaces
 // flottantes la réservent — la fusée juste en dessous, la carte « Bien
 // démarrer » dans son propre fichier. Sans ça, elles se posaient dessus :
 // mesuré le 2026-09-12 en 360×640, « © 2026 » était recouvert par la fusée et
 // la carte coach mordait 21 px sur la bande du footer. Même doctrine que le
 // bandeau cookies du 28/08 : deux surfaces `fixed` se SÉQUENCENT.
 const footerRef = useRef(null)
 useBottomInsetPublisher(footerRef, true, FOOTER_HEIGHT_VAR)
 const navigate = useNavigate()
 const tf = FOOTER_I18N[lang] ?? FOOTER_I18N.fr
 const { hasNew, markSeen, latestRelease } = useNewRelease()
 const tc = CONSENT_I18N[lang] ?? CONSENT_I18N.fr

 // Bouton fusée « Bien démarrer » : mêmes conditions d'existence que le guide
 // (flag onboarding_activation + welcome vu) + `isHome` — le composant qu'elle
 // rouvre (GettingStartedContainer) ne vit que sur l'accueil (comme FridgeFAB),
 // sinon elle flottait sur /legal, /community, /profile... (chantier H,
 // 2026-07-09). Comme la fusée n'existe plus que sur l'accueil, plus besoin de
 // naviguer avant de rouvrir le guide. Disparaît définitivement une fois
 // l'onboarding complété (`isCompleted`) : la tâche est réalisée, plus besoin
 // de point de réentrée flottant — pour rouvrir le guide, "Aide & infos" →
 // "Visite guidée" reste disponible.
 const { user } = useAuth()
 const uid = user?.id ?? 'guest'
 const guideEnabled = useFeatureFlag('onboarding_activation')
 const showGuide = guideEnabled && hasSeenWelcome() && isHome && !isCompleted(uid)
 const openGuide = () => reopenGuide(uid)

 return (
 <>
 {/* Keyframe du point de version (pulse « nouveautés »). */}
 <style>{`
 @keyframes fridge-version-pulse {
 0%, 100% { opacity: 1; transform: scale(1); }
 50%       { opacity: 0.5; transform: scale(0.8); }
 }
 `}</style>

 <footer
 ref={footerRef}
 className="mt-auto"
 style={{
 background: darkMode ? 'rgba(15,25,35,0.94)' : 'rgba(253,248,242,0.97)',
 backdropFilter: 'blur(8px)',
 WebkitBackdropFilter: 'blur(8px)',
 position: 'relative',
 // Root de l'app en `height: 100dvh` + `overflow-hidden` (App.jsx) : sans
 // cette marge, le footer se retrouve pile au ras du bord bas de l'écran —
 // sur mobile, la barre de gestes/l'indicateur d'accueil (Android/iOS) le
 // recouvre partiellement, donnant l'impression qu'il « ne s'affiche pas
 // complètement » (retour utilisateur 2026-07-10).
 paddingBottom: 'env(safe-area-inset-bottom, 0px)',
 }}
 >
 {/* Séparateur supérieur orange dégradé — signature Fridge+ */}
 <div
 aria-hidden="true"
 style={{
 height: '1px',
 background: darkMode
 ? 'linear-gradient(90deg, transparent 0%, rgba(247,168,94,0.30) 50%, transparent 100%)'
 : 'linear-gradient(90deg, transparent 0%, rgba(212,106,16,0.45) 50%, transparent 100%)',
 }}
 />

 <div className="max-w-7xl mx-auto px-4 py-3 lg:py-4">

 {/* Mobile & tablette — ÉPURÉ : une ligne compacte (légal · cookies · version
 discrète · ©). Logo retiré (déjà dans le header), fusée guide en FAB
 flottant, pilule inventaire déplacée dans le menu FridgeFAB (chantier D,
 2026-07-09) — allège le footer, pas de doublon d'accès. */}
 <div className="flex flex-col items-center gap-1.5 lg:hidden">
 <div className="flex items-center flex-wrap justify-center gap-x-2.5 gap-y-1 text-[12px]" style={{ color: 'var(--color-muted)' }}>
 <FooterLink to="/legal">{tf.footerBtn}</FooterLink>
 <Separator />
 <FooterButton onClick={() => setShowCookies(true)}>{tc.footerBtn}</FooterButton>
 <Separator />
 <Link
 to="/changelog" onClick={markSeen} aria-label={`v${CURRENT_VERSION}`}
 className="fridge-footer-link inline-flex items-center gap-1"
 style={{ color: 'var(--color-muted)', textDecoration: 'none', whiteSpace: 'nowrap' }}
 >
 v{CURRENT_VERSION}
 {hasNew && <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-brand-500)', display: 'inline-block' }} />}
 </Link>
 <Separator />
 <span style={{ whiteSpace: 'nowrap' }}>© {new Date().getFullYear()}</span>
 </div>
 </div>

 {/* Desktop : ligne informationnelle centrée. La fusée guide est désormais
 un FAB flottant (hors footer), donc plus de justify-between. */}
 <div className="hidden lg:flex items-center gap-6 justify-center">
 <div className="flex items-center gap-3 text-[15px]" style={{ color: 'var(--color-muted)' }}>
 <FooterLogo />
 <Separator />
 {/* `/guide` et `/faq` — desktop UNIQUEMENT, et c'est délibéré.
     · Côté visiteur : la ligne mobile a été volontairement épurée en
       juillet 2026 ; y rajouter deux entrées annulerait cette décision.
     · Côté robot : ces liens sont dans le DOM quelle que soit la
       largeur (`hidden lg:flex` masque en CSS, ne démonte pas). Le
       maillage interne y gagne sans toucher au mobile.
     Le libellé est descriptif à dessein — c'est le texte du lien qui
     dit à Google de quoi parle la page d'arrivée, pas son URL. */}
 <FooterLink to="/guide" className="whitespace-nowrap">{tf.guideLink}</FooterLink>
 <Separator />
 <FooterLink to="/faq" className="whitespace-nowrap">{tf.faqLink}</FooterLink>
 <Separator />
 <FooterLink to="/legal" className="whitespace-nowrap">{tf.footerBtn}</FooterLink>
 <Separator />
 <FooterButton onClick={() => setShowCookies(true)} className="whitespace-nowrap">{tc.footerBtn}</FooterButton>
 <Separator />
 <VersionBadge to="/changelog" version={CURRENT_VERSION} release={latestRelease} lang={lang} hasNew={hasNew} onSeen={markSeen} />
 <Separator />
 <span className="whitespace-nowrap">© {new Date().getFullYear()}</span>
 </div>
 </div>

 </div>
 </footer>

 {/* Fusée guide — FAB flottant (hors footer, bas-droite) */}
 {showGuide && <GuideRocketFab label={tf.guideLabel} onClick={openGuide} darkMode={darkMode} />}

 {showCookies && (
 <CookieModal
 lang={lang}
 darkMode={darkMode}
 onClose={() => setShowCookies(false)}
 onShowLegal={() => { setShowCookies(false); navigate('/legal') }}
 />
 )}
 </>
 )
}
