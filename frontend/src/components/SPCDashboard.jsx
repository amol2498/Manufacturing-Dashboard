import { useState, useRef } from 'react'
import {
  LineChart, Line, ReferenceLine, CartesianGrid, XAxis, YAxis,
  Legend, ResponsiveContainer, Tooltip as ReTooltip,
} from 'recharts'
import SiteHeader from './SiteHeader'
import { uploadSpc } from '../api/client'

// ── Supplier color palette (cycled by index) ─────────────────────────────────
const SUPPLIER_COLORS = [
  '#1D4ED8', '#059669', '#D97706', '#DC2626', '#8B5CF6',
  '#0891B2', '#BE185D', '#15803D', '#92400E', '#1E40AF',
]
function supplierColor(i) { return SUPPLIER_COLORS[i % SUPPLIER_COLORS.length] }

// ── Heatmap coloring ──────────────────────────────────────────────────────────
function heatmapBg(v) {
  if (v == null) return null
  if (v >= 2.0)  return '#00B050'
  if (v >= 1.67) return '#4AC738'
  if (v >= 1.33) return '#CCEF10'
  if (v >= 1.0)  return '#FFA200'
  return '#FF0000'
}
function heatmapText(v) {
  if (v == null || v >= 1.0) return '#222'
  return '#fff'
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ value, label, sub, color }) {
  return (
    <div className="spc-kpi-card" style={{ borderTop: `4px solid ${color}` }}>
      <div className="spc-kpi-value" style={{ color }}>{value}</div>
      <div className="spc-kpi-label">{label}</div>
      {sub && <div className="spc-kpi-sub">{sub}</div>}
    </div>
  )
}

