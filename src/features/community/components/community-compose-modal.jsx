import { useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { LuX, LuFeather, LuUtensils } from 'react-icons/lu'
import { moderateContent } from '@shared/hooks/use-moderation'
import { CATEGORIES, categoryLabel } from '@shared/lib/i18n/community-i18n'
import { canPost, createPost, updatePost } from '@shared/api/community'
import leoProfanity from 'leo-profanity'
import Button from '@shared/ui/button'
import { getC, catColor } from './community-theme'
import { CategoryIcon } from './community-category-icon'

export function ComposeModal({ initialPost, initialCategory, user, t, lang, darkMode, baseRecipes, recipeNames, attachableRecipes = [], onClose, onSaved }) {
  const C = getC(darkMode)
  const isEdit = !!initialPost
  const [category, setCategory] = useState(initialPost?.category ?? initialCategory ?? 'general')
  const [title, setTitle] = useState(initialPost?.title ?? '')
  const [body, setBody] = useState(initialPost?.body ?? '')
  const [recipeId, setRecipeId] = useState(initialPost?.recipe_id ?? null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Sprint 11 hotfix — picker = base recipes + custom user + public
  // communauté (dédupliqué par id, custom prend précédence si conflit).
  // Helper local pour résoudre le nom d'une recette (base via mapping
  // recipeNames, custom/public via recipe.name direct).
  const resolveName = useCallback((recipe) => {
    if (!recipe) return ''
    // Custom / public : name est sur l'objet
    if (recipe.isCustom) {
      return recipe.name ?? recipe.id
    }
    // Base : lookup recipeNames
    return recipeNames?.[recipe.id]?.[lang] ?? recipeNames?.[recipe.id]?.fr ?? recipe.id
  }, [recipeNames, lang])

  const filteredRecipes = useMemo(() => {
    const allRecipes = [
      ...(baseRecipes ?? []),
      ...(attachableRecipes ?? []),
    ]
    // Dédup : si même id, on garde la première occurrence (base recipes
    // d'abord ; en pratique pas de collision car custom/public ont des
    // UUIDs et base des slugs courts).
    const seen = new Set()
    const dedup = allRecipes.filter(r => {
      if (seen.has(r.id)) return false
      seen.add(r.id)
      return true
    })
    const q = pickerSearch.trim().toLowerCase()
    return dedup.filter(r => {
      const name = resolveName(r)
      return !q || name.toLowerCase().includes(q)
    }).slice(0, 30)
  }, [baseRecipes, attachableRecipes, pickerSearch, resolveName])

  const handleSubmit = async () => {
    setPickerOpen(false)
    setError(null)
    if (title.trim().length < 3) { setError(t.titleTooShort); return }
    if (title.length > 120)      { setError(t.titleTooLong(title.length)); return }
    if (body.trim().length < 10) { setError(t.bodyTooShort); return }
    if (body.length > 5000)      { setError(t.bodyTooLong(body.length)); return }
    if (leoProfanity.check(`${title} ${body}`)) { setError(t.profanityWarning); return }
    if (!isEdit && !await canPost(user.id)) { setError(t.spamLimitPost); return }
    setSubmitting(true)
    try {
      const modResult = await moderateContent(`${title.trim()}\n${body.trim()}`, 'community-post')
      if (modResult?.flagged) {
        setSubmitting(false)
        setError(t.contentBlocked)
        return
      }
    } catch {
      // Fail-closed délibéré, même raison que ReviewForm (recipe-reviews-section.jsx) :
      // pas de file de modération admin équivalente pour un post public.
      setSubmitting(false)
      setError(t.moderationError)
      return
    }
    const result = isEdit
      ? await updatePost(initialPost.id, { category, title: title.trim(), body: body.trim(), recipe_id: recipeId ?? null })
      : await createPost(user.id, { category, title: title.trim(), body: body.trim(), recipe_id: recipeId ?? undefined })
    setSubmitting(false)
    if (result.error) { setError(result.error); return }
    onSaved(result.data)
  }

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 130,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: '520px', maxHeight: '92dvh',
        background: C.surface,
        border: `1.5px solid ${C.border}`,
        borderRadius: '18px',
        display: 'flex', flexDirection: 'column',
        boxShadow: `0 0 40px ${C.orangeDim}, 0 16px 40px rgba(0,0,0,${darkMode ? '.6' : '.2'})`,
        overflow: 'hidden',
      }}>
        <div style={{ flexShrink: 0, padding: '18px 20px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            fontSize: '19px', fontWeight: 900, letterSpacing: '0.04em', flex: 1,
            backgroundImage: `linear-gradient(90deg, ${C.orange}, ${C.cyan})`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            {isEdit ? t.composeEditTitle.toUpperCase() : t.composeTitle.toUpperCase()}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}
            aria-label={t.closeAria}
            className="h-auto w-auto p-1 hover:bg-transparent"
            style={{ color: C.mid }}>
            <LuX size={18} />
          </Button>
        </div>

        <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, color: C.mid, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.fieldCategory}</span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {CATEGORIES.map(cat => {
                const cc = catColor(cat, darkMode)
                const active = category === cat
                return (
                  <Button key={cat} variant="ghost" type="button"
                    onClick={() => setCategory(cat)}
                    aria-pressed={active}
                    className="h-auto rounded-lg border-[1.5px] px-3 py-1 text-sm font-bold hover:bg-transparent"
                    style={{
                      gap: '5px',
                      borderColor: active ? cc.color : C.border,
                      background: active ? cc.dim : 'transparent',
                      color: active ? cc.color : C.mid,
                      transition: 'all .15s',
                      boxShadow: active ? `0 0 8px ${cc.dim}` : 'none',
                    }}>
                    <CategoryIcon cat={cat} size={12} />
                    {categoryLabel(t, cat)}
                  </Button>
                )
              })}
            </div>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, color: C.mid, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.fieldTitle}</span>
            <input type="text" className="cp-input" value={title} onChange={e => setTitle(e.target.value)}
              placeholder={t.fieldTitlePh} maxLength={120}
              style={{
                padding: '10px 12px', borderRadius: '8px',
                border: `1.5px solid ${C.border}`,
                background: C.surface2, color: C.hi, fontSize: '16px',
                fontFamily: 'inherit', boxSizing: 'border-box', width: '100%',
              }} />
            <span style={{ fontSize: '13px', color: C.mid, textAlign: 'right' }}>{title.length}/120</span>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, color: C.mid, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.fieldBody}</span>
            <textarea className="cp-textarea" value={body} onChange={e => setBody(e.target.value)}
              placeholder={t.fieldBodyPh} maxLength={5000} rows={6}
              style={{
                padding: '10px 12px', borderRadius: '8px',
                border: `1.5px solid ${C.border}`,
                background: C.surface2, color: C.hi, fontSize: '16px',
                fontFamily: 'inherit', resize: 'vertical',
                boxSizing: 'border-box', width: '100%',
              }} />
            <span style={{ fontSize: '13px', color: C.mid, textAlign: 'right' }}>{body.length}/5000</span>
          </label>

          {/* Recette attachée */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {recipeId ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 12px', borderRadius: '10px',
                border: `1.5px solid ${darkMode ? 'rgba(255,107,26,0.40)' : 'rgba(200,64,0,0.30)'}`,
                background: darkMode ? 'rgba(255,107,26,0.09)' : 'rgba(200,64,0,0.06)',
              }}>
                <LuUtensils size={14} color={darkMode ? '#FF6B1A' : '#C84000'} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: '14px', fontWeight: 700, color: darkMode ? '#FF6B1A' : '#C84000', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {/* Sprint 11 hotfix — résoudre via resolveName (gère
                      base + custom + public). */}
                  {resolveName(filteredRecipes.find(r => r.id === recipeId) ?? attachableRecipes.find(r => r.id === recipeId) ?? { id: recipeId })}
                </span>
                <Button variant="ghost" size="icon" type="button"
                  onClick={() => { setRecipeId(null); setPickerOpen(false) }}
                  aria-label={t.removeRecipeAria}
                  className="h-auto w-auto shrink-0 p-0.5 hover:bg-transparent"
                  style={{ color: C.mid }}>
                  <LuX size={14} />
                </Button>
              </div>
            ) : (
              <Button variant="ghost" type="button"
                onClick={() => setPickerOpen(v => !v)}
                aria-expanded={pickerOpen}
                aria-haspopup="listbox"
                className="h-auto self-start rounded-lg border-[1.5px] px-3 py-2 text-sm font-semibold hover:bg-transparent"
                style={{
                  gap: '7px',
                  borderColor: pickerOpen ? C.orange : C.border,
                  background: pickerOpen ? C.orangeDim : 'transparent',
                  color: pickerOpen ? C.orange : C.mid,
                  transition: 'all .15s',
                }}>
                <LuUtensils size={14} />
                {t.attachRecipe ?? 'Joindre une recette'}
              </Button>
            )}

            {pickerOpen && !recipeId && (
              <div style={{
                border: `1.5px solid ${C.border}`, borderRadius: '10px',
                background: C.surface2, overflow: 'hidden',
              }}>
                <div style={{ padding: '8px 10px', borderBottom: `1px solid ${C.border}` }}>
                  <input
                    value={pickerSearch}
                    onChange={e => setPickerSearch(e.target.value)}
                    placeholder={t.recipePickerPh ?? 'Rechercher une recette…'}
                    style={{
                      width: '100%', padding: '6px 10px', borderRadius: '6px',
                      border: `1.5px solid ${C.border}`,
                      background: C.surface, color: C.hi, fontSize: '14px',
                      fontFamily: 'inherit', boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                  {filteredRecipes.map(r => {
                    // Sprint 11 hotfix — résolution unifiée base/custom/public.
                    const name = resolveName(r)
                    return (
                      <Button
                        key={r.id} variant="ghost" type="button"
                        role="option"
                        onClick={() => { setRecipeId(r.id); setPickerOpen(false); setPickerSearch('') }}
                        className="h-auto w-full justify-start rounded-none bg-transparent px-3 py-2 text-left hover:bg-transparent"
                        style={{
                          gap: '8px',
                          borderBottom: `1px solid ${C.border}`,
                          transition: 'background .12s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = C.orangeDim}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <span style={{ fontSize: '18px', lineHeight: 1, flexShrink: 0 }}>{r.emoji}</span>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: C.hi, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                        <span style={{ fontSize: '12px', color: C.mid, flexShrink: 0 }}>{r.time}</span>
                      </Button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {error && (
            <div style={{ fontSize: '14px', color: C.danger, padding: '8px 12px', borderRadius: '8px', background: C.dangerDim, border: `1px solid ${C.danger}44` }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ flexShrink: 0, padding: '14px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <Button variant="secondary" onClick={onClose} type="button"
            className="h-auto rounded-lg border-[1.5px] bg-transparent px-4 py-2 text-[15px] font-semibold"
            style={{ borderColor: C.border, color: C.mid }}>
            {t.cancel}
          </Button>
          <Button onClick={handleSubmit} type="button"
            loading={submitting}
            disabled={submitting}
            className="h-auto rounded-lg px-5 py-2 text-[15px] font-extrabold"
            style={{
              background: `linear-gradient(135deg, ${C.orange}, ${darkMode ? '#FF9A00' : '#E07020'})`,
              color: darkMode ? '#000' : '#fff',
              cursor: submitting ? 'wait' : 'pointer',
              boxShadow: `0 0 14px ${C.orangeDim}`,
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
            <LuFeather size={14} />
            {isEdit ? t.submitEdit : t.submit}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
