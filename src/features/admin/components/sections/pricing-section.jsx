// Phase H.1 : section admin pricing (read-only).
// Phase H.2 : édition modale + export JSON.
//
// Liste les ingrédients de la base avec leurs packs grande surface définis
// dans `pricing/<year>.json` (Phase D). Filtre par sous-cat + recherche +
// édition en mémoire + téléchargement du JSON modifié.
//
// Workflow d'édition (Option B — export local) :
//   1. L'admin clique « Éditer » sur une ligne → PricingEditModal s'ouvre
//   2. Il modifie les prix par lang × pack → onSave stocke dans `edits`
//   3. Le footer fixe affiche « X modifications non sauvegardées »
//   4. Clic « Télécharger pricing/<year>.json » → fichier généré et download
//   5. L'admin remplace le fichier dans le repo et commit (workflow standard
//      Phase D, déjà documenté dans `scripts/README.md`)
//
// Pourquoi pas BDD : le pricing change rarement (annuellement), un seul
// admin actif, workflow JSON déjà bien documenté. La BDD ajouterait migration
// SQL + RLS + sync sans bénéfice notable.

import { useEffect, useMemo, useRef, useState, useId } from 'react'
import { createPortal } from 'react-dom'
import { LuSearch, LuPackage, LuLanguages, LuCheck, LuMinus, LuPencil, LuDownload, LuRotateCcw } from 'react-icons/lu'
import { useIngredients } from '@shared/contexts/data-provider'
import { getPricingMeta } from '@shared/lib/pricing/pricing-resolver'
import { getFullIngredient } from '@shared/lib/ingredients/ingredient-schema'
import { mergePricingEdits, formatPricingForDownload, getDownloadFilename } from '@shared/lib/pricing/pricing-export'
import PricingEditModal from './pricing-edit-modal'
import { ConfirmActionModal } from '@shared/ui/confirm-dialog/confirm-modals'
import pricing2026 from '@shared/static/pricing/2026.json'
import Button from '@shared/ui/button'

const I18N = {
  fr: {
    title: 'Pricing — vue d\'ensemble',
    searchLabel: 'Rechercher un ingrédient',
    allSubcats: 'Toutes les sous-catégories',
    metaYear: 'Année',
    metaUpdated: 'Dernière mise à jour',
    metaSource: 'Source',
    columnId: 'ID',
    columnLabel: 'Nom',
    columnSubcat: 'Sous-catégorie',
    columnCoverage: 'Couverture langues',
    columnPacks: 'Packs (FR)',
    noResults: 'Aucun ingrédient correspondant.',
    counter: '{{n}} ingrédient(s) affiché(s)',
    coverageHelp: 'Une coche par langue (FR/EN/ES/DE/JA) si l\'ingrédient a au moins un pack défini dans cette langue.',
    edit: 'Éditer',
    columnActions: 'Actions',
    pendingChanges: '{{n}} modification(s) non sauvegardée(s)',
    download: 'Télécharger pricing.json',
    reset: 'Réinitialiser',
    confirmReset: 'Annuler toutes les modifications non sauvegardées ?',
    workflowHint: 'Après téléchargement, remplace `src/shared/static/pricing/2026.json` dans le repo et commit pour appliquer les modifications.',
    srSaved: 'Modifications enregistrées pour {{label}}.',
    srReset: 'Toutes les modifications ont été annulées.',
    srDownloaded: 'Fichier {{filename}} téléchargé.',
  },
  en: {
    title: 'Pricing — overview',
    searchLabel: 'Search an ingredient',
    allSubcats: 'All subcategories',
    metaYear: 'Year',
    metaUpdated: 'Last updated',
    metaSource: 'Source',
    columnId: 'ID',
    columnLabel: 'Name',
    columnSubcat: 'Subcategory',
    columnCoverage: 'Language coverage',
    columnPacks: 'Packs (FR)',
    noResults: 'No matching ingredient.',
    counter: '{{n}} ingredient(s) shown',
    coverageHelp: 'One check per language (FR/EN/ES/DE/JA) if the ingredient has at least one pack defined in that language.',
    edit: 'Edit',
    columnActions: 'Actions',
    pendingChanges: '{{n}} unsaved change(s)',
    download: 'Download pricing.json',
    reset: 'Reset',
    confirmReset: 'Discard all unsaved changes?',
    workflowHint: 'After download, replace `src/shared/static/pricing/2026.json` in the repo and commit to apply changes.',
    srSaved: 'Changes saved for {{label}}.',
    srReset: 'All changes have been reset.',
    srDownloaded: 'File {{filename}} downloaded.',
  },
}

const LANGS = ['fr', 'en', 'es', 'de', 'ja']