// ── Mini sparkline per supplier (uses backend-computed trend data) ────────────
function CpkSparkline({ cpkTrend, months }) {
  const data = months
    .map(m => ({ month: m, cpk: cpkTrend?.data[m] ?? null }))
    .filter(d => d.cpk != null)

  if (data.length < 2) return <span className="spc-sparkline-na">—</span>

  return (
    <ResponsiveContainer width={72} height={28}>
      <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <ReferenceLine y={1.33} stroke="#f59e0b" strokeDasharray="3 2" strokeWidth={1} />
        <Line type="monotone" dataKey="cpk" stroke="#6366f1" dot={false} strokeWidth={1.5} />
        <ReTooltip
          contentStyle={{ fontSize: 10, padding: '2px 6px' }}
          formatter={v => (v != null ? v.toFixed(2) : '—')}
          labelFormatter={l => l}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── Data cells ────────────────────────────────────────────────────────────────
function CpCell({ cellData }) {
  if (!cellData || cellData.avg_cp == null) {
    return <td className="spc-cell spc-cell-nodata" title="No data">—</td>
  }
  const v = cellData.avg_cp
  return (
    <td
      className="spc-cell"
      style={{ background: heatmapBg(v), color: heatmapText(v) }}
      title={`Avg Cp: ${v.toFixed(2)} | n = ${cellData.count} records`}
    >
      {v.toFixed(2)}
    </td>
  )
}

function CpkCell({ cellData, onClick }) {
  if (!cellData || cellData.avg_cpk == null) {
    return <td className="spc-cell spc-cell-nodata" title="No data">—</td>
  }
  const v = cellData.avg_cpk
  const clickable = onClick != null
  return (
    <td
      className={`spc-cell${clickable ? ' spc-cell-clickable' : ''}`}
      style={{ background: heatmapBg(v), color: heatmapText(v) }}
      title={
        clickable
          ? `Avg Cpk: ${v.toFixed(2)} | n = ${cellData.count} records — click to drill down`
          : `Avg Cpk: ${v.toFixed(2)} | n = ${cellData.count} records`
      }
      onClick={onClick || undefined}
    >
      {v.toFixed(2)}
    </td>
  )
}

// ── Heatmap legend ────────────────────────────────────────────────────────────
function HeatmapLegend() {
  const items = [
    { color: '#00B050', label: '≥ 2.0 — Excellent' },
    { color: '#4AC738', label: '1.67–2.0 — Good' },
    { color: '#CCEF10', label: '1.33–1.67 — Meets min' },
    { color: '#FFA200', label: '1.0–1.33 — Marginal' },
    { color: '#FF0000', label: '< 1.0 — NOT capable' },
  ]
  return (
    <div className="spc-legend">
      {items.map(({ color, label }) => (
        <div key={label} className="spc-legend-item">
          <span className="spc-legend-swatch" style={{ background: color }} />
          <span>{label}</span>
        </div>
      ))}
    </div>
  )
}

// ── Drill-down modal ──────────────────────────────────────────────────────────
function DrillDownModal({ records, supplier, type, month, onClose }) {
  const filtered = records.filter(
    r => r.Supplier === supplier && r.Type === type && r.Month === month
  )
  return (
    <div className="spc-modal-backdrop" onClick={onClose}>
      <div className="spc-modal" onClick={e => e.stopPropagation()}>
        <div className="spc-modal-header">
          <div>
            <strong>{supplier}</strong> · {type} · {month}
            <span className="spc-modal-count">{filtered.length} records</span>
          </div>
          <button className="spc-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="spc-modal-body">
          {filtered.length === 0 ? (
            <p style={{ color: '#6B7280', padding: 16 }}>No records found.</p>
          ) : (
            <table className="spc-modal-table">
              <thead>
                <tr>
                  <th>Part No</th>
                  <th>Cp</th>
                  <th>Cpk</th>
                  <th>Cp Status</th>
                  <th>Cpk Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i}>
                    <td>{r.Part_No || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{r.Cp != null ? r.Cp.toFixed(2) : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{r.Cpk != null ? r.Cpk.toFixed(2) : '—'}</td>
                    <td>
                      {r.Cp != null && (
                        <span className="spc-badge" style={{ background: heatmapBg(r.Cp), color: heatmapText(r.Cp) }}>
                          {r.Cp >= 1.33 ? 'OK' : r.Cp >= 1.0 ? 'Marginal' : 'NOT OK'}
                        </span>
                      )}
                    </td>
                    <td>
                      {r.Cpk != null && (
                        <span className="spc-badge" style={{ background: heatmapBg(r.Cpk), color: heatmapText(r.Cpk) }}>
                          {r.Cpk >= 1.33 ? 'OK' : r.Cpk >= 1.0 ? 'Marginal' : 'NOT OK'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Overall PPAP vs Production Cpk line chart ─────────────────────────────────
function OverallCpkChart({ months, overall, targetCpk }) {
  const data = months.map(m => ({
    month: m,
    'Overall PPAP':       overall?.PPAP?.[m]?.avg_cpk       ?? null,
    'Overall Production': overall?.Production?.[m]?.avg_cpk ?? null,
  }))

  const allVals = data.flatMap(d => [d['Overall PPAP'], d['Overall Production']]).filter(v => v != null)
  const yMax = allVals.length
    ? Math.ceil(Math.max(...allVals, targetCpk + 0.3) * 10) / 10
    : 2.5

  return (
    <div className="spc-overall-chart-wrap">
      <div className="spc-trend-chart-title">Overall Cpk — PPAP vs Production</div>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 12, right: 20, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis dataKey="month" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={48} />
          <YAxis domain={[0, yMax]} tickFormatter={v => v.toFixed(2)} tick={{ fontSize: 10 }} width={42} />
          <ReTooltip formatter={(v, name) => [v != null ? v.toFixed(2) : '—', name]} contentStyle={{ fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
          <ReferenceLine
            y={targetCpk}
            stroke="#DC2626"
            strokeDasharray="6 3"
            strokeWidth={1.5}
            label={{ position: 'insideTopRight', value: `Target ${targetCpk}`, fill: '#DC2626', fontSize: 10, fontWeight: 700 }}
          />
          <Line type="monotone" dataKey="Overall PPAP"       stroke="#1D4ED8" strokeWidth={2} dot={{ r: 4, fill: '#1D4ED8', stroke: '#fff', strokeWidth: 1.5 }} activeDot={{ r: 5 }} connectNulls={false} />
          <Line type="monotone" dataKey="Overall Production" stroke="#DC2626" strokeWidth={2} dot={{ r: 4, fill: '#DC2626', stroke: '#fff', strokeWidth: 1.5 }} activeDot={{ r: 5 }} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Cp / Cpk trend data table ─────────────────────────────────────────────────
function TrendDataTable({ months, suppliers, cpTrends, cpkTrends, targetCpk }) {
  return (
    <div className="spc-trend-table-wrap">
      <table className="spc-trend-table">
        <thead>
          <tr>
            <th className="spc-trend-th-label">Supplier</th>
            {months.map(m => (
              <th key={m} className="spc-trend-th-month">{m}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cpTrends.map((trend, i) => (
            <tr key={`cp-${trend.supplier}`} className="spc-trend-row">
              <td className="spc-trend-row-label" style={{ color: supplierColor(i) }}>
                {trend.supplier} Cp
              </td>
              {months.map(m => (
                <td key={m} className="spc-trend-cell">
                  {trend.data[m] != null ? trend.data[m].toFixed(3) : ''}
                </td>
              ))}
            </tr>
          ))}

          <tr className="spc-trend-sep"><td colSpan={1 + months.length} /></tr>

          {cpkTrends.map((trend, i) => (
            <tr key={`cpk-${trend.supplier}`} className="spc-trend-row">
              <td className="spc-trend-row-label" style={{ color: supplierColor(i) }}>
                {trend.supplier} Cpk
              </td>
              {months.map(m => {
                const v = trend.data[m]
                const below = v != null && v < targetCpk
                return (
                  <td
                    key={m}
                    className="spc-trend-cell"
                    style={below ? { color: '#DC2626', fontWeight: 700 } : {}}
                    title={below ? `Below target ${targetCpk}` : undefined}
                  >
                    {v != null ? v.toFixed(3) : ''}
                  </td>
                )
              })}
            </tr>
          ))}

          <tr className="spc-trend-sep"><td colSpan={1 + months.length} /></tr>

          <tr className="spc-trend-target-row">
            <td className="spc-trend-row-label">Target Cpk {targetCpk}</td>
            {months.map(m => (
              <td key={m} className="spc-trend-cell">{targetCpk.toFixed(2)}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ── Supplier group (PPAP + Production rows) ───────────────────────────────────
function SupplierGroup({ supplier, si, grid, months, openDrill, cpkTrend }) {
  const color   = supplierColor(si)
  const ppapRow = grid.find(r => r.supplier === supplier && r.type === 'PPAP')
  const prodRow = grid.find(r => r.supplier === supplier && r.type === 'Production')

  return (
    <>
      {si > 0 && (
        <tr className="spc-sep-row">
          <td colSpan={2 + months.length * 2} />
        </tr>
      )}

      {/* PPAP row */}
      <tr className="spc-row">
        <td className="spc-supplier-cell" style={{ borderLeft: `4px solid ${color}` }}>
          <span className="spc-supplier-name" style={{ color }}>{supplier}</span>
          <span className="spc-type-tag spc-type-ppap">PPAP</span>
        </td>
        <td className="spc-trend-cell" rowSpan={2}>
          <CpkSparkline cpkTrend={cpkTrend} months={months} />
        </td>
        {months.map(m => (
          <MonthCells
            key={m}
            cellData={ppapRow?.data[m]}
            onCpkClick={ppapRow?.data[m]?.avg_cpk != null ? () => openDrill(supplier, 'PPAP', m) : null}
          />
        ))}
      </tr>

      {/* Production row */}
      <tr className="spc-row spc-row-prod">
        <td className="spc-supplier-cell spc-supplier-cell-prod" style={{ borderLeft: `4px solid ${color}` }}>
          <span className="spc-type-tag spc-type-prod">Production</span>
        </td>
        {months.map(m => (
          <MonthCells
            key={m}
            cellData={prodRow?.data[m]}
            onCpkClick={prodRow?.data[m]?.avg_cpk != null ? () => openDrill(supplier, 'Production', m) : null}
          />
        ))}
      </tr>
    </>
  )
}

// Renders one Cp + one Cpk cell for a given month column
function MonthCells({ cellData, onCpkClick }) {
  return (
    <>
      <CpCell cellData={cellData} />
      <CpkCell cellData={cellData} onClick={onCpkClick} />
    </>
  )
}

// ── Plant drill-down modal ────────────────────────────────────────────────────
function PlantDrillModal({ records, plant, onClose }) {
  const filtered = records.filter(r => r.Plant === plant)
  return (
    <div className="spc-modal-backdrop" onClick={onClose}>
      <div className="spc-modal" onClick={e => e.stopPropagation()}>
        <div className="spc-modal-header">
          <div>
            <strong>{plant}</strong>
            <span className="spc-modal-count">{filtered.length} records</span>
          </div>
          <button className="spc-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="spc-modal-body">
          {filtered.length === 0 ? (
            <p style={{ color: '#6B7280', padding: 16 }}>No records found.</p>
          ) : (
            <table className="spc-modal-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Type</th>
                  <th>Month</th>
                  <th>Part No</th>
                  <th>Cp</th>
                  <th>Cpk</th>
                  <th>Cpk Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i}>
                    <td>{r.Supplier || '—'}</td>
                    <td>{r.Type || '—'}</td>
                    <td>{r.Month || '—'}</td>
                    <td>{r.Part_No || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{r.Cp != null ? r.Cp.toFixed(2) : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{r.Cpk != null ? r.Cpk.toFixed(2) : '—'}</td>
                    <td>
                      {r.Cpk != null && (
                        <span className="spc-badge" style={{ background: heatmapBg(r.Cpk), color: heatmapText(r.Cpk) }}>
                          {r.Cpk >= 1.33 ? 'OK' : r.Cpk >= 1.0 ? 'Marginal' : 'NOT OK'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Plant-wise summary table ──────────────────────────────────────────────────
const PLANT_COLS = [
  { key: 'plant',   label: 'Plant',    align: 'left'  },
  { key: 'avg_cp',  label: 'Avg Cp',   align: 'right' },
  { key: 'avg_cpk', label: 'Avg Cpk',  align: 'right' },
  { key: 'min_cpk', label: 'Min Cpk',  align: 'right' },
  { key: 'max_cpk', label: 'Max Cpk',  align: 'right' },
  { key: 'records', label: 'Records',  align: 'right' },
  { key: 'status',  label: 'Cpk Status', align: 'left' },
]

function PlantSummaryTable({ plantSummary, onPlantClick }) {
  const [sortKey, setSortKey] = useState('plant')
  const [sortAsc, setSortAsc] = useState(true)

  const handleSort = (key) => {
    if (key === sortKey) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(true) }
  }

  const sorted = [...plantSummary].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey]
    if (av == null && bv == null) return 0
    if (av == null) return sortAsc ? 1 : -1
    if (bv == null) return sortAsc ? -1 : 1
    if (typeof av === 'string') return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
    return sortAsc ? av - bv : bv - av
  })

  return (
    <div className="spc-plant-table-wrap">
      <table className="spc-plant-table">
        <thead>
          <tr>
            {PLANT_COLS.map(col => (
              <th
                key={col.key}
                className={`spc-plant-th${sortKey === col.key ? ' spc-plant-th-active' : ''}`}
                style={{ textAlign: col.align }}
                onClick={() => handleSort(col.key)}
              >
                {col.label}
                <span className="spc-sort-arrow">
                  {sortKey === col.key ? (sortAsc ? ' ▲' : ' ▼') : ' ⇅'}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.plant} className="spc-plant-row">
              {/* Plant name — clickable, alert dot if min_cpk < 1.0 */}
              <td className="spc-plant-name-cell">
                {row.min_cpk != null && row.min_cpk < 1.0 && (
                  <span className="spc-alert-dot" title="Min Cpk below 1.0 — process NOT capable" />
                )}
                <button className="spc-plant-link" onClick={() => onPlantClick(row.plant)}>
                  {row.plant}
                </button>
              </td>
              {/* Avg Cp */}
              <td className="spc-plant-num">{row.avg_cp != null ? row.avg_cp.toFixed(2) : '—'}</td>
              {/* Avg Cpk — heatmap */}
              <td
                className="spc-plant-num spc-plant-cpk"
                style={row.avg_cpk != null ? { background: heatmapBg(row.avg_cpk), color: heatmapText(row.avg_cpk) } : {}}
              >
                {row.avg_cpk != null ? row.avg_cpk.toFixed(2) : '—'}
              </td>
              {/* Min Cpk — always red */}
              <td className="spc-plant-num spc-plant-min-cpk">
                {row.min_cpk != null ? row.min_cpk.toFixed(2) : '—'}
              </td>
              {/* Max Cpk */}
              <td className="spc-plant-num">{row.max_cpk != null ? row.max_cpk.toFixed(2) : '—'}</td>
              {/* Records */}
              <td className="spc-plant-num">{row.records}</td>
              {/* Status */}
              <td className="spc-plant-status">{row.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main dashboard page ───────────────────────────────────────────────────────
export default function SPCDashboard() {
  const [status,     setStatus]     = useState('idle')
  const [fileName,   setFileName]   = useState('')
  const [errorMsg,   setErrorMsg]   = useState('')
  const [dashData,   setDashData]   = useState(null)
  const [drill,      setDrill]      = useState(null)
  const [plantDrill, setPlantDrill] = useState(null)
  const fileRef = useRef(null)

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setStatus('loading')
    setErrorMsg('')
    try {
      const result = await uploadSpc(file)
      setDashData(result)
      setFileName(file.name)
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setErrorMsg(err.message)
    } finally {
      e.target.value = ''
    }
  }

  const openDrill      = (supplier, type, month) => setDrill({ supplier, type, month })
  const closeDrill     = () => setDrill(null)
  const openPlantDrill = (plant) => setPlantDrill(plant)
  const closePlantDrill = () => setPlantDrill(null)

  const {
    kpis, months = [], suppliers = [], grid = [], overall = {}, records = [],
    cp_trends: cpTrends = [], cpk_trends: cpkTrends = [],
    plant_summary: plantSummary = [], target_cpk: targetCpk = 1.33,
  } = dashData || {}

  return (
    <div className="app">
      <SiteHeader>
        <div>
          <h1 className="header-title">SPC Dashboard — Cp / Cpk Analysis</h1>
        </div>
        <div className="header-badge">SPC</div>
      </SiteHeader>

      <div className="main-layout" style={{ height: 'calc(100vh - 54px)' }}>
        <main className="content">

          {/* ── Upload section ──────────────────────────────────────────────── */}
          <div className="section">
            <h2 className="section-title">Upload SPC Data File</h2>
            <p className="otdr-upload-hint">
              <strong><em>
                Upload an Excel file with a "SPC Data" sheet — columns A–J:
                Month, Supplier, Type (PPAP/Production), Plant, Part No, UCL, LCL, Insp. Method, Cp, Cpk
              </em></strong>
            </p>
            <div className="tab3-upload-row" style={{ marginTop: 12 }}>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <button
                className={`tab3-upload-btn${status === 'success' ? ' tab3-upload-btn--success' : ''}`}
                onClick={() => fileRef.current.click()}
                disabled={status === 'loading'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                {status === 'loading' ? 'Processing…' : 'Upload Excel File'}
              </button>
              {status === 'success' && (
                <div className="tab3-file-info">
                  <span className="tab3-file-name">{fileName}</span>
                  <span className="tab3-file-rows">{kpis?.record_count} records loaded</span>
                </div>
              )}
              {status === 'error' && (
                <span className="tab3-upload-error">{errorMsg}</span>
              )}
            </div>
          </div>

          {dashData ? (
            <>
              {/* ── KPI cards ─────────────────────────────────────────────── */}
              <div className="section">
                <div className="spc-kpi-row">
                  <KpiCard
                    value={kpis.avg_cpk != null ? kpis.avg_cpk.toFixed(2) : '—'}
                    label="Overall Avg Cpk"
                    sub="Target ≥ 1.33 (aerospace)"
                    color="#3730A3"
                  />
                  <KpiCard
                    value={kpis.avg_cp != null ? kpis.avg_cp.toFixed(2) : '—'}
                    label="Overall Avg Cp"
                    sub="Process capability spread"
                    color="#1D4ED8"
                  />
                  <KpiCard
                    value={kpis.min_cpk != null ? kpis.min_cpk.toFixed(2) : '—'}
                    label="Min Cpk (Worst)"
                    sub={
                      kpis.min_cpk == null ? '' :
                      kpis.min_cpk < 1.0   ? 'NOT CAPABLE — immediate action' :
                      kpis.min_cpk < 1.33  ? 'Below minimum standard' :
                      'Within acceptable range'
                    }
                    color="#DC2626"
                  />
                  <KpiCard
                    value={kpis.record_count}
                    label="Total SPC Records"
                    sub={`Across ${suppliers.length} supplier${suppliers.length !== 1 ? 's' : ''}`}
                    color="#374151"
                  />
                </div>
              </div>

              {/* ── Legend ────────────────────────────────────────────────── */}
              <div className="section" style={{ paddingBottom: 4 }}>
                <HeatmapLegend />
              </div>

              {/* ── Main Cp/Cpk grid + Overall chart ──────────────────────── */}
              <div className="section">
                <h2 className="section-title" style={{ marginBottom: 12 }}>
                  Cp / Cpk by Supplier & Month
                </h2>
                <div className="spc-grid-chart-row">
                <div className="spc-grid-scroll">
                  <table className="spc-grid-table">
                    <thead>
                      <tr>
                        <th className="spc-th-supplier" rowSpan={2}>Supplier</th>
                        <th className="spc-th-trend"    rowSpan={2}>Cpk Trend</th>
                        {months.map(m => (
                          <th key={m} colSpan={2} className="spc-th-month">{m}</th>
                        ))}
                      </tr>
                      <tr>
                        {months.map(m => (
                          <MonthSubHeaders key={m} month={m} />
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {suppliers.map((supplier, si) => (
                        <SupplierGroup
                          key={supplier}
                          supplier={supplier}
                          si={si}
                          grid={grid}
                          months={months}
                          openDrill={openDrill}
                          cpkTrend={cpkTrends.find(t => t.supplier === supplier)}
                        />
                      ))}

                      {/* Overall rows */}
                      <tr className="spc-sep-row">
                        <td colSpan={2 + months.length * 2} />
                      </tr>
                      {['PPAP', 'Production'].map(type => (
                        <tr key={`overall-${type}`} className="spc-overall-row">
                          <td className="spc-overall-label" colSpan={2}>Overall · {type}</td>
                          {months.map(m => (
                            <MonthCells
                              key={m}
                              cellData={overall?.[type]?.[m]}
                              onCpkClick={null}
                            />
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Overall Cpk chart alongside the grid */}
                <OverallCpkChart months={months} overall={overall} targetCpk={targetCpk} />
                </div>{/* end spc-grid-chart-row */}

                {/* Supplier colour key */}
                <div className="spc-row-legend">
                  {suppliers.map((s, i) => (
                    <span key={s} className="spc-row-legend-item">
                      <span className="spc-row-legend-dot" style={{ background: supplierColor(i) }} />
                      {s}
                    </span>
                  ))}
                </div>
                <p className="spc-cell-hint">
                  Each supplier shows PPAP (top) and Production (bottom) rows.
                  Click any <strong>Avg Cpk</strong> cell to drill down to part-level records.
                  Hover any cell to see record count.
                </p>
              </div>

              {/* ── Cp / Cpk trend data table ─────────────────────────────── */}
              <div className="section">
                <h2 className="section-title" style={{ marginBottom: 12 }}>
                  Cp / Cpk Trend — All Types Combined
                </h2>
                <TrendDataTable
                  months={months}
                  suppliers={suppliers}
                  cpTrends={cpTrends}
                  cpkTrends={cpkTrends}
                  targetCpk={targetCpk}
                />
              </div>

              {/* ── Plant-Wise Cp / Cpk Summary ────────────────────────────── */}
              {plantSummary.length > 0 && (
                <div className="section">
                  <h2 className="section-title" style={{ marginBottom: 12 }}>
                    Plant-Wise Cp / Cpk Summary
                  </h2>
                  <p className="spc-cell-hint" style={{ marginBottom: 8 }}>
                    Click any <strong>Plant</strong> name to drill down to its records.
                    <span className="spc-alert-dot spc-alert-dot-inline" /> = Min Cpk below 1.0 (process NOT capable).
                  </p>
                  <PlantSummaryTable
                    plantSummary={plantSummary}
                    onPlantClick={openPlantDrill}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="section">
              <div className="dummy-content">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p>
                  Upload an Excel file with a <strong>SPC Data</strong> sheet to generate the dashboard.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {drill && (
        <DrillDownModal
          records={records}
          supplier={drill.supplier}
          type={drill.type}
          month={drill.month}
          onClose={closeDrill}
        />
      )}
      {plantDrill && (
        <PlantDrillModal
          records={records}
          plant={plantDrill}
          onClose={closePlantDrill}
        />
      )}
    </div>
  )
}

// Extracted so the fragment key sits on a named component boundary
function MonthSubHeaders({ month }) {
  return (
    <>
      <th className="spc-th-cp">Avg Cp</th>
      <th className="spc-th-cpk">Avg Cpk</th>
    </>
  )
}
