import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { LuActivity } from 'react-icons/lu'
import { adminGetAnalyticsData } from '@features/admin/api/admin'
import Button from '@shared/ui/button'
import { texteLisible } from '@shared/lib/couleurs/texte-lisible'

const PERIODS = [
  { key: '7j',  label: '7 jours' },
  { key: '30j', label: '30 jours' },
  { key: '12m', label: '12 mois' },
  { key: 'all', label: 'Tout' },
]

const COLOR_ACTIONS  = 'var(--color-brand-500)'
const COLOR_SIGNUPS  = 'var(--color-info)'
const COLOR_RECIPES  = 'var(--color-success)'
const HEIGHT_STEP    = 60
const MAX_EXTRA      = HEIGHT_STEP * 6   // 360 px max au-dessus de l'auto-fill

// ── Agrégation client-side ────────────────────────────────────────────────────

function buildPeriodBuckets(period) {
  const now = new Date()
  if (period === '7j') {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now); d.setDate(d.getDate() - (6 - i)); d.setHours(0,0,0,0)
      return { key: d.toISOString().slice(0, 10), label: d.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit' }) }
    })
  }
  if (period === '30j') {
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now); d.setDate(d.getDate() - (29 - i)); d.setHours(0,0,0,0)
      return { key: d.toISOString().slice(0, 10), label: d.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit' }) }
    })
  }
  if (period === '12m') {
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      return { key, label: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }) }
    })
  }
  return null
}

function getItemKey(dateStr, period) {
  if (period === '7j' || period === '30j') return dateStr.slice(0, 10)
  if (period === '12m') return dateStr.slice(0, 7)
  return dateStr.slice(0, 4)
}

function aggregate(raw, period) {
  const { logs, users, recipes } = raw

  let buckets = buildPeriodBuckets(period)

  if (period === 'all') {
    const allDates = [...logs, ...users, ...recipes].map(x => x.created_at.slice(0, 4))
    if (!allDates.length) return []
    const minYear = Math.min(...allDates.map(Number))
    const maxYear = new Date().getFullYear()
    buckets = Array.from({ length: maxYear - minYear + 1 }, (_, i) => {
      const y = String(minYear + i)
      return { key: y, label: y }
    })
  }

  const map = {}
  for (const b of buckets) map[b.key] = { label: b.label, actions: 0, signups: 0, recipes: 0 }

  const startKey = buckets[0].key

  for (const l of logs) {
    const k = getItemKey(l.created_at, period)
    if (k >= startKey && map[k]) map[k].actions++
  }
  for (const u of users) {
    const k = getItemKey(u.created_at, period)
    if (k >= startKey && map[k]) map[k].signups++
  }
  for (const r of recipes) {
    const k = getItemKey(r.created_at, period)
    if (k >= startKey && map[k]) map[k].recipes++
  }

  return buckets.map(b => map[b.key])
}

