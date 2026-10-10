import { Link } from 'react-router-dom'
import { LuArrowLeft } from 'react-icons/lu'
import { useDocumentTitle } from '@shared/hooks/use-document-title'

// Une page publique faite de texte seul — `/accessibilite`, `/securite` : un
// titre, un chapeau, des sections (paragraphes, liste, un lien), la date de mise
// à jour. Le contenu vient d’un module de `data/`, que le HTML servi
// (`src/prerender/corps-statique.js`) lit aussi : la page et le fichier servi ne
// peuvent pas se contredire.
//
// Pas de carte ni de bouton plein, et aucune couleur en dur : les variables du
// thème suivent le clair et le sombre d’elles-mêmes. Le lien est en
// `--link-accent`, le seul token d’accent qui tient 4,5:1 sur le crème des pages
// de contenu (4,62:1 ; voir `index.css`).

const I18N = {
  fr: { retour: 'Retour à l’accueil' },
  en: { retour: 'Back to home' },
}

const TEXTE = { margin: '0 0 10px', fontSize: 14.5, lineHeight: 1.6, color: 'var(--color-muted)', maxWidth: '66ch' }

export default function PagePubliqueDeTexte({ contenu, lang = 'fr', Icone }) {
  const t = I18N[lang] ?? I18N.fr
  const c = contenu[lang] ?? contenu.fr
  useDocumentTitle(`${c.titre} — Fridge+`)

  return (
    <div role="article" style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 64px', color: 'var(--color-charcoal)' }}>
      <Link
        to="/"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 20,
          fontSize: 13.5, fontWeight: 700, color: 'var(--color-muted)', textDecoration: 'none',
        }}
      >
        <LuArrowLeft size={16} aria-hidden="true" />
        {t.retour}
      </Link>

      <header style={{ marginBottom: 26 }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', margin: 0, display: 'flex', alignItems: 'center', gap: 11 }}>
          {Icone && <Icone size={26} aria-hidden="true" />}
          {c.titre}
        </h1>
        <p style={{ ...TEXTE, marginTop: 8, fontSize: 15, lineHeight: 1.55 }}>{c.intro}</p>
      </header>

      {c.sections.map((s) => (
        <section key={s.id} id={s.id} aria-labelledby={`${s.id}-titre`} style={{ marginBottom: 26 }}>
          <h2 id={`${s.id}-titre`} style={{ fontSize: 19, fontWeight: 750, margin: '0 0 10px', letterSpacing: '-0.01em' }}>
            {s.titre}
          </h2>
          {s.paragraphes?.map((p, i) => <p key={i} style={TEXTE}>{p}</p>)}
          {s.liste && (
            <ul style={{ ...TEXTE, paddingLeft: 22, listStyle: 'disc' }}>
              {s.liste.map((x, i) => <li key={i} style={{ marginTop: i ? 6 : 0 }}>{x}</li>)}
            </ul>
          )}
          {s.lien && (
            <p style={{ margin: '4px 0 0', fontSize: 14.5, lineHeight: 1.6 }}>
              <a href={s.lien.href} style={{ color: 'var(--link-accent)', fontWeight: 700 }}>{s.lien.texte}</a>
            </p>
          )}
        </section>
      ))}

      <p style={{ ...TEXTE, margin: '30px 0 0', fontSize: 13 }}>{c.miseAJour}</p>
    </div>
  )
}
