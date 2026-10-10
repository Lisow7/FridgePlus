import { useState, useEffect, useRef } from 'react'
import Field from '@shared/ui/field'
import { useOutletContext } from 'react-router-dom'
import { LuImage, LuUser, LuMessageSquare, LuScroll, LuPanelTop } from 'react-icons/lu'
import { useAuth } from '@shared/contexts/auth-provider'
import AvatarImg from '@shared/ui/avatar-img'
import Button from '@shared/ui/button'
import { containsProfanity } from '@shared/lib/moderation'
import { moderateContent } from '@shared/api/moderation-de-contenu'
import { acceptCommunityTerms, revokeCommunityTerms, updateCommunityBio } from '@shared/api/community'
import { useConfirm } from '@shared/ui/confirm-dialog/confirm-provider'
import { useProfileState } from '@features/profile/hooks/use-profile-state'
import ProfilePageIntro from '@features/profile/components/profile-page-intro'
import ProfileSection  from '@features/profile/components/profile-section'
import ProfileBanner from '@shared/ui/profile-banner'
import BannerPickerModal from '@features/profile/components/banner-picker-modal'
import {
  isValidUsername, isUsernameAvailable, usernameWriteProblem, USERNAME_MESSAGES,
} from '@shared/lib/auth/username-rules'
// Sprint 11 S11.a.2 — sous-page /profile/identite (« Profil »).
// Identité publique : avatar, pseudo, bio communauté, charte communauté.

