import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { LuX } from 'react-icons/lu'
import { TOUR_STEPS_I18N } from '../i18n/tour-steps-i18n'
import { TourIcon } from '../lib/tour-icon'
import ContenuEtape from './tour-step-content'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import Button from '@shared/ui/button'
import { useFeatureFlag } from '@shared/contexts/feature-flags-provider'

// ── CSS injecté une seule fois dans <head> ────────────────────────────────────
const TOUR_CSS = `
  @keyframes tw-bg   { from{opacity:0} to{opacity:1} }
  @keyframes tw-card { from{opacity:0;transform:translateY(22px) scale(.96)} to{opacity:1;transform:none} }
  @keyframes tw-step { from{opacity:0} to{opacity:1} }
  @keyframes tw-tip-pulse {
    0%,100%{ box-shadow:0 0 0 0 rgba(247,168,94,.5) }
    50%    { box-shadow:0 0 0 7px rgba(247,168,94,0) }
  }
  .tw-stage    { perspective:1400px; }
  /* minmax(0,1fr) et non 1fr : une ligne de grille ne descend JAMAIS sous la
     taille de son contenu sans ce minmax(0, …). Sans lui, quand maxHeight
     borne la carte sur un ecran vraiment trop court, le contenu la deborde
     simplement — le defilement de repli de .tw-zone ne s'enclenche pas et la
     commande sort de l'ecran (mesure a 320x568 le 2026-09-12 : bouton a 581 px
     pour une carte qui s'arrete a 556). */
  .tw-flip-in  { position:relative; display:grid; grid-template-rows:minmax(0,1fr); transition:transform .6s cubic-bezier(.4,.2,.2,1); transform-style:preserve-3d; }
  .tw-flip-in.flipped { transform:rotateY(180deg); }
  .tw-face     { backface-visibility:hidden; -webkit-backface-visibility:hidden; grid-area:1/1; min-height:0; display:flex; flex-direction:column; }
  .tw-face.back{ transform:rotateY(180deg); }
  .tw-card     { animation:tw-step .28s ease both; }
  /* La ZONE de contenu : une pile de grille. Le contenu reel de l'etape
     courante et le GABARIT invisible des cinq etapes occupent la MEME cellule,
     donc la zone prend la hauteur de la plus haute des cinq. Ajouter une option
     ou une astuce fait grandir les cinq panneaux ensemble, sans qu'aucun nombre
     ne soit ecrit nulle part. */
  .tw-zone     { display:grid; }
  .tw-zone > * { grid-area:1/1; }
  .tw-gabarit  { display:grid; visibility:hidden; pointer-events:none; }
  .tw-gabarit > * { grid-area:1/1; }
  /* Repli pour les ecrans VRAIMENT trop courts (390x560 et moins) : la zone
     defile. La barre native etait blanche sur une carte brun fonce — signalee
     le 2026-09-12. Elle prend desormais les couleurs de la carte. */
  .tw-zone     { scrollbar-width:thin; scrollbar-color:rgba(247,168,94,.45) transparent; }
  .tw-zone::-webkit-scrollbar       { width:6px; }
  .tw-zone::-webkit-scrollbar-track { background:transparent; }
  .tw-zone::-webkit-scrollbar-thumb { background:rgba(247,168,94,.45); border-radius:99px; }
  .tw-zone::-webkit-scrollbar-thumb:hover { background:rgba(247,168,94,.7); }
  .tw-tip-btn  { animation:tw-tip-pulse 2.2s ease-in-out infinite; }
  .tw-tip-btn:hover  { filter:brightness(1.12); }
  .tw-next:hover     { filter:brightness(1.06); transform:translateY(-1px); }
  .tw-next:active    { transform:scale(.98); }
  .tw-nav-back:hover:not(:disabled) { color:#E8D9C4 !important; }
  .tw-revert:hover   { filter:brightness(1.1); }
  .tw-close:hover    { background:rgba(255,255,255,.13) !important; color:#F0E8DC !important; }
  @media (prefers-reduced-motion: reduce) {
    .tw-flip-in { transition:opacity .2s ease; }
    .tw-flip-in.flipped { transform:none; }
    .tw-face    { backface-visibility:visible; -webkit-backface-visibility:visible; transition:opacity .2s ease; }
    .tw-face.back { transform:none; opacity:0; pointer-events:none; }
    .tw-flip-in.flipped .tw-face.front { opacity:0; pointer-events:none; }
    .tw-flip-in.flipped .tw-face.back  { opacity:1; pointer-events:auto; }
    .tw-tip-btn { animation:none; }
    .tw-card    { animation:none !important; }
  }
`

