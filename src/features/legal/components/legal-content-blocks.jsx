import { LuQuote, LuInfo } from 'react-icons/lu'

// Blocs de contenu et sections de la page légale, extraits de `legal-page.jsx`
// le 2026-07-31 (§2 audit front : aucun fichier composant > 500 lignes).
//
// Purement présentationnels : les deux composants avaient déjà des props
// explicites et n'utilisent aucune constante du parent — l'extraction n'a donc
// demandé ni module commun ni props supplémentaires.

export function Block({ block, fg, citationLabel, darkMode }) {
  if (block.type === 'h3') {
    return (
      <h3 style={{
        fontSize: '15px', fontWeight: 700, color: fg,
        margin: '20px 0 10px', display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <span aria-hidden="true" style={{
          display: 'inline-block',
          width: '3px', height: '14px',
          background: 'linear-gradient(180deg, #F7A85E 0%, #D46A10 100%)',
          borderRadius: '2px',
        }} />
        {block.text}
      </h3>
    )
  }
  if (block.type === 'p') {
    return (
      <p style={{
        fontSize: '14px', lineHeight: 1.7, color: fg,
        margin: '0 0 12px',
      }}>
        {block.text}
      </p>
    )
  }
  if (block.type === 'list') {
    return (
      <ul style={{
        listStyle: 'none', padding: 0, margin: '0 0 12px',
        display: 'flex', flexDirection: 'column', gap: '6px',
      }}>
        {block.items.map((item, i) => (
          <li
            key={i}
            style={{
              fontSize: '14px', lineHeight: 1.6, color: fg,
              paddingLeft: '20px', position: 'relative',
            }}
          >
            <span aria-hidden="true" style={{
              position: 'absolute', left: '4px', top: '8px',
              width: '6px', height: '6px',
              borderRadius: '50%',
              background: 'var(--gradient-warm)',
            }} />
            {item}
          </li>
        ))}
      </ul>
    )
  }
  if (block.type === 'citation') {
    return (
      <blockquote
        style={{
          margin: '14px 0',
          padding: '12px 14px 12px 42px',
          borderRadius: '10px',
          background: darkMode ? 'rgba(247,168,94,0.06)' : 'rgba(212,106,16,0.04)',
          border: `1px solid ${darkMode ? 'rgba(247,168,94,0.20)' : 'rgba(212,106,16,0.18)'}`,
          position: 'relative',
          fontSize: '13px', lineHeight: 1.65, color: fg,
          fontStyle: 'italic',
        }}
      >
        <LuQuote
          size={16}
          aria-hidden="true"
          style={{
            position: 'absolute', top: '12px', left: '14px',
            color: 'var(--color-warm-600)',
          }}
        />
        <div style={{
          fontSize: '10px', fontWeight: 700,
          color: 'var(--color-warm-600)',
          textTransform: 'uppercase', letterSpacing: '0.06em',
          marginBottom: '4px',
          fontStyle: 'normal',
        }}>
          {citationLabel} · <cite style={{ fontStyle: 'normal' }}>{block.source}</cite>
        </div>
        {block.text}
      </blockquote>
    )
  }
  if (block.type === 'note') {
    return (
      <aside
        role="note"
        style={{
          margin: '14px 0',
          padding: '12px 14px 12px 42px',
          borderRadius: '10px',
          background: darkMode
            ? 'linear-gradient(135deg, rgba(247,168,94,0.10) 0%, rgba(212,106,16,0.05) 100%)'
            : 'linear-gradient(135deg, rgba(247,168,94,0.14) 0%, rgba(212,106,16,0.06) 100%)',
          border: `1.5px solid ${darkMode ? 'rgba(247,168,94,0.20)' : 'rgba(212,106,16,0.20)'}`,
          position: 'relative',
          fontSize: '13px', lineHeight: 1.65,
          color: fg,
        }}
      >
        <LuInfo
          size={16}
          aria-hidden="true"
          style={{
            position: 'absolute', top: '13px', left: '14px',
            color: 'var(--color-warm-600)',
          }}
        />
        {block.text}
      </aside>
    )
  }
  return null
}

export function Section({ id, title, Icon, intro, blocks, fg, muted, citationLabel, cardBg, cardBorder, cardShadow, darkMode }) {
  if (!blocks || blocks.length === 0) {
    return (
      <section
        id={id}
        style={{
          padding: '24px',
          borderRadius: '12px',
          background: cardBg,
          border: `1px solid ${cardBorder}`,
          boxShadow: cardShadow,
          marginBottom: '20px',
          scrollMarginTop: '90px',
        }}
      >
        <h2 style={{
          fontSize: '20px', fontWeight: 700,
          color: fg, margin: '0 0 12px',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <Icon size={22} aria-hidden="true" style={{ color: 'var(--color-warm-600)' }} />
          {title}
        </h2>
        <p style={{ fontSize: '14px', color: muted, margin: 0, fontStyle: 'italic' }}>
          Contenu non disponible.
        </p>
      </section>
    )
  }
  return (
    <section
      id={id}
      style={{
        padding: '24px',
        borderRadius: '12px',
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        boxShadow: cardShadow,
        marginBottom: '20px',
        scrollMarginTop: '90px',
      }}
    >
      <h2 style={{
        fontSize: '22px', fontWeight: 700,
        color: fg, margin: '0 0 14px',
        display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <Icon size={24} aria-hidden="true" style={{ color: 'var(--color-warm-600)', flexShrink: 0 }} />
        {title}
      </h2>
      {intro && (
        <p style={{
          fontSize: '14px', lineHeight: 1.7, color: fg,
          margin: '0 0 14px',
        }}>
          {intro}
        </p>
      )}
      {blocks.map((block, i) => (
        <Block
          key={i}
          block={block}
          fg={fg}
          citationLabel={citationLabel}
          darkMode={darkMode}
        />
      ))}
    </section>
  )
}
