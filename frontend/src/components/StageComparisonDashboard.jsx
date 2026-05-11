import { useRef, useState } from 'react'
import SiteHeader from './SiteHeader'
import { uploadStageComparison, fetchStageComparisonFilter } from '../api/client'

// ── Stage colour map ────────────────────────────────────────────────────────────

const STAGE_COLORS = {
  'NO RM / No RM':               '#c00000',
  'Yet to Start / Yet to launch':'#ff9900',
  'Initial Stage':               '#ffd966',
  'Intermediate Stage':          '#7030a0',
  'Final Stage':                 '#4472c4',
  'FG':                          '#70ad47',
  'PPAP PO / NRE PO':            '#00b0f0',
  'Shipped':                     '#92d050',
  'TOTAL':                       '#1f3864',
}

// ── Table ───────────────────────────────────────────────────────────────────────

function StageTable({ months, rows }) {
  const fmt = (v) => (v == null ? '' : v)
  const fmtPct = (v, lines) => {
    if (lines === 0) return '0%'
    return `${v}%`
  }

  return (
    <div className="table-container" style={{ overflowX: 'auto' }}>
      <table className="pivot-table otdr-table sc-table">
        <thead>
          {/* Row 1: month group headers */}
          <tr>
            <th className="sc-th-stage" rowSpan={3}>Stage / Pipeline</th>
            {months.map(m => (
              <th key={m} className="sc-th-month" colSpan={6}>{m}</th>
            ))}
          </tr>
          {/* Row 2: LW / CW sub-headers */}
          <tr>
            {months.flatMap(m => [
              <th key={`${m}-lw`} className="sc-th-week sc-th-lw" colSpan={3}>◄ Last Week (LW)</th>,
              <th key={`${m}-cw`} className="sc-th-week sc-th-cw" colSpan={3}>Current Week (CW) ►</th>,
            ])}
          </tr>
          {/* Row 3: Lines / Delays / Del% */}
          <tr>
            {months.flatMap(m => [
              <th key={`${m}-lw-lines`}  className="sc-th-col sc-th-lw">Lines</th>,
              <th key={`${m}-lw-delays`} className="sc-th-col sc-th-lw-delays">Delays</th>,
              <th key={`${m}-lw-pct`}    className="sc-th-col sc-th-lw">Del%</th>,
              <th key={`${m}-cw-lines`}  className="sc-th-col sc-th-cw">Lines</th>,
              <th key={`${m}-cw-delays`} className="sc-th-col sc-th-cw-delays">Delays</th>,
              <th key={`${m}-cw-pct`}    className="sc-th-col sc-th-cw">Del%</th>,
            ])}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isTotal = row.stage === 'TOTAL'
            const color   = STAGE_COLORS[row.stage] ?? '#333'
            return (
              <tr key={i} className={isTotal ? 'sc-row-total' : 'sc-row'}>
                <td
                  className="sc-td-stage"
                  style={{ color: isTotal ? '#fff' : color, fontWeight: isTotal ? 700 : 500 }}
                >
                  {row.stage}
                </td>
                {months.flatMap(m => {
                  const lw = row.data[m]?.lw ?? { lines: 0, delays: 0, del_pct: 0 }
                  const cw = row.data[m]?.cw ?? { lines: 0, delays: 0, del_pct: 0 }
                  return [
                    <td key={`${m}-lw-l`}  className="sc-td sc-td-lw">{fmt(lw.lines)}</td>,
                    <td key={`${m}-lw-d`}  className="sc-td sc-td-lw-delays">{fmt(lw.delays)}</td>,
                    <td key={`${m}-lw-p`}  className="sc-td sc-td-lw">{fmtPct(lw.del_pct, lw.lines)}</td>,
                    <td key={`${m}-cw-l`}  className="sc-td sc-td-cw">{fmt(cw.lines)}</td>,
                    <td key={`${m}-cw-d`}  className="sc-td sc-td-cw-delays">{fmt(cw.delays)}</td>,
                    <td key={`${m}-cw-p`}  className="sc-td sc-td-cw">{fmtPct(cw.del_pct, cw.lines)}</td>,
                  ]
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────────

export default function StageComparisonDashboard() {
  const [status, setStatus]         = useState('idle')
  const [fileName, setFileName]     = useState('')
  const [errorMsg, setErrorMsg]     = useState('')
  const [months, setMonths]         = useState([])
  const [rows, setRows]             = useState([])
  const [suppliers, setSuppliers]   = useState([])       // all available
  const [selected, setSelected]     = useState([])       // currently selected
  const [filtering, setFiltering]   = useState(false)
  const fileRef = useRef(null)

  const applyResult = (result) => {
    setMonths(result.months)
    setRows(result.rows)
  }

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setStatus('loading')
    setErrorMsg('')
    try {
      const result = await uploadStageComparison(file)
      applyResult(result)
      setSuppliers(result.suppliers ?? [])
      setSelected([])
      setFileName(file.name)
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setErrorMsg(err.message)
    } finally {
      e.target.value = ''
    }
  }

  const handleSupplierChange = async (e) => {
    const value = e.target.value
    const next = value === '' ? [] : [value]
    setSelected(next)
    setFiltering(true)
    try {
      const result = await fetchStageComparisonFilter(next)
      applyResult(result)
    } finally {
      setFiltering(false)
    }
  }

  return (
    <div className="app">
      <SiteHeader>
        <div>
          <h1 className="header-title">Stage Pipeline Comparison — LW vs CW | Month-wise | Predictive Delay Intelligence</h1>
        </div>
        <div className="header-badge">Dashboard</div>
      </SiteHeader>

      <div className="main-layout" style={{ height: 'calc(100vh - 54px)' }}>
        <main className="content">

          {/* Upload section */}
          <div className="section">
            <h2 className="section-title">Upload Stage Comparison File</h2>
            <p className="otdr-upload-hint">
              <strong><em>Upload an Excel file containing Last Week and Current Week data</em></strong>
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
                  <span className="tab3-file-rows">{months.length} months loaded</span>
                </div>
              )}
              {status === 'error' && <span className="tab3-upload-error">{errorMsg}</span>}
            </div>
          </div>

          {suppliers.length > 0 && (
            <div className="section">
              <div className="sc-filter-bar">
                <label className="sc-filter-label" htmlFor="sc-supplier-select">Supplier</label>
                <select
                  id="sc-supplier-select"
                  className="sc-filter-select"
                  value={selected[0] ?? ''}
                  onChange={handleSupplierChange}
                  disabled={filtering}
                >
                  <option value="">All Suppliers</option>
                  {suppliers.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {filtering && <span className="sc-filter-loading">Updating…</span>}
              </div>
            </div>
          )}

          {rows.length > 0 ? (
            <div className="section">
              <StageTable months={months} rows={rows} />
            </div>
          ) : (
            <div className="section">
              <div className="dummy-content">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p>Upload an Excel file with <strong>LW_Data</strong> and <strong>CW_Data</strong> sheets to generate the stage comparison table.</p>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}
