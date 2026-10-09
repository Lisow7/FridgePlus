// RecipeSourceBadge — petit rectangle à bords ronds indiquant la
// provenance d'une recette dans le panel/fiche recette.
//
// Variants (mutuellement exclusifs) :
//   - 'community' : recette validée par l'admin (custom_recipes :
//     moderation_status='approved' AND is_public=true) mais PAS encore
//     promue vers base_recipes. Couleur orange-warm cohérente avec la
//     palette brand.
//   - 'authentic' : recette promue par l'admin vers base_recipes
//     (base_recipes.promoted_from_id non-null). Couleur verte = badge
//     « validé/officiel ». Différencie visuellement des recettes
//     Fridge+ officielles natives (sans badge).
//
// i18n : 2 langues seulement (fr, en) cohérent avec la politique
// changelog/UI (Sprint 7).
//
// Pas de variant officielles Fridge+ : pas de badge = recette de base
// hardcodée par Fridge+ depuis le départ.

const I18N = {
  fr: { community: 'Communauté', authentic: 'Authentique' },
  en: { community: 'Community',  authentic: 'Authentic'   },
}

const STYLES = {
  community: {
    background: 'var(--gradient-deep)',
    color: '#FFFFFF',
    shadow: '0 1px 4px rgba(212,106,16,0.30)',
  },
  authentic: {
    background: 'linear-gradient(135deg, #4CAF7D 0%, #2E8B57 100%)',
    color: '#FFFFFF',
    shadow: '0 1px 4px rgba(46,139,87,0.30)',
  },
}

export default function RecipeSourceBadge({ variant, lang = 'fr', size = 'sm' }) {
  if (variant !== 'community' && variant !== 'authentic') return null
  const t = (I18N[lang] ?? I18N.fr)[variant]
  const s = STYLES[variant]
  const isLg = size === 'lg'

  return (
    <span
      className="inline-flex items-center font-bold whitespace-nowrap"
      style={{
        background: s.background,
        color: s.color,
        boxShadow: s.shadow,
        padding: isLg ? '4px 10px' : '2px 8px',
        borderRadius: '6px',
        fontSize: isLg ? '12px' : '10px',
        letterSpacing: '0.02em',
        lineHeight: 1.2,
      }}
    >
      {t}
    </span>
  )
}
