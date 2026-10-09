import { useEffect, useMemo, useState } from 'react'
import { LuRefreshCw, LuCheck, LuX, LuSearch, LuPlay, LuPackage } from 'react-icons/lu'
import {
  adminGetImportQueue,
  adminPublishStaged,
  adminRejectStaged,
  adminBatchPublishValid,
  adminReRunValidators,
} from '@features/admin/api/admin'
import Button from '@shared/ui/button'
import FilterPill from '@shared/ui/filter-pill'
import EmptyState from '@shared/ui/empty-state'
import { useConfirm } from '@shared/ui/confirm-dialog/confirm-provider'
import ImportMetrics from './import-metrics'
import { formatDate } from '@shared/lib/format-date'
import { useReloader } from '@shared/hooks/use-reloader'

const STATUS_LABEL = {
  pending:      { label: 'En attente',   color: '#7A8298',                bg: 'rgba(122,130,152,0.10)' },
  valid:        { label: 'Validée',      color: 'var(--color-success)',   bg: 'rgba(22,163,74,0.10)' },
  invalid:      { label: 'Invalide',     color: 'var(--color-danger)',    bg: 'rgba(220,38,38,0.10)' },
  admin_review: { label: 'Review admin', color: 'var(--color-warning)',   bg: 'rgba(217,119,6,0.10)' },
  published:    { label: 'Publiée',      color: 'var(--color-success)',   bg: 'rgba(22,163,74,0.18)' },
  rejected:     { label: 'Rejetée',      color: '#7A8298',                bg: 'rgba(122,130,152,0.15)' },
}

const STATUS_FILTERS = [
  { key: 'all',          label: 'Tous' },
  { key: 'pending',      label: 'En attente', color: '#7A8298' },
  { key: 'valid',        label: 'Validées',   color: 'var(--color-success)' },
  { key: 'invalid',      label: 'Invalides',  color: 'var(--color-danger)' },
  { key: 'admin_review', label: 'Review',     color: 'var(--color-warning)' },
  { key: 'published',    label: 'Publiées',   color: 'var(--color-success)' },
  { key: 'rejected',     label: 'Rejetées',   color: '#7A8298' },
]

function fmtDate(str, lang = 'fr') { return str ? formatDate(str, lang) : '' }

function recipeName(row) {
  return row.parsed_data?.name?.fr ?? row.parsed_data?.title?.fr ?? row.external_key ?? row.id
}

