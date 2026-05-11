import { useRef, useState } from 'react'
import SiteHeader from './SiteHeader'
import { uploadFpy } from '../api/client'

// ── Helpers ─────────────────────────────────────────────────────────────────────

function fmtPct(v) {
  if (v == null) return 'N/A'
  return `${v}%`
}

function cellStyle(v) {
  if (v == null) return {}
  if (v >= 95) return { background: '#1e7c3a', color: '#fff' }
  if (v >= 90) return { background: '#70ad47', color: '#fff' }
  if (v >= 80) return { background: '#ed7d31', color: '#fff' }
  return { background: '#c00000', color: '#fff' }
}

// ── Summary cards ────────────────────────────────────────────────────────────────

function SummaryCard({ value, label, sub, valueClass }) {
  return (
    <div className="otdr-card">
      <div className="otdr-card-top">
        <span className={`otdr-card-value ${valueClass}`}>{value}</span>
        <span className="otdr-card-label">{label}</span>
      </div>
      <div className="otdr-card-sub">{sub}</div>
    </div>
  )
}

function SummaryBar({ summary }) {
  const fmt = (v) => (v == null ? '—' : `${v}%`)
  return (
    <div className="otdr-summary-bar">
      <SummaryCard
        value={fmt(summary.overall_avg)}
        label="OVERALL AVG FPY"
        sub="All suppliers, all months"
        valueClass="otdr-val-green"
      />
      <SummaryCard
        value={fmt(summary.ppap_avg)}
        label="PPAP AVG FPY"
        sub="PPAP stage only"
        valueClass="otdr-val-blue"
      />
      <SummaryCard
        value={fmt(summary.production_avg)}
        label="PRODUCTION AVG FPY"
        sub="Production stage only"
        valueClass="otdr-val-orange"
      />
      <SummaryCard
        value={summary.total_records ?? '—'}
        label="TOTAL RECORDS"
        sub="Data rows in FPY Data tab"
        valueClass="otdr-val-blue"
      />
    </div>
  )
}

// ── FPY Table ────────────────────────────────────────────────────────────────────

