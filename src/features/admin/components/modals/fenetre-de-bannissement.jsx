import { useState } from 'react'
import { createPortal } from 'react-dom'
import { LuBan } from 'react-icons/lu'
import { useDialogue } from '@shared/hooks/use-dialogue'
import Button from '@shared/ui/button'

// « Bannir « pseudo » ? » (audit du 2026-10-04, lot 3c-3b : CPT-17 ; maquette
// validée par Antoine le 2026-10-05). Motif obligatoire — une catégorie, et
// des précisions —, montré tel quel à la personne ; durée en quatre choix ; le
// bouton dit ce qu'il fait. La base (`admin_bannir`) garde ses propres règles.

const MOTIFS = ['Spam', 'Harcèlement', 'Contenu inapproprié', 'Usurpation d’identité', 'Fraude', 'Autre']
const DUREES = [
  { jours: 1, libelle: '1 jour', bouton: 'Bannir 1 jour' },
  { jours: 7, libelle: '7 jours', bouton: 'Bannir 7 jours' },
  { jours: 30, libelle: '30 jours', bouton: 'Bannir 30 jours' },
  { jours: null, libelle: 'Sans fin', bouton: 'Bannir sans fin' },
]
const PRECISIONS_MAX = 250

function dateDeFin(maintenant, jours) {
  return new Date(maintenant.getTime() + jours * 864e5)
    .toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })
}

export default function FenetreDeBannissement({ username, darkMode, onBannir, onClose, maintenant = new Date() }) {
  const [motif, setMotif] = useState('')
  const [precisions, setPrecisions] = useState('')
  const [duree, setDuree] = useState(DUREES[1])
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const dialogue = useDialogue({ onClose: envoi ? undefined : onClose })

  const fg = darkMode ? '#F0E8DC' : '#2C1A0E'
  const muted = darkMode ? 'rgba(240,232,220,0.72)' : 'rgba(44,26,14,0.72)'
  const champ = {
    width: '100%', padding: '10px 12px', borderRadius: 10, fontSize: 14, color: fg,
    background: darkMode ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
    border: `1px solid ${darkMode ? 'rgba(255,255,255,0.16)' : 'rgba(44,26,14,0.2)'}`,
  }

  async function bannir() {
    if (!motif) { setErreur('Choisis un motif : il sera montré à la personne.'); return }
    setEnvoi(true)
    setErreur(null)
    const detail = precisions.trim()
    const { error } = await onBannir({ motif: detail ? `${motif} — ${detail}` : motif, jours: duree.jours })
    if (error) { setErreur(error.message); setEnvoi(false) }
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={envoi ? undefined : onClose}>
      <div {...dialogue.proprietes} onClick={(e) => e.stopPropagation()}
        style={{ background: darkMode ? '#1A2535' : '#FFFFFF', color: fg, borderRadius: 16, padding: 24, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 id={dialogue.titreId} style={{ margin: 0, fontSize: 17, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
          <LuBan size={17} aria-hidden="true" style={{ color: 'var(--color-danger)' }} />
          {`Bannir « ${username} » ?`}
        </h2>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 700, color: muted }}>
          Motif, montré à la personne
          <select value={motif} onChange={(e) => { setMotif(e.target.value); setErreur(null) }} disabled={envoi} style={champ}>
            <option value="">Choisir…</option>
            {MOTIFS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 700, color: muted }}>
            Précisions
            <textarea value={precisions} onChange={(e) => setPrecisions(e.target.value.slice(0, PRECISIONS_MAX))} maxLength={PRECISIONS_MAX}
              rows={2} disabled={envoi} aria-describedby="ban-precisions-compte" style={{ ...champ, resize: 'vertical', fontWeight: 400 }} />
          </label>
          <span id="ban-precisions-compte" style={{ alignSelf: 'flex-end', fontSize: 12, color: muted }}>{`${precisions.length} / ${PRECISIONS_MAX}`}</span>
        </div>

        <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <legend style={{ fontSize: 13, fontWeight: 700, color: muted, marginBottom: 6 }}>Durée</legend>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {DUREES.map((d) => {
              const choisi = d === duree
              return (
                <label key={d.libelle} style={{
                  flex: '1 1 0', minWidth: 76, textAlign: 'center', padding: '9px 6px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                  border: `2px solid ${choisi ? 'var(--color-danger)' : (darkMode ? 'rgba(255,255,255,0.16)' : 'rgba(44,26,14,0.2)')}`,
                  background: choisi ? 'rgba(239,68,68,0.10)' : 'transparent',
                }}>
                  <input type="radio" name="duree-du-bannissement" checked={choisi} onChange={() => setDuree(d)} disabled={envoi} className="sr-only" />
                  {d.libelle}
                </label>
              )
            })}
          </div>
        </fieldset>

        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: muted }}>
          {duree.jours
            ? `Déconnecté dans l’heure, reconnexion refusée jusqu’au ${dateDeFin(maintenant, duree.jours)}. Plus rien publié ni écrit au support d’ici là.`
            : 'Déconnecté dans l’heure, reconnexion refusée sans date de fin. Plus rien publié ni écrit au support.'}
        </p>

        {erreur && <p role="alert" style={{ margin: 0, fontSize: 13, fontWeight: 600, color: darkMode ? '#F59B9B' : '#B42318' }}>{erreur}</p>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onClose} disabled={envoi} className="h-auto rounded-lg border bg-transparent px-4 py-2.5 text-[13px] font-semibold" style={{ color: fg }}>
            Annuler
          </Button>
          <Button onClick={bannir} loading={envoi} className="h-auto rounded-lg px-4 py-2.5 text-[13px] font-bold text-white" style={{ background: '#B42318' }}>
            {duree.bouton}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
