import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LuCheck, LuLock } from 'react-icons/lu'
import { useAuth } from '@shared/contexts/auth-provider'
import { BANNER_CATALOG, DEFAULT_BANNER_ID } from '@shared/lib/banners'
import { isBannerLocked, badgeForBanner } from '@shared/lib/recipes/achievements'
import ProfileBanner from '@shared/ui/profile-banner'
import ReusableModal from '@shared/ui/reusable-modal'
import Button from '@shared/ui/button'

// Sélecteur de bannière (catalogue fixe). Calqué sur AvatarPickerModal.
// Sauvegarde via updateProfile({ banner_id }). Monté/démonté par le parent
// → l'état `selected` est réinitialisé à la bannière courante à chaque ouverture.
// Les bannières libres du catalogue restent non verrouillées ; les bannières
// à récompense (kind 'quest') sont verrouillées tant que le palier de badge
// correspondant n'est pas débloqué (cf. isBannerLocked/badgeForBanner).

const I18N = {
  fr: { title: 'Choisir une bannière', intro: 'Personnalise l\'en-tête de ton profil public.', save: 'Enregistrer', cancel: 'Annuler', error: 'Erreur lors de la sauvegarde.', lockedBanner: 'Bannière verrouillée — récompense :', reward: 'Récompense' },
  en: { title: 'Choose a banner', intro: 'Personalize your public profile header.', save: 'Save', cancel: 'Cancel', error: 'Error while saving.', lockedBanner: 'Locked banner — reward:', reward: 'Reward' },
}

export default function BannerPickerModal({ currentBannerId, unlockedBanners = [], onClose, lang = 'fr', darkMode = false }) {
  const t = I18N[lang] ?? I18N.fr
  const { updateProfile } = useAuth()
  const navigate = useNavigate()
  const [selected, setSelected] = useState(currentBannerId ?? DEFAULT_BANNER_ID)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSave() {
    if (saving) return
    setSaving(true)
    setError(null)
    const result = await updateProfile({ banner_id: selected })
    setSaving(false)
    if (result?.error) { setError(result.error.message || t.error); return }
    onClose()
  }

  return (
    <ReusableModal
      open
      title={t.title}
      onClose={onClose}
      darkMode={darkMode}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>{t.cancel}</Button>
          <Button onClick={handleSave} loading={saving} disabled={saving || selected === currentBannerId}>{t.save}</Button>
        </>
      }
    >
      <p style={{ fontSize: 13, color: darkMode ? '#A0A8B8' : '#6A4F45', margin: '0 0 14px', lineHeight: 1.5 }}>{t.intro}</p>
      <div role="radiogroup" aria-label={t.title} className="fp-scroll" style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        maxHeight: '52dvh', overflowY: 'auto', paddingRight: 6, marginRight: -6,
      }}>
        {BANNER_CATALOG.map((b) => {
          const isSel = b.id === selected
          const locked = isBannerLocked(b.id, unlockedBanners)
          const badge = locked ? badgeForBanner(b.id) : null
          return (
            <button
              key={b.id}
              type="button"
              role="radio"
              aria-checked={isSel}
              aria-label={locked ? `${t.lockedBanner} ${badge?.label[lang] ?? badge?.label.fr}` : b.id}
              title={badge ? (badge.label[lang] ?? badge.label.fr) : undefined}
              onClick={() => {
                if (locked) { onClose(); navigate(`/profile/recompenses?reward=${badge.id}`) }
                else setSelected(b.id)
              }}
              style={{
                position: 'relative', padding: 0, border: 'none', background: 'none',
                cursor: 'pointer', borderRadius: 12,
                boxShadow: isSel && !locked ? '0 0 0 3px var(--color-warm-500)' : '0 0 0 1px rgba(0,0,0,0.10)',
                transition: 'box-shadow 0.12s',
              }}
            >
              <ProfileBanner bannerId={b.id} height={48} radius={12}
                style={locked ? { filter: 'grayscale(0.7) brightness(0.65)' } : undefined} />
              {isSel && !locked && (
                <span style={{
                  position: 'absolute', top: 6, right: 6,
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'var(--color-warm-500)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <LuCheck size={13} />
                </span>
              )}
              {locked && (
                <span style={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 7, color: '#fff', fontSize: 12.5, fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.7)',
                  padding: '0 10px', textAlign: 'center',
                }}>
                  <LuLock size={14} style={{ flexShrink: 0 }} />
                  <span>{t.reward} : {badge?.label[lang] ?? badge?.label.fr}</span>
                </span>
              )}
            </button>
          )
        })}
      </div>
      {error && <p role="alert" style={{ marginTop: 12, fontSize: 12, color: 'var(--color-danger)' }}>{error}</p>}
    </ReusableModal>
  )
}
