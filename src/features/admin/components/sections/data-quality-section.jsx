import { useEffect, useMemo, useState, useRef, useId } from 'react'
import { LuRefreshCw, LuExternalLink, LuSearch, LuX, LuDownload, LuShieldCheck, LuShieldAlert } from 'react-icons/lu'
import { adminGetHealthChecks } from '@features/admin/api/admin'
import Button from '@shared/ui/button'
import FilterPill from '@shared/ui/filter-pill'
import EmptyState from '@shared/ui/empty-state'
import ImportQueueTab from './import-queue-tab'
import { formatDate } from '@shared/lib/format-date'
import { useReloader } from '@shared/hooks/use-reloader'
import { texteLisible, fondTeinte } from '@shared/lib/couleurs/texte-lisible'

// Catalog des issues Data Quality v2 (Sprint 8). Couvre 5 dimensions :
// Completeness / Accuracy / Validity / Consistency / Uniqueness.
const ISSUE_LABELS = {
  // Completeness — champs essentiels présents
  no_ingredients:       'Aucun ingrédient',
  missing_emoji:        'Emoji manquant',
  missing_desc_fr:      'Description FR manquante',
  missing_desc_en:      'Description EN manquante',
  missing_steps:        'Étapes manquantes',
  missing_country:      'Pays manquant',
  missing_label_fr:     'Label FR manquant',
  missing_label_en:     'Label EN manquant',
  missing_nutrition:    'Nutrition manquante',
  missing_pack_size:    'Conditionnement manquant',
  missing_default_unit: 'Unité par défaut manquante',
  missing_price:        'Prix manquant',
  // Accuracy — valeurs plausibles
  invalid_servings:     'Portions invalides',
  invalid_time:         'Temps invalide',
  price_outlier:        'Prix aberrant',
  // Validity — règles métier
  steps_too_short:                 'Étapes trop courtes (< 3)',
  ingredient_slots_missing_qty:    'Ingrédients sans quantité',
  // Consistency — pas de contradictions
  orphan_ingredients:              'Ingrédients introuvables (orphelins)',
  diet_inconsistent:               'Régime incohérent avec ingrédients',
  missing_diet_allergens:          'Régime + allergènes vides',
  nutrition_zero_kcal_inconsistent: 'Calories à 0 mais macros présentes',
  nutrition_macros_inconsistent:    'Calories vs macros (±30 %) incohérent',
  // Uniqueness — pas de doublons
  duplicate_name_fr:    'Nom FR en doublon',
  duplicate_label_fr:   'Label FR en doublon',
}

const ISSUE_SEVERITY = {
  // Critical — empêche l'utilisation correcte de la donnée
  no_ingredients:       'critical',
  invalid_servings:     'critical',
  invalid_time:         'critical',
  missing_desc_fr:      'critical',
  missing_label_fr:     'critical',
  orphan_ingredients:   'critical',
  diet_inconsistent:    'critical',
  // Medium — dégrade l'expérience sans la bloquer
  missing_steps:                    'medium',
  missing_country:                  'medium',
  missing_diet_allergens:           'medium',
  missing_desc_en:                  'medium',
  missing_label_en:                 'medium',
  missing_pack_size:                'medium',
  missing_price:                    'medium',
  steps_too_short:                  'medium',
  ingredient_slots_missing_qty:     'medium',
  price_outlier:                    'medium',
  nutrition_zero_kcal_inconsistent: 'medium',
  nutrition_macros_inconsistent:    'medium',
  duplicate_name_fr:                'medium',
  duplicate_label_fr:               'medium',
  // Low — cosmétique
  missing_default_unit: 'low',
  missing_nutrition:    'low',
  missing_emoji:        'low',
}

const ISSUE_COLORS = {
  // Critical (rouge)
  no_ingredients:      'var(--color-danger)',
  invalid_servings:    'var(--color-danger)',
  invalid_time:        'var(--color-danger)',
  missing_desc_fr:     'var(--color-danger)',
  missing_label_fr:    'var(--color-danger)',
  orphan_ingredients:  'var(--color-danger)',
  diet_inconsistent:   'var(--color-danger)',
  // Medium (orange)
  missing_steps:                    'var(--color-warning)',
  missing_country:                  'var(--color-warning)',
  missing_diet_allergens:           'var(--color-warning)',
  missing_pack_size:                'var(--color-warning)',
  missing_price:                    'var(--color-warning)',
  steps_too_short:                  'var(--color-warning)',
  ingredient_slots_missing_qty:     'var(--color-warning)',
  price_outlier:                    'var(--color-warning)',
  nutrition_zero_kcal_inconsistent: 'var(--color-warning)',
  nutrition_macros_inconsistent:    'var(--color-warning)',
  duplicate_name_fr:                'var(--color-warning)',
  duplicate_label_fr:               'var(--color-warning)',
  // Low (gris)
  missing_default_unit: '#7A8298',
  missing_nutrition:    '#7A8298',
  missing_emoji:        '#7A8298',
  default:              '#7A8298',
}

