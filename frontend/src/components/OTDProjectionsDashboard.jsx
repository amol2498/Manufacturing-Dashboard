import { useState, useRef, useMemo, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import SiteHeader from './SiteHeader'
import { uploadOtdProjections } from '../api/client'

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHLY_RISK_CLASS = {
  critical: 'otdp-risk-critical',
  warning:  'otdp-risk-warning',
  caution:  'otdp-risk-caution',
  good:     'otdp-risk-good',
  no_data:  'otdp-risk-no-data',
}

const PIPELINE_RISK_CLASS = {
  '🚨 CRITICAL': 'otdp-rl-critical',
  '🔴 HIGH':     'otdp-rl-high',
  '🟡 MEDIUM':   'otdp-rl-medium',
  '🔵 WATCH':    'otdp-rl-watch',
}

// ── Section 1: Monthly OTD Summary Table ─────────────────────────────────────

function MonthlyOtdSummary({ rows }) {
  if (!rows.length) {
    return (
      <div className="no-data" style={{ padding: '24px 0' }}>
        No forward-looking months found in the data.
      </div>
    )
  }
  return (
    <div className="table-container">
      <table className="pivot-table otdr-table">
        <thead>
          <tr>
            <th className="otdr-th otdr-th-supplier">Month</th>
            <th className="otdr-th">Total Lines</th>
            <th className="otdr-th otdr-th-ontime">On Time</th>
            <th className="otdr-th otdr-th-delayed">Delayed</th>
            <th className="otdr-th otdr-th-otd">OTD % Actual</th>
            <th className="otdr-th otdr-th-otd">OTD Forecast</th>
            <th className="otdr-th" style={{ minWidth: 300 }}>Risk Assessment</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="otdr-row">
              <td className="otdr-td otdr-supplier">{row.month}</td>
              <td className="otdr-td">{row.total_lines}</td>
              <td className="otdr-td otdr-ontime">{row.on_time}</td>
              <td className="otdr-td otdr-delayed">{row.delayed}</td>
              <td className="otdr-td otdr-otd-pct">
                {row.total_lines > 0 ? `${row.otd_actual}%` : '—'}
              </td>
              <td className="otdr-td otdr-otd-pct">{row.otd_forecast}%</td>
              <td className={`otdr-td otdr-risk-cell ${MONTHLY_RISK_CLASS[row.risk_level] || ''}`}>
                {row.risk_label}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── OTD Projection Line Chart ─────────────────────────────────────────────────

function OtdProjectionChart({ rows }) {
  const values = rows.flatMap(r => [r.otd_actual, r.otd_forecast]).filter(v => v != null)
  const yMin = values.length ? Math.floor(Math.min(...values) / 5) * 5 - 5 : 80
  const yMax = values.length ? Math.ceil(Math.max(...values)  / 5) * 5 + 2 : 105

  const ticks = []
  for (let t = yMin; t <= yMax; t += 5) ticks.push(t)

  return (
    <div className="otdp-chart-wrap">
      <div className="otdp-chart-title">OTD % — 6 Month Projection (All Formula Driven)</div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={rows} margin={{ top: 16, right: 24, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11 }}
            tickLine={false}
          />
          <YAxis
            domain={[yMin, yMax]}
            ticks={ticks}
            tickFormatter={v => `${v.toFixed(1)}%`}
            tick={{ fontSize: 11 }}
            width={54}
          />
          <Tooltip formatter={(v, name) => [`${v}%`, name]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="otd_forecast"
            name="OTD Forecast"
            stroke="#27AE60"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#27AE60' }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="otd_actual"
            name="OTD % Actual"
            stroke="#2980B9"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#2980B9' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Section 2: At-Risk Pipeline Table ────────────────────────────────────────

const RISK_LEVEL_OPTIONS = ['🚨 CRITICAL', '🔴 HIGH', '🟡 MEDIUM', '🔵 WATCH']

// ── Multi-select dropdown ─────────────────────────────────────────────────────

function MultiSelectDropdown({ options, value, onChange }) {
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState('')
  const wrapRef = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const visible = options.filter(o => o.toLowerCase().includes(search.toLowerCase()))

  const toggle = (opt) =>
    onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt])

  const label = value.length === 0 ? 'All' : `${value.length} selected`

  return (
    <div className="otdp-ms-wrap" ref={wrapRef}>
      <button
        className={`otdp-ms-btn${open ? ' open' : ''}${value.length > 0 ? ' active' : ''}`}
        onClick={() => setOpen(o => !o)}
        type="button"
      >
        <span className="otdp-ms-label">{label}</span>
        <span className="otdp-ms-chevron">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="otdp-ms-panel">
          {options.length > 4 && (
            <input
              className="otdp-ms-search"
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          )}
          {value.length > 0 && (
            <button
              className="otdp-ms-clear-all"
              type="button"
              onClick={() => { onChange([]); setSearch('') }}
            >
              ✕ Clear all
            </button>
          )}
          <div className="otdp-ms-options">
            {visible.map(opt => (
              <label key={opt} className="otdp-ms-option">
                <input
                  type="checkbox"
                  checked={value.includes(opt)}
                  onChange={() => toggle(opt)}
                />
                <span>{opt}</span>
              </label>
            ))}
            {visible.length === 0 && (
              <div className="otdp-ms-empty">No matches</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Parse "15-May-26" → { y:2026, m:5, d:15 } for timezone-safe comparison
const MONTH_IDX = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12}
function parseDueDate(str) {
  if (!str) return null
  const parts = str.split('-')
  if (parts.length !== 3) return null
  const d = parseInt(parts[0], 10)
  const m = MONTH_IDX[parts[1].toLowerCase()]
  const y = parseInt(parts[2], 10) + 2000
  return (isNaN(d) || !m || isNaN(y)) ? null : { y, m, d }
}

function matchesDueDateFilter(due_date, filterVal) {
  if (!filterVal) return true                          // no filter set
  const row = parseDueDate(due_date)
  if (!row) return false
  const [fy, fm, fd] = filterVal.split('-').map(Number)
  return row.y === fy && row.m === fm && row.d === fd
}

function matchesDaysFilter(days, raw) {
  const s = raw.trim()
  if (!s) return true
  const ops = [['>=', (a, b) => a >= b], ['<=', (a, b) => a <= b],
               ['>',  (a, b) => a >  b], ['<',  (a, b) => a <  b],
               ['=',  (a, b) => a === b]]
  for (const [op, fn] of ops) {
    if (s.startsWith(op)) {
      const n = Number(s.slice(op.length).trim())
      return isNaN(n) ? true : fn(days, n)
    }
  }
  const n = Number(s)
  return isNaN(n) ? String(days).includes(s) : days === n
}

const EMPTY_PIPELINE_FILTERS = {
  item_number:    '',
  supplier:       [],
  site:           [],
  due_date:       '',
  days_until_due: '',
  stage:          [],
  risk_level:     [],
}

function AtRiskPipeline({ rows }) {
  const [filters, setFilters] = useState(EMPTY_PIPELINE_FILTERS)

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val }))

  const uniqueSuppliers = useMemo(() => [...new Set(rows.map(r => r.supplier).filter(Boolean))].sort(), [rows])
  const uniqueSites     = useMemo(() => [...new Set(rows.map(r => r.site).filter(Boolean))].sort(), [rows])
  const uniqueStages    = useMemo(() => [...new Set(rows.map(r => r.stage).filter(Boolean))].sort(), [rows])

  const filtered = useMemo(() => rows.filter(r => {
    const ci = (a, b) => a.toLowerCase().includes(b.toLowerCase())
    if (filters.item_number           && !ci(r.item_number || '', filters.item_number))           return false
    if (filters.supplier.length       && !filters.supplier.includes(r.supplier))                  return false
    if (filters.site.length           && !filters.site.includes(r.site))                          return false
    if (filters.due_date              && !matchesDueDateFilter(r.due_date, filters.due_date))       return false
    if (filters.days_until_due        && !matchesDaysFilter(r.days_until_due, filters.days_until_due)) return false
    if (filters.stage.length          && !filters.stage.includes(r.stage))                        return false
    if (filters.risk_level.length     && !filters.risk_level.includes(r.risk_level))              return false
    return true
  }), [rows, filters])

  const hasActiveFilter =
    filters.item_number !== ''     ||
    filters.supplier.length > 0    ||
    filters.site.length > 0        ||
    filters.due_date !== ''        ||
    filters.days_until_due !== ''  ||
    filters.stage.length > 0       ||
    filters.risk_level.length > 0

  if (!rows.length) {
    return (
      <div className="no-data" style={{ padding: '24px 0' }}>
        No at-risk items found — no orders in early stages due within 60 days.
      </div>
    )
  }

  return (
    <>
      <div className="otdp-pipeline-toolbar">
        <span className="otdp-pipeline-count">
          Showing <strong>{filtered.length}</strong> of <strong>{rows.length}</strong> items
        </span>
        {hasActiveFilter && (
          <button className="otdp-clear-btn" onClick={() => setFilters(EMPTY_PIPELINE_FILTERS)}>
            ✕ Clear filters
          </button>
        )}
      </div>
      <div className="table-container">
        <table className="pivot-table otdr-table">
          <thead>
            <tr>
              <th className="otdr-th otdr-th-supplier">Item #</th>
              <th className="otdr-th otdr-th-supplier">Supplier</th>
              <th className="otdr-th otdr-th-supplier">Site</th>
              <th className="otdr-th">Due Date</th>
              <th className="otdr-th">Days Until Due</th>
              <th className="otdr-th otdr-th-supplier">Stage</th>
              <th className="otdr-th">Risk Level</th>
            </tr>
            <tr className="otdp-filter-row">
              <th className="otdp-filter-th">
                <input
                  className="otdp-filter-input"
                  placeholder="Search…"
                  value={filters.item_number}
                  onChange={e => setFilter('item_number', e.target.value)}
                />
              </th>
              <th className="otdp-filter-th">
                <MultiSelectDropdown
                  options={uniqueSuppliers}
                  value={filters.supplier}
                  onChange={v => setFilter('supplier', v)}
                />
              </th>
              <th className="otdp-filter-th">
                <MultiSelectDropdown
                  options={uniqueSites}
                  value={filters.site}
                  onChange={v => setFilter('site', v)}
                />
              </th>
              <th className="otdp-filter-th">
                <input
                  type="date"
                  className="otdp-filter-date"
                  value={filters.due_date}
                  onChange={e => setFilter('due_date', e.target.value)}
                />
              </th>
              <th className="otdp-filter-th">
                <input
                  className="otdp-filter-input"
                  placeholder="e.g. <=14, >7"
                  value={filters.days_until_due}
                  onChange={e => setFilter('days_until_due', e.target.value)}
                />
              </th>
              <th className="otdp-filter-th">
                <MultiSelectDropdown
                  options={uniqueStages}
                  value={filters.stage}
                  onChange={v => setFilter('stage', v)}
                />
              </th>
              <th className="otdp-filter-th">
                <MultiSelectDropdown
                  options={RISK_LEVEL_OPTIONS}
                  value={filters.risk_level}
                  onChange={v => setFilter('risk_level', v)}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map((row, i) => (
              <tr key={i} className="otdr-row">
                <td className="otdr-td otdr-supplier">{row.item_number || '—'}</td>
                <td className="otdr-td otdr-supplier">{row.supplier || '—'}</td>
                <td className="otdr-td otdr-supplier">{row.site || '—'}</td>
                <td className="otdr-td">{row.due_date || '—'}</td>
                <td className="otdr-td" style={{ fontWeight: 700, color: '#1e3a5f' }}>
                  {row.days_until_due}
                </td>
                <td className="otdr-td otdr-supplier">{row.stage}</td>
                <td className={`otdr-td otdr-risk-cell ${PIPELINE_RISK_CLASS[row.risk_level] || ''}`}>
                  {row.risk_level}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={7} className="otdr-td" style={{ textAlign: 'center', color: '#888', padding: '20px' }}>
                  No items match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ── Risk Level Legend ─────────────────────────────────────────────────────────

function RiskLegend() {
  const items = [
    { cls: 'otdp-rl-critical', label: '🚨 CRITICAL', sub: '≤7 days' },
    { cls: 'otdp-rl-high',     label: '🔴 HIGH',     sub: '8–14 days' },
    { cls: 'otdp-rl-medium',   label: '🟡 MEDIUM',   sub: '15–30 days' },
    { cls: 'otdp-rl-watch',    label: '🔵 WATCH',    sub: '31–60 days' },
  ]
  return (
    <div className="otdp-legend">
      {items.map(({ cls, label, sub }) => (
        <span key={label} className="otdp-legend-item">
          <span className={`otdp-legend-badge ${cls}`}>{label}</span>
          <span className="otdp-legend-sub">{sub}</span>
        </span>
      ))}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OTDProjectionsDashboard() {
  const [status, setStatus]                 = useState('idle')
  const [fileName, setFileName]             = useState('')
  const [errorMsg, setErrorMsg]             = useState('')
  const [monthlySummary, setMonthlySummary] = useState([])
  const [atRiskPipeline, setAtRiskPipeline] = useState([])
  const [dateRangeLabel, setDateRangeLabel] = useState('')
  const [totalAtRisk, setTotalAtRisk]       = useState(0)
  const fileRef = useRef(null)

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setStatus('loading')
    setErrorMsg('')
    try {
      const result = await uploadOtdProjections(file)
      setMonthlySummary(result.monthly_summary   ?? [])
      setAtRiskPipeline(result.at_risk_pipeline  ?? [])
      setDateRangeLabel(result.date_range_label  ?? '')
      setTotalAtRisk(result.total_at_risk         ?? 0)
      setFileName(file.name)
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setErrorMsg(err.message)
    } finally {
      e.target.value = ''
    }
  }

  return (
    <div className="app">
      <SiteHeader>
        <div>
          <h1 className="header-title">OTD Projections Dashboard</h1>
        </div>
        <div className="header-badge">Dashboard</div>
      </SiteHeader>

      <div className="main-layout" style={{ height: 'calc(100vh - 54px)' }}>
        <main className="content">

          {/* Upload */}
          <div className="section">
            <h2 className="section-title">Upload Data File</h2>
            <p className="otdr-upload-hint">
              <strong><em>Upload an Excel file containing a CW_Data sheet (row 3 as header) with Supplier, Site, Item #, Due Date, Stage, On-Time/Delay, Days Until Due, and Month columns</em></strong>
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
                </div>
              )}
              {status === 'error' && <span className="tab3-upload-error">{errorMsg}</span>}
            </div>
          </div>

          {status === 'success' ? (
            <>
              {/* Monthly OTD Summary + Projection Chart */}
              <div className="section">
                <div className="otdp-section-header">
                  <h2 className="section-title" style={{ margin: 0 }}>Monthly OTD Summary</h2>
                  {dateRangeLabel && (
                    <span className="otdp-date-range">{dateRangeLabel}</span>
                  )}
                </div>
                <div className="otdp-summary-row">
                  <div className="otdp-summary-table">
                    <MonthlyOtdSummary rows={monthlySummary} />
                  </div>
                  <div className="otdp-summary-chart">
                    <OtdProjectionChart rows={monthlySummary} />
                  </div>
                </div>
              </div>

              {/* At-Risk Pipeline */}
              <div className="section">
                <div className="otdp-section-header">
                  <h2 className="section-title" style={{ margin: 0 }}>At-Risk Pipeline</h2>
                  <span className="otdp-count-badge">
                    <strong>{totalAtRisk}</strong> items at risk · due within 60 days in early stages
                  </span>
                </div>
                <RiskLegend />
                <div style={{ marginTop: 12 }}>
                  <AtRiskPipeline rows={atRiskPipeline} />
                </div>
              </div>
            </>
          ) : (
            <div className="section">
              <div className="dummy-content">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p>Upload an Excel file with a <strong>CW_Data</strong> sheet to generate the OTD Projections dashboard.</p>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}
