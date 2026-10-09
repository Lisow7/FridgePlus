import { useId } from 'react'
import { LuSearch } from 'react-icons/lu'
import Button from '@shared/ui/button'
import { MESSAGE_SUPPORT_MAX } from '@shared/lib/longueurs-maximales'
import Field from '@shared/ui/field'

const REASON_SUBSETS = {
  base:       ['inappropriate', 'wrong_info', 'plagiarism', 'spam', 'other'],
  community:  ['inappropriate', 'wrong_info', 'plagiarism', 'spam', 'other'],
  ingredient: ['allergen_error', 'wrong_info', 'inappropriate', 'other'],
  user:       ['spam', 'inappropriate', 'harassment', 'other'],
}

/**
 * Vue « formulaire » du panneau Support : cible du signalement, motif, message.
 *
 * Reçoit l'état en UN objet (`ctx`, celui de `useSupportPanel`) plutôt qu'en une
 * quinzaine de props — c'est ce qui rend cette extraction possible.
 */
export default function SupportFormView({ ctx, theme, t }) {
  const { newFlow, setNewFlow, error, setError, goToConfirm, setView } = ctx
  const { darkMode, modalBg, border, text, muted, inputBg } = theme
  // Avant le retour anticipé : un hook ne se saute pas.
  const idRecherche = useId()
  const libelle = { fontSize:11, fontWeight:700, color:muted, letterSpacing:'0.07em', textTransform:'uppercase', marginBottom:6, display:'block' }

  const { category, target, searchQuery, searchResults, searchLoading, reasonKey, details, freeTitle } = newFlow
  if (!category) return null

  const reasons = REASON_SUBSETS[category.searchType] ?? []

  return (
    <div style={{ padding:'16px 18px 20px', display:'flex', flexDirection:'column', gap:14 }}>
      {error && <p style={{ fontSize:12, color:'var(--color-danger)', margin:0 }}>{error}</p>}

      {/* Flux signalement : search + reason */}
      {category.flow === 'report' && (
        <>
          {/* Search / target sélectionné */}
          {target ? (
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:10, background:darkMode ? 'var(--color-dark-surface)' : '#F0EDE4', border:`1px solid var(--color-warm-400)` }}>
              <span style={{ fontSize:20, flexShrink:0 }}>{target.emoji}</span>
              <span style={{ flex:1, fontSize:13, fontWeight:600, color:text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{target.label}</span>
              <Button
                variant="ghost"
                onClick={() => setNewFlow(f => ({ ...f, target:null, searchQuery:'', searchResults:[] }))}
                className="h-auto shrink-0 rounded-none bg-transparent p-0 text-[11px] font-semibold hover:bg-transparent"
                style={{ color: 'var(--color-warm-600)' }}>
                {t.changeTarget}
              </Button>
            </div>
          ) : (
            <div style={{ position:'relative' }}>
              <label htmlFor={idRecherche} style={libelle}>{t.cats[category.id]}</label>
              <div style={{ position:'relative' }}>
                <LuSearch size={14} style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:muted, pointerEvents:'none' }} />
                <input
                  id={idRecherche}
                  value={searchQuery}
                  onChange={e => setNewFlow(f => ({ ...f, searchQuery:e.target.value }))}
                  placeholder={t.searchPlaceholders[category.searchType]}
                  style={{ width:'100%', padding:'9px 12px 9px 32px', borderRadius:10, border:`1.5px solid ${border}`, background:inputBg, color:text, fontSize:13, outline:'none', fontFamily:'inherit', boxSizing:'border-box', transition:'border-color 0.15s' }}
                  onFocus={e => e.target.style.borderColor = 'var(--color-warm-400)'}
                  onBlur={e => e.target.style.borderColor = border}
                />
              </div>
              {searchQuery.trim() && (
                <div style={{ marginTop:4, borderRadius:10, border:`1px solid ${border}`, background:modalBg, overflow:'hidden' }}>
                  {searchLoading
                    ? <p style={{ padding:'10px 14px', fontSize:12, color:muted, margin:0 }}>{t.searchLoading}</p>
                    : searchResults.length === 0
                    ? <p style={{ padding:'10px 14px', fontSize:12, color:muted, margin:0 }}>{t.searchNoResults}</p>
                    : searchResults.map(r => (
                        <Button key={r.id} variant="ghost"
                          onClick={() => setNewFlow(f => ({ ...f, target:r, searchQuery:'', searchResults:[] }))}
                          className="h-auto w-full justify-start rounded-none bg-transparent px-3.5 py-2.5 text-left hover:bg-transparent"
                          style={{ gap: '10px', transition: 'background 0.12s' }}
                          onMouseEnter={e => e.currentTarget.style.background = darkMode ? 'var(--color-dark-surface)' : '#F5EDE0'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <span style={{ fontSize:16, flexShrink:0 }}>{r.emoji}</span>
                          <span style={{ fontSize:13, color:text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.label}</span>
                        </Button>
                      ))
                  }
                </div>
              )}
            </div>
          )}

          {/* Raison (sauf si fixée) */}
          {!category.fixedReason && reasons.length > 0 && (
            <div>
              <label style={{ fontSize:11, fontWeight:700, color:muted, letterSpacing:'0.07em', textTransform:'uppercase', marginBottom:8, display:'block' }}>{t.reasonLabel}</label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {reasons.map(rk => (
                  <Button key={rk} variant="ghost"
                    onClick={() => setNewFlow(f => ({ ...f, reasonKey:rk }))}
                    aria-pressed={reasonKey === rk}
                    className="h-auto rounded-lg border px-3 py-1 text-xs hover:bg-transparent"
                    style={{
                      borderColor: reasonKey === rk ? 'var(--color-warm-500)' : border,
                      background: reasonKey === rk ? 'rgba(212,106,16,0.10)' : 'transparent',
                      color: reasonKey === rk ? 'var(--color-warm-600)' : muted,
                      transition: 'all 0.15s',
                    }}>
                    {t.reasons[rk]}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Détails */}
          <Field label={t.detailsLabel} labelStyle={libelle}>
            <textarea value={details} onChange={e => setNewFlow(f => ({ ...f, details:e.target.value }))}
              placeholder={category.id === 'price_error' ? t.priceDetailsPlaceholder : t.detailsPlaceholder}
              rows={3} maxLength={MESSAGE_SUPPORT_MAX}
              style={{ width:'100%', borderRadius:10, border:`1.5px solid ${border}`, background:inputBg, color:text, fontSize:13, padding:'9px 12px', resize:'vertical', outline:'none', fontFamily:'inherit', boxSizing:'border-box', transition:'border-color 0.15s' }}
              onFocus={e => e.target.style.borderColor = 'var(--color-warm-400)'}
              onBlur={e => e.target.style.borderColor = border}
            />
          </Field>
        </>
      )}

      {/* Flux bug : titre fixe + description */}
      {category.flow === 'bug' && (
        <>
          <div style={{ padding:'9px 14px', borderRadius:10, background:darkMode ? 'var(--color-dark-surface)' : '#F0EDE4', border:`1px solid ${border}`, fontSize:13, color:text, fontWeight:600 }}>
            {category.emoji} {t.cats[category.id]}
          </div>
          <Field label={t.bugDescLabel} labelStyle={libelle}>
            <textarea value={details} onChange={e => setNewFlow(f => ({ ...f, details:e.target.value }))}
              placeholder={t.bugDescPlaceholder} rows={5} maxLength={MESSAGE_SUPPORT_MAX}
              style={{ width:'100%', borderRadius:10, border:`1.5px solid ${border}`, background:inputBg, color:text, fontSize:13, padding:'9px 12px', resize:'vertical', outline:'none', fontFamily:'inherit', boxSizing:'border-box', transition:'border-color 0.15s' }}
              onFocus={e => e.target.style.borderColor = 'var(--color-warm-400)'}
              onBlur={e => e.target.style.borderColor = border}
            />
          </Field>
        </>
      )}

      {/* Flux libre : titre + message */}
      {category.flow === 'free' && (
        <>
          <Field label={t.freeTitleLabel} labelStyle={libelle}>
            <input value={freeTitle} onChange={e => setNewFlow(f => ({ ...f, freeTitle:e.target.value }))}
              placeholder={t.freeTitlePlaceholder} maxLength={120}
              style={{ width:'100%', borderRadius:10, border:`1.5px solid ${border}`, background:inputBg, color:text, fontSize:13, padding:'9px 12px', outline:'none', fontFamily:'inherit', boxSizing:'border-box', transition:'border-color 0.15s' }}
              onFocus={e => e.target.style.borderColor = 'var(--color-warm-400)'}
              onBlur={e => e.target.style.borderColor = border}
            />
          </Field>
          <Field label={t.freeDescLabel} labelStyle={libelle}>
            <textarea value={details} onChange={e => setNewFlow(f => ({ ...f, details:e.target.value }))}
              placeholder={t.freeDescPlaceholder} rows={5} maxLength={MESSAGE_SUPPORT_MAX}
              style={{ width:'100%', borderRadius:10, border:`1.5px solid ${border}`, background:inputBg, color:text, fontSize:13, padding:'9px 12px', resize:'vertical', outline:'none', fontFamily:'inherit', boxSizing:'border-box', transition:'border-color 0.15s' }}
              onFocus={e => e.target.style.borderColor = 'var(--color-warm-400)'}
              onBlur={e => e.target.style.borderColor = border}
            />
          </Field>
        </>
      )}

      <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
        <Button
          variant="ghost"
          onClick={() => { setError(null); setView('cat') }}
          className="h-auto rounded-[10px] border-[1.5px] bg-transparent px-[18px] py-2.5 text-[13px] font-medium hover:bg-transparent"
          style={{ borderColor: border, color: text }}>
          {t.cancel}
        </Button>
        <Button
          onClick={goToConfirm}
          className="h-auto rounded-[10px] px-5 py-2.5 text-[13px] font-semibold text-white"
          style={{ background: 'linear-gradient(135deg,#2E4A6A,#1A2F48)' }}>
          {t.nextStep}
        </Button>
      </div>
    </div>
  )
}
