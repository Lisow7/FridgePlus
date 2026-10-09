import { useState } from 'react'
import { LuTrash2, LuMessageSquare } from 'react-icons/lu'
import { useAuth } from '@shared/contexts/auth-provider'
import Button from '@shared/ui/button'

const I18N = {
  fr: {
    title: 'Compte suspendu',
    message: "Ton compte a été suspendu suite à un non-respect de nos conditions d'utilisation. Si tu penses qu'il s'agit d'une erreur, tu peux nous contacter via le support.",
    rgpd: 'Conformément au RGPD (article 17), tu gardes le droit de supprimer ton compte et toutes tes données personnelles à tout moment.',
    deleteBtn: 'Supprimer mon compte',
    supportBtn: 'Contacter le support',
    confirmTitle: 'Supprimer définitivement ?',
    confirmMsg: 'Toutes tes données seront effacées de façon permanente. Cette action est irréversible.',
    cancel: 'Annuler',
    confirm: 'Supprimer',
    errorDelete: 'Une erreur est survenue. Réessaie.',
  },
  en: {
    title: 'Account suspended',
    message: 'Your account has been suspended for violating our terms of use. If you believe this is an error, you can contact us via support.',
    rgpd: 'Under GDPR (Article 17), you retain the right to delete your account and all your personal data at any time.',
    deleteBtn: 'Delete my account',
    supportBtn: 'Contact support',
    confirmTitle: 'Permanently delete?',
    confirmMsg: 'All your data will be permanently erased. This action is irreversible.',
    cancel: 'Cancel',
    confirm: 'Delete',
    errorDelete: 'An error occurred. Please try again.',
  },
}

export default function BannedScreen({ lang = 'fr', darkMode = false, onShowSupport }) {
  const t = I18N[lang] ?? I18N.fr
  const { deleteAccount } = useAuth()
  const [showConfirm, setShowConfirm] = useState(false)
  const [deleting,    setDeleting]    = useState(false)
  const [error,       setError]       = useState(null)

  const bg        = darkMode ? '#0A1020' : '#FDFAF6'
  const textColor = darkMode ? '#C8D8E8' : '#2A1A0E'
  const muted     = darkMode ? '#6A85A0' : '#9A8878'
  const border    = darkMode ? '#1E2F45' : 'var(--color-border-warm)'

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    const { error: err } = await deleteAccount()
    if (err) {
      setError(t.errorDelete)
      setDeleting(false)
    }
    // succès : user → null, le composant se démonte naturellement
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, background: bg,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{ maxWidth: '420px', width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>🚫</div>

        <h2 style={{ fontSize: '22px', fontWeight: 700, color: textColor, marginBottom: '12px' }}>
          {t.title}
        </h2>

        <p style={{ fontSize: '14px', color: muted, marginBottom: '14px', lineHeight: 1.6 }}>
          {t.message}
        </p>

        <div style={{
          padding: '12px 16px', borderRadius: '10px', marginBottom: '28px',
          background: darkMode ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.06)',
          border: '1px solid rgba(59,130,246,0.22)',
        }}>
          <p style={{ fontSize: '12px', color: darkMode ? '#93C5FD' : '#1D4ED8', lineHeight: 1.65, margin: 0 }}>
            {t.rgpd}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Button
            variant="ghost"
            onClick={() => setShowConfirm(true)}
            className="h-auto w-full rounded-[10px] border-[1.5px] px-4 py-3 text-sm font-semibold hover:bg-transparent"
            style={{
              gap: '7px',
              borderColor: 'rgba(220,38,38,0.35)',
              background: 'rgba(220,38,38,0.08)',
              color: 'var(--color-danger)',
            }}
          >
            <LuTrash2 size={15} />
            {t.deleteBtn}
          </Button>
          <Button
            variant="secondary"
            onClick={onShowSupport}
            className="h-auto w-full rounded-[10px] border-[1.5px] bg-transparent px-4 py-3 text-sm font-medium"
            style={{
              gap: '7px',
              borderColor: border,
              color: muted,
            }}
          >
            <LuMessageSquare size={15} />
            {t.supportBtn}
          </Button>
        </div>
      </div>

      {showConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 210,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
        }}>
          <div style={{
            background: bg, borderRadius: '16px', border: `1.5px solid ${border}`,
            padding: '24px', maxWidth: '340px', width: '100%',
            boxShadow: '0 16px 48px rgba(0,0,0,0.30)',
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: textColor, marginBottom: '8px' }}>
              {t.confirmTitle}
            </h3>
            <p style={{ fontSize: '13px', color: muted, marginBottom: '20px', lineHeight: 1.55 }}>
              {t.confirmMsg}
            </p>
            {error && (
              <p style={{ fontSize: '12px', color: 'var(--color-danger)', marginBottom: '12px' }}>{error}</p>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <Button
                variant="secondary"
                onClick={() => setShowConfirm(false)}
                className="h-auto flex-1 rounded-[10px] border-[1.5px] bg-transparent px-3 py-3 text-sm font-medium"
                style={{ borderColor: border, color: textColor }}
              >
                {t.cancel}
              </Button>
              <Button
                onClick={handleDelete}
                loading={deleting}
                disabled={deleting}
                className="h-auto flex-1 rounded-[10px] bg-[#DC2626] px-3 py-3 text-sm font-bold text-white"
              >
                {t.confirm}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
