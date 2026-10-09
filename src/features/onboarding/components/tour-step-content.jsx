import { TourIcon } from '../lib/tour-icon'

// Le contenu d'UNE etape de la visite guidee, extrait de `tour-wizard.jsx`.
//
// ── Pourquoi un fichier a part ────────────────────────────────────────────
// Deux raisons, et la seconde est un cliquet.
//
// 1. Il est rendu SIX fois : une fois pour l'etape affichee, et cinq fois —
//    invisible — dans le gabarit qui donne a la carte la hauteur de l'etape la
//    plus haute. Deux copies de ce JSX divergeraient, et la carte se reglerait
//    alors sur une hauteur qui n'est plus celle du contenu reel.
// 2. `tour-wizard.jsx` a franchi les 500 lignes le 2026-09-12, et le budget de
//    taille des composants (`component-size-budget.test.js`) demande de decouper
//    plutot que d'accumuler la dette. Ce bloc-ci etait la coupe evidente : il ne
//    depend de rien du wizard, seulement de ses props.

// Réplique visuelle du vrai bouton FAB (carré orange + grille 2×2).
function FabIcon() {
  return (
    <div style={{
      width: '58px', height: '58px', borderRadius: '16px',
      background: 'linear-gradient(135deg,#F7A85E 0%,#D46A10 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 7px 22px rgba(212,106,16,.55),0 0 24px rgba(212,106,16,.35)',
    }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff"
        strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="7.5" height="7.5" rx="1.4" />
        <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.4" />
        <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.4" />
        <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.4" />
      </svg>
    </div>
  )
}

// ── Composant principal ────────────────────────────────────────────────────────
/**
 * Le contenu d'UNE etape : icone, titre, sous-titre, options ou description, et
 * le bouton « Astuces ».
 *
 * ── Pourquoi c'est un composant, et pas du JSX en ligne ──────────────────────
 * Il est rendu DEUX fois : une fois pour l'etape courante, et cinq fois —
 * invisible — dans le GABARIT qui donne a la carte la hauteur de l'etape la plus
 * haute. Deux copies de ce JSX divergeraient, et la carte se reglerait alors sur
 * une hauteur qui n'est plus celle du contenu reel. C'est la classe de defaut
 * dominante de ce depot ; on ne la refait pas ici.
 *
 * `onAstuces` absent = rendu de gabarit : le bouton reste, car il OCCUPE de la
 * place et c'est precisement ce qu'on mesure, mais il ne fait rien.
 */
export default function ContenuEtape({ step, tipOne, tipMany, onAstuces, onSecondary }) {
  const tips = step.tips ?? []
  const tipWord = tips.length > 1 ? tipMany : tipOne
  return (
    <div>
    {/* Icône */}
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      margin: '6px 0 12px', minHeight: '58px',
    }}>
      {step.customIcon
        ? <FabIcon />
        : step.icon
        ? <span style={{ display: 'flex', color: '#F7A85E', filter: 'drop-shadow(0 0 14px rgba(224,120,32,.5))' }}><TourIcon id={step.icon} size={44} /></span>
        : <span style={{ fontSize: '44px', lineHeight: 1, filter: 'drop-shadow(0 0 14px rgba(224,120,32,.5))' }}>
            {step.emoji}
          </span>}
    </div>

    <h2 style={{ fontSize: '20px', fontWeight: 800, textAlign: 'center', margin: 0, color: '#F5EBDD' }}>
      {step.title}
    </h2>
    <div style={{
      fontSize: '10px', fontWeight: 800, letterSpacing: '.09em',
      color: '#E8924A', textAlign: 'center', margin: '7px 0 13px',
    }}>
      {step.subtitle}
    </div>
    {step.options
      ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
          {step.options.map((opt, i) => (
            <div key={i} style={{
              display: 'flex', gap: '11px', alignItems: 'center',
              background: 'rgba(247,168,94,.12)', border: '1px solid rgba(247,168,94,.34)',
              borderRadius: '13px', padding: '11px 13px',
            }}>
              <span style={{ flexShrink: 0, fontSize: '22px', lineHeight: 1, display: 'flex', color: '#F7A85E' }} aria-hidden="true">{opt.icon ? <TourIcon id={opt.icon} size={22} /> : opt.i}</span>
              <span>
                <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 800, color: '#F5EBDD' }}>{opt.t}</span>
                <span style={{ display: 'block', fontSize: '12.5px', lineHeight: 1.4, color: '#D8C9B4' }}>{opt.d}</span>
              </span>
            </div>
          ))}
        </div>
      )
      : (
        <p style={{
          fontSize: '14px', lineHeight: 1.55, textAlign: 'center',
          color: '#E4D9C7', margin: '0 auto', maxWidth: '295px',
        }}>
          {step.desc}
        </p>
      )}

    {/* P4 (audit 2026-10-02) : la visite d'un invité finissait sur « Créer un
        compte » seul. L'autre voie, discrète mais nommée, vit ICI et non dans la
        rangée de navigation, qui doit rester sur une ligne (cf. tour-wizard). */}
    {step.secondaryLabel && (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
        <button
          type="button"
          onClick={onSecondary}
          disabled={!onSecondary}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', minHeight: 32, padding: '6px 10px',
            color: '#E4D9C7', fontSize: '13px', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: '3px',
          }}
        >
          {step.secondaryLabel}
        </button>
      </div>
    )}

    {/* Bouton Astuce(s) — orange sombre, texte blanc, halo pulsé */}
    {tips.length > 0 && (
      <div style={{ display: 'flex', justifyContent: 'center', margin: '15px 0 4px' }}>
        <button
          type="button"
          className="tw-tip-btn"
          onClick={onAstuces}
          disabled={!onAstuces}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
            color: '#fff', fontSize: '12.5px', fontWeight: 800, padding: '8px 16px',
            background: 'linear-gradient(135deg,rgba(224,120,32,.34),rgba(150,78,20,.30))',
            border: '1px solid rgba(247,168,94,.5)', borderRadius: '999px',
            transition: 'filter .15s',
          }}
        >
          💡 {tipWord} ({tips.length})
        </button>
      </div>
    )}
    </div>
  )
}
