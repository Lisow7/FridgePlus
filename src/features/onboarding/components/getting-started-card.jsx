import { createPortal } from 'react-dom'
import { GETTING_STARTED_I18N } from '../i18n/getting-started-i18n'
import { QUICK_START_I18N } from '../i18n/quick-start-i18n'
import { QUICK_ADD_IDS } from '../lib/quick-add-ingredients'
import QuickAddChips from './quick-add-chips'
import { TourIcon } from '../lib/tour-icon'
import FabGlyph from '@shared/ui/fab-glyph'

// Carte « coach » FLOTTANTE (portail vers document.body). Affiche UN seul état à
// la fois (déterminé en amont par le container via `state`) et se transforme au
// fil de la progression. Présentational : ne lit aucun contexte.
//
// Rendue hors de la hiérarchie du frigo (héros centré + transform) qui écraserait
// un élément in-flow ; le portail + position fixed garantit un ancrage écran.
export default function GettingStartedCard({
  lang = 'fr', state, isGuest = false, stepsTotal = 2, stepsDone = 0, recipeName = '',
  collapsed, onCollapse, stock, onQuickAdd, onQuickRemove, onSeeRecipe, onSeeRecipes, onSignUp, onOpenRewards,
}) {
  const t = GETTING_STARTED_I18N[lang] ?? GETTING_STARTED_I18N.fr
  const tq = QUICK_START_I18N[lang] ?? QUICK_START_I18N.fr

  // Réduite (« masquer ») : plus de pastille flottante — le point d'entrée pour
  // rouvrir le guide vit désormais dans le footer (bouton fusée 🚀). Masqué =
  // simplement retiré de l'écran (réversible depuis le footer).
  if (collapsed) return null

  // Résout titre / texte / corps / CTA selon l'état actif. `showAddAll` piste
  // les états qui affichent les puces (s1/s2b) : le bouton « Tout ajouter »
  // est rendu par la carte (pas par QuickAddChips) pour pouvoir l'aligner
  // côte à côte avec la CTA quand les deux coexistent (s2b) — chantier H,
  // 2026-07-09, corrige 2 boutons oranges empilés qui semblaient redondants.
  let title = '', text = '', cta = null, onCta = null, body = null
  const showAddAll = state === 's1' || state === 's2b'
  if (state === 's1') {
    title = t.s1.title; text = t.s1.text
    body = <QuickAddChips lang={lang} stock={stock} onQuickAdd={onQuickAdd} onQuickRemove={onQuickRemove} />
  } else if (state === 's2a') {
    title = t.s2a.title; text = t.s2a.text(recipeName); cta = t.s2a.cta; onCta = onSeeRecipe
  } else if (state === 's2b') {
    // Frigo rempli mais pas encore de recette prête → on garde les puces pour
    // continuer à ajouter en un tap jusqu'à débloquer une recette (flow fluide).
    title = t.s2b.title; text = t.s2b.text
    body = <QuickAddChips lang={lang} stock={stock} onQuickAdd={onQuickAdd} onQuickRemove={onQuickRemove} />
    cta = t.s2b.cta; onCta = onSeeRecipes
  } else if (state === 's3') {
    title = t.s3.title; text = t.s3.text; cta = t.s3.cta; onCta = onSeeRecipes
  } else { // fin
    const f = isGuest ? t.finGuest : t.finCook
    title = f.title; text = f.text; cta = f.cta; onCta = isGuest ? onSignUp : onOpenRewards
  }

  return createPortal(
    <section
      aria-label={t.title}
      className="fixed bottom-[calc(22px+var(--fp-footer-height,0px)+var(--fp-bottom-inset,0px))] left-1/2 z-[60] w-[92%] max-w-[380px] -translate-x-1/2 rounded-2xl border p-4"
      style={{ background: '#FFFDFB', borderColor: 'rgba(247,168,94,0.55)', boxShadow: '0 14px 44px rgba(150,95,30,0.28)' }}
    >
      <button
        type="button" onClick={onCollapse} aria-label={t.dismiss}
        className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-lg text-sm opacity-50 transition-opacity hover:opacity-100" style={{ color: '#8A5A18' }}
      >✕</button>

      {/* `<h2>` et non `<h3>` : cette carte est la première section de la page
          d'accueil, dont le `<h1>` est posé par `FridgeHomeView`. En `<h3>`, le
          plan de la page sautait un niveau — invisible à l'œil, mais c'est le
          plan que suit quelqu'un qui navigue de titre en titre.

          🔴 Le défaut PRÉEXISTAIT : mesuré le 2026-08-22 sur `origin/dev`,
          l'ordre était déjà h1 « Fridge+ » → h3. Il n'apparaît qu'une fois
          l'écran de bienvenue passé — tant qu'il est ouvert, son
          `aria-modal="true"` retire le reste de la page de l'arbre
          d'accessibilité, et le saut de niveau avec. C'est pour ça qu'aucune
          mesure faite sur un stockage vierge ne pouvait le voir.

          `text-base` fixe déjà la taille : rendu identique au pixel, vérifié
          au navigateur (16px / 800 / margin 0). Garde-fou : `e2e/a11y.spec.js`,
          règle `heading-order`. */}
      <h2 className="pr-6 text-base font-extrabold" style={{ color: '#8A5A18' }}>{title}</h2>
      <p className="mt-1 text-sm" style={{ color: '#3C2D1E' }}>{text}</p>
      {/* À vide, nommer les façons de remplir avec les icônes du menu et
          le glyphe du bouton orange : l'état vide enseigne l'action principale
          (spec « aide & bouton orange », 2026-09-11). */}
      {state === 's1' && t.s1.ways && (
        <div data-ways style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 10px', marginTop: 8, fontSize: 12.5, color: '#7A6A52' }}>
          <ul role="list" style={{ display: 'contents', margin: 0, padding: 0, listStyle: 'none' }}>
            {['door', 'search', 'mic', 'camera'].filter(id => t.s1.ways[id]).map(id => (
              <li key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ display: 'flex', color: 'var(--color-warm-600)' }}><TourIcon id={id} size={14} /></span>
                <span>{t.s1.ways[id]}</span>
              </li>
            ))}
          </ul>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>— {t.s1.ways.fab} <FabGlyph size={14} /></span>
        </div>
      )}

      {body}

      {(showAddAll || (cta && typeof onCta === 'function')) && (
        <div className="mt-3 flex gap-2">
          {showAddAll && (
            <button
              type="button" onClick={() => onQuickAdd?.(QUICK_ADD_IDS)}
              className="flex-1 rounded-xl px-3 py-2.5 text-sm font-bold text-white transition-transform hover:scale-[1.02]"
              style={{ background: '#B85000', boxShadow: '0 4px 14px rgba(184,80,0,0.4)' }}
            >
              {tq.addAll}
            </button>
          )}
          {cta && typeof onCta === 'function' && (
            <button
              type="button" onClick={onCta}
              className="flex-1 rounded-xl px-3 py-2.5 text-sm font-bold text-white transition-transform hover:scale-[1.02]"
              style={{ background: '#B85000', boxShadow: '0 4px 14px rgba(184,80,0,0.4)' }}
            >
              {cta} →
            </button>
          )}
        </div>
      )}

      {/* Points de progression : n = étapes du parcours, premiers `stepsDone` remplis. */}
      <div className="mt-3 flex justify-center gap-1.5" aria-hidden="true">
        {Array.from({ length: stepsTotal }).map((_, i) => (
          <span key={i} className="h-1.5 rounded-full transition-all"
            style={{ width: i < stepsDone ? '18px' : '6px', background: i < stepsDone ? '#E8924A' : 'rgba(232,146,74,0.3)' }} />
        ))}
      </div>
    </section>,
    document.body,
  )
}
