// Habillage commun des sections du formulaire de recette : titre, carte, et
// style des messages d'erreur.
//
// Extrait de `recipe-form-modal.jsx` le 2026-07-30 (§2 audit front). Ces trois
// éléments sont utilisés par les QUATRE sections (présentation, détails,
// ingrédients, étapes) : tant qu'ils vivaient dans le composant parent,
// extraire une section aurait créé un import enfant → parent. Ce module est le
// préalable à ce découpage — même séquence que `lib/recipe-form-units.js`.
//
// `sectionStyle` est une FONCTION et non un objet, parce qu'il dépend de
// `darkMode` : c'est la seule différence de forme avec le code d'origine, et
// elle est explicite au site d'appel.

export const ERR_MSG = { fontSize: '12px', color: '#D07070', marginTop: '4px', display: 'block' }

export const sectionStyle = (darkMode) => ({
  marginBottom: '16px',
  padding: '18px 20px',
  borderRadius: '14px',
  background: darkMode ? '#131E2C' : '#FFF',
  border: darkMode ? '1px solid #1A2A3D' : '1px solid #EDE4D4',
})

// Appelée comme une fonction (`{sectionTitle(t.x)}`) et non montée comme un
// composant : la signature reste celle d'origine, les 4 sites d'appel sont
// inchangés.
export const sectionTitle = (txt) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
    <div style={{ width: '3px', height: '18px', borderRadius: '2px', background: 'var(--color-brand-500)', flexShrink: 0 }} />
    <h3 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-brand-500)', textTransform: 'uppercase', letterSpacing: '0.09em', margin: 0 }}>{txt}</h3>
  </div>
)