const SEVERITY_CFG = {
  critical: { label: 'Critique', color: 'var(--color-danger)', bg: 'rgba(220,38,38,0.1)'  },
  medium:   { label: 'Moyen',    color: 'var(--color-warning)', bg: 'rgba(217,119,6,0.1)'  },
  low:      { label: 'Faible',   color: '#7A8298', bg: 'rgba(122,130,152,0.1)'},
}

const AUTO_REFRESH_MS = 5 * 60 * 1000

function getItemSeverity(item) {
  const issues = item.issues ?? []
  if (issues.some(k => ISSUE_SEVERITY[k] === 'critical')) return 'critical'
  if (issues.some(k => ISSUE_SEVERITY[k] === 'medium'))   return 'medium'
  return 'low'
}

function fmtDate(str, lang = 'fr') { return str ? formatDate(str, lang) : '' }

// Une ligne : un vrai bouton quand elle ouvre un éditeur (audit du 2026-10-04,
// ADM-19 d : c'était une `div` cliquable, hors de l'ordre de tabulation, dont
// le curseur promettait un clic même sans éditeur à ouvrir) ; un bloc sinon.
function LigneDeQualite({ ouvrir, style, bordure, children }) {
  if (!ouvrir) return <div style={style}>{children}</div>
  return (
    <Button variant="ghost" onClick={ouvrir}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-brand-500)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = bordure }}
      className="h-auto w-full items-stretch justify-start text-left font-normal hover:bg-transparent" style={style}>
      {children}
    </Button>
  )
}

