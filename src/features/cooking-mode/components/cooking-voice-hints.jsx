// src/features/cooking-mode/components/cooking-voice-hints.jsx
//
// Barre d'exemples de commandes vocales (bas d'écran). Toutes visibles en
// permanence, sans rotation (une mise en évidence tournante laissait penser
// à une sélection active). Style « bulle de parole » distinct des boutons
// toggle (pas de bordure) pour qu'on comprenne : ce sont des choses à DIRE.

const I18N = {
  fr: {
    label: '🗣️ Tu peux dire :',
    commands: ['suivant', 'précédent', 'répète', 'lance le minuteur', 'pause', 'stop'],
  },
  en: {
    label: '🗣️ You can say:',
    commands: ['next', 'previous', 'repeat', 'start timer', 'pause', 'stop'],
  },
}

export default function CookingVoiceHints({ lang = 'fr' }) {
  const t = I18N[lang] ?? I18N.fr

  return (
    <div
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '12px 16px 16px',
        display: 'flex', flexWrap: 'wrap', gap: '8px',
        justifyContent: 'center', alignItems: 'center',
        background: 'linear-gradient(to top, var(--color-cream) 70%, transparent)',
      }}
    >
      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-charcoal)', marginRight: '2px' }}>
        {t.label}
      </span>
      {t.commands.map(cmd => (
        <span
          key={cmd}
          style={{
            fontSize: '14px', fontWeight: 600,
            padding: '5px 12px', borderRadius: '999px',
            background: 'color-mix(in srgb, var(--color-brand-500) 13%, transparent)',
            color: 'var(--color-brand-600)',
            whiteSpace: 'nowrap',
          }}
        >
          « {cmd} »
        </span>
      ))}
    </div>
  )
}
