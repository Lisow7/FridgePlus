import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LuX, LuUtensils, LuChevronRight, LuClock, LuFlame, LuFlag, LuBan, LuCheck } from 'react-icons/lu'
import AvatarImg from '@shared/ui/avatar-img'
import ProfileBanner from '@shared/ui/profile-banner'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import { useConfirm } from '@shared/ui/confirm-dialog/confirm-provider'
import { COMMUNITY_I18N } from '@shared/lib/i18n/community-i18n'
import { getCommunityProfile, listUserPublishedRecipes, isUserBlocked, blockUser, unblockUser } from '@shared/api/community'
import ReportModal from './report-modal'
import Button from '@shared/ui/button'

// Profil communauté (lecture seule).
//
// Modale overlay au-dessus du feed (zIndex 125, entre CommunityPage 120
// et RecipeModal 130). Affiche bio + recettes publiées.
// Recettes désormais cliquables : on passe l'objet recipe complet
// au callback onShowRecipe (App.jsx accepte maintenant ID string OU objet).
// Boutons Signaler + Bloquer (cachés si profil = current user).
// onBlockChange notifie le parent pour rafraîchir le filtrage du feed.

export default function CommunityProfileModal({ userId, currentUserId, lang = 'fr', darkMode = false, onClose, onShowRecipe, onBlockChange }) {
  const t = COMMUNITY_I18N[lang] ?? COMMUNITY_I18N.fr
  const [profile, setProfile] = useState(null)
  const [recipes, setRecipes] = useState(null)
  const [loading, setLoading] = useState(true)
  const [blocked, setBlocked] = useState(false)
  const [blockBusy, setBlockBusy] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const dialogRef = useRef(null)
  useFocusTrap(dialogRef, { active: !reportOpen, onEscape: reportOpen ? undefined : onClose })
  // Un seul jeton d'historique pour toute la durée de vie de cette modale
  // (isOpen reste `true`) ; seul le callback change selon reportOpen — le
  // retour ferme le ReportModal imbriqué en premier (lui n'a pas son propre
  // hook, hors périmètre de ce lot), puis la modale profil au retour suivant.
  useCloseOnBackButton(true, reportOpen ? () => setReportOpen(false) : onClose)

  const isSelf = !!(currentUserId && userId && currentUserId === userId)
  const confirm = useConfirm()

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    Promise.all([
      getCommunityProfile(userId),
      listUserPublishedRecipes(userId),
      currentUserId && !isSelf ? isUserBlocked(currentUserId, userId) : Promise.resolve(false),
    ])
      .then(([p, r, b]) => {
        if (cancelled) return
        setProfile(p)
        setRecipes(r)
        setBlocked(b)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [userId, currentUserId, isSelf])

  const handleToggleBlock = async () => {
    if (!currentUserId || isSelf || blockBusy) return
    if (!blocked) {
      const name = profile?.username ?? ''
      if (!(await confirm({ title: t.profileBlockConfirm(name) }))) return
    }
    setBlockBusy(true)
    const result = blocked
      ? await unblockUser(currentUserId, userId)
      : await blockUser(currentUserId, userId)
    setBlockBusy(false)
    if (result.error) return
    setBlocked(!blocked)
    onBlockChange?.(userId, !blocked)
  }

  const fg = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted = darkMode ? '#A0A8B8' : '#7A6A52'
  const bg = darkMode ? '#0F1925' : '#FDFAF6'
  const surface = darkMode ? '#141F2D' : '#FFFFFF'
  const border = darkMode ? 'var(--color-dark-surface)' : 'var(--color-border-warm)'
  const accent = darkMode ? '#FF6B1A' : '#C84000'

  const memberSinceLabel = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang, {
        year: 'numeric', month: 'long',
      })
    : null

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="community-profile-title"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 125,
        background: 'rgba(8,12,20,0.65)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px', animation: 'cp-fade-up 0.18s ease both',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '520px', maxHeight: '90dvh',
          background: bg, color: fg, borderRadius: '20px',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
          animation: 'cp-fade-up 0.28s cubic-bezier(0.34,1.10,0.64,1) both',
          overflow: 'hidden',
        }}
      >
        {/* Header : bannière en fond plein + avatar/nom superposés */}
        <div style={{ position: 'relative', flexShrink: 0, borderBottom: `1px solid ${border}` }}>
          <ProfileBanner bannerId={profile?.banner_id} height={118} radius={0} scrim>
            {/* Fermer — flottant sur la bannière */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label={t.profileClose}
              type="button"
              className="h-auto w-auto rounded-lg p-1.5 hover:bg-transparent"
              style={{
                position: 'absolute', top: '12px', right: '12px',
                color: '#fff', background: 'rgba(0,0,0,0.28)',
                border: '1px solid rgba(255,255,255,0.35)', transition: 'all .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.45)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.28)' }}
            >
              <LuX size={18} />
            </Button>
            {/* Avatar + nom en bas, superposés */}
            <div style={{
              position: 'absolute', left: 0, right: 0, bottom: 0,
              padding: '0 20px 14px', display: 'flex', alignItems: 'flex-end', gap: '14px',
            }}>
              <AvatarImg
                avatarId={profile?.avatar_id}
                size={60}
                style={{ flexShrink: 0, border: '3px solid #fff', borderRadius: '50%', background: '#fff' }}
              />
              <div style={{ flex: 1, minWidth: 0, paddingBottom: '4px' }}>
                <h2
                  id="community-profile-title"
                  style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {profile?.username ?? t.profileTitle}
                </h2>
                {memberSinceLabel && (
                  <div style={{ marginTop: '2px', fontSize: '12px', color: 'rgba(255,255,255,0.92)', textShadow: '0 1px 2px rgba(0,0,0,0.55)' }}>
                    {t.profileMemberSince(memberSinceLabel)}
                  </div>
                )}
              </div>
            </div>
          </ProfileBanner>
        </div>

        {/* Bannière "bloqué" — visible uniquement si current user a bloqué la cible */}
        {blocked && !isSelf && (
          <div style={{
            flexShrink: 0,
            padding: '10px 20px',
            background: 'rgba(208,96,96,0.10)',
            borderBottom: `1px solid ${border}`,
            color: '#D06060',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <LuBan size={14} />
            <span style={{ flex: 1 }}>{t.profileBlockedBanner}</span>
          </div>
        )}

        {/* Contenu scrollable */}
        <div style={{
          flex: '1 1 auto', minHeight: 0, overflowY: 'auto',
          padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '20px',
        }}>
          {loading ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: muted, fontSize: '14px' }}>
              {t.profileLoading}
            </div>
          ) : !profile ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: muted, fontSize: '14px' }}>
              {t.profileNotFound}
            </div>
          ) : (
            <>
              {/* Bio */}
              <section>
                <h3 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {t.profileBio}
                </h3>
                <p style={{
                  margin: 0, fontSize: '14px', lineHeight: 1.5,
                  color: profile.community_bio ? fg : muted,
                  fontStyle: profile.community_bio ? 'normal' : 'italic',
                  whiteSpace: 'pre-wrap', wordWrap: 'break-word',
                }}>
                  {profile.community_bio?.trim() || t.profileBioEmpty}
                </p>
              </section>

              {/* Recettes */}
              <section>
                <h3 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <LuUtensils size={13} />
                  {t.profileRecipes}
                  {recipes && recipes.length > 0 && (
                    <span style={{ fontSize: '12px', color: muted, fontWeight: 600 }}>· {recipes.length}</span>
                  )}
                </h3>
                {(!recipes || recipes.length === 0) ? (
                  <p style={{ margin: 0, fontSize: '14px', color: muted, fontStyle: 'italic' }}>
                    {t.profileRecipesEmpty}
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {recipes.map(r => (
                      <RecipeMini
                        key={r.id}
                        recipe={r}
                        lang={lang}
                        accent={accent}
                        fg={fg}
                        muted={muted}
                        surface={surface}
                        border={border}
                        onClick={onShowRecipe ? () => onShowRecipe(r) : undefined}
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        {/* Footer actions — Signaler + Bloquer/Débloquer (cachés si profil = current user) */}
        {!loading && profile && currentUserId && !isSelf && (
          <div style={{
            flexShrink: 0,
            padding: '12px 20px',
            borderTop: `1px solid ${border}`,
            display: 'flex', gap: '8px',
          }}>
            <Button
              variant="ghost"
              type="button"
              onClick={() => setReportOpen(true)}
              className="h-auto flex-1 rounded-[10px] border-[1.5px] bg-transparent p-2.5 text-[13px] font-bold hover:bg-transparent"
              style={{
                gap: '6px',
                borderColor: border,
                color: muted,
                transition: 'all .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#D06060'; e.currentTarget.style.borderColor = '#D06060' }}
              onMouseLeave={e => { e.currentTarget.style.color = muted; e.currentTarget.style.borderColor = border }}
            >
              <LuFlag size={14} />
              {t.profileReport}
            </Button>
            <Button
              type="button"
              onClick={handleToggleBlock}
              loading={blockBusy}
              disabled={blockBusy}
              aria-pressed={blocked}
              className="h-auto flex-1 rounded-[10px] p-2.5 text-[13px] font-bold"
              style={{
                gap: '6px',
                border: blocked ? `1.5px solid ${border}` : 'none',
                background: blocked ? 'transparent' : '#D06060',
                color: blocked ? muted : '#FFF',
                transition: 'all .15s',
              }}
            >
              {blocked ? <LuCheck size={14} /> : <LuBan size={14} />}
              {blocked ? t.profileUnblock : t.profileBlock}
            </Button>
          </div>
        )}
      </div>

      {/* ReportModal — zIndex 135 pour passer au-dessus de la modale profil (125) */}
      {reportOpen && currentUserId && (
        <ReportModal
          targetType="community_profile"
          targetId={userId}
          userId={currentUserId}
          lang={lang}
          darkMode={darkMode}
          zIndex={135}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>,
    document.body
  )
}

function RecipeMini({ recipe, lang, accent, fg, muted, surface, border, onClick }) {
  const name = recipe?.name?.[lang] ?? recipe?.name?.fr ?? recipe?.title ?? recipe?.id
  const emoji = recipe?.emoji ?? '🍽️'
  const time = recipe?.time
  const difficulty = recipe?.difficulty
  const Component = onClick ? 'button' : 'div'
  return (
    <Component
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '10px 12px', borderRadius: '10px',
        border: `1px solid ${border}`,
        background: surface,
        textAlign: 'left',
        cursor: onClick ? 'pointer' : 'default',
        font: 'inherit', color: 'inherit',
        transition: 'border-color .15s, background .15s',
      }}
      onMouseEnter={onClick ? (e) => { e.currentTarget.style.borderColor = accent } : undefined}
      onMouseLeave={onClick ? (e) => { e.currentTarget.style.borderColor = border } : undefined}
    >
      <span style={{ fontSize: '24px', lineHeight: 1, flexShrink: 0 }} aria-hidden="true">{emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </div>
        {(time || difficulty) && (
          <div style={{ marginTop: '2px', display: 'flex', gap: '10px', fontSize: '12px', color: muted }}>
            {time && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <LuClock size={11} color={accent} /> {time}
              </span>
            )}
            {difficulty && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <LuFlame size={11} color={accent} /> {difficulty}
              </span>
            )}
          </div>
        )}
      </div>
      {onClick && <LuChevronRight size={14} color={accent} style={{ flexShrink: 0 }} />}
    </Component>
  )
}