function fmtTime(date) {
  if (!date) return '—'
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function scoreColor(pct) {
  if (pct === 100) return 'var(--color-success)'
  if (pct >= 95)   return '#65A30D'
  if (pct >= 80)   return 'var(--color-warning)'
  return 'var(--color-danger)'
}

function exportCSV(items, label) {
  const headers = ['id', 'nom', 'issues', 'derniere_maj']
  const rows = items.map(it => [
    it.id ?? '',
    (it.name_fr ?? it.label_fr ?? '').replace(/,/g, ' '),
    (it.issues ?? []).join(' | '),
    fmtDate(it.updated_at),
  ])
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `qualite-${label}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function DataQualitySection({
  darkMode = false,
  onEditRecipe,
  onEditIngredient,
}) {
  const [activeTab,        setActiveTab]        = useState('recipes')
  const [recipes,          setRecipes]          = useState([])
  const [ingredients,      setIngredients]      = useState([])
  const [totalRecipes,     setTotalRecipes]     = useState(0)
  const [totalIngredients, setTotalIngredients] = useState(0)
  const [search,           setSearch]           = useState('')
  const rechercheId = useId()
  const [severityFilter,   setSeverityFilter]   = useState('all')
  const [lastChecked,      setLastChecked]       = useState(null)
  // `adminGetHealthChecks` remonte l'erreur Supabase ; sans elle, une requête en
  // échec renvoie des listes vides que le score interprétait comme « 100 % sain ».
  const [loadError,        setLoadError]         = useState(null)
  const timerRef = useRef(null)

  const fg     = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted  = darkMode ? '#A0A8B8' : '#7A6A52'
  const border = darkMode ? 'var(--color-dark-border)' : 'var(--color-border-warm)'
  const rowBg  = darkMode ? '#1A2F48' : '#FFFFFF'

  // `useReloader` garantit le `finally` (sans lui, une erreur réseau laissait
  // le voyant allumé pour toujours) et périme les réponses en retard : sans ça,
  // enchaîner deux rechargements laissait le plus ancien écraser le plus récent.
  // Il lance aussi le premier chargement — l'effet ci-dessous n'arme plus que
  // le rafraîchissement automatique.
  const { loading, error: erreurChargement, reload } = useReloader(async (estObsolete) => {
    const { recipes: r, ingredients: i, totalRecipes: tr, totalIngredients: ti, error } = await adminGetHealthChecks()
    if (estObsolete()) return
    setLoadError(error ?? null)
    setRecipes(r)
    setIngredients(i)
    setTotalRecipes(tr)
    setTotalIngredients(ti)
    setLastChecked(new Date())
  }, [])

  // Rafraîchissement automatique seulement si quelqu'un regarde : onglet du
  // navigateur visible ET listes affichées (pas le sous-onglet Import). Au retour
  // sur l'onglet, une lecture rattrape le retard si la dernière date de plus de
  // AUTO_REFRESH_MS — avant, les deux vues de santé repartaient toutes les cinq
  // minutes, onglet masqué ou non (audit du 2026-10-04, ADM-12 (3)).
  const dernierControleRef = useRef(null)
  useEffect(() => { dernierControleRef.current = lastChecked }, [lastChecked])
  const listesAffichees = activeTab !== 'imports'
  useEffect(() => {
    if (!listesAffichees) return undefined
    const visible = () => document.visibilityState !== 'hidden'
    const auTic = () => { if (visible()) reload() }
    const auRetour = () => {
      if (!visible()) return
      const depuis = Date.now() - (dernierControleRef.current?.getTime() ?? 0)
      if (depuis >= AUTO_REFRESH_MS) reload()
    }
    timerRef.current = setInterval(auTic, AUTO_REFRESH_MS)
    document.addEventListener('visibilitychange', auRetour)
    return () => {
      clearInterval(timerRef.current)
      document.removeEventListener('visibilitychange', auRetour)
    }
  }, [reload, listesAffichees])

  const items = activeTab === 'recipes' ? recipes : ingredients
  // eslint-disable-next-line no-unused-vars
  const total = activeTab === 'recipes' ? totalRecipes : totalIngredients

  const counts = useMemo(() => ({
    all:      items.length,
    critical: items.filter(i => getItemSeverity(i) === 'critical').length,
    medium:   items.filter(i => getItemSeverity(i) === 'medium').length,
    low:      items.filter(i => getItemSeverity(i) === 'low').length,
  }), [items])

  const filtered = useMemo(() => {
    let list = items
    if (severityFilter !== 'all') list = list.filter(i => getItemSeverity(i) === severityFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(it => {
        const label = (it.name_fr ?? it.label_fr ?? it.id ?? '').toLowerCase()
        return label.includes(q) || (it.issues ?? []).some(k => (ISSUE_LABELS[k] ?? k).toLowerCase().includes(q))
      })
    }
    return list
  }, [items, severityFilter, search])

  // Score de santé : % d'items sans problème
  const recipeScore = totalRecipes  > 0 ? Math.round((1 - recipes.length     / totalRecipes)     * 100) : 100
  const ingScore    = totalIngredients > 0 ? Math.round((1 - ingredients.length / totalIngredients) * 100) : 100
  // En cas d'échec, les listes sont vides pour une raison qui n'a rien à voir
  // avec la qualité des données : ne jamais en déduire un score.
  // Une lecture qui LÈVE (un comptage, depuis le 2026-10-05) rejoint le même bandeau.
  const erreurAnalyse = loadError ?? erreurChargement
  const globalOk    = !erreurAnalyse && recipeScore === 100 && ingScore === 100

  const SEVERITY_FILTERS = [
    { key: 'all',      label: `Tous (${counts.all})` },
    { key: 'critical', label: `Critique (${counts.critical})`, color: 'var(--color-danger)' },
    { key: 'medium',   label: `Moyen (${counts.medium})`,     color: 'var(--color-warning)' },
    { key: 'low',      label: `Faible (${counts.low})`,       color: '#7A8298' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Échec de l'analyse ──────────────────────────────────────────
          Prioritaire sur le score : listes vides ≠ données saines. */}
      {activeTab !== 'imports' && erreurAnalyse && (
        <div role="alert" style={{
          display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 12,
          background: darkMode ? 'rgba(220,38,38,0.10)' : 'rgba(220,38,38,0.06)',
          border: `1px solid ${darkMode ? 'rgba(220,38,38,0.35)' : 'rgba(220,38,38,0.20)'}`,
          alignItems: 'flex-start',
        }}>
          <LuShieldAlert size={20} color="var(--color-danger)" style={{ flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-danger)' }}>
              Analyse impossible
            </span>
            <span style={{ fontSize: 12, color: muted }}>
              Les indicateurs ci-dessous ne reflètent pas l’état réel des données.
              {erreurAnalyse.message ? ` (${erreurAnalyse.message})` : ''}
            </span>
          </div>
        </div>
      )}

      {/* ── Score de santé global ───────────────────────────────────── */}
      {activeTab !== 'imports' && !erreurAnalyse && (
        <div style={{
          display: 'flex', gap: 10, padding: '12px 14px',
          borderRadius: 12,
          background: globalOk
            ? (darkMode ? 'rgba(22,163,74,0.12)' : 'rgba(22,163,74,0.07)')
            : (darkMode ? 'rgba(220,38,38,0.10)' : 'rgba(220,38,38,0.06)'),
          border: `1px solid ${globalOk
            ? (darkMode ? 'rgba(22,163,74,0.35)' : 'rgba(22,163,74,0.25)')
            : (darkMode ? 'rgba(220,38,38,0.35)' : 'rgba(220,38,38,0.20)')}`,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            {globalOk
              ? <LuShieldCheck size={20} color="var(--color-success)" />
              : <LuShieldAlert  size={20} color="var(--color-danger)" />
            }
            <span style={{ fontSize: 13, fontWeight: 700, color: texteLisible(globalOk ? 'var(--color-success)' : 'var(--color-danger)') }}>
              {globalOk ? 'Qualité parfaite' : 'Problèmes détectés'}
            </span>
          </div>

          {/* Badges recettes + ingrédients */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { label: 'Recettes',     score: recipeScore,  issues: recipes.length,     total: totalRecipes },
              { label: 'Ingrédients',  score: ingScore,     issues: ingredients.length, total: totalIngredients },
            ].map(({ label, score, issues }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '3px 10px', borderRadius: 20,
                background: darkMode ? 'rgba(0,0,0,0.20)' : 'rgba(255,255,255,0.60)',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              }}>
                <span style={{ fontSize: 12, color: muted }}>{label}</span>
                <span style={{
                  fontSize: 13, fontWeight: 800, color: texteLisible(scoreColor(score)),
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {score}%
                </span>
                {issues > 0 && (
                  <span style={{ fontSize: 11, color: texteLisible('var(--color-warning)') }}>({issues} ⚠)</span>
                )}
              </div>
            ))}
          </div>

          {/* Timestamp + auto-refresh hint */}
          <div style={{ fontSize: 11, color: muted, whiteSpace: 'nowrap' }}>
            {lastChecked ? `Actualisé à ${fmtTime(lastChecked)}` : '…'} · auto 5 min
          </div>
        </div>
      )}

      {/* ── Onglets + actions ──────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {[
          ['recipes',     '🍳 Recettes',    recipes.length],
          ['ingredients', '🥬 Ingrédients', ingredients.length],
          ['imports',     '📥 Import',      null],
        ].map(([key, label, count]) => (
          <Button
            key={key}
            variant="ghost"
            aria-pressed={activeTab === key}
            onClick={() => { setActiveTab(key); setSeverityFilter('all'); setSearch('') }}
            className="h-auto rounded-lg border px-3 py-1.5 text-[13px] hover:bg-transparent"
            style={{
              gap: 7,
              borderColor: activeTab === key ? 'var(--color-brand-500)' : border,
              // Texte blanc : l'orange profond (`--gradient-deep`, décision du 2026-10-06) —
              // sur l'orange de marque, le blanc tombait à 3,05:1 (A11Y-03).
              background: activeTab === key ? 'var(--gradient-deep)' : 'transparent',
              color: activeTab === key ? '#FFF' : muted,
              fontWeight: activeTab === key ? 700 : 500,
            }}
          >
            {label}
            {count !== null && (
              <span style={{ padding: '1px 6px', borderRadius: 10, background: activeTab === key ? 'rgba(255,255,255,0.25)' : (darkMode ? '#2A4060' : 'var(--color-bg-warm)'), fontSize: 12 }}>{count}</span>
            )}
          </Button>
        ))}

        {/* Bouton exporter CSV */}
        <Button
          variant="ghost"
          onClick={() => exportCSV(filtered, activeTab)}
          disabled={filtered.length === 0}
          title="Exporter les issues en CSV"
          className="h-auto rounded-lg border bg-transparent px-2.5 py-1.5 text-xs hover:bg-transparent"
          style={{ gap: 5, borderColor: border, color: muted }}
        >
          <LuDownload size={13} />
          CSV
        </Button>

        <Button
          variant="ghost"
          onClick={reload}
          disabled={loading}
          className="ml-auto h-auto rounded-lg border bg-transparent px-3 py-1.5 text-xs hover:bg-transparent"
          style={{ gap: 6, borderColor: border, color: muted }}
        >
          <LuRefreshCw size={13} className={loading ? 'animate-spin' : undefined} />
          Recharger
        </Button>
      </div>

      {/* ── Filtres sévérité ───────────────────────────────────────── */}
      {activeTab !== 'imports' && items.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {SEVERITY_FILTERS.map(f => (
            <FilterPill
              key={f.key}
              active={severityFilter === f.key}
              color={f.color ?? 'var(--color-brand-500)'}
              onClick={() => setSeverityFilter(f.key)}
              border={border}
              muted={muted}
            >
              {f.label}
            </FilterPill>
          ))}
        </div>
      )}

      {/* ── Recherche ─────────────────────────────────────────────── */}
      {activeTab !== 'imports' && (
        <div>
          <label htmlFor={rechercheId} style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', marginBottom: 4 }}>Filtrer par nom ou type de problème</label>
          <div style={{ position: 'relative' }}>
            <LuSearch size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: muted, pointerEvents: 'none' }} />
            <input
              id={rechercheId}
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '7px 32px 7px 30px', borderRadius: 8, border: `1px solid ${border}`, background: darkMode ? '#141F2E' : '#FFF', color: fg, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
            {search && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSearch('')}
                aria-label="Effacer la recherche"
                className="absolute right-2 top-1/2 h-auto w-auto -translate-y-1/2 bg-transparent p-0.5 hover:bg-transparent"
                style={{ color: muted }}
              >
                <LuX size={13} />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── Liste ─────────────────────────────────────────────────── */}
      {activeTab === 'imports' ? (
        <ImportQueueTab darkMode={darkMode} />
      ) : loading ? (
        <div style={{ padding: '24px', color: muted, textAlign: 'center', fontSize: 13 }}>Chargement…</div>
      ) : filtered.length === 0 ? (
        items.length === 0
          ? <EmptyState variant="card" icon="🎉" muted={muted} border={border} cardBg={rowBg}>Aucun problème détecté !</EmptyState>
          : <EmptyState variant="card" muted={muted} border={border} cardBg={rowBg}>Aucun résultat pour ce filtre.</EmptyState>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(item => {
            const severity = getItemSeverity(item)
            const sev = SEVERITY_CFG[severity]
            const ouvrir = activeTab === 'recipes' && onEditRecipe ? () => onEditRecipe(item.id, item.origin)
              : activeTab === 'ingredients' && onEditIngredient ? () => onEditIngredient(item.id)
              : null
            return (
              <LigneDeQualite key={item.id} ouvrir={ouvrir} bordure={border}
                style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', borderRadius: 10, background: rowBg, border: `1px solid ${border}`, transition: 'border-color 0.15s' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                    <span style={{ padding: '2px 8px', borderRadius: 8, background: sev.bg, color: texteLisible(sev.color), fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{sev.label}</span>
                    {/* Badge origine recette (community = jaune, official = neutre).
                        Sprint 8 Qualité v2 : permet à l'admin de distinguer
                        en un coup d'œil les recettes user-published. */}
                    {item.origin === 'community' && (
                      <span style={{
                        padding: '2px 6px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                        background: darkMode ? 'rgba(217,119,6,0.18)' : 'rgba(217,119,6,0.12)',
                        color: texteLisible('var(--color-warning)'), flexShrink: 0,
                      }} title="Recette publiée par un utilisateur">
                        👤 COMMUNAUTÉ
                      </span>
                    )}
                    <span style={{ fontSize: 14, fontWeight: 600, color: fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name_fr ?? item.label_fr ?? '(sans nom)'}
                    </span>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: muted, flexShrink: 0 }}>{item.id}</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {item.subcategory && <span style={{ fontSize: 11, color: muted, padding: '2px 6px', borderRadius: 6, background: darkMode ? '#0E1828' : '#F5F0E8' }}>{item.subcategory}</span>}
                    <span style={{ fontSize: 11, color: muted }}>{fmtDate(item.updated_at)}</span>
                    {ouvrir && <LuExternalLink size={13} color={muted} aria-hidden="true" />}
                  </span>
                </span>
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {(item.issues ?? []).map(key => (
                    <span key={key} style={{ padding: '2px 8px', borderRadius: 10, background: fondTeinte(ISSUE_COLORS[key] ?? ISSUE_COLORS.default, 13), color: texteLisible(ISSUE_COLORS[key] ?? ISSUE_COLORS.default), fontSize: 12, fontWeight: 500 }}>
                      {ISSUE_LABELS[key] ?? key}
                    </span>
                  ))}
                </span>
              </LigneDeQualite>
            )
          })}
        </div>
      )}
    </div>
  )
}