function FpyTable({ months, rows }) {
  return (
    <div className="table-container" style={{ overflowX: 'auto' }}>
      <table className="pivot-table otdr-table fpy-table">
        <thead>
          {/* Row 1: month group headers */}
          <tr>
            <th className="fpy-th-supplier" rowSpan={2}>Supplier</th>
            {months.map(m => (
              <th key={m} className="fpy-th-month" colSpan={2}>{m}</th>
            ))}
          </tr>
          {/* Row 2: PPAP / Production sub-headers */}
          <tr>
            {months.flatMap(m => [
              <th key={`${m}-ppap`} className="fpy-th-col fpy-th-ppap">PPAP</th>,
              <th key={`${m}-prod`} className="fpy-th-col fpy-th-prod">Production</th>,
            ])}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="fpy-row">
              <td className="fpy-td-supplier">{row.supplier}</td>
              {months.flatMap(m => {
                const cell = row.data[m] ?? {}
                return [
                  <td key={`${m}-ppap`} className="fpy-td" style={cellStyle(cell.ppap)}>
                    {fmtPct(cell.ppap)}
                  </td>,
                  <td key={`${m}-prod`} className="fpy-td" style={cellStyle(cell.production)}>
                    {fmtPct(cell.production)}
                  </td>,
                ]
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Monthly FPY Trend table ──────────────────────────────────────────────────────

function TrendTable({ months, rows }) {
  return (
    <div className="table-container" style={{ overflowX: 'auto', marginTop: 28 }}>
      <h2 className="section-title" style={{ marginBottom: 10 }}>
        Monthly FPY Trend — Chart data (AVERAGEIFS formula per supplier per month)
      </h2>
      <table className="pivot-table otdr-table fpy-table">
        <thead>
          <tr>
            <th className="fpy-th-supplier">Supplier</th>
            {months.map(m => (
              <th key={m} className="fpy-th-month">{m}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="fpy-row">
              <td className="fpy-td-supplier">{row.supplier}</td>
              {months.map(m => {
                const v = row.data[m] ?? null
                return (
                  <td key={m} className="fpy-td" style={cellStyle(v)}>
                    {v != null ? `${v}%` : ''}
                  </td>
                )
              })}
            </tr>
          ))}
          {/* Target row */}
          <tr className="fpy-row-target">
            <td className="fpy-td-target-label">Target 90%</td>
            {months.map(m => (
              <td key={m} className="fpy-td-target">90%</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ── Plant-wise summary table ─────────────────────────────────────────────────────

function PlantTable({ rows }) {
  if (!rows.length) return null
  return (
    <div className="table-container" style={{ overflowX: 'auto', marginTop: 28 }}>
      <h2 className="section-title" style={{ marginBottom: 10 }}>
        Plant-wise FPY Summary — AVERAGEIFS from FPY Data · All months combined
      </h2>
      <table className="pivot-table otdr-table fpy-table">
        <thead>
          <tr>
            <th className="fpy-th-supplier">Plant</th>
            <th className="fpy-th-col fpy-th-ppap">PPAP Avg FPY</th>
            <th className="fpy-th-col fpy-th-prod">Production Avg FPY</th>
            <th className="fpy-th-col" style={{ background: '#1f3864', color: '#fff' }}>Overall Avg FPY</th>
            <th className="fpy-th-col" style={{ background: '#2e4057', color: '#fff' }}>Total Records</th>
            <th className="fpy-th-col" style={{ background: '#7b1f1f', color: '#fff' }}>Below 90% Count</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="fpy-row">
              <td className="fpy-td-supplier">{row.plant}</td>
              <td className="fpy-td" style={cellStyle(row.ppap_avg)}>{row.ppap_avg}%</td>
              <td className="fpy-td" style={cellStyle(row.production_avg)}>{row.production_avg}%</td>
              <td className="fpy-td fpy-td-overall" style={cellStyle(row.overall_avg)}>
                <strong>{row.overall_avg}%</strong>
              </td>
              <td className="fpy-td">{row.total_records}</td>
              <td className="fpy-td fpy-td-below90">{row.below_90_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────────

export default function FPYDashboard() {
  const [status, setStatus]       = useState('idle')
  const [fileName, setFileName]   = useState('')
  const [errorMsg, setErrorMsg]   = useState('')
  const [summary, setSummary]       = useState(null)
  const [months, setMonths]         = useState([])
  const [allRows, setAllRows]           = useState([])
  const [allTrendRows, setAllTrendRows] = useState([])
  const [plantRows, setPlantRows]       = useState([])
  const [suppliers, setSuppliers]       = useState([])
  const [selected, setSelected]     = useState('')
  const fileRef = useRef(null)

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setStatus('loading')
    setErrorMsg('')
    try {
      const result = await uploadFpy(file)
      setSummary(result.summary)
      setMonths(result.months)
      setAllRows(result.rows)
      setAllTrendRows(result.trend_rows ?? [])
      setPlantRows(result.plant_rows ?? [])
      setSuppliers(result.suppliers)
      setSelected('')
      setFileName(file.name)
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setErrorMsg(err.message)
    } finally {
      e.target.value = ''
    }
  }

  const visibleRows      = selected ? allRows.filter(r => r.supplier === selected)      : allRows
  const visibleTrendRows = selected ? allTrendRows.filter(r => r.supplier === selected) : allTrendRows

  return (
    <div className="app">
      <SiteHeader>
        <div>
          <h1 className="header-title">Supplier Wise FPY — PPAP Stage · Target ≥90% · AVERAGEIFS from FPY Data tab</h1>
        </div>
        <div className="header-badge">Dashboard</div>
      </SiteHeader>

      <div className="main-layout" style={{ height: 'calc(100vh - 54px)' }}>
        <main className="content">

          {/* Upload section */}
          <div className="section">
            <h2 className="section-title">Upload FPY File</h2>
            <p className="otdr-upload-hint">
              <strong><em>Upload an Excel file containing the FPY Data sheet</em></strong>
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
                  <span className="tab3-file-rows">{summary?.total_records} records loaded</span>
                </div>
              )}
              {status === 'error' && <span className="tab3-upload-error">{errorMsg}</span>}
            </div>
          </div>

          {summary ? (
            <>
              {/* Summary cards */}
              <div className="section">
                <SummaryBar summary={summary} />
              </div>

              {/* Supplier filter */}
              {suppliers.length > 0 && (
                <div className="section">
                  <div className="sc-filter-bar">
                    <label className="sc-filter-label" htmlFor="fpy-supplier-select">Supplier</label>
                    <select
                      id="fpy-supplier-select"
                      className="sc-filter-select"
                      value={selected}
                      onChange={e => setSelected(e.target.value)}
                    >
                      <option value="">All Suppliers</option>
                      {suppliers.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* FPY table + trend table */}
              <div className="section">
                <FpyTable months={months} rows={visibleRows} />
                {allTrendRows.length > 0 && (
                  <TrendTable months={months} rows={visibleTrendRows} />
                )}
                <PlantTable rows={plantRows} />
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
                <p>Upload an Excel file with a <strong>FPY Data</strong> sheet to generate the dashboard.</p>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}
