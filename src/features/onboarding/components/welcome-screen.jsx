import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import TourWizard from './tour-wizard'
import { WELCOME_I18N } from '../i18n/welcome-i18n'
import { markWelcomeSeen } from '../lib/welcome-storage'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import { PREMIUM_ENABLED } from '@shared/lib/premium-config'
import Button from '@shared/ui/button'
// WebP SANS PERTE, pas PNG : mesuré le 2026-08-24, ce logo est l'élément **LCP**
// de l'accueil sur mobile — c'est lui qui date la plus grande peinture de la page
// vue par un nouveau visiteur (et par le crawler). 68 ko → 34,8 ko, soit -49 %
// sur le chemin critique.
// 🔴 `lossless: true` est délibéré : **0 pixel visible modifié** (vérifié canal
// par canal, alpha compris). Les variantes avec perte descendaient à 15-20 ko
// mais altéraient le logotype de la marque — un gain de moitié sans aucune
// concession vaut mieux qu'un gain de trois quarts qui se discute.
import fridgeLogo from '../assets/fridge-logo.webp'

// Écran d'accueil au tout 1er lancement (visiteurs comme membres). Persiste
// `fridge-welcome-seen-v1` dans le localStorage pour ne plus se déclencher.
//
// Refonte : la marque « Fridge+ » devient un vrai logotype (icône frigo sur
// carré orange + wordmark « Fridge » clair / « + » orange), suivie d'un accueil
// inclusif « Bienvenue en cuisine ! ». 2 CTA — « Faire la visite guidée » lance
// le TourWizard (monté inline), « Entrer directement » ferme l'accueil. Bouton
// « Passer » en haut à droite. Le flag est posé à la fermeture dans tous les cas.
//
// Pour RELANCER le tour plus tard, le chemin est passé par la page `/guide` :
// le bouton « ? » du HelpGuide y mène, et c'est elle qui monte le TourWizard.
// Cet écran d'accueil garde son montage inline — il s'affiche avant toute
// navigation, et l'envoyer sur une route couperait l'enchaînement.