export default function ImportQueueTab({ darkMode = false }) {
  const [rows,        setRows]        = useState([])
  const [count,       setCount]       = useState(0)
  const [statusFilter, setStatusFilter] = useState('all')
  const [batchFilter, setBatchFilter] = useState('')
  const [search,      setSearch]      = useState('')
  const [busyId,      setBusyId]      = useState(null)
  const [batchBusy,   setBatchBusy]   = useState(false)
  const [toast,       setToast]       = useState(null)
  const [metricsKey,  setMetricsKey]  = useState(0)
  const confirm = useConfirm()

  const fg     = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted  = darkMode ? '#A0A8B8' : '#7A6A52'
  const border = darkMode ? 'var(--color-dark-border)' : 'var(--color-border-warm)'
  const rowBg  = darkMode ? '#1A2F48' : '#FFFFFF'

  function showToast(type, msg) {
    setToast({ type, msg })
  }

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  // `useReloader` garantit le `finally` (sans lui, une erreur réseau laissait
  // le voyant allumé pour toujours) et périme les réponses en retard : sans ça,
  // enchaîner deux filtres laissait la plus ancienne écraser la plus récente.
  const { loading, reload } = useReloader(async (estObsolete) => {
    const { data, count: c, error } = await adminGetImportQueue({
      status: statusFilter,
      batchId: batchFilter,
      search,
      page: 0,
      pageSize: 50,
    })
    if (estObsolete()) return
    if (error) {
      showToast('error', `Erreur chargement : ${error.message}`)
    } else {
      setRows(data)
      setCount(c)
    }
  }, [statusFilter, batchFilter, search])

  const batchOptions = useMemo(() => {
    const seen = new Set()
    const opts = []
    for (const row of rows) {
      if (row.batch_id && !seen.has(row.batch_id)) {
        seen.add(row.batch_id)
        opts.push(row.batch_id)
        if (opts.length >= 20) break
      }
    }
    return opts
  }, [rows])

  async function handlePublish(row) {
    if (!(await confirm({ title: `Publier la recette "${recipeName(row)}" ?` }))) return
    setBusyId(row.id)
    const { error } = await adminPublishStaged(row.id)
    if (error) showToast('error', `Erreur publication : ${error.message}`)
    else { showToast('success', `Recette publiée avec succès.`); setMetricsKey(k => k + 1) }
    setBusyId(null)
    reload()
  }

  async function handleReject(row) {
    const reason = window.prompt(`Raison du rejet pour "${recipeName(row)}" :`)
    if (reason === null) return
    setBusyId(row.id)
    const { error } = await adminRejectStaged(row.id, reason)
    if (error) showToast('error', `Erreur rejet : ${error.message}`)
    else { showToast('success', `Recette rejetée.`); setMetricsKey(k => k + 1) }
    setBusyId(null)
    reload()
  }

  async function handleRevalidate(row) {
    setBusyId(row.id)
    const { message } = await adminReRunValidators(row.id)
    showToast('info', message)
    setBusyId(null)
  }

  async function handleBatchPublish() {
    if (!batchFilter) return
    if (!(await confirm({ title: `Publier toutes les recettes valides du batch "${batchFilter}" ?` }))) return
    setBatchBusy(true)
    const { published, failed, error } = await adminBatchPublishValid(batchFilter)
    if (error) showToast('error', `Erreur batch : ${error.message}`)
    else { showToast('success', `${published} publiée(s)${failed.length > 0 ? `, ${failed.length} échec(s)` : ''}.`); setMetricsKey(k => k + 1) }
    setBatchBusy(false)
    reload()
  }

  const toastBg = {
    success: 'rgba(22,163,74,0.12)',
    error:   'rgba(220,38,38,0.12)',
    info:    'rgba(59,130,246,0.12)',
  }
  const toastColor = {
    success: 'var(--color-success)',
    error:   'var(--color-danger)',
    info:    '#3B82F6',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>

      {/* Import metrics dashboard */}
      <ImportMetrics darkMode={darkMode} reloadKey={metricsKey} />

      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            background: toastBg[toast.type] ?? toastBg.info,
            border: `1px solid ${toastColor[toast.type] ?? toastColor.info}44`,
            color: toastColor[toast.type] ?? toastColor.info,
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: fg, fontWeight: 600 }}>
          <LuPackage size={14} color={muted} />
          {count} entrée{count !== 1 ? 's' : ''}
        </span>

        <select
          value={batchFilter}
          onChange={e => setBatchFilter(e.target.value)}
          style={{
            padding: '5px 10px', borderRadius: 8, border: `1px solid ${border}`,
            background: darkMode ? '#141F2E' : '#FFF', color: batchFilter ? fg : muted,
            fontSize: 12, outline: 'none', fontFamily: 'inherit', cursor: 'pointer',
          }}
        >
          <option value="">Tous batches</option>
          {batchOptions.map(bid => (
            <option key={bid} value={bid}>
              {bid.length > 8 ? `${bid.slice(0, 8)}…` : bid}
            </option>
          ))}
        </select>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleBatchPublish}
          disabled={!batchFilter || batchBusy}
          loading={batchBusy}
          className="h-auto rounded-lg border bg-transparent px-3 py-1.5 text-xs hover:bg-transparent"
          style={{ gap: 5, borderColor: border, color: batchFilter ? 'var(--color-success)' : muted }}
        >
          <LuPlay size={12} />
          Publier tous valides du batch
        </Button>

        <Button
          variant="ghost"
          onClick={reload}
          disabled={loading}
          className="ml-auto h-auto rounded-lg border bg-transparent px-3 py-1.5 text-xs hover:bg-transparent"
          style={{ gap: 6, borderColor: border, color: muted }}
        >
          <LuRefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Recharger
        </Button>
      </div>

      {/* Status filter pills */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {STATUS_FILTERS.map(f => (
          <FilterPill
            key={f.key}
            active={statusFilter === f.key}
            color={f.color ?? 'var(--color-brand-500)'}
            onClick={() => setStatusFilter(f.key)}
            border={border}
            muted={muted}
          >
            {f.label}
          </FilterPill>
        ))}
      </div>

      {/* Search input */}
      <div style={{ position: 'relative' }}>
        <LuSearch
          size={13}
          style={{
            position: 'absolute', left: 10, top: '50%',
            transform: 'translateY(-50%)', color: muted, pointerEvents: 'none',
          }}
        />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filtrer par nom ou clé externe…"
          style={{
            width: '100%', padding: '7px 32px 7px 30px',
            borderRadius: 8, border: `1px solid ${border}`,
            background: darkMode ? '#141F2E' : '#FFF',
            color: fg, fontSize: 13, outline: 'none',
            fontFamily: 'inherit', boxSizing: 'border-box',
          }}
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

      {/* List */}
      {loading ? (
        <div style={{ padding: '24px', color: muted, textAlign: 'center', fontSize: 13 }}>
          Chargement…
        </div>
      ) : rows.length === 0 ? (
        <EmptyState variant="card" icon="📭" muted={muted} border={border} cardBg={rowBg}>
          Aucune entrée dans la file d&apos;import.
        </EmptyState>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map(row => {
            const st = STATUS_LABEL[row.status] ?? { label: row.status, color: '#7A8298', bg: 'rgba(122,130,152,0.10)' }
            const name = recipeName(row)
            const errors = row.errors ?? []
            const isRowBusy = busyId === row.id
            const canPublish = row.status === 'pending' || row.status === 'valid'
            const canReject  = row.status === 'pending' || row.status === 'valid' || row.status === 'invalid' || row.status === 'admin_review'
            const canRevalidate = row.status === 'invalid'

            return (
              <div
                key={row.id}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 6,
                  padding: '10px 12px', borderRadius: 10,
                  background: rowBg, border: `1px solid ${border}`,
                  opacity: isRowBusy ? 0.6 : 1,
                  transition: 'border-color 0.15s, opacity 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-brand-500)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = border}
              >
                {/* Top line: status + source + name + id + date */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 8,
                      background: st.bg, color: st.color,
                      fontSize: 11, fontWeight: 700, flexShrink: 0,
                    }}>
                      {st.label}
                    </span>
                    {row.source && (
                      <span style={{
                        padding: '2px 6px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                        background: darkMode ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.10)',
                        color: '#3B82F6', flexShrink: 0,
                      }}>
                        {row.source}
                      </span>
                    )}
                    <span style={{
                      fontSize: 14, fontWeight: 600, color: fg,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {name}
                    </span>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: muted, flexShrink: 0 }}>
                      {String(row.id).slice(0, 8)}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: muted, flexShrink: 0 }}>
                    {fmtDate(row.created_at)}
                  </span>
                </div>

                {/* Errors line */}
                {errors.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {errors.slice(0, 5).map((code, i) => (
                      <span key={i} style={{
                        padding: '2px 8px', borderRadius: 10,
                        background: 'rgba(220,38,38,0.10)',
                        color: 'var(--color-danger)',
                        fontSize: 11, fontWeight: 500,
                      }}>
                        {typeof code === 'string' ? code : code?.code ?? JSON.stringify(code)}
                      </span>
                    ))}
                    {errors.length > 5 && (
                      <span style={{
                        padding: '2px 8px', borderRadius: 10,
                        background: 'rgba(122,130,152,0.10)', color: muted,
                        fontSize: 11,
                      }}>
                        +{errors.length - 5} autres
                      </span>
                    )}
                  </div>
                )}

                {/* Actions line */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {canPublish && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePublish(row)}
                      disabled={isRowBusy}
                      className="h-auto rounded-md border bg-transparent px-2.5 py-1 text-xs hover:bg-transparent"
                      style={{ gap: 4, borderColor: 'var(--color-success)', color: 'var(--color-success)' }}
                    >
                      <LuCheck size={12} />
                      Publier
                    </Button>
                  )}
                  {canReject && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleReject(row)}
                      disabled={isRowBusy}
                      className="h-auto rounded-md border bg-transparent px-2.5 py-1 text-xs hover:bg-transparent"
                      style={{ gap: 4, borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                    >
                      <LuX size={12} />
                      Rejeter
                    </Button>
                  )}
                  {canRevalidate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevalidate(row)}
                      disabled={isRowBusy}
                      className="h-auto rounded-md border bg-transparent px-2.5 py-1 text-xs hover:bg-transparent"
                      style={{ gap: 4, borderColor: border, color: muted }}
                    >
                      <LuPlay size={12} />
                      Re-valider (CLI)
                    </Button>
                  )}
                  {row.admin_notes && (
                    <span style={{ fontSize: 12, color: muted, fontStyle: 'italic' }}>
                      📝 {row.admin_notes}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