// ── Structure des étapes : icône + (pour la finale) action du CTA ──────────────
// Le texte (title/subtitle/desc/tips/ctaLabel) vient de TOUR_STEPS_I18N.
const STEP_META = {
  fab:           { customIcon: true },
  fridge:        { icon: 'door' },
  check:         { icon: 'inventory' },
  recipes:       { icon: 'recipes' },
  final_guest:   { emoji: '🚀', action: 'showRegister'  },
  final_free:    { emoji: '🚀', action: 'showCommunity' },
  final_premium: { emoji: '🎉', action: null            },
}

// 4 étapes communes à tous + 1 étape finale adaptée au profil.
const COMMON = ['fab', 'fridge', 'check', 'recipes']
const FINAL_BY_PROFILE = { guest: 'final_guest', free: 'final_free', premium: 'final_premium' }

// ── i18n libellés (navigation / verso) ─────────────────────────────────────────
const I18N = {
  fr: {
    step   : (i, n) => `ÉTAPE ${i} / ${n}`,
    prev   : '‹ Précédent',
    next   : 'Suivant ›',
    close  : 'Fermer le tour',
    tipOne : 'Astuce',
    tipMany: 'Astuces',
    tipsFinal: 'Pour aller plus loin',
    revert : '↺ Revenir',
  },
  en: {
    step   : (i, n) => `STEP ${i} / ${n}`,
    prev   : '‹ Back',
    next   : 'Next ›',
    close  : 'Close tour',
    tipOne : 'Tip',
    tipMany: 'Tips',
    tipsFinal: 'Going further',
    revert : '↺ Back',
  },
}

// Compose les 5 étapes du profil avec leur texte localisé.
//
// Règle i18n : fr → français, toute autre langue → anglais. Ce repli sur
// l'anglais est délibéré — c'est le premier écran d'un nouvel utilisateur, et
// l'anglais y sert mieux un hispanophone ou un germanophone que le français.
// D'où le `?? .en`, seule exception assumée à la convention `?? .fr` du dépôt
// (cf. `src/test/unit/lang-ternaries-i18n.test.js`). Ajouter une 3ᵉ langue ne
// demande plus qu'un bloc dans TOUR_STEPS_I18N, sans toucher à cette ligne.
// Le drapeau de la photo du ticket éteint (décision du 2026-10-08) : l’étape « Remplis
// ton frigo » perd l’option et les conseils qui la nomment. Le dictionnaire partagé n’est
// pas touché : le guide public, préparé à l’avance, la décrit toujours.
const FRIGO_SANS_PHOTO = {
  fr: {
    subtitle: 'TROIS FAÇONS, AU CHOIX',
    tips: [
      { i: '⚡', t: 'Le plus rapide en rentrant des courses : la voix, sans avoir les deux mains prises par le téléphone.' },
      { i: '🔒', t: 'Le micro reste désactivé tant que tu ne dis pas oui — et tu peux changer d’avis à tout moment dans Confidentialité.' },
    ],
  },
  en: {
    subtitle: 'THREE WAYS, YOUR PICK',
    tips: [
      { i: '⚡', t: 'The fastest way when you get home with groceries: voice, never both hands on the phone.' },
      { i: '🔒', t: 'The mic stays off until you say yes — and you can change your mind anytime in Privacy.' },
    ],
  },
}

function getSteps(profile, lang, photoDuTicket) {
  const dict = TOUR_STEPS_I18N[lang] ?? TOUR_STEPS_I18N.en
  const keys = [...COMMON, FINAL_BY_PROFILE[profile] ?? 'final_guest']
  const steps = keys.map(k => ({ key: k, ...STEP_META[k], ...(dict[k] ?? {}) }))
  if (photoDuTicket) return steps
  const sansPhoto = FRIGO_SANS_PHOTO[lang] ?? FRIGO_SANS_PHOTO.en
  return steps.map(s => (s.key === 'fridge'
    ? { ...s, ...sansPhoto, options: (s.options ?? []).filter(o => o.icon !== 'camera') }
    : s))
}

