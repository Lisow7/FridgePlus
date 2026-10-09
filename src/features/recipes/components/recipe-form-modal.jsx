import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { formatRelativeAge } from '@features/recipes/lib/recipe-draft'
import useRecipeFormModal from '@features/recipes/hooks/use-recipe-form-modal'
import { LuX, LuChefHat, LuChevronDown } from 'react-icons/lu'
import Button from '@shared/ui/button'
import RecipeFormCancelDialog from './recipe-form-cancel-dialog'
import RecipeFormPublishDialog from './recipe-form-publish-dialog'
import RecipeFormSortableStep from './recipe-form-sortable-step'
import RecipeFormMicInput from './recipe-form-mic-input'
import IngredientRow from './recipe-form-ingredient-row'
import RecipeFormDetailsSection from './recipe-form-details-section'
import { ERR_MSG, sectionStyle, sectionTitle } from './recipe-form-section-ui'

const FOOD_EMOJIS = [
  '🥚','🧀','🥩','🍗','🥓','🦐','🐟','🍣','🐙','🦑',
  '🥬','🥦','🥕','🧅','🧄','🥔','🍅','🍆','🌽','🫑',
  '🍞','🥐','🥖','🫓','🍝','🍜','🍚','🥞','🧇','🫙',
  '🍲','🫕','🥘','🌮','🌯','🍳','🥗','🥙','🍕','🍔',
  '🍰','🎂','🧁','🍩','🍪','🍫','🥧','🍦','🍓','🍎',
  '🥑','🫐','🍋','🥝','🌰','🥜','🍯','🫚','🧆','🍽️',
]

// Unités proposées dans le select du form. Liste exhaustive : poids, volumes,
// unités-pièce (gousse, tranche, etc.), volumes ménagers (verre, pot, louche),
// portions (carré, tablette, morceau, noix) + cuillerées + PM ("pour mémoire").


// Seul libellé du formulaire couvrant les 5 langues (FORM_I18N est fr/en).
const SCROLL_TOP_LABEL = {
  fr: 'Remonter en haut', en: 'Scroll to top', es: 'Volver arriba',
  de: 'Nach oben', ja: 'トップへ戻る',
}

// `halal` retiré temporairement (cf. HIDDEN_DIETS dans
// recipeConstants.js). Réactivation = ré-ajouter la clé.





// `SortableStep` extrait dans `./recipe-form-sortable-step.jsx`



// `MicInput` et `SelectDropdown` extraits dans
// `./recipe-form-mic-input.jsx` et `./recipe-form-select-dropdown.jsx`

