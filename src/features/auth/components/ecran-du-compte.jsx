import { couleursDuCompte } from '../lib/ecrans-du-compte'

// Le gabarit des écrans pleins qui remplacent l'application le temps d'un
// choix sur le compte (suppression en cours, compte désactivé) : l'en-tête
// « Fridge+ » et une colonne centrée, comme sur les maquettes validées par
// Antoine le 2026-10-05.

// `darkMode` est passé par l'écran (et non relu ici) : l'écran banni le
// reçoit de son parent, les autres de `useUI`.
export default function EcranDuCompte({ icone, titre, aDroite, darkMode = false, children }) {
  const c = couleursDuCompte(darkMode)
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: c.fond, color: c.texte }}>
      <header style={{ padding: '16px 22px', borderBottom: `1px solid ${c.bord}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 19, fontWeight: 800 }}>Fridge<span style={{ color: c.accent }}>+</span></span>
        {aDroite && <span style={{ fontSize: 15, color: c.doux }}>{aDroite}</span>}
      </header>
      <main style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '32px 20px' }}>
        <div style={{ width: '100%', maxWidth: 360, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div aria-hidden="true" style={{ fontSize: 44, lineHeight: 1 }}>{icone}</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, lineHeight: 1.3 }}>{titre}</h1>
          {children}
        </div>
      </main>
    </div>
  )
}
