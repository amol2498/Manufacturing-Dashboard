import { useState, useRef } from 'react'
import SiteHeader from './SiteHeader'
import { uploadOtdRisk } from '../api/client'

// ── Summary banner ─────────────────────────────────────────────────────────────

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

function SummaryBar({ stats }) {
  const fmt1 = (n) => (n == null ? '—' : n.toFixed(1))

  const cards = [
    {
      value:      stats.cw_total,
      label:      'TOTAL CW LINES',
      sub:        `LW: ${stats.lw_total}`,
      valueClass: 'otdr-val-blue',
    },
    {
      value:      `${fmt1(stats.cw_otd_rate)}%`,
      label:      'OTD RATE (CW)',
      sub:        `LW: ${stats.lw_otd_rate != null ? stats.lw_otd_rate : '—'}`,
      valueClass: 'otdr-val-green',
    },
    {
      value:      stats.cw_delayed,
      label:      'DELAYED LINES (CW)',
      sub:        `LW: ${stats.lw_delayed}`,
      valueClass: 'otdr-val-red',
    },
    {
      value:      stats.max_days_late ?? '—',
      label:      'MAX DAYS LATE',
      sub:        stats.max_days_late != null ? `Most aged delay: ${stats.max_days_late} days` : '—',
      valueClass: 'otdr-val-red',
    },
    {
      value:      stats.net_new_delays,
      label:      'NEW DELAYS THIS WK',
      sub:        `Resolved ${stats.resolved ?? 0}`,
      valueClass: stats.net_new_delays <= 0 ? 'otdr-val-orange' : 'otdr-val-red',
    },
    {
      value:      stats.past_due ?? '—',
      label:      'PAST DUE',
      sub:        'Col K = Delay Category',
      valueClass: 'otdr-val-orange',
    },
  ]

  return (
    <div className="otdr-summary-bar">
      {cards.map((c, i) => (
        <SummaryCard key={i} {...c} />
      ))}
    </div>
  )
}

// ── Monthly OTD table ───────────────────────────────────────────────────────────

function MonthlyOtdTable({ rows }) {
  return (
    <div className="table-container">
      <table className="pivot-table otdr-table">
        <thead>
          <tr>
            <th className="otdr-th otdr-th-supplier">Month</th>
            <th className="otdr-th otdr-th-otd">OTD %</th>
            <th className="otdr-th otdr-th-delayed">Delayed</th>
            <th className="otdr-th otdr-th-ontime">On Time</th>
            <th className="otdr-th">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="otdr-row">
              <td className="otdr-td otdr-supplier">{row.month}</td>
              <td className="otdr-td otdr-otd-pct">{row.otd_pct != null ? `${row.otd_pct}%` : ''}</td>
              <td className="otdr-td otdr-delayed">{row.delayed ?? ''}</td>
              <td className="otdr-td otdr-ontime">{row.on_time ?? ''}</td>
              <td className="otdr-td">{row.total ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Supplier OTD table ──────────────────────────────────────────────────────────

function SupplierOtdTable({ rows }) {
  return (
    <div className="table-container">
      <table className="pivot-table otdr-table">
        <thead>
          <tr>
            <th className="otdr-th otdr-th-supplier">Supplier</th>
            <th className="otdr-th">CW Lines</th>
            <th className="otdr-th otdr-th-ontime">On Time</th>
            <th className="otdr-th otdr-th-delayed">Delayed</th>
            <th className="otdr-th otdr-th-otd">OTD %</th>
            <th className="otdr-th">Gap to 95%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="otdr-row">
              <td className="otdr-td otdr-supplier">{row.supplier}</td>
              <td className="otdr-td">{row.cw_lines}</td>
              <td className="otdr-td otdr-ontime">{row.on_time}</td>
              <td className="otdr-td otdr-delayed">{row.delayed}</td>
              <td className="otdr-td otdr-otd-pct">{row.otd_pct}%</td>
              <td className={`otdr-td otdr-gap ${row.gap_to_95 >= 0 ? 'otdr-gap-pos' : 'otdr-gap-neg'}`}>
                {row.gap_to_95 >= 0 ? '+' : ''}{row.gap_to_95}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────────

export default function OTDRiskDashboard() {
  const [status, setStatus]         = useState('idle')
  const [fileName, setFileName]     = useState('')
  const [errorMsg, setErrorMsg]     = useState('')
  const [supplierOtd, setSupplierOtd]   = useState([])
  const [monthlyOtd, setMonthlyOtd]     = useState([])
  const [summaryStats, setSummaryStats] = useState(null)
  const fileRef = useRef(null)

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setStatus('loading')
    setErrorMsg('')
    try {
      const result = await uploadOtdRisk(file)
      setSupplierOtd(result.supplier_otd)
      setMonthlyOtd(result.monthly_otd ?? [])
      setSummaryStats(result.summary_stats)
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
          <h1 className="header-title">OTD Risk Intelligence Dashboard</h1>
        </div>
        <div className="header-badge">Dashboard</div>
      </SiteHeader>

      <div className="main-layout" style={{ height: 'calc(100vh - 54px)' }}>
        <main className="content">

          {/* Upload section */}
          <div className="section">
            <h2 className="section-title">Upload OTD Risk File</h2>
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
                  <span className="tab3-file-rows">{supplierOtd.length} suppliers loaded</span>
                </div>
              )}
              {status === 'error' && <span className="tab3-upload-error">{errorMsg}</span>}
            </div>
          </div>

          {summaryStats ? (
            <>
              {/* 6-card summary banner */}
              <div className="section">
                <SummaryBar stats={summaryStats} />
              </div>

              {/* SUPPLIER OTD + MONTHLY OTD side by side */}
              <div className="section">
                <div className="otdr-tables-row">
                  <div className="otdr-table-col">
                    <h2 className="section-title otdr-section-title">SUPPLIER OTD</h2>
                    <SupplierOtdTable rows={supplierOtd} />
                  </div>
                  <div className="otdr-table-col">
                    <h2 className="section-title otdr-section-title">MONTHLY OTD</h2>
                    <MonthlyOtdTable rows={monthlyOtd} />
                  </div>
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
                <p>Upload an Excel file with <strong>LW_Data</strong> and <strong>CW_Data</strong> sheets to generate the dashboard.</p>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}