const I18N = {
  fr: {
    pageTitle: 'Profil',
    pageIntro: 'Comment les autres utilisateurs de Fridge+ te voient dans la communauté.',
    avatarTitle: 'Avatar',
    avatarDesc:  'Ton image de profil, visible partout dans la communauté.',
    avatarBtn:   'Changer mon avatar',
    bannerTitle: 'Bannière',
    bannerDesc:  'L\'image d\'en-tête de ton profil public.',
    bannerBtn:   'Changer ma bannière',
    pseudoTitle: 'Pseudo',
    pseudoDesc:  'Ton nom dans Fridge+. Il doit être unique.',
    pseudoLabel: 'Pseudo',
    pseudoSave:  'Enregistrer',
    pseudoError: 'Le pseudo n\'a pas pu être enregistré. Réessaie.',
    pseudoProfanity: 'Ce pseudo contient des termes inappropriés.',
    bioTitle:    'Ma bio',
    bioDesc:     'Une courte présentation visible quand quelqu\'un consulte ton profil dans la communauté.',
    bioLabel: 'Ce que les autres membres liront (facultatif)',
    bioPlaceholder: 'ex. : Fan de cuisine italienne, je cuisine pour quatre.',
    bioSave:     'Enregistrer la bio',
    bioMaxHint:  (n, max) => `${n} / ${max} caractères`,
    bioProfanity: 'Ta bio contient des termes inappropriés.',
    bioSaved:    'Bio enregistrée.',
    bioError:    'Erreur lors de l’enregistrement.',
    charterTitle: 'Charte communauté',
    charterDesc:  'Les règles de bonne conduite pour interagir sur le forum.',
    charterTagAccepted:    'Acceptée',
    charterTagNotSigned:   'À signer',
    charterTagDismissed:   'Auto-affichage désactivé',
    charterStatusAccepted:    (d) => `Tu as accepté la charte le ${d}.`,
    charterStatusNotSigned:   'Tu n\'as pas encore signé la charte — tu ne peux pas poster ni commenter dans la communauté.',
    charterStatusDismissed:   'Tu as cliqué « Ne plus afficher ». La modale ne s\'affichera plus automatiquement, mais elle reste accessible via le bouton 📜 dans le header Communauté.',
    charterAccept: 'Accepter la charte',
    charterRevoke: 'Révoquer ma signature',
    charterRevokeConfirm: 'Confirmer la révocation ? Tu ne pourras plus publier dans la communauté.',
    charterRevokeOk: 'Retirer mon accord',
    charterRevoked:   'Signature révoquée. Tu pourras re-signer quand tu veux.',
    charterReenable:  'Réactiver l\'affichage automatique',
    charterReenabled: 'Réactivé. La modale s\'affichera à ta prochaine visite Communauté.',
  },
  en: {
    pageTitle: 'Profile',
    pageIntro: 'How other Fridge+ users see you in the community.',
    avatarTitle: 'Avatar',
    avatarDesc:  'Your profile picture, visible everywhere in the community.',
    avatarBtn:   'Change my avatar',
    bannerTitle: 'Banner',
    bannerDesc:  'The header image of your public profile.',
    bannerBtn:   'Change my banner',
    pseudoTitle: 'Username',
    pseudoDesc:  'Your name in Fridge+. It must be unique.',
    pseudoLabel: 'Username',
    pseudoSave:  'Save',
    pseudoError: 'The username could not be saved. Try again.',
    pseudoProfanity: 'This username contains inappropriate terms.',
    bioTitle:    'My bio',
    bioDesc:     'A short presentation visible when someone views your community profile.',
    bioLabel: 'What other members will read (optional)',
    bioPlaceholder: 'e.g. Italian food fan, cooking for four.',
    bioSave:     'Save bio',
    bioMaxHint:  (n, max) => `${n} / ${max} characters`,
    bioProfanity: 'Your bio contains inappropriate language.',
    bioSaved:    'Bio saved.',
    bioError:    'Error while saving.',
    charterTitle: 'Community charter',
    charterDesc:  'The rules of conduct for interacting on the forum.',
    charterTagAccepted:    'Accepted',
    charterTagNotSigned:   'To be signed',
    charterTagDismissed:   'Auto-show disabled',
    charterStatusAccepted:    (d) => `You accepted the charter on ${d}.`,
    charterStatusNotSigned:   'You haven\'t signed the charter yet — you can\'t post or comment in the community.',
    charterStatusDismissed:   'You\'ve clicked "Don\'t show again". The modal won\'t auto-show anymore, but it stays accessible via the 📜 button in the Community header.',
    charterAccept: 'Accept the charter',
    charterRevoke: 'Revoke my signature',
    charterRevokeConfirm: 'Confirm revocation? You will no longer be able to publish in the community.',
    charterRevokeOk: 'Withdraw my agreement',
    charterRevoked:   'Signature revoked. You can re-sign whenever you want.',
    charterReenable:  'Re-enable auto-show',
    charterReenabled: 'Re-enabled. The modal will show on your next Community visit.',
  },
}

// v3.409 — clé localStorage partagée avec community-page.jsx (flag
// « ne plus afficher la charte »). Référencée ici pour le toggle reset.
const CHARTER_DISMISSED_KEY = 'fridge-community-charter-dismissed'

const BIO_MAX = 280