export default function RecipeFormModal({ initialRecipe = null, onSave, onClose, lang = 'fr', darkMode = false, hidePublishOption = false }) {
  // L'état, les effets et les actions vivent dans le hook : il retourne un
  // objet unique, destructuré ici pour que le JSX garde ses noms de variables.
  const {
    t, user, dietTypes, allergenTypes,
    form, errors, saveError, draftBanner,
    showEmojiPicker, setShowEmojiPicker, showCloseConfirm, setShowCloseConfirm,
    showPublishConfirm, setShowPublishConfirm, publishAcknowledged, setPublishAcknowledged,
    publishConsent, setPublishConsent, proposePublic, setProposePublic,
    consentToPromote, setConsentToPromote, showScrollTop, setShowScrollTop,
    completenessOpen, setCompletenessOpen,
    emojiRef, scrollRef, dialogRef,
    flatIngredients, groupedIngredients, completenessIssues, similarRecipes,
    countryOptions, sensors, submitting, ALLERGEN_KEYS,
    update, handleResetDraft, handleClose,
    addIngredient, updateIngredient, deleteIngredient,
    addStep, updateStep, deleteStep, handleStepDragEnd,
    toggleDiet, handleSubmit, handleConfirmPublish,
  } = useRecipeFormModal({ initialRecipe, onSave, onClose, lang })


  const dm = darkMode
  const bd = dm ? '1px solid #1A2A3D' : '1px solid #EDE4D4'
  const inputBase = (err) => ({ width:'100%', padding:'10px 12px', borderRadius:'8px', border: err ? '1.5px solid #D07070' : (dm ? '1.5px solid #1A2A3D' : '1.5px solid #E8E0D4'), background: dm ? '#0F1923' : '#FFF', color:'var(--color-charcoal)', fontSize:'15px', outline:'none', boxSizing:'border-box', fontFamily:'inherit' })
  const label = { fontSize:'13px', fontWeight:700, color:'var(--color-muted)', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:'6px' }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[55]" style={{ background:'rgba(18,10,4,0.35)', backdropFilter:'blur(3px)' }} onClick={handleClose} />

      {/* Panel */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={initialRecipe ? t.editTitle : t.createTitle}
        style={{ position:'fixed', top:0, right:0, width:'660px', maxWidth:'100vw', height:'100dvh', display:'flex', flexDirection:'column', background: dm ? '#0F1923' : '#FDFAF6', boxShadow: dm ? '-8px 0 32px rgba(0,0,0,0.45)' : '-8px 0 32px rgba(0,0,0,0.16)', zIndex:60, animation:'panel-slide-in 0.32s cubic-bezier(0.34,1.06,0.64,1) both' }}>

        {/* Header */}
        <div style={{ padding:'16px 20px 14px', borderBottom: bd, flexShrink:0, display:'flex', alignItems:'center', gap:'10px', background: dm ? '#0F1923' : '#FDFAF6' }}>
          <LuChefHat size={22} style={{ color:'var(--color-brand-500)', flexShrink:0 }} />
          <p style={{ margin:0, fontSize:'22px', fontWeight:800, color:'var(--color-charcoal)', flex:1 }}>
            {initialRecipe ? t.editTitle : t.createTitle}
          </p>
          {/* v3.251.0 — Sprint 8 PR S8.e.3 — close X migré. */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            aria-label={t.closeLabel}
            className="h-auto w-auto p-1.5 rounded-lg"
            style={{ color: 'var(--color-muted)' }}
          >
            <LuX size={20} />
          </Button>
        </div>

        {/* Body */}
        <div
          ref={scrollRef}
          onScroll={e => setShowScrollTop(e.currentTarget.scrollTop > 80)}
          style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}
        >

          {/* L'enregistrement a été refusé : dit en haut du formulaire, qui reste
              ouvert avec tout ce qui est tapé (le hook y ramène le défilement). */}
          {saveError && (
            <div
              role="alert"
              style={{
                marginBottom:'16px', padding:'10px 14px', borderRadius:'10px',
                background: dm ? 'rgba(220,38,38,0.14)' : '#FEF2F2',
                borderLeft:'3px solid #DC2626',
                fontSize:'13px', fontWeight:600, lineHeight:1.45,
                color: dm ? '#FCA5A5' : '#991B1B',
              }}
            >
              {saveError === 'locked' ? t.saveLocked : t.saveFailed}
            </div>
          )}

          {/* R-02 — banner brouillon restauré (création uniquement, jamais en édition) */}
          {draftBanner && (
            <div
              role="status"
              aria-live="polite"
              style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                gap:'12px', marginBottom:'16px',
                padding:'10px 14px', borderRadius:'10px',
                background: dm ? '#0F1A28' : '#FFF6E8',
                borderLeft:'3px solid var(--color-brand-500)',
                fontSize:'13px', color:'var(--color-charcoal)',
              }}
            >
              <span style={{ display:'flex', alignItems:'center', gap:'8px', minWidth:0 }}>
                <span aria-hidden="true" style={{ fontSize:'15px' }}>💡</span>
                <span style={{ minWidth:0 }}>
                  <strong style={{ fontWeight:700 }}>{t.draftBannerLabel}</strong>
                  {' — '}
                  <span style={{ color:'var(--color-muted)' }}>
                    {t.draftBannerHint.replace('{age}', formatRelativeAge(draftBanner.savedAt, lang))}
                  </span>
                </span>
              </span>
              <Button
                variant="ghost"
                onClick={handleResetDraft}
                className="h-auto rounded-[8px] px-3 py-1 text-[12px] font-semibold"
                style={{ color:'var(--color-brand-500)', flexShrink:0 }}
              >
                {t.draftReset}
              </Button>
            </div>
          )}

          {/* Présentation */}
          <div style={sectionStyle(darkMode)}>
            {sectionTitle(t.sectionPresentation)}

            {/* Emoji + Nom */}
            <div style={{ display:'flex', gap:'14px', marginBottom:'4px', alignItems:'center' }}>
              <div ref={emojiRef} style={{ position:'relative', flexShrink:0 }}>
                <span style={{ ...label, marginBottom:'8px', textAlign:'center', display:'block' }}>{t.fieldEmoji}</span>
                <Button
                  onClick={() => setShowEmojiPicker(v => !v)}
                  aria-haspopup="dialog"
                  aria-expanded={showEmojiPicker}
                  aria-label={t.fieldEmoji}
                  className="h-[72px] w-[72px] rounded-[14px] border-2 p-0 text-[36px] hover:opacity-100"
                  style={{
                    borderColor: errors.emoji ? '#D07070' : (dm ? 'var(--color-dark-surface)' : '#E8E0D4'),
                    background: dm ? '#0D1620' : '#F8F4EE',
                    transition:'all 0.15s',
                    boxShadow: form.emoji ? (dm ? '0 2px 12px rgba(0,0,0,0.4)' : '0 2px 10px rgba(0,0,0,0.08)') : 'none',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-brand-500)'; e.currentTarget.style.background = dm ? 'rgba(224,120,32,0.12)' : '#FEF3E2' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = errors.emoji ? '#D07070' : (dm ? 'var(--color-dark-surface)' : '#E8E0D4'); e.currentTarget.style.background = dm ? '#0D1620' : '#F8F4EE' }}
                >
                  {form.emoji || <span style={{ fontSize:'24px', opacity:0.3 }}>?</span>}
                </Button>
                {errors.emoji && <span style={ERR_MSG}>{errors.emoji}</span>}
                {showEmojiPicker && (
                  <div style={{ position:'absolute', top:'calc(100% + 8px)', left:0, zIndex:200, background: dm ? '#131E2C' : '#FDFAF6', border: dm ? '1.5px solid #1A2A3D' : '1.5px solid #EDE4D4', borderRadius:'12px', padding:'10px', display:'grid', gridTemplateColumns:'repeat(auto-fill, 42px)', gap:'4px', boxShadow:'0 4px 24px rgba(0,0,0,0.18)', maxWidth:'min(420px, calc(100vw - 32px))' }}>
                    {FOOD_EMOJIS.map(e => (
                      <Button key={e}
                        variant="ghost"
                        onClick={() => { update('emoji', e); setShowEmojiPicker(false) }}
                        aria-pressed={form.emoji === e}
                        aria-label={e}
                        className="h-[42px] w-[42px] rounded-lg p-0 text-[26px] hover:bg-transparent"
                        style={{
                          background: form.emoji === e ? (dm ? 'rgba(224,120,32,0.25)' : '#FEF3E2') : 'transparent',
                        }}>
                        {e}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ flex:1 }}>
                <span style={label}>{t.fieldName}</span>
                <RecipeFormMicInput value={form.name} onChange={e => update('name', e.target.value)} placeholder={t.placeholderName} style={inputBase(errors.name)} lang={lang} darkMode={dm} maxLength={30} />
                {errors.name && <span style={ERR_MSG}>{errors.name}</span>}
                {/* R-05 — recettes similaires existantes (indicatif, publication seulement). */}
                {similarRecipes.length > 0 && (
                  <div role="status" style={{
                    marginTop: '8px', padding: '10px 12px', borderRadius: '8px',
                    background: dm ? 'rgba(99,179,237,0.10)' : '#EFF6FF',
                    border: '1px solid rgba(43,108,176,0.25)',
                  }}>
                    <p style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: 700, color: dm ? '#90CDF4' : '#2B6CB0' }}>
                      💡 {t.similarTitle}
                    </p>
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {similarRecipes.map(r => (
                        <li key={r.id} style={{ fontSize: '13px', color: 'var(--color-charcoal)', display: 'flex', gap: '6px' }}>
                          <span>{r.title}</span>
                          <a href={`/recipe/${r.id}`} target="_blank" rel="noreferrer" style={{ color: dm ? '#90CDF4' : '#2B6CB0', fontWeight: 600, textDecoration: 'underline' }}>
                            {t.similarView}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Détails — extraite dans RecipeFormDetailsSection */}
          <RecipeFormDetailsSection
            form={form} update={update} errors={errors} t={t} lang={lang} darkMode={darkMode}
            inputBase={inputBase} label={label}
            allergenTypes={allergenTypes} dietTypes={dietTypes} allergenKeys={ALLERGEN_KEYS}
            countryOptions={countryOptions} toggleDiet={toggleDiet}
          />


          {/* Ingrédients */}
          <div style={sectionStyle(darkMode)}>
            {sectionTitle(t.sectionIngredients)}
            {errors.ingredients && <span style={{ ...ERR_MSG, marginBottom:'10px', display:'block' }}>{errors.ingredients}</span>}
            {form.ingredients.map((ing, idx) => (
              <div key={ing._key}>
                {idx > 0 && (
                  <div style={{ height:'1px', background: dm ? 'var(--color-dark-surface)' : 'var(--color-border-warm)', margin: '6px 0' }} />
                )}
                <IngredientRow
                  item={ing}
                  flatIngredients={flatIngredients}
                  groupedIngredients={groupedIngredients}
                  onUpdate={updateIngredient}
                  onDelete={deleteIngredient}
                  darkMode={dm}
                  t={t}
                  hasError={!!errors.ingredients && !ing.ingredientId}
                  lang={lang}
                />
              </div>
            ))}
            <Button
              onClick={addIngredient}
              className="h-auto w-full rounded-[10px] border-[1.5px] px-3.5 py-2 text-[15px] font-bold"
              style={{
                borderColor: 'rgba(224,120,32,0.35)',
                background: dm ? 'rgba(224,120,32,0.08)' : 'rgba(224,120,32,0.06)',
                color: 'var(--color-brand-500)',
                marginTop: form.ingredients.length > 0 ? '8px' : 0,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = dm ? 'rgba(224,120,32,0.16)' : 'rgba(224,120,32,0.12)'; e.currentTarget.style.borderColor = 'var(--color-brand-500)' }}
              onMouseLeave={e => { e.currentTarget.style.background = dm ? 'rgba(224,120,32,0.08)' : 'rgba(224,120,32,0.06)'; e.currentTarget.style.borderColor = 'rgba(224,120,32,0.35)' }}
            >
              {t.addIngredient}
            </Button>
          </div>

          {/* Étapes */}
          <div style={sectionStyle(darkMode)}>
            {sectionTitle(t.sectionSteps)}
            {errors.steps && <span style={{ ...ERR_MSG, marginBottom:'10px', display:'block' }}>{errors.steps}</span>}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleStepDragEnd}>
              <SortableContext items={form.steps.map(s => s.id)} strategy={verticalListSortingStrategy}>
                {form.steps.map((step, idx) => (
                  <RecipeFormSortableStep
                    key={step.id}
                    step={step}
                    index={idx}
                    onChange={updateStep}
                    onDelete={deleteStep}
                    darkMode={dm}
                    t={t}
                    hasError={!!errors.steps && !step.text.trim()}
                    lang={lang}
                  />
                ))}
              </SortableContext>
            </DndContext>
            <Button
              onClick={addStep}
              className="h-auto w-full rounded-[10px] border-[1.5px] px-3.5 py-2 text-[15px] font-bold"
              style={{
                borderColor: 'rgba(224,120,32,0.35)',
                background: dm ? 'rgba(224,120,32,0.08)' : 'rgba(224,120,32,0.06)',
                color: 'var(--color-brand-500)',
                marginTop: form.steps.length > 0 ? '8px' : 0,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = dm ? 'rgba(224,120,32,0.16)' : 'rgba(224,120,32,0.12)'; e.currentTarget.style.borderColor = 'var(--color-brand-500)' }}
              onMouseLeave={e => { e.currentTarget.style.background = dm ? 'rgba(224,120,32,0.08)' : 'rgba(224,120,32,0.06)'; e.currentTarget.style.borderColor = 'rgba(224,120,32,0.35)' }}
            >
              {t.addStep}
            </Button>
          </div>

          {/* Espace bas */}
          <div style={{ height:'16px' }} />
        </div>

        {/* Bouton remonter en haut — centré horizontalement, juste au-dessus du footer */}
        <Button
          onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label={SCROLL_TOP_LABEL[lang] ?? SCROLL_TOP_LABEL.fr}
          className="h-14 w-14 rounded-2xl bg-none bg-[#B85000] p-0 shadow-[0_4px_16px_rgba(184,80,0,0.32)] hover:opacity-100"
          style={{
            position: 'absolute', bottom: '120px', right: '36px',
            opacity: showScrollTop ? 0.85 : 0,
            pointerEvents: showScrollTop ? 'auto' : 'none',
            transform: showScrollTop ? 'scale(1)' : 'translateY(10px) scale(0.85)',
            transition: 'opacity 0.25s ease, transform 0.25s ease',
            zIndex: 10,
          }}
        >
          {[0, 0.9].map((delay, idx) => (
            <div key={idx} style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              border: '1.5px solid rgba(224,120,32,0.45)',
              animation: showScrollTop ? `tap-ring 2.2s ease-out ${delay}s infinite` : 'none',
            }} />
          ))}
          <svg width="18" height="18" viewBox="0 0 14 14" fill="none" style={{ position: 'relative', zIndex: 1 }}>
            <path d="M7 11V3M7 3L3.5 6.5M7 3L10.5 6.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Button>

        {/* Footer */}
        <div style={{ padding:'20px 24px', borderTop: bd, flexShrink:0, background: dm ? '#0F1923' : '#FDFAF6', display:'flex', flexDirection:'column', gap:'16px' }}>
          {user && !hidePublishOption && (
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              {/* Checkbox 1 — Proposer publiquement */}
              <label style={{ display:'flex', gap:'12px', cursor:'pointer', alignItems:'flex-start' }}>
                <input
                  type="checkbox"
                  checked={proposePublic}
                  onChange={e => setProposePublic(e.target.checked)}
                  style={{ width:'18px', height:'18px', accentColor:'var(--color-brand-500)', cursor:'pointer', flexShrink:0, marginTop:'2px' }}
                />
                <div>
                  <div style={{ fontSize:'15px', fontWeight:700, color:'var(--color-charcoal)', lineHeight:'1.3' }}>{t.proposePublic}</div>
                  <div style={{ fontSize:'13px', color:'var(--color-muted)', marginTop:'4px', lineHeight:'1.5' }}>{t.proposePublicHint}</div>
                </div>
              </label>

              {/* v3.3.9 — consentement RGPD, visible seulement si proposePublic */}
              {proposePublic && (
                <label style={{ display:'flex', gap:'12px', cursor:'pointer', alignItems:'flex-start', paddingLeft:'30px' }}>
                  <input
                    type="checkbox"
                    checked={consentToPromote}
                    onChange={e => setConsentToPromote(e.target.checked)}
                    style={{ width:'16px', height:'16px', accentColor:'var(--color-success)', cursor:'pointer', flexShrink:0, marginTop:'2px' }}
                  />
                  <div>
                    <div style={{ fontSize:'14px', fontWeight:600, color:'var(--color-charcoal)', lineHeight:'1.3' }}>{t.consentPromote}</div>
                    <div style={{ fontSize:'12px', color:'var(--color-muted)', marginTop:'3px', lineHeight:'1.5' }}>{t.consentPromoteHint}</div>
                  </div>
                </label>
              )}
            </div>
          )}

          {/* R-09 — checklist de complétude indicative, repliable (fermée par
              défaut, reconnaissable). N'empêche pas de soumettre. */}
          {completenessIssues.length > 0 && (
            <div style={{
              margin: '0 0 12px 0', borderRadius: '10px', overflow: 'hidden',
              background: dm ? 'rgba(247,168,94,0.10)' : '#FFF6E8',
              border: '1px solid rgba(212,106,16,0.25)',
            }}>
              <button
                type="button"
                onClick={() => setCompletenessOpen(o => !o)}
                aria-expanded={completenessOpen}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <span style={{ flex: 1, fontSize: '13px', fontWeight: 800, color: 'var(--color-brand-600)' }}>
                  {t.completenessTitle} ({completenessIssues.length})
                </span>
                <LuChevronDown size={16} style={{ flexShrink: 0, color: 'var(--color-brand-600)', transform: completenessOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
              </button>
              {completenessOpen && (
                <ul style={{ margin: 0, padding: '0 14px 12px', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {completenessIssues.map((code, i) => {
                    const unknown = code.startsWith('ingredient_unknown:')
                    const text = unknown
                      ? `${t.issueUnknownIngredient} ${code.slice('ingredient_unknown:'.length)}`
                      : ({ servings: t.issueServings, time: t.issueTime, steps: t.issueSteps, ingredients: t.issueIngredients })[code]
                    return (
                      <li key={`${code}-${i}`} style={{ fontSize: '13px', color: 'var(--color-charcoal)', display: 'flex', gap: '7px', lineHeight: 1.45 }}>
                        <span aria-hidden="true" style={{ flexShrink: 0, color: unknown ? 'var(--color-danger)' : 'var(--color-brand-500)', fontWeight: 800 }}>{unknown ? '⚠' : '·'}</span>
                        <span>{text}</span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          {/* Boutons d'action — v3.251.0 — Sprint 8 PR S8.e.3 */}
          <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end' }}>
            <Button
              variant="secondary"
              onClick={handleClose}
              className="h-auto py-[11px] px-6 rounded-[10px] text-sm font-semibold text-[var(--color-muted)]"
              style={{ borderColor: dm ? 'var(--color-dark-surface)' : '#E8E0D4' }}
            >
              {t.cancel}
            </Button>
            <Button
              onClick={handleSubmit}
              loading={submitting}
              className="h-auto py-[11px] px-8 rounded-[10px] text-[15px] shadow-[0_4px_16px_rgba(184,80,0,0.30)]"
            >
              {t.save}
            </Button>
          </div>
        </div>
      </div>

      <RecipeFormCancelDialog
        isOpen={showCloseConfirm}
        onCancel={() => setShowCloseConfirm(false)}
        onConfirm={() => { setShowCloseConfirm(false); onClose() }}
        darkMode={dm}
        t={t}
      />

      <RecipeFormPublishDialog
        isOpen={showPublishConfirm}
        onCancel={() => { setShowPublishConfirm(false); setPublishAcknowledged(false); setPublishConsent(false) }}
        onConfirm={handleConfirmPublish}
        acknowledged={publishAcknowledged}
        onToggleAcknowledged={e => setPublishAcknowledged(e.target.checked)}
        consent={publishConsent}
        onToggleConsent={e => setPublishConsent(e.target.checked)}
        submitting={submitting}
        darkMode={dm}
        t={t}
      />
    </>
  )
}
