import { useState } from 'react'
import { LuCheck } from 'react-icons/lu'
import { useAuth } from '@shared/contexts/auth-provider'
import { AVATAR_CATALOG, getAvatarUrl } from '@shared/lib/avatars'
import ReusableModal from '@shared/ui/reusable-modal'
import Button from '@shared/ui/button'

// Sélecteur d'avatar (catalogue fixe de 10 emojis culinaires).
// Rendu par profile-page selon `avatarModalOpen`. Sauvegarde via
// updateProfile({ avatar_id }) — même mécanisme que le pseudo.
//
// Monté/démonté par le parent (`{open && <AvatarPickerModal/>}`) : l'état
// `selected` est donc réinitialisé à l'avatar courant à chaque ouverture.

const I18N = {
  fr: {
    title: 'Choisir un avatar',
    intro: 'Sélectionne l\'image qui te représente dans la communauté.',
    save: 'Enregistrer', cancel: 'Annuler', error: 'Erreur lors de l’enregistrement.',
  },
  en: {
    title: 'Choose an avatar',
    intro: 'Pick the image that represents you in the community.',
    save: 'Save', cancel: 'Cancel', error: 'Error while saving.',
  },
}

export default function AvatarPickerModal({ currentAvatarId, onClose, lang = 'fr', darkMode = false }) {
  const t = I18N[lang] ?? I18N.fr
  const { updateProfile } = useAuth()
  const [selected, setSelected] = useState(currentAvatarId ?? AVATAR_CATALOG[0].id)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSave() {
    if (saving) return
    setSaving(true)
    setError(null)
    const result = await updateProfile({ avatar_id: selected })
    setSaving(false)
    if (result?.error) {
      setError(result.error.message || t.error)
      return
    }
    onClose()
  }

  return (
    <ReusableModal
      open
      title={t.title}
      onClose={onClose}
      darkMode={darkMode}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>{t.cancel}</Button>
          <Button onClick={handleSave} loading={saving} disabled={saving || selected === currentAvatarId}>
            {t.save}
          </Button>
        </>
      }
    >
      <p style={{ fontSize: 13, color: darkMode ? '#A0A8B8' : '#6A4F45', margin: '0 0 14px', lineHeight: 1.5 }}>
        {t.intro}
      </p>
      <div role="radiogroup" aria-label={t.title} style={{
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10,
      }}>
        {AVATAR_CATALOG.map(a => {
          const isSel = a.id === selected
          return (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={isSel}
              aria-label={a.id}
              onClick={() => setSelected(a.id)}
              style={{
                position: 'relative',
                aspectRatio: '1 / 1',
                borderRadius: 12,
                border: `2px solid ${isSel ? 'var(--color-warm-500)' : 'transparent'}`,
                background: a.bg,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 6,
                transition: 'border-color 0.12s, transform 0.12s',
                boxShadow: isSel ? '0 0 0 3px rgba(224,120,32,0.18)' : 'none',
              }}
            >
              <img src={getAvatarUrl(a.id)} alt="" width={34} height={34} style={{ display: 'block' }} />
              {isSel && (
                <span style={{
                  position: 'absolute', top: -6, right: -6,
                  width: 18, height: 18, borderRadius: '50%',
                  background: 'var(--color-warm-500)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <LuCheck size={12} />
                </span>
              )}
            </button>
          )
        })}
      </div>
      {error && (
        <p role="alert" style={{ marginTop: 12, fontSize: 12, color: 'var(--color-danger)' }}>{error}</p>
      )}
    </ReusableModal>
  )
}
