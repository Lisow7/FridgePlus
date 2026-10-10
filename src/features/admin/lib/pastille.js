import { texteLisible, fondTeinte } from '@shared/lib/couleurs/texte-lisible'

// Le style d'une pastille de filtre (statut, type, non lus…) : bordure et fond
// teintés de l'accent quand elle est active, texte lisible dessus, sinon la
// couleur atténuée de l'écran. Signalements et Support en gardaient chacun une
// copie (audit du 2026-10-04, ADM-27).
export function stylePastille(active, { accent = 'var(--color-brand-500)', border, muted }) {
  return {
    borderColor: active ? accent : border,
    background: active ? fondTeinte(accent, 10) : 'transparent',
    color: active ? texteLisible(accent) : muted,
    fontWeight: active ? 700 : 500,
    transition: 'all 0.12s',
  }
}