export default function ProfileIdentityPage() {
  const { lang = 'fr', darkMode = false, profile, setAvatarModalOpen } = useOutletContext()
  const t = I18N[lang] ?? I18N.fr
  const regles = USERNAME_MESSAGES[lang] ?? USERNAME_MESSAGES.fr
  const confirm = useConfirm()
  const { updateProfile } = useAuth()
  const { communityTermsAt, setCommunityTermsAt } = useProfileState({ enableCommunityTerms: true })
  const [bannerModalOpen, setBannerModalOpen] = useState(false)
  // ── Pseudo (édition inline) ──────────────────────────────────────────
  const [username, setUsername] = useState(profile?.username ?? '')
  const [pseudoError, setPseudoError] = useState(null)
  const [pseudoSaving, setPseudoSaving] = useState(false)

  async function handleSavePseudo() {
    const u = username.trim()
    if (!isValidUsername(u)) {
      setPseudoError(regles.invalid)
      return
    }
    if (containsProfanity(u)) {
      setPseudoError(t.pseudoProfanity)
      return
    }
    setPseudoSaving(true)
    setPseudoError(null)
    // `null` = on n'a pas pu le savoir : l'écriture tranchera.
    if (await isUsernameAvailable(u) === false) {
      setPseudoSaving(false)
      setPseudoError(regles.taken)
      return
    }
    const result = await updateProfile({ username: u })
    setPseudoSaving(false)
    if (result?.error) {
      // Jamais le message de la base : il affichait « duplicate key value
      // violates unique constraint… » (audit du 2026-10-04, CPT-09).
      const probleme = usernameWriteProblem(result.error)
      setPseudoError(probleme ? regles[probleme] : t.pseudoError)
      return
    }
    setUsername(u)
  }

  // ── Bio communauté ────────────────────────────────────────────────────
  const [bio, setBio] = useState(profile?.community_bio ?? '')
  const [bioMsg, setBioMsg] = useState(null)
  const [bioSaving, setBioSaving] = useState(false)

  // Hydratation : en chargement direct / refresh, `profile` arrive APRÈS le
  // 1er render → les useState ci-dessus captent '' et ne se remettent jamais à
  // jour (champs pseudo/bio vides + bouton Enregistrer actif à tort). On
  // peuple une seule fois quand `profile` devient disponible, sans écraser une
  // édition en cours.
  const hydratedRef = useRef(false)
  useEffect(() => {
    if (!hydratedRef.current && profile) {
      setUsername(profile.username ?? '')
      setBio(profile.community_bio ?? '')
      hydratedRef.current = true
    }
  }, [profile])

  async function handleSaveBio() {
    if (containsProfanity(bio)) {
      setBioMsg({ type: 'error', text: t.bioProfanity })
      return
    }
    // Modération IA OpenAI — couche supplémentaire au leo-profanity statique.
    // Fail-open si l'API est down (warn console + on continue).
    if (bio.trim().length > 0) {
      try {
        const result = await moderateContent(bio, 'profile-bio')
        if (result?.flagged) {
          setBioMsg({ type: 'error', text: t.bioProfanity })
          return
        }
      } catch (err) {
        console.warn('[moderation] bio check failed', err)
      }
    }
    setBioSaving(true)
    setBioMsg(null)
    const result = await updateCommunityBio(profile?.id, bio)
    setBioSaving(false)
    setBioMsg(result?.error
      ? { type: 'error', text: t.bioError }
      : { type: 'success', text: t.bioSaved })
  }

  // ── Charte communauté — 3 états + actions contextuelles ─────────────
  //   - 'accepted'   : profile.community_terms_accepted_at set
  //                    → tag vert + bouton « Révoquer ma signature »
  //   - 'dismissed'  : localStorage CHARTER_DISMISSED_KEY=1, non signée
  //                    → tag gris + boutons « Réactiver l'auto-affichage »
  //                      + « Accepter la charte » (raccourci)
  //   - 'not_signed' : ni signée ni dismissed
  //                    → tag orange + bouton « Accepter la charte »
  const [charterBusy, setCharterBusy] = useState(false)
  const [charterDismissed, setCharterDismissed] = useState(() => {
    try { return localStorage.getItem(CHARTER_DISMISSED_KEY) === '1' } catch { return false }
  })
  const [charterToast, setCharterToast] = useState(null) // 'revoked' | 'reenabled'
  const charterState = communityTermsAt
    ? 'accepted'
    : (charterDismissed ? 'dismissed' : 'not_signed')

  async function handleAcceptCharter() {
    if (!profile?.id) return
    setCharterBusy(true)
    const result = await acceptCommunityTerms(profile.id)
    setCharterBusy(false)
    if (!result?.error) {
      setCommunityTermsAt(result.acceptedAt)
      // Si l'user avait dismissé, l'accept reset le flag (cohérence :
      // l'auto-show ne sert plus à rien une fois signé de toute façon).
      try { localStorage.removeItem(CHARTER_DISMISSED_KEY) } catch { /* silent */ }
      setCharterDismissed(false)
    }
  }

  async function handleRevokeCharter() {
    if (!profile?.id) return
    if (!(await confirm({ title: t.charterRevokeConfirm, confirmLabel: t.charterRevokeOk }))) return
    setCharterBusy(true)
    const result = await revokeCommunityTerms(profile.id)
    setCharterBusy(false)
    if (!result?.error) {
      setCommunityTermsAt(null)
      // Clear le dismiss flag : après révoquer, l'user devrait revoir
      // la modale à sa prochaine visite (sinon état incohérent).
      try { localStorage.removeItem(CHARTER_DISMISSED_KEY) } catch { /* silent */ }
      setCharterDismissed(false)
      setCharterToast('revoked')
      setTimeout(() => setCharterToast(null), 4000)
    }
  }

  function handleReenableCharter() {
    try { localStorage.removeItem(CHARTER_DISMISSED_KEY) } catch { /* silent */ }
    setCharterDismissed(false)
    setCharterToast('reenabled')
    setTimeout(() => setCharterToast(null), 4000)
  }

  return (
    <>
      <ProfilePageIntro title={t.pageTitle} description={t.pageIntro} darkMode={darkMode} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <ProfileSection
          Icon={LuImage}
          title={t.avatarTitle}
          description={t.avatarDesc}
          lang={lang}
          darkMode={darkMode}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <AvatarImg avatarId={profile?.avatar_id} size={64} />
            <Button onClick={() => setAvatarModalOpen(true)} variant="secondary">
              {t.avatarBtn}
            </Button>
          </div>
        </ProfileSection>

        <ProfileSection
          Icon={LuPanelTop}
          title={t.bannerTitle}
          description={t.bannerDesc}
          lang={lang}
          darkMode={darkMode}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <ProfileBanner bannerId={profile?.banner_id} height={80} />
            <Button onClick={() => setBannerModalOpen(true)} variant="secondary" style={{ alignSelf: 'flex-start' }}>
              {t.bannerBtn}
            </Button>
          </div>
        </ProfileSection>

        <ProfileSection
          Icon={LuUser}
          title={t.pseudoTitle}
          description={`${t.pseudoDesc} ${regles.hint}`}
          lang={lang}
          darkMode={darkMode}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              aria-label={t.pseudoLabel}
              style={{
                padding: '10px 12px', borderRadius: '8px',
                border: '1px solid rgba(0,0,0,0.15)',
                fontSize: '14px',
              }}
            />
            {pseudoError && <p role="alert" style={{ color: '#DC2626', fontSize: '12px', margin: 0 }}>{pseudoError}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <Button onClick={handleSavePseudo} loading={pseudoSaving} disabled={pseudoSaving || username.trim() === profile?.username}>
                {t.pseudoSave}
              </Button>
            </div>
          </div>
        </ProfileSection>

        <ProfileSection
          Icon={LuMessageSquare}
          title={t.bioTitle}
          description={t.bioDesc}
          lang={lang}
          darkMode={darkMode}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Field label={t.bioLabel} labelStyle={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-muted)', marginBottom: '6px' }} style={{ display: 'flex', flexDirection: 'column' }}>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
              placeholder={t.bioPlaceholder}
              rows={4}
              style={{
                padding: '10px 12px', borderRadius: '8px',
                border: '1px solid rgba(0,0,0,0.15)',
                fontSize: '14px', resize: 'vertical',
              }}
            />
            </Field>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', fontSize: '12px' }}>
              <Button onClick={handleSaveBio} loading={bioSaving} disabled={bioSaving || bio === (profile?.community_bio ?? '')}>
                {t.bioSave}
              </Button>
              <span style={{ color: bio.length >= BIO_MAX ? '#DC2626' : '#6A4F45' }}>
                {t.bioMaxHint(bio.length, BIO_MAX)}
              </span>
            </div>
            {bioMsg && <p style={{ color: bioMsg.type === 'error' ? '#DC2626' : '#16A34A', fontSize: '12px', margin: 0 }}>{bioMsg.text}</p>}
          </div>
        </ProfileSection>

        {/* v3.409 — Charte communauté refondue : tag coloré (vert/orange/gris)
            selon l'état + boutons contextuels. Section unifiée ici (Profil)
            au lieu de dupliquée sur Préférences (DRY + cohérence sémantique :
            la charte = engagement personnel/identitaire). */}
        <ProfileSection
          Icon={LuScroll}
          title={t.charterTitle}
          description={t.charterDesc}
          lang={lang}
          darkMode={darkMode}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Tag d'état coloré */}
            <div>
              {charterState === 'accepted' && (
                <span style={{
                  display: 'inline-block', padding: '4px 10px', borderRadius: '6px',
                  background: 'linear-gradient(135deg, #4CAF7D 0%, #2E8B57 100%)',
                  color: '#FFFFFF', fontSize: '12px', fontWeight: 700,
                  letterSpacing: '0.02em',
                  boxShadow: '0 1px 4px rgba(46,139,87,0.30)',
                }}>
                  ✓ {t.charterTagAccepted}
                </span>
              )}
              {charterState === 'not_signed' && (
                <span style={{
                  display: 'inline-block', padding: '4px 10px', borderRadius: '6px',
                  background: 'var(--gradient-deep)',
                  color: '#FFFFFF', fontSize: '12px', fontWeight: 700,
                  letterSpacing: '0.02em',
                  boxShadow: '0 1px 4px rgba(212,106,16,0.30)',
                }}>
                  ⏳ {t.charterTagNotSigned}
                </span>
              )}
              {charterState === 'dismissed' && (
                <span style={{
                  display: 'inline-block', padding: '4px 10px', borderRadius: '6px',
                  background: darkMode ? '#3A3F4A' : '#9CA3AF',
                  color: '#FFFFFF', fontSize: '12px', fontWeight: 700,
                  letterSpacing: '0.02em',
                }}>
                  🔕 {t.charterTagDismissed}
                </span>
              )}
            </div>

            {/* Message contextuel */}
            <p style={{ fontSize: '13px', margin: 0, color: darkMode ? '#EBE4D8' : '#2d1b00' }}>
              {charterState === 'accepted' && t.charterStatusAccepted(
                new Date(communityTermsAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
              )}
              {charterState === 'not_signed' && t.charterStatusNotSigned}
              {charterState === 'dismissed' && t.charterStatusDismissed}
            </p>

            {/* Actions contextuelles */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {charterState === 'accepted' && (
                <Button onClick={handleRevokeCharter} loading={charterBusy} variant="secondary"
                  style={{ borderColor: '#DC2626', color: '#DC2626' }}>
                  {t.charterRevoke}
                </Button>
              )}
              {charterState === 'dismissed' && (
                <>
                  <Button onClick={handleAcceptCharter} loading={charterBusy}>
                    {t.charterAccept}
                  </Button>
                  <Button onClick={handleReenableCharter} variant="secondary">
                    {t.charterReenable}
                  </Button>
                </>
              )}
              {charterState === 'not_signed' && (
                <Button onClick={handleAcceptCharter} loading={charterBusy}>
                  {t.charterAccept}
                </Button>
              )}
              {charterToast === 'revoked' && (
                <span style={{ fontSize: '12px', color: '#4CAF7D', fontWeight: 600 }}>
                  ✓ {t.charterRevoked}
                </span>
              )}
              {charterToast === 'reenabled' && (
                <span style={{ fontSize: '12px', color: '#4CAF7D', fontWeight: 600 }}>
                  ✓ {t.charterReenabled}
                </span>
              )}
            </div>
          </div>
        </ProfileSection>
      </div>

      {bannerModalOpen && (
        <BannerPickerModal
          currentBannerId={profile?.banner_id}
          unlockedBanners={profile?.unlocked_banners ?? []}
          onClose={() => setBannerModalOpen(false)}
          lang={lang}
          darkMode={darkMode}
        />
      )}
    </>
  )
}
