import { LuX } from 'react-icons/lu'
import { useLang } from '@shared/contexts/ui-provider'

// Le message d'un chargement raté à la connexion : frigo, favoris, recettes —
// un seul, deux, ou les trois.
//
// Un chargement en échec n'écrase rien (règle du 2026-08-28) — mais jusqu'au
// 2026-10-04 il ne disait rien non plus : la personne voyait un frigo vide et le
// croyait vidé (audit UX-02). Ce message reste tant qu'elle n'a pas réessayé ou
// fermé : il n'y a rien d'autre à l'écran pour expliquer ce vide.
const I18N = {
  fr: {
    names: { stock: 'ton frigo', favorites: 'tes favoris', recipes: 'tes recettes' },
    and: ' et ',
    // Seul, chaque nom porte son accord ; à plusieurs, c'est le masculin pluriel.
    alone: {
      stock: 'n’a pas pu être chargé.',
      favorites: 'n’ont pas pu être chargés.',
      recipes: 'n’ont pas pu être chargées.',
    },
    several: 'n’ont pas pu être chargés.',
    hint: 'Rien n’est perdu : ce que tu vois n’est simplement pas à jour.',
    retry: 'Réessayer',
    close: 'Fermer',
  },
  en: {
    names: { stock: 'your fridge', favorites: 'your favourites', recipes: 'your recipes' },
    and: ' and ',
    alone: { stock: 'could not be loaded.', favorites: 'could not be loaded.', recipes: 'could not be loaded.' },
    several: 'could not be loaded.',
    hint: 'Nothing is lost: what you see is simply not up to date.',
    retry: 'Try again',
    close: 'Close',
  },
}

// « Ton frigo, tes favoris et tes recettes n'ont pas pu être chargés. »
function phrase(t, missing) {
  const connus = missing.filter((quoi) => t.names[quoi])
  const quoi = connus.length > 0 ? connus : Object.keys(t.names)
  const noms = quoi.map((cle) => t.names[cle])
  const liste = noms.length > 1 ? `${noms.slice(0, -1).join(', ')}${t.and}${noms[noms.length - 1]}` : noms[0]
  const verbe = quoi.length === 1 ? t.alone[quoi[0]] : t.several
  return `${liste.charAt(0).toUpperCase()}${liste.slice(1)} ${verbe}`
}

// `missing` : ce qui n'a pas pu être chargé, parmi 'stock', 'favorites', 'recipes'.
export default function LoadErrorToast({ missing = [], onRetry, onClose }) {
  const { lang } = useLang()
  const t = I18N[lang] ?? I18N.fr
  // Sur un écran large : le texte, puis les deux boutons, sur une ligne. Sur un
  // téléphone le texte prend toute la largeur et les boutons passent dessous —
  // sans cela il se serrait dans ce que les boutons lui laissaient.
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 12px',
      maxWidth: 'min(460px, calc(100vw - 32px))', padding: '12px 14px', borderRadius: '12px',
      background: '#B91C1C', color: 'white', fontSize: '14px', lineHeight: 1.4,
      boxShadow: '0 6px 18px rgba(0,0,0,0.22)',
    }}>
      <p style={{ margin: 0, flex: '1 1 220px' }}>
        <strong style={{ fontWeight: 700 }}>{phrase(t, missing)}</strong>{' '}
        <span style={{ opacity: 0.92 }}>{t.hint}</span>
      </p>
      {/* 44 px : la taille d'une cible qu'on touche au doigt sans viser. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
        <button
          type="button" onClick={onRetry}
          style={{
            minHeight: '44px', padding: '6px 14px', borderRadius: '8px', border: 'none',
            background: 'white', color: '#B91C1C', fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {t.retry}
        </button>
        <button
          type="button" onClick={onClose} aria-label={t.close}
          style={{
            width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.9,
          }}
        >
          <LuX size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
