import { useState, useId } from 'react'
import Button from '@shared/ui/button'
import { useDialogue } from '@shared/hooks/use-dialogue'
import { useFermetureGardee } from '@shared/hooks/use-fermeture-gardee'

// Modale de choix du motif de modération (rejet / dépublication d'une recette
// communautaire), extraite de `custom-recipes-section.jsx` le 2026-07-31
// (§2 audit front : aucun fichier composant > 500 lignes).
//
// Autonome : props explicites, et les deux tables de motifs ne servaient qu'à
// elle — elles descendent donc avec le composant plutôt que de rester des
// constantes de la section.

const MODERATION_REASON_KEYS = {
  rejected: ['not_original', 'incomplete', 'inappropriate', 'wrong_category', 'poor_quality', 'plagiarism', 'other'],
  pending:  ['needs_more_info', 'needs_correction', 'under_review', 'other'],
  approved: [],
}

const MODERATION_REASON_LABELS = {
  not_original:     { fr: 'Recette non originale',       en: 'Not original'          },
  incomplete:       { fr: 'Recette incomplète',          en: 'Incomplete recipe'     },
  inappropriate:    { fr: 'Contenu inapproprié',         en: 'Inappropriate content' },
  wrong_category:   { fr: 'Mauvaise catégorie',          en: 'Wrong category'        },
  poor_quality:     { fr: 'Qualité insuffisante',        en: 'Poor quality'          },
  plagiarism:       { fr: 'Plagiat détecté',             en: 'Plagiarism detected'   },
  needs_more_info:  { fr: 'Informations manquantes',     en: 'Missing information'   },
  needs_correction: { fr: 'Corrections nécessaires',     en: 'Needs correction'      },
  under_review:     { fr: 'En cours de vérification',    en: 'Under review'          },
  other:            { fr: 'Autre',                       en: 'Other'                 },
}

export default function ModerationReasonModal({ target, lang, darkMode, onConfirm, onCancel, t, statusColors }) {
  const reasonL = v => MODERATION_REASON_LABELS[v]?.[lang] ?? MODERATION_REASON_LABELS[v]?.fr ?? v
  const [selected, setSelected] = useState(null)
  const [note, setNote]         = useState('')
  const noteId = useId()
  // Un motif choisi ou écrit ne se perd plus sur un clic, ni sur un
  // cliquer-glisser relâché hors de la carte (ADM-18).
  const { fermer, fond } = useFermetureGardee({
    onClose: onCancel,
    brouillon: !!selected || note.trim() !== '',
    question: { title: 'Abandonner ce motif ?' },
  })
  // Une vraie boîte de dialogue : rôle, nom, focus piégé, Échap (A11Y-01).
  const dialogue = useDialogue({ onClose: fermer })

  const bg     = darkMode ? '#0F1923' : '#FFF'
  const border = darkMode ? '#2A3A50' : '#D9CCBA'
  const text   = darkMode ? '#C8D8E8' : '#1A0F00'
  const muted  = darkMode ? '#7A90A8' : '#5C4033'
  const sc     = statusColors[target.status] ?? statusColors.pending
  const keys   = MODERATION_REASON_KEYS[target.status] ?? []

  function buildReason() {
    const parts = []
    if (selected) parts.push(reasonL(selected))
    if (note.trim()) parts.push(note.trim())
    return parts.length ? parts.join(' — ') : null
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
      {...fond}>
      <div {...dialogue.proprietes} style={{ background:bg, borderRadius:16, padding:'24px 28px', maxWidth:520, width:'100%', boxShadow:'0 24px 80px rgba(0,0,0,0.3)', border:`1px solid ${border}` }}
        onClick={e => e.stopPropagation()}>

        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
          <span style={{ fontSize:12, fontWeight:700, padding:'3px 9px', borderRadius:6, background:sc.bg, color:sc.color, flexShrink:0 }}>
            {t[target.status] ?? target.status}
          </span>
          <span id={dialogue.titreId} style={{ fontSize:14, fontWeight:600, color:text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {target.recipeName}
          </span>
        </div>

        <div style={{ fontSize:13, fontWeight:600, color:text, marginBottom:10 }}>
          {t.moderationModalTitles?.[target.status]}
        </div>

        {keys.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:14 }}>
            {keys.map(k => (
              <Button
                key={k}
                variant="ghost"
                aria-pressed={selected === k}
                onClick={() => setSelected(selected === k ? null : k)}
                className="h-auto rounded-lg border px-3 py-1 text-xs hover:bg-transparent"
                style={{
                  borderColor: selected === k ? sc.color : border,
                  background: selected === k ? sc.bg : 'transparent',
                  color: selected === k ? sc.color : muted,
                  transition: 'all 0.15s',
                }}
              >
                {reasonL(k)}
              </Button>
            ))}
          </div>
        )}

        <label htmlFor={noteId} style={{ display:'block', fontSize:12, fontWeight:700, color:'var(--color-muted)', marginBottom:4 }}>
          {t.moderationModalNoteLabels?.[target.status] ?? 'Précisions (facultatif)'}
        </label>
        <textarea
          id={noteId}
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={3}
          style={{ width:'100%', padding:'8px 12px', borderRadius:10, border:`1px solid ${border}`, background: darkMode ? '#141F2E' : '#F9F5EE', color:text, fontSize:13, fontFamily:'inherit', resize:'vertical', outline:'none', boxSizing:'border-box' }}
        />

        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:14 }}>
          <Button
            variant="ghost"
            onClick={fermer}
            className="h-auto rounded-[10px] border bg-transparent px-4 py-2 text-[13px] hover:bg-transparent"
            style={{ borderColor: border, color: muted }}
          >
            {t.confirmCancel}
          </Button>
          <Button
            onClick={() => onConfirm(buildReason())}
            className="h-auto rounded-[10px] px-5 py-2 text-[13px] font-semibold text-white"
            style={{ background: sc.color }}
          >
            {t.moderationModalConfirm}
          </Button>
        </div>
      </div>
    </div>
  )
}
