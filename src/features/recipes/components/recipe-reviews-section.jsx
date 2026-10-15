import { REVIEWS_I18N as I18N } from '@features/recipes/i18n/recipe-reviews-i18n'
import { useEffect, useState, useRef, useImperativeHandle, forwardRef } from 'react'
import { LuStar, LuPencil, LuTrash2, LuFlag, LuChevronDown } from 'react-icons/lu'
import { useAuth } from '@shared/contexts/auth-provider'
import AvatarImg from '@shared/ui/avatar-img'
import Button from '@shared/ui/button'
import { formatRelativeTime } from '@shared/lib/i18n/notifications-i18n'
import {
  loadReviews, getMyReview, upsertReview, deleteReview, aggregateReviews,
} from '@features/recipes/api/recipe-reviews'
import ReviewReportModal from './recipe-review-report-modal'
import LoadErrorNotice from '@shared/ui/load-error-notice'
import { useSaveErrorToast } from '@shared/hooks/use-save-error-toast'
import { getCommunityTermsAcceptedAt } from '@shared/api/community'
import { moderateContent, submitPhotoPost } from '@shared/api/moderation-de-contenu'
import { compressImageToBase64 } from '@shared/lib/media/compress-image'
import { containsProfanity } from '@shared/lib/moderation'
import { useConfirm } from '@shared/ui/confirm-dialog/confirm-provider'
import { authorName } from '@shared/lib/author-name'
import Field from '@shared/ui/field'

// Section « Avis » dans la modale recette.
//
// Affiche : note moyenne + count + distribution, formulaire pour
// donner/éditer son avis, liste des avis triés par date desc.
//
// Connexion + charte communauté requises pour noter (cohérent avec
// les interactions communauté). Lecture publique.


// ─── Composant Stars affiche / saisie ──────────────────────────────────