export default function PricingSection({ lang = 'fr', darkMode = false }) {
  const t = I18N[lang] ?? I18N.fr
  const ingredientsByCat = useIngredients()

  const [query, setQuery] = useState('')
  const rechercheId = useId()
  const [subcatFilter, setSubcatFilter] = useState('all')

  // Édition en mémoire. `edits` est un Map { id: newPacksByLang }
  // qui override les packs du JSON pour les ingrédients modifiés. Stocké
  // dans le state local, perdu si la session admin se ferme avant download.
  // Pas de persistance côté client (sessionStorage/localStorage) pour ne pas
  // garder de données pricing en cache local par accident.
  const [edits,            setEdits]            = useState({})
  const [editingId,        setEditingId]        = useState(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  // Annonce screen reader pour les changements de state hors-écran
  // (modale qui save, download terminé, reset). Vidé après un court délai
  // pour permettre la prochaine annonce.
  const [srAnnouncement, setSrAnnouncement] = useState('')

  // Liste plate des ingrédients avec couverture par langue.
  // Inclut les `edits` en mémoire pour refléter les modifs non sauvegardées
  // dans la liste (le prix affiché reflète l'édition en cours).
  const allRows = useMemo(() => {
    if (!ingredientsByCat) return []
    const out = []
    const seen = new Set()
    for (const [subcat, items] of Object.entries(ingredientsByCat)) {
      if (!Array.isArray(items)) continue
      if (subcat === 'bof') continue
      for (const item of items) {
        if (!item?.id || seen.has(item.id)) continue
        seen.add(item.id)
        const full = getFullIngredient(item.id, lang)
        if (!full) continue
        // Si l'ingrédient a été édité, utiliser les packs édités pour l'affichage
        const editedPacks = edits[item.id]?.[lang]
        const displayPacks = editedPacks ?? full.packs
        const byLangCoverage = {}
        for (const l of LANGS) byLangCoverage[l] = full.labels?.[l] ? !!(full.packs?.length && full.hasSpecificPacks) : false
        out.push({
          id: item.id,
          label: item.labels?.[lang] ?? item.labels?.fr ?? item.id,
          subcat,
          packs: displayPacks ?? [],
          hasSpecific: full.hasSpecificPacks,
          byLangCoverage,
          isEdited: !!edits[item.id],
        })
      }
    }
    return out
  }, [ingredientsByCat, lang, edits])

  const editsCount = Object.keys(edits).length

  function handleOpenEdit(id) {
    setEditingId(id)
  }

  function handleCloseEdit() {
    setEditingId(null)
  }

  // Petit toggle pour forcer le re-render même si même message. Le timer est
  // nettoyé au démontage, sinon il se déclenche après le teardown de jsdom
  // (`window is not defined`, cf. shopping-lists-modal).
  const srTimerRef = useRef(null)
  useEffect(() => () => clearTimeout(srTimerRef.current), [])

  function announceSr(msg) {
    setSrAnnouncement('')
    clearTimeout(srTimerRef.current)
    srTimerRef.current = setTimeout(() => setSrAnnouncement(msg), 50)
  }

  function handleSaveEdit(newPacks) {
    const editingLabel = allRows.find(r => r.id === editingId)?.label ?? editingId
    setEdits(prev => ({ ...prev, [editingId]: newPacks }))
    setEditingId(null)
    announceSr(t.srSaved.replace('{{label}}', editingLabel))
  }

  function handleReset() {
    if (editsCount === 0) return
    setShowResetConfirm(true)
  }

  function confirmReset() {
    setShowResetConfirm(false)
    setEdits({})
    announceSr(t.srReset)
  }

  function handleDownload() {
    // utilise les helpers purs testés (cf. pricingExport.test.js).
    const merged = mergePricingEdits(pricing2026, edits)
    const blob = new Blob([formatPricingForDownload(merged)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = getDownloadFilename(merged)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    announceSr(t.srDownloaded.replace('{{filename}}', a.download))
  }

  // Récupère les packs courants (édités ou originaux) pour la modale.
  function getCurrentPacksForEdit(id) {
    if (edits[id]) return edits[id]
    const fromJson = pricing2026.prices?.[id]
    if (fromJson) return fromJson
    // Fallback : si pas dans JSON, on prend les packs résolus (qui peuvent
    // venir du fallback subcat — l'admin pourra alors créer une vraie entrée)
    const full = getFullIngredient(id, 'fr')
    const empty = { fr: [], en: [], es: [], de: [], ja: [] }
    if (full?.hasSpecificPacks) {
      // Cas rare : packs en JS mais pas en JSON (devrait être tout en JSON v3.30+)
      empty.fr = full.packs ?? []
    }
    return empty
  }

  const editingIngredient = editingId
    ? allRows.find(r => r.id === editingId) ?? null
    : null

  // Liste des sous-catégories pour le filtre dropdown.
  const subcats = useMemo(() => {
    const set = new Set(allRows.map(r => r.subcat))
    return [...set].sort()
  }, [allRows])

  // Filtrage par recherche + sous-cat.
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allRows.filter(r => {
      if (subcatFilter !== 'all' && r.subcat !== subcatFilter) return false
      if (!q) return true
      return r.id.toLowerCase().includes(q) || r.label.toLowerCase().includes(q)
    })
  }, [allRows, query, subcatFilter])

  const meta = getPricingMeta()

  // Couleurs adaptatives.
  const bg     = darkMode ? '#0E1420' : '#FFFFFF'
  const fg     = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  // Le jeton atténué commun : rgba(44,26,14,0.55) donnait #8B817A sur blanc,
  // 3,8:1 — 31 cellules du tableau sous le seuil (audit A11Y-03, 2026-10-08).
  const muted  = 'var(--color-muted)'
  const border = darkMode ? 'rgba(247,168,94,0.20)' : 'rgba(212,106,16,0.18)'
  const hover  = darkMode ? 'rgba(247,168,94,0.06)' : 'rgba(212,106,16,0.04)'
  const inputBg= darkMode ? '#1A2535' : '#FAF6EE'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {showResetConfirm && createPortal(
        <ConfirmActionModal
          darkMode={darkMode}
          title="Réinitialiser les modifications ?"
          body={`${editsCount} modification(s) non sauvegardée(s) seront annulées.`}
          confirmLabel="Réinitialiser"
          cancelLabel="Annuler"
          onConfirm={confirmReset}
          onCancel={() => setShowResetConfirm(false)}
        />,
        document.body
      )}

      {/* Live region pour annonces screen reader (sr-only) */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute', width: '1px', height: '1px',
          padding: 0, margin: '-1px', overflow: 'hidden',
          clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
        }}
      >
        {srAnnouncement}
      </div>

      {/* ─── Méta du pricing actif ─── */}
      {meta && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '14px',
          padding: '10px 14px',
          background: darkMode ? 'rgba(247,168,94,0.04)' : 'rgba(212,106,16,0.03)',
          border: `1px solid ${border}`,
          borderRadius: '8px',
          fontSize: '12px',
        }}>
          <span><strong style={{ color: 'var(--color-warm-600)' }}>{t.metaYear} :</strong> {meta.year}</span>
          <span><strong style={{ color: 'var(--color-warm-600)' }}>{t.metaUpdated} :</strong> {meta.lastUpdated}</span>
          <span style={{ color: muted, fontStyle: 'italic' }}>{meta.source}</span>
        </div>
      )}

      {/* ─── Filtres ─── */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {/* Libellé visible à gauche du cadre (décision du 2026-10-06). */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 280px', minWidth: 0 }}>
          <label htmlFor={rechercheId} style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>{t.searchLabel}</label>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            flex: 1, minWidth: 0,
            padding: '8px 12px', background: inputBg,
            border: `1px solid ${border}`, borderRadius: '8px',
          }}>
            <LuSearch size={14} aria-hidden="true" style={{ color: muted, flexShrink: 0 }} />
            <input
              id={rechercheId}
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{
                flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
                fontSize: '13px', color: fg, fontFamily: 'inherit',
              }}
            />
          </div>
        </div>
        <select
          value={subcatFilter}
          onChange={e => setSubcatFilter(e.target.value)}
          aria-label={t.allSubcats}
          style={{
            padding: '8px 12px', background: inputBg,
            border: `1px solid ${border}`, borderRadius: '8px',
            fontSize: '13px', color: fg, fontFamily: 'inherit',
            minWidth: '180px',
          }}
        >
          <option value="all">{t.allSubcats}</option>
          {subcats.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* ─── Compteur ─── */}
      <div style={{ fontSize: '12px', color: muted }}>
        {t.counter.replace('{{n}}', filteredRows.length)}
      </div>

      {/* ─── Tableau ─── */}
      {filteredRows.length === 0 ? (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: muted, fontSize: '14px' }}>
          {t.noResults}
        </div>
      ) : (
        <div style={{
          background: bg, border: `1px solid ${border}`, borderRadius: '10px',
          overflow: 'hidden', overflowX: 'auto',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{
                background: darkMode ? 'rgba(247,168,94,0.04)' : 'rgba(212,106,16,0.03)',
                borderBottom: `1px solid ${border}`,
              }}>
                <th style={thStyle(fg)}>{t.columnId}</th>
                <th style={thStyle(fg)}>{t.columnLabel}</th>
                <th style={thStyle(fg)}>{t.columnSubcat}</th>
                <th style={{ ...thStyle(fg), textAlign: 'center' }} title={t.coverageHelp}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <LuLanguages size={12} aria-hidden="true" /> {t.columnCoverage}
                  </span>
                </th>
                <th style={thStyle(fg)}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <LuPackage size={12} aria-hidden="true" /> {t.columnPacks}
                  </span>
                </th>
                <th style={{ ...thStyle(fg), textAlign: 'right' }}>{t.columnActions}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(r => (
                <tr key={r.id} style={{ borderBottom: `1px solid ${border}` }}
                    onMouseEnter={e => e.currentTarget.style.background = hover}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ ...tdStyle(muted), fontFamily: 'monospace', fontSize: '11px' }}>{r.id}</td>
                  <td style={tdStyle(fg)}>{r.label}</td>
                  <td style={{ ...tdStyle(muted), fontSize: '11px' }}>{r.subcat}</td>
                  <td style={{ ...tdStyle(fg), textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {LANGS.map(l => (
                      <span key={l} title={l} style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: '20px', marginRight: '2px',
                        color: r.byLangCoverage[l] ? 'var(--color-warm-600)' : 'rgba(127,127,127,0.4)',
                      }}>
                        {r.byLangCoverage[l]
                          ? <LuCheck size={12} aria-label="ok" />
                          : <LuMinus size={12} aria-label="missing" />}
                      </span>
                    ))}
                  </td>
                  <td style={{ ...tdStyle(fg), fontSize: '11px' }}>
                    {r.packs.length > 0 ? (
                      r.hasSpecific
                        ? r.packs.map(p => `${p.size}${p.unit} (~${p.price}€)`).join(' · ')
                        : <span style={{ color: muted, fontStyle: 'italic' }}>fallback subcat</span>
                    ) : (
                      <span style={{ color: muted }}>—</span>
                    )}
                    {r.isEdited && (
                      <span style={{
                        marginLeft: '8px', fontSize: '10px',
                        padding: '2px 6px', borderRadius: '4px',
                        background: 'rgba(247,168,94,0.20)',
                        color: 'var(--color-warm-600)',
                        fontWeight: 700,
                      }}>
                        edited
                      </span>
                    )}
                  </td>
                  <td style={{ ...tdStyle(fg), textAlign: 'right' }}>
                    <Button
                      variant="ghost"
                      onClick={() => handleOpenEdit(r.id)}
                      aria-label={`${t.edit} ${r.label}`}
                      className="inline-flex h-auto rounded-md border bg-transparent px-2.5 py-1 text-[11px] font-semibold hover:bg-transparent"
                      style={{ gap: '4px', borderColor: border, color: fg }}
                    >
                      <LuPencil size={11} aria-hidden="true" />
                      {t.edit}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Footer fixe : modifs non sauvegardées + actions ─── */}
      {editsCount > 0 && (
        <div
          role="region"
          aria-label={t.pendingChanges.replace('{{n}}', editsCount)}
          style={{
          position: 'sticky', bottom: 0, zIndex: 10,
          marginTop: '8px',
          padding: '12px 14px',
          background: darkMode ? '#1A2535' : '#FDFAF6',
          border: `1px solid ${border}`,
          borderRadius: '10px',
          boxShadow: darkMode
            ? '0 -4px 16px rgba(0,0,0,0.45)'
            : '0 -4px 16px rgba(212,106,16,0.12)',
          display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: fg }}>
              {t.pendingChanges.replace('{{n}}', editsCount)}
            </div>
            <div style={{ fontSize: '11px', color: muted, marginTop: '2px' }}>
              {t.workflowHint}
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={handleReset}
            className="inline-flex h-auto rounded-lg border bg-transparent px-3 py-2 text-xs font-semibold hover:bg-transparent"
            style={{ gap: '6px', borderColor: border, color: fg }}
          >
            <LuRotateCcw size={12} aria-hidden="true" />
            {t.reset}
          </Button>
          <Button
            onClick={handleDownload}
            className="inline-flex h-auto rounded-lg bg-gradient-to-br from-[#F7A85E] to-[#D46A10] px-3.5 py-2 text-[13px] font-bold shadow-[0_2px_8px_rgba(212,106,16,0.30)]"
            style={{ gap: '6px', color: '#2C1A0E' }}
          >
            <LuDownload size={14} aria-hidden="true" />
            {t.download}
          </Button>
        </div>
      )}

      {/* ─── Modale d'édition ─── */}
      {editingId && editingIngredient && (
        <PricingEditModal
          ingredient={editingIngredient}
          currentPacks={getCurrentPacksForEdit(editingId)}
          onSave={handleSaveEdit}
          onClose={handleCloseEdit}
          lang={lang}
          darkMode={darkMode}
        />
      )}
    </div>
  )
}

const thStyle = (fg) => ({
  padding: '8px 12px', textAlign: 'left',
  fontSize: '11px', fontWeight: 700,
  color: fg, textTransform: 'uppercase', letterSpacing: '0.04em',
})

const tdStyle = (fg) => ({
  padding: '8px 12px', color: fg, verticalAlign: 'middle',
})