// ── Tooltip personnalisé ──────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label, darkMode }) {
  if (!active || !payload?.length) return null
  const bg     = darkMode ? '#1A2F48' : '#FFFFFF'
  const border = darkMode ? 'var(--color-dark-border)' : 'var(--color-border-warm)'
  const fg     = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  return (
    <div style={{ background:bg, border:`1px solid ${border}`, borderRadius:10, padding:'10px 14px', boxShadow:'0 4px 16px rgba(0,0,0,0.12)', minWidth:140 }}>
      <div style={{ fontSize:12, fontWeight:700, color:fg, marginBottom:8 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:p.color, marginBottom:3 }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:p.color, flexShrink:0 }} />
          <span style={{ color: darkMode ? '#A0A8B8' : '#7A6A52', marginRight:4 }}>{p.name}</span>
          <span style={{ fontWeight:700, color:fg }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function AnalyticsChart({ darkMode = false, refreshKey = 0 }) {
  const [period,      setPeriod]      = useState('30j')
  const [rawData,     setRawData]     = useState(null)
  const [loading,     setLoading]     = useState(true)
  // Distinct de `loading` : « pas encore chargé » et « n'a pas pu être chargé »
  // appellent deux messages différents.
  const [failed,      setFailed]      = useState(false)
  const [extraHeight, setExtraHeight] = useState(0)   // px au-delà du auto-fill

  // eslint-disable-next-line no-unused-vars
  const fg      = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted   = darkMode ? '#A0A8B8' : '#7A6A52'
  const border  = darkMode ? 'var(--color-dark-border)' : 'var(--color-border-warm)'
  const gridC   = darkMode ? '#1E3048' : '#F2EBE0'
  const cardBg  = darkMode ? '#1A2F48' : '#FFFFFF'
  // Le jeton atténué commun (A11Y-03 : #9A8070 à 3,7:1, #4A6080 à 2,1:1).
  const groupLbl = 'var(--color-muted)'

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setFailed(false)
    adminGetAnalyticsData()
      .then(data => {
        setRawData(data)
        setLoading(false)
      })
      // ⚠️ Sans ce catch, `setLoading(false)` n'était jamais atteint : le
      // graphique restait sur « Chargement… » indéfiniment. Pire, le rendu
      // aurait sinon annoncé « Aucune donnée sur cette période » — un écran
      // d'administration qui tait son échec fait cesser de chercher le
      // problème (même leçon que la régression de l'onglet Qualité).
      .catch(() => {
        setFailed(true)
        setLoading(false)
      })
  }, [refreshKey])

  const chartData = useMemo(() => {
    if (!rawData) return []
    return aggregate(rawData, period)
  }, [rawData, period])

  const tickInterval = chartData.length <= 7 ? 0 : Math.ceil(chartData.length / 7) - 1

  // La carte remplit le parent (flex:1 dans Dashboard).
  // extraHeight > 0 → carte dépasse → scroll apparaît dans le container.
  const cardHeight = extraHeight > 0 ? `calc(100% + ${extraHeight}px)` : '100%'

  return (
    <div style={{
      height: cardHeight,
      background: cardBg, border: `1px solid ${border}`, borderRadius: 14,
      padding: '14px 20px 16px',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, flexWrap:'wrap', gap:8, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
          <LuActivity size={14} style={{ color:muted }} />
          <span style={{ fontSize:11, fontWeight:700, color:groupLbl, textTransform:'uppercase', letterSpacing:'0.07em' }}>
            Analytics
          </span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {/* Sélecteur de période */}
          <div style={{ display:'flex', gap:3 }}>
            {PERIODS.map(p => (
              <Button
                key={p.key}
                variant="ghost"
                aria-pressed={period === p.key}
                onClick={() => setPeriod(p.key)}
                className="h-auto rounded-[20px] border px-2.5 py-1 text-xs hover:bg-transparent"
                style={{
                  fontWeight: period === p.key ? 700 : 500,
                  borderColor: period === p.key ? 'var(--color-brand-500)' : border,
                  background: period === p.key ? 'rgba(224,120,32,0.12)' : 'transparent',
                  color: period === p.key ? texteLisible('var(--color-brand-500)') : muted,
                  transition: 'all 0.15s',
                }}
              >
                {p.label}
              </Button>
            ))}
          </div>
          {/* Boutons resize vertical */}
          <div style={{ display:'flex', gap:2 }}>
            {[['−', -1], ['+', 1]].map(([sym, dir]) => {
              const disabled = dir === -1 ? extraHeight <= 0 : extraHeight >= MAX_EXTRA
              return (
                <Button
                  key={sym}
                  variant="ghost"
                  size="icon"
                  onClick={() => setExtraHeight(h => Math.min(MAX_EXTRA, Math.max(0, h + dir * HEIGHT_STEP)))}
                  disabled={disabled}
                  aria-label={dir === -1 ? 'Réduire la hauteur du graphique' : 'Agrandir le graphique'}
                  className="h-6 w-6 rounded-md border bg-transparent text-sm font-bold leading-none hover:bg-transparent"
                  style={{
                    borderColor: border,
                    color: muted,
                    opacity: disabled ? 0.3 : 1,
                    transition: 'all 0.12s',
                  }}
                >
                  {sym}
                </Button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Légende */}
      <div style={{ display:'flex', gap:16, marginBottom:10, flexWrap:'wrap', flexShrink:0 }}>
        {[['Actions admin', COLOR_ACTIONS], ['Inscriptions', COLOR_SIGNUPS], ['Recettes soumises', COLOR_RECIPES]].map(([name, color]) => (
          <div key={name} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:muted }}>
            <span style={{ width:10, height:10, borderRadius:3, background:color, flexShrink:0 }} />
            {name}
          </div>
        ))}
      </div>

      {/* Graphique — remplit l'espace restant. minHeight évite le warning
          recharts width(-1)/height(-1) au premier render (parent flex pas
          encore mesuré). */}
      <div style={{ flex:1, minHeight:200, overflow:'hidden' }}>
        {loading ? (
          <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:muted, fontSize:13 }}>
            Chargement…
          </div>
        ) : failed ? (
          <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#E53535', fontSize:13, textAlign:'center', padding:'0 16px' }}>
            Les statistiques n&apos;ont pas pu être chargées. Réessaie via le bouton de rafraîchissement.
          </div>
        ) : chartData.every(d => d.actions === 0 && d.signups === 0 && d.recipes === 0) ? (
          <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:muted, fontSize:13, fontStyle:'italic' }}>
            Aucune donnée sur cette période.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minHeight={80}>
            <BarChart data={chartData} barSize={period === '7j' ? 20 : period === '30j' ? 8 : 16}
              margin={{ top:4, right:4, left:-18, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridC} vertical={false} />
              <XAxis
                dataKey="label" tick={{ fontSize:11, fill:muted }} axisLine={false} tickLine={false}
                interval={tickInterval}
              />
              <YAxis tick={{ fontSize:11, fill:muted }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip darkMode={darkMode} />} cursor={{ fill: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }} />
              <Bar dataKey="actions"  name="Actions admin"      fill={COLOR_ACTIONS}  radius={[3,3,0,0]} stackId="a" />
              <Bar dataKey="recipes"  name="Recettes soumises"  fill={COLOR_RECIPES}  radius={[0,0,0,0]} stackId="a" />
              <Bar dataKey="signups"  name="Inscriptions"       fill={COLOR_SIGNUPS}  radius={[3,3,0,0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