export function Stars({ value = 0, size = 16, onChange = null, color = 'var(--color-brand-500)', mutedColor = '#C0C0C0' }) {
  const [hover, setHover] = useState(0)
  const display = hover || value
  const interactive = !!onChange

  // Purement décoratif (moyenne affichée, note d'un avis) : jamais de
  // <button> — évite un bouton (potentiellement imbriqué dans un <Button>
  // parent, ex. header accordéon des avis) qui ne sert à rien sans onChange.
  if (!interactive) {
    return (
      <div role="img" style={{ display: 'inline-flex', gap: '2px' }} aria-label={`${value}/5`}>
        {[1, 2, 3, 4, 5].map(n => (
          <span key={n} aria-hidden="true" style={{ color: n <= display ? color : mutedColor, display: 'inline-flex' }}>
            <LuStar size={size} fill={n <= display ? 'currentColor' : 'none'} strokeWidth={2.2} />
          </span>
        ))}
      </div>
    )
  }

  return (
    <div style={{ display: 'inline-flex', gap: '2px' }}>
      {[1, 2, 3, 4, 5].map(n => {
        const filled = n <= display
        return (
          <Button key={n}
            variant="ghost"
            type="button"
            onClick={() => onChange?.(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            aria-label={`${n}/5`}
            className="h-auto w-auto rounded-none p-0 hover:bg-transparent"
            style={{
              color: filled ? color : mutedColor,
              cursor: 'pointer',
            }}>
            <LuStar size={size} fill={filled ? 'currentColor' : 'none'} strokeWidth={2.2} />
          </Button>
        )
      })}
    </div>
  )
}

// ─── Section principale ────────────────────────────────────────────────

// forwardRef pour exposer .expand() au parent (utilisé quand
// on clique le badge ⭐ dans le header de la modale recette pour ouvrir
// l'accordéon et scroller vers la section).
const RecipeReviewsSection = forwardRef(function RecipeReviewsSection(
  { recipeId, recipeSource, lang = 'fr', darkMode = false, defaultCollapsed = true, onAggregateChange = null },
  ref
) {
  const t = I18N[lang] ?? I18N.fr
  const { user } = useAuth()
  const confirm = useConfirm()

  const signalerEchec = useSaveErrorToast()

  // Trois états : `reviews === null` en cours, une liste (chargée), ou
  // `loadError` — pas chargés, ce qui n'est PAS « pas encore d'avis ».
  const [reviews, setReviews] = useState(null)
  const [loadError, setLoadError] = useState(false)
  const [tentative, setTentative] = useState(0)
  const [myReview, setMyReview] = useState(null)
  const [termsAcceptedAt, setTermsAcceptedAt] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [reportTarget, setReportTarget] = useState(null)
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const sectionRef = useRef(null)

  const canInteract = !!user?.id && !!termsAcceptedAt

  // expose .expand() au parent via ref
  useImperativeHandle(ref, () => ({
    expand: () => {
      setCollapsed(false)
      // Petit délai pour laisser le DOM rendre le contenu déplié
      setTimeout(() => {
        sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 50)
    },
  }), [])

  useEffect(() => {
    if (!recipeId || !recipeSource) return
    let cancelled = false
    Promise.all([
      loadReviews(recipeId, recipeSource),
      user?.id ? getMyReview(user.id, recipeId, recipeSource) : Promise.resolve(null),
      user?.id ? getCommunityTermsAcceptedAt(user.id) : Promise.resolve(null),
    ]).then(([lus, mine, termsAt]) => {
      if (cancelled) return
      if (lus.error) { setLoadError(true); return }
      setReviews(lus.reviews); setMyReview(mine); setTermsAcceptedAt(termsAt); setLoadError(false)
    }).catch(() => { if (!cancelled) setLoadError(true) })
    return () => { cancelled = true }
  }, [recipeId, recipeSource, user?.id, tentative])

  const aggregate = aggregateReviews(reviews ?? [])

  // Notifie le parent quand l'agrégat change (pour le badge header)
  useEffect(() => {
    if (onAggregateChange) onAggregateChange(aggregate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aggregate.avg, aggregate.count])

  const handleSaved = (saved) => {
    setShowForm(false)
    setMyReview(saved)
    setReviews(prev => {
      const list = prev ?? []
      const idx = list.findIndex(r => r.id === saved.id)
      if (idx >= 0) {
        const next = [...list]; next[idx] = saved; return next
      }
      return [saved, ...list]
    })
  }

  const handleDelete = async () => {
    if (!myReview) return
    if (!(await confirm({ title: t.deleteConfirm, confirmLabel: t.deleteConfirmOk, danger: true }))) return
    // L'avis ne quitte l'écran que si la base l'a retiré : retiré sur un
    // refus, il serait revenu au rechargement.
    let refusee
    try { refusee = !!(await deleteReview(myReview.id))?.error } catch { refusee = true }
    if (refusee) { signalerEchec('removal'); return }
    setMyReview(null)
    setReviews(prev => prev?.filter(r => r.id !== myReview.id))
  }

  const fg = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted = darkMode ? '#A0A8B8' : '#7A6A52'
  const border = darkMode ? 'var(--color-dark-surface)' : 'var(--color-border-warm)'
  const cardBg = darkMode ? '#131E2C' : '#FFFFFF'

  if (loadError) {
    return (
      <LoadErrorNotice
        message={t.loadError} retryLabel={t.retry} textColor={fg} mutedColor={muted}
        // L'erreur s'efface le temps de la nouvelle tentative : si elle
        // revient, c'est que la tentative a échoué aussi.
        onRetry={() => { setLoadError(false); setTentative(n => n + 1) }}
      />
    )
  }
  if (reviews === null) {
    return <p style={{ fontSize: '13px', color: muted, fontStyle: 'italic' }}>…</p>
  }

  return (
    <div ref={sectionRef} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* v3.17.1 — Header cliquable (accordéon) */}
      <Button
        type="button"
        variant="ghost"
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
        className="h-auto w-full justify-start rounded-[10px] border px-3 py-2.5 text-left flex-wrap hover:bg-transparent"
        style={{
          gap: '10px',
          borderColor: border,
          background: cardBg,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = darkMode ? 'rgba(247,168,94,0.05)' : 'rgba(247,168,94,0.06)'}
        onMouseLeave={e => e.currentTarget.style.background = cardBg}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: fg, display: 'flex', alignItems: 'center', gap: '6px' }}>
          ⭐ {t.title}
        </h3>
        {aggregate.count > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Stars value={Math.round(aggregate.avg)} size={14} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: fg }}>{aggregate.avg}</span>
            <span style={{ fontSize: '13px', color: muted }}>({t.reviewsCount(aggregate.count)})</span>
          </div>
        ) : (
          <span style={{ fontSize: '13px', color: muted, fontStyle: 'italic' }}>{t.reviewsCount(0)}</span>
        )}
        <div style={{ flex: 1 }} />
        <LuChevronDown size={16} style={{ color: muted, transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s' }} />
      </Button>

      {/* Contenu (visible uniquement si déplié) */}
      {!collapsed && (
        <>
          {/* Action user : noter / éditer / supprimer */}
          {!user?.id ? (
            <p style={{ margin: 0, fontSize: '14px', color: muted, fontStyle: 'italic' }}>{t.needLogin}</p>
          ) : !termsAcceptedAt ? (
            <p style={{ margin: 0, fontSize: '14px', color: muted, fontStyle: 'italic' }}>{t.needTerms}</p>
          ) : myReview && !showForm ? (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Button
                variant="secondary"
                onClick={() => setShowForm(true)}
                type="button"
                className="h-auto rounded-lg border-[1.5px] px-3 py-1.5 text-sm font-semibold"
                style={{ borderColor: border, background: cardBg, color: muted, gap: '5px' }}>
                <LuPencil size={14} /> {t.editBtn}
              </Button>
              <Button
                variant="ghost"
                onClick={handleDelete}
                type="button"
                className="h-auto rounded-lg bg-transparent px-3 py-1.5 text-sm font-semibold hover:bg-transparent"
                style={{ color: '#D06060', gap: '5px' }}>
                <LuTrash2 size={13} /> {t.deleteBtn}
              </Button>
            </div>
          ) : !showForm ? (
            <Button
              onClick={() => setShowForm(true)}
              type="button"
              className="h-auto self-start rounded-lg bg-[#B85000] px-3.5 py-2 text-sm font-bold text-white"
              style={{ boxShadow: '0 2px 10px rgba(224,120,32,0.30)' }}>
              ⭐ {t.rateBtn}
            </Button>
          ) : null}

          {/* Formulaire */}
          {showForm && canInteract && (
            <ReviewForm
              initial={myReview}
              recipeId={recipeId}
              recipeSource={recipeSource}
              userId={user.id}
              t={t} darkMode={darkMode} border={border} muted={muted} fg={fg} cardBg={cardBg}
              onCancel={() => setShowForm(false)}
              onSaved={handleSaved}
            />
          )}

          {/* Liste */}
          {reviews.length === 0 ? (
            <p style={{ margin: 0, fontSize: '15px', color: muted, fontStyle: 'italic' }}>{t.empty}</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {reviews.map(r => {
                const isOwn = user?.id && r.user_id === user.id
                const author = authorName(r, t)
                return (
                  <li key={r.id} style={{
                    padding: '10px 12px', borderRadius: '10px',
                    border: `1px solid ${border}`, background: cardBg,
                    display: 'flex', flexDirection: 'column', gap: '6px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AvatarImg avatarId={r.profile?.avatar_id} size={24} style={{ flexShrink: 0, border: `1px solid ${border}` }} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: '14px', fontWeight: 700, color: fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{author}</span>
                      <Stars value={r.rating} size={15} />
                      <span style={{ fontSize: '12px', color: muted, flexShrink: 0 }}>{formatRelativeTime(r.created_at, lang)}</span>
                      {!isOwn && canInteract && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setReportTarget(r.id)}
                          aria-label={t.reportTitle}
                          title={t.reportTitle}
                          className="h-auto w-auto p-0.5 hover:bg-transparent"
                          style={{ color: muted, opacity: 0.5 }}
                          onMouseEnter={e => { e.currentTarget.style.opacity = 1; e.currentTarget.style.color = '#D06060' }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = 0.5; e.currentTarget.style.color = muted }}>
                          <LuFlag size={13} />
                        </Button>
                      )}
                    </div>
                    {r.body && (
                      <p style={{ margin: 0, fontSize: '15px', lineHeight: 1.5, color: fg, whiteSpace: 'pre-wrap' }}>{r.body}</p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      {reportTarget && user?.id && (
        <ReviewReportModal
          reviewId={reportTarget}
          userId={user.id}
          t={t}
          darkMode={darkMode}
          onClose={() => setReportTarget(null)}
        />
      )}
    </div>
  )
})

export default RecipeReviewsSection

// ─── Formulaire d'avis ─────────────────────────────────────────────────

export function ReviewForm({ initial, recipeId, recipeSource, userId, t, darkMode, border, muted, fg, cardBg, onCancel, onSaved }) {
  const [rating, setRating] = useState(initial?.rating ?? 0)
  const [body, setBody] = useState(initial?.body ?? '')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [sharePhoto, setSharePhoto] = useState(false)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoError, setPhotoError] = useState(null)

  const handleSubmit = async () => {
    setError(null)
    setPhotoError(null)
    if (rating < 1) return
    if (body && body.length > 2000) { setError(t.bodyTooLong(body.length)); return }
    if (body && containsProfanity(body)) { setError(t.profanityWarning); return }
    if (sharePhoto && !photoFile) { setPhotoError(t.photoRequired); return }
    setSubmitting(true)
    if (body) {
      try {
        const modResult = await moderateContent(body, 'review')
        if (modResult?.flagged) {
          setSubmitting(false)
          setError(t.contentBlocked)
          return
        }
      } catch {
        // Fail-closed délibéré (contrairement à recipe-form-modal.jsx qui est
        // fail-open) : un avis public n'a pas de file de modération admin
        // équivalente à l'admin queue des recettes custom — en cas de doute
        // sur la vérification, on ne publie jamais.
        setSubmitting(false)
        setError(t.moderationError)
        return
      }
    }
    if (sharePhoto && photoFile) {
      try {
        const imageBase64 = await compressImageToBase64(photoFile)
        const photoResult = await submitPhotoPost({ content: body, imageBase64, recipeId, title: t.shareTitle })
        if (photoResult?.flagged) {
          setSubmitting(false)
          setPhotoError(t.contentBlocked)
          return
        }
      } catch {
        setSubmitting(false)
        setPhotoError(t.moderationError)
        return
      }
    }
    const result = await upsertReview(userId, { recipeId, recipeSource, rating, body: body || null })
    setSubmitting(false)
    // Un message lisible — pas le texte de la base, que la personne ne peut ni
    // comprendre ni corriger (« new row violates row-level security policy… »).
    if (result.error) { setError(t.saveError ?? result.error); return }
    onSaved(result.data)
  }

  return (
    <div style={{
      padding: '12px', borderRadius: '10px',
      border: `1.5px solid ${border}`, background: cardBg,
      display: 'flex', flexDirection: 'column', gap: '10px',
    }}>
      <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: fg }}>{t.formTitle}</p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t.formRating}</span>
        <Stars value={rating} size={20} onChange={setRating} />
        {rating > 0 && <span style={{ fontSize: '12px', color: muted }}>{t.starsLabel(rating)}</span>}
      </div>

      <Field label={t.formBody} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }} labelStyle={{ fontSize: '13px', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        <textarea value={body} onChange={e => setBody(e.target.value)} placeholder={t.formBodyPh} maxLength={2000} rows={3}
          style={{ padding: '8px 10px', borderRadius: '8px', border: `1.5px solid ${border}`, background: darkMode ? '#0F1925' : '#FDFAF6', color: fg, fontSize: '13px', fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
      </Field>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: fg, cursor: 'pointer' }}>
          <input type="checkbox" checked={sharePhoto} onChange={e => setSharePhoto(e.target.checked)} />
          {t.sharePhotoLabel}
        </label>
        {sharePhoto && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '24px' }}>
            <input type="file" accept="image/*" aria-label={t.choosePhoto}
              onChange={e => setPhotoFile(e.target.files?.[0] ?? null)} />
            <span style={{ fontSize: '11px', color: muted }}>{t.sharePhotoNotice}</span>
            {photoError && <span style={{ fontSize: '12px', color: '#D06060' }}>{photoError}</span>}
          </div>
        )}
      </div>

      {error && <div style={{ fontSize: '12px', color: '#D06060' }}>{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <Button
          variant="secondary"
          onClick={onCancel}
          type="button"
          className="h-auto rounded-lg border-[1.5px] bg-transparent px-3.5 py-1.5 text-sm font-semibold"
          style={{ borderColor: border, color: muted }}>
          {t.cancel}
        </Button>
        <Button
          onClick={handleSubmit}
          type="button"
          loading={submitting}
          disabled={submitting || rating < 1}
          className="h-auto rounded-lg px-4 py-1.5 text-sm font-bold text-white"
          style={{ background: rating >= 1 ? 'var(--color-brand-500)' : (darkMode ? '#2A3A50' : '#D0C0A0') }}>
          {initial ? t.formSubmitEdit : t.formSubmit}
        </Button>
      </div>
    </div>
  )
}