export default function WelcomeScreen({ lang = 'fr', user, isPremium, onClose, onAction = {} }) {
  // Même règle que TourWizard : fr → français, toute autre langue → anglais.
  // Repli sur `.en` assumé (et non `.fr` comme ailleurs) — écran d'accueil.
  const t = WELCOME_I18N[lang] ?? WELCOME_I18N.en
  // « Faire la visite guidée » → bascule en mode tour (cycle géré par le tour).
  const [tourOpen, setTourOpen] = useState(false)
  // a11y : focus trap + Escape (1er écran au launch)
  const dialogRef = useRef(null)
  useFocusTrap(dialogRef, { active: !tourOpen, onEscape: () => { markWelcomeSeen(); onClose?.() } })

  function handleClose() {
    markWelcomeSeen()
    onClose?.()
  }

  useCloseOnBackButton(!tourOpen, handleClose)

  function handleStart() {
    setTourOpen(true)
  }

  function handleTourClose() {
    setTourOpen(false)
    handleClose()
  }

  if (tourOpen) {
    return (
      <TourWizard
        lang={lang}
        user={user}
        isPremium={isPremium}
        onClose={handleTourClose}
        onAction={onAction}
      />
    )
  }

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={t.greet}
      className="fp-modal-backdrop"
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'linear-gradient(160deg, #1A1008 0%, #2D1B0E 50%, #1A1008 100%)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        // 🔴 Deux défauts mesurés le 2026-09-12 sur le build de production, tous
        // deux corrigés ici — cf. `e2e/ecran-bienvenue-petite-hauteur.spec.js`.
        //
        // `overflowY: auto` : le panneau mesure 730 à 770 px. Plus haut que
        // l'écran, `align-items: center` répartissait le débord EN HAUT ET EN BAS
        // à la fois (101 px perdus en 320×568) et RIEN ne défilait : le contenu
        // coupé était définitivement inatteignable, « Entrer directement »
        // compris. D'où `alignItems: flex-start` + `margin: auto` sur le panneau,
        // qui centre quand il y a de la place et s'accroche en haut sinon.
        //
        // Plus de bande réservée en haut : elle servait au bouton « Passer »
        // épinglé, retiré par la décision du 2026-10-08 (2026-10-08, `bienvenue_sortie =
        // entrer`) — il faisait la même chose qu'« Entrer directement → ».
        // Sortir reste possible par ce bouton, par Échap et par « retour ».
        padding: '24px', overflowY: 'auto', overscrollBehavior: 'contain',
      }}
    >
      <div className="fp-modal-panel" style={{
        width: '100%', maxWidth: '452px', margin: 'auto',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: '19px', textAlign: 'center',
      }}>
        {/* Logo — icône frigo sur carré orange */}
        <div style={{
          width: '112px', height: '112px', borderRadius: '27px',
          background: 'linear-gradient(135deg, #F7A85E, #D46A10)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 14px 44px rgba(212,106,16,0.45), 0 0 60px rgba(247,168,94,0.25)',
          border: '1px solid rgba(255,255,255,0.12)',
        }}>
          <img
            src={fridgeLogo}
            alt=""
            aria-hidden="true"
            style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '6px' }}
          />
        </div>

        {/* Marque + accueil */}
        <div>
          {/* Logotype Fridge+ — « Fridge » clair, « + » orange qui pop */}
          <div style={{ fontSize: 'clamp(32px, 7.6vw, 41px)', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1, margin: '2px 0 8px' }}>
            <span style={{ color: '#F6EEE4' }}>Fridge</span>
            <span style={{ color: '#F7A85E', textShadow: '0 0 22px rgba(247,168,94,0.7)', marginLeft: '2px' }}>+</span>
          </div>
          {/* Accueil chaleureux et inclusif */}
          <h1 style={{
            margin: 0, fontSize: '19px', fontWeight: 800, letterSpacing: '0.005em',
            background: 'linear-gradient(90deg, #FFD9A8 0%, #F7A85E 58%, #FFCB8C 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            {t.greet}
          </h1>
          <p style={{ margin: '9px 0 0', fontSize: '15.5px', color: 'rgba(245,237,228,0.72)', lineHeight: 1.5 }}>
            {t.sub}
          </p>
        </div>

        {/* Bullets — 3 features clés */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {t.bullets.map((b, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              padding: '14px 16px', borderRadius: '14px', textAlign: 'left',
              background: 'rgba(247,168,94,0.06)', border: '1px solid rgba(247,168,94,0.16)',
            }}>
              <span style={{ fontSize: '24px', flexShrink: 0, lineHeight: 1 }} aria-hidden="true">{b.emoji}</span>
              <span style={{ fontSize: '14.5px', color: '#F5EDE4', lineHeight: 1.4, fontWeight: 500 }}>
                {b.text}
              </span>
            </div>
          ))}
        </div>

        {/* Teaser sobre des features à venir (mode Launch Free uniquement). */}
        {!PREMIUM_ENABLED && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', fontSize: '12.5px', fontWeight: 700,
            color: '#F0C79A', background: 'rgba(247,168,94,0.12)',
            // ⚠️ RECTANGLE ARRONDI, pas capsule. Tout cet écran est en rectangles
            // arrondis — 27px le logo, 14px les trois lignes juste au-dessus,
            // 15px et 13px les deux boutons juste en dessous. Un `999px` ici
            // faisait de cette pastille le seul élément d'une autre famille, et
            // ça se voyait (signalé le 2026-09-12).
            border: '1px solid rgba(247,168,94,0.3)', borderRadius: '12px', padding: '8px 16px',
          }}>
            {t.soonTeaser}
          </span>
        )}

        {/* CTAs */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '11px', marginTop: '2px' }}>
          <Button
            type="button"
            onClick={handleStart}
            className="h-auto w-full flex-col rounded-[15px] bg-none bg-[#B85000] px-5 py-[15px] text-white"
            style={{
              gap: '2px',
              boxShadow: '0 8px 28px rgba(184,80,0,0.45)',
              transition: 'transform 0.12s, box-shadow 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 10px 36px rgba(184,80,0,0.6)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 8px 28px rgba(184,80,0,0.45)'; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            <span style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '0.01em' }}>🧭 {t.cta}</span>
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#fff' }}>{t.ctaSub}</span>
          </Button>
          <Button
            variant="ghost"
            type="button"
            onClick={handleClose}
            className="h-auto w-full rounded-[13px] border bg-transparent px-4 py-[13px] text-sm font-bold hover:bg-transparent"
            style={{
              borderColor: 'rgba(245,237,228,0.16)',
              color: 'rgba(245,237,228,0.8)',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,237,228,0.05)'; e.currentTarget.style.color = '#F5EDE4' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(245,237,228,0.8)' }}
          >
            {t.later}
          </Button>
        </div>

        <p style={{
          margin: '2px 0 0', fontSize: '11.5px',
          color: 'rgba(245,237,228,0.42)', textAlign: 'center', lineHeight: 1.5, maxWidth: '360px',
        }}>
          {t.skipFootnote}
        </p>
      </div>
    </div>,
    document.body,
  )
}