export default function TourWizard({ lang = 'fr', user, isPremium, onClose, onBack, onAction = {} }) {
  const profile = !user ? 'guest' : isPremium ? 'premium' : 'free'
  const photoDuTicket = useFeatureFlag('receipt_scan', false)
  const steps   = getSteps(profile, lang, photoDuTicket)
  const t       = I18N[lang] ?? I18N.en

  const [idx, setIdx]         = useState(0)
  const [flipped, setFlipped] = useState(false)

  const step   = steps[idx]
  const n       = steps.length
  const isLast = idx === n - 1
  const tips    = step.tips ?? []
  const tipWord = tips.length > 1 ? t.tipMany : t.tipOne

  // a11y : focus trap sur la carte
  const dialogRef = useRef(null)
  useFocusTrap(dialogRef, { active: true })
  useCloseOnBackButton(true, onClose)

  // Injection CSS (une seule fois)
  useEffect(() => {
    if (document.getElementById('tw-styles-v2')) return
    const el = document.createElement('style')
    el.id = 'tw-styles-v2'
    el.textContent = TOUR_CSS
    document.head.appendChild(el)
  }, [])

  // Marquer le tour comme vu
  useEffect(() => {
    try { localStorage.setItem('fridge-tour-v1', 'done') } catch {}
  }, [])

  function goTo(next) {
    setFlipped(false)
    setIdx(Math.min(n - 1, Math.max(0, next)))
  }

  function handleNext() {
    if (isLast) {
      // Étape finale : le bouton principal exécute le CTA du profil.
      onClose()
      if (step.action) onAction[step.action]?.()
    } else {
      goTo(idx + 1)
    }
  }

  function handleBack() {
    if (idx === 0) { onBack?.(); return }
    goTo(idx - 1)
  }

  // Navigation clavier (les flèches naviguent les étapes ; le flip reste au clic)
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowRight' || e.key === 'Enter') handleNext()
      else if (e.key === 'ArrowLeft') handleBack()
      else if (e.key === 'Escape')    onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx])

  const CARD = {
    background: 'linear-gradient(180deg,#221610,#160e07)',
    border: '1px solid rgba(247,168,94,.16)',
    borderRadius: '22px',
    padding: '20px 22px 16px',
    // `flex: 1` et non `height: '100%'` : la face est desormais un element de
    // grille dont la hauteur vient de SON contenu. Une hauteur en pourcentage
    // s'y resoudrait contre une hauteur `auto` — circulaire.
    flex: 1, minHeight: 0,
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 24px 60px rgba(0,0,0,.55)',
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.step(idx + 1, n)}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'rgba(18,10,4,.86)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px', animation: 'tw-bg .22s ease both',
      }}
    >
      {/* Grille chaude en arrière-plan */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'linear-gradient(rgba(224,120,32,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(224,120,32,.04) 1px,transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      <div
        ref={dialogRef}
        className="tw-stage"
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative', zIndex: 1,
          width: '100%', maxWidth: '392px',
          animation: 'tw-card .34s cubic-bezier(.34,1.1,.64,1) both',
        }}
      >
        {/* Bouton fermer — flotte au-dessus de la carte (ne tourne pas) */}
        <Button
          variant="ghost"
          size="icon"
          className="tw-close absolute right-3 top-3 z-10 h-[30px] w-[30px] rounded-lg p-0 hover:bg-transparent"
          onClick={onClose}
          aria-label={t.close}
          style={{
            background: 'rgba(255,255,255,.06)', color: 'rgba(240,232,220,.5)',
            transition: 'background .15s, color .15s',
          }}
        >
          <LuX size={15} aria-hidden="true" />
        </Button>

        <div
          key={idx}
          className={`tw-flip-in ${flipped ? 'flipped' : ''}`}
          // 🔴 `maxHeight` : sans lui, un contenu plus haut que l'écran pousse la
          // navigation DEHORS — mesuré le 2026-09-12 en 360×640, « Suivant »
          // tombait à 685 px pour un écran de 640, et la visite devenait un
          // cul-de-sac. La carte se borne donc à l'écran, et c'est le contenu
          // qui défile (cf. `tw-scroll` plus bas), jamais la navigation.
          style={{ minHeight: '408px', maxHeight: 'calc(100dvh - 24px)' }}
        >
          {/* ── RECTO ─────────────────────────────────────────── */}
          <div className="tw-face front" inert={flipped || undefined}>
            <div className="tw-card" style={CARD}>
              <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '.12em', color: '#C88A44' }}>
                {t.step(idx + 1, n)}
              </span>

              {/* Barre de progression segmentée */}
              <div style={{ display: 'flex', gap: '5px', margin: '11px 0 16px' }}>
                {steps.map((_, i) => (
                  <span key={i} style={{
                    height: '4px', flex: 1, borderRadius: '3px',
                    background: i <= idx ? 'linear-gradient(90deg,#F7A85E,#D46A10)' : 'rgba(255,255,255,.12)',
                    transition: 'background .3s',
                  }} />
                ))}
              </div>

              {/* Zone qui DÉFILE : tout ce qui peut grandir vit ici. La
                  navigation, elle, reste hors de ce conteneur — donc toujours
                  visible, quelle que soit la longueur du texte ou le nombre
                  d'options d'une étape. */}
              {/* La ZONE : une pile de grille. Le contenu REEL de l'etape et le
                  GABARIT invisible des cinq etapes partagent la meme cellule, donc
                  la zone prend la hauteur de la plus haute — les cinq panneaux font
                  la meme taille et « Suivant » ne bouge jamais.
                  `overflowY:auto` ne sert plus que de repli sur un ecran vraiment
                  trop court (390x560 et moins) ; la barre y porte les couleurs de
                  la carte, plus celles du systeme. */}
              <div className="tw-zone" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' }}>
                <ContenuEtape step={step} tipOne={t.tipOne} tipMany={t.tipMany} onAstuces={() => setFlipped(true)} onSecondary={onClose} />
                <div className="tw-gabarit" data-gabarit aria-hidden="true" inert>
                  {steps.map((s, i) => (
                    <ContenuEtape key={i} step={s} tipOne={t.tipOne} tipMany={t.tipMany} />
                  ))}
                </div>
              </div>

              {/* Navigation.
                  ⚠️ La rangée vit EN DEHORS du gabarit : lui n'impose que la
                  hauteur du contenu. Or à l'étape finale le libellé change
                  (« Créer un compte » au lieu de « Suivant »). Assez large, il
                  écrasait « ‹ Précédent » qui passait à la ligne : +10 px sur
                  cette seule étape, donc un panneau plus haut que les autres et
                  une commande qui saute. Invisible sur le poste du mainteneur,
                  reproduit trois fois de suite par la CI — les polices de Linux
                  ne mesurent pas comme celles de Windows.
                  Remède STRUCTUREL, et non un nombre : aucun des deux libellés
                  ne peut passer à la ligne, donc la rangée fait toujours
                  exactement une ligne, quelle que soit la police et quelle que
                  soit la longueur du libellé. */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', gap: '10px' }}>
                <button
                  type="button"
                  className="tw-nav-back"
                  onClick={handleBack}
                  disabled={idx === 0 && !onBack}
                  style={{
                    background: 'none', border: 'none', padding: '6px',
                    color: '#B9A88F', fontSize: '13px', fontWeight: 600,
                    whiteSpace: 'nowrap',
                    cursor: (idx === 0 && !onBack) ? 'default' : 'pointer',
                    opacity: (idx === 0 && !onBack) ? .3 : 1,
                    transition: 'color .15s',
                  }}
                >
                  {t.prev}
                </button>
                <button
                  type="button"
                  className="tw-next"
                  onClick={handleNext}
                  style={{
                    border: 'none', borderRadius: '11px', padding: '10px 20px',
                    fontSize: '14px', fontWeight: 800, color: '#fff', cursor: 'pointer',
                    background: '#B85000',
                    boxShadow: '0 6px 18px rgba(184,80,0,.45)',
                    transition: 'filter .15s, transform .1s',
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}
                >
                  {isLast ? step.ctaLabel : t.next}
                </button>
              </div>
            </div>
          </div>

          {/* ── VERSO (astuces) ───────────────────────────────── */}
          <div className="tw-face back" inert={!flipped || undefined}>
            <div className="tw-card" style={CARD}>
              <h3 style={{
                fontSize: '14px', fontWeight: 800, color: '#F7B87A',
                margin: '2px 0 15px', display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                💡 {isLast ? t.tipsFinal : tipWord}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {tips.map((tip, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: '12px', alignItems: 'flex-start',
                    background: 'rgba(247,168,94,.12)', border: '1px solid rgba(247,168,94,.34)',
                    borderRadius: '14px', padding: '14px 15px',
                    fontSize: '14px', lineHeight: 1.5, color: '#F6EAD6', fontWeight: 500,
                  }}>
                    <span style={{ flexShrink: 0, fontSize: '20px', lineHeight: 1.1, display: 'flex', color: '#F7A85E' }} aria-hidden="true">{tip.icon ? <TourIcon id={tip.icon} size={20} /> : tip.i}</span>
                    <span>{tip.t}</span>
                  </div>
                ))}
              </div>

              <div style={{ flex: 1 }} />

              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px' }}>
                <button
                  type="button"
                  className="tw-revert"
                  onClick={() => setFlipped(false)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                    color: '#E8B57E', fontSize: '11.5px', fontWeight: 700, padding: '6px 13px',
                    background: 'rgba(247,168,94,.08)', border: '1px solid rgba(247,168,94,.20)',
                    borderRadius: '999px', transition: 'filter .15s',
                  }}
                >
                  {t.revert}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
