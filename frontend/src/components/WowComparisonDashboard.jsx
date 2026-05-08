import { useState, useRef } from 'react'
import SiteHeader from './SiteHeader'
import { uploadWowComparison } from '../api/client'

// ── Signal helpers ─────────────────────────────────────────────────────────────

function getDelta(lw, cw, type) {
  if (type === 'otdRate') {
    const d = +(cw - lw).toFixed(1)
    return { text: `${d >= 0 ? '+' : ''}${d}%`, good: d >= 0 }
  }
  if (type === 'totalLines') {
    const diff = cw - lw
    const pct = lw ? `${((diff / lw) * 100).toFixed(1)}%` : '—'
    return { text: `${diff >= 0 ? '+' : ''}${diff} (${pct})`, good: null }
  }
  const diff = cw - lw
  return { text: `${diff >= 0 ? '+' : ''}${diff}`, good: diff <= 0 }
}

function getSignal(lw, cw, type) {
  if (type === 'totalLines') {
    return cw > lw
      ? { text: '▲ More lines',  cls: 'mbm-neutral' }
      : { text: '▼ Fewer lines', cls: 'mbm-neutral' }
  }
  if (type === 'otdRate') {
    const d = +(cw - lw).toFixed(1)
    return d >= 0
      ? { text: '✅ Improved',                   cls: 'mbm-good' }
      : { text: `🔴 Declined ${Math.abs(d)}%`,   cls: 'mbm-bad'  }
  }
  if (type === 'delayedLines') {
    const diff = lw - cw
    if (diff > 0)   return { text: `✅ Improved by ${diff}`,  cls: 'mbm-good' }
    if (diff === 0) return { text: '✅ No change',             cls: 'mbm-good' }
    return { text: `🔴 Worsened +${-diff}`, cls: 'mbm-bad' }
  }
  if (type === 'netDelay') {
    const diff = lw - cw
    if (diff > 0)   return { text: `✅ Net improvement ${diff} resolved`, cls: 'mbm-good' }
    if (diff === 0) return { text: '✅ No net change',                     cls: 'mbm-good' }
    return { text: `🔴 Net worsening +${-diff}`, cls: 'mbm-bad' }
  }
  if (type === 'maxDaysLate') {
    return cw <= lw
      ? { text: '✅ Improving',              cls: 'mbm-good' }
      : { text: `🔴 ${cw}d chronic delay`,  cls: 'mbm-bad'  }
  }
  if (type === 'pastDue') {
    if (cw === 0) return { text: '✅ None',                           cls: 'mbm-good' }
    if (cw <= lw) return { text: `🟡 ${cw} past due`,                 cls: 'mbm-warn' }
    return { text: `🔴 ${cw} past due — close urgently`, cls: 'mbm-bad' }
  }
  if (type === 'supplier') {
    const diff = cw - lw
    if (diff < 0)   return { text: '✅ Improving',             cls: 'mbm-good' }
    if (diff === 0) return { text: cw === 0 ? '✅ None' : '✅ Stable', cls: 'mbm-good' }
    if (diff <= 2)  return { text: `⚠️ +${diff} increase`,    cls: 'mbm-warn' }
    return { text: `🟡 Monitor — ${cw} delays`, cls: 'mbm-warn' }
  }
  if (type === 'site') {
    const diff = cw - lw
    if (diff < 0)   return { text: '✅ Better',        cls: 'mbm-good' }
    if (diff === 0) return { text: '✅ OK',             cls: 'mbm-good' }
    if (diff <= 5)  return { text: `🟡 ${cw} delays`,  cls: 'mbm-warn' }
    return { text: `🔴 Worst site — ${cw} delays`, cls: 'mbm-bad' }
  }
  return { text: '—', cls: '' }
}

// ── Table row ──────────────────────────────────────────────────────────────────

function MetricRow({ label, lw, cw, type, highlight }) {
  const d = getDelta(lw, cw, type)
  const s = getSignal(lw, cw, type)
  const lwFmt = type === 'otdRate' ? `${lw}%` : lw
  const cwFmt = type === 'otdRate' ? `${cw}%` : cw
  return (
    <tr className="mbm-row">
      <td className={`mbm-td mbm-metric${highlight ? ' mbm-highlight' : ''}`}>{label}</td>
      <td className="mbm-td mbm-formula-val">{lwFmt}</td>
      <td className="mbm-td mbm-lw">{lwFmt}</td>
      <td className="mbm-td mbm-cw">{cwFmt}</td>
      <td className={`mbm-td mbm-delta ${d.good === true ? 'mbm-delta-good' : d.good === false ? 'mbm-delta-bad' : 'mbm-delta-neutral'}`}>
        {d.text}
      </td>
      <td className={`mbm-td mbm-signal-cell ${s.cls}`}>{s.text}</td>
    </tr>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function WowComparisonDashboard() {
  const [status, setStatus]     = useState('idle')
  const [fileName, setFileName] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [data, setData]         = useState(null)
  const fileRef = useRef(null)

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setStatus('loading')
    setErrorMsg('')
    try {
      const result = await uploadWowComparison(file)
      setData(result)
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
        <div><h1 className="header-title">WoW Comparison — Metric by Metric</h1></div>
        <div className="header-badge">Dashboard</div>
      </SiteHeader>

      <div className="main-layout" style={{ height: 'calc(100vh - 54px)' }}>
        <main className="content">

          {/* Upload */}
          <div className="section">
            <h2 className="section-title">Upload OTD Risk File</h2>
            <div className="tab3-upload-row" style={{ marginTop: 12 }}>
              <input ref={fileRef} type="file" accept=".xlsx,.xls"
                style={{ display: 'none' }} onChange={handleFileChange} />
              <button
                className={`tab3-upload-btn${status === 'success' ? ' tab3-upload-btn--success' : ''}`}
                onClick={() => fileRef.current.click()}
                disabled={status === 'loading'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
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

          {data ? (
            <>
              {/* Section 1: Metric by Metric */}
              <div className="section">
                <div className="mbm-banner">
                  <span className="mbm-banner-icon">📊</span>
                  METRIC-BY-METRIC COMPARISON · All COUNTIF/COUNTIFS formulas · Hover each cell for formula
                </div>
                <div className="details-table-wrap">
                  <table className="mbm-table">
                    <thead>
                      <tr>
                        <th className="mbm-th mbm-th-metric">Metric</th>
                        <th className="mbm-th">Last Week Formula</th>
                        <th className="mbm-th">LW Value</th>
                        <th className="mbm-th">CW Value</th>
                        <th className="mbm-th">Δ Change</th>
                        <th className="mbm-th">Signal</th>
                      </tr>
                    </thead>
                    <tbody>
                      <MetricRow label="Total Lines"    lw={data.total_lines.lw}   cw={data.total_lines.cw}   type="totalLines"   />
                      <MetricRow label="OTD Rate %"     lw={data.otd_rate.lw}      cw={data.otd_rate.cw}      type="otdRate"      highlight />
                      <MetricRow label="Delayed Lines"  lw={data.delayed_lines.lw} cw={data.delayed_lines.cw} type="delayedLines" />
                      {data.supplier_rows.map(s => (
                        <MetricRow key={s.name} label={`${s.name} Delayed`} lw={s.lw} cw={s.cw} type="supplier" />
                      ))}
                      {data.site_rows.map(s => (
                        <MetricRow key={s.name} label={`${s.name} Delayed`} lw={s.lw} cw={s.cw} type="site" />
                      ))}
                      <MetricRow label="Max Days Late"           lw={data.max_days_late.lw}  cw={data.max_days_late.cw}  type="maxDaysLate"  />
                      <MetricRow label="Past Due Lines"          lw={data.past_due.lw}        cw={data.past_due.cw}        type="pastDue"      />
                      <MetricRow label="Net Delay Change (CW-LW)" lw={data.delayed_lines.lw} cw={data.delayed_lines.cw}  type="netDelay"     />
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 2: Supplier Delay Trend */}
              {data.supplier_delay_trend?.length > 0 && (
                <div className="section">
                  <div className="sdt-banner">
                    <span>📊</span>
                    SUPPLIER DELAY TREND · Week-on-Week Comparison · Sorted by Δ Change (worst first)
                  </div>
                  <div className="details-table-wrap">
                    <table className="sdt-table">
                      <thead>
                        <tr>
                          <th className="sdt-th sdt-th-supplier">Supplier</th>
                          <th className="sdt-th">LW Delays</th>
                          <th className="sdt-th">CW Delays</th>
                          <th className="sdt-th">Δ Change</th>
                          <th className="sdt-th">Trend</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.supplier_delay_trend.map((row, i) => {
                          const deltaSign = row.delta > 0 ? '+' : ''
                          const deltaCls  = row.delta < 0 ? 'sdt-delta-good'
                                          : row.delta > 0 ? 'sdt-delta-bad'
                                          : 'sdt-delta-neutral'
                          const trendCls  = row.trend.startsWith('✅') ? 'sdt-trend-improved' : 'sdt-trend-worsened'
                          return (
                            <tr key={row.supplier} className={`sdt-row${i % 2 === 1 ? ' sdt-row-alt' : ''}`}>
                              <td className="sdt-td sdt-supplier">{row.supplier}</td>
                              <td className="sdt-td sdt-num">{row.lw_delays}</td>
                              <td className="sdt-td sdt-num">{row.cw_delays}</td>
                              <td className={`sdt-td sdt-num ${deltaCls}`}>
                                {deltaSign}{row.delta}
                              </td>
                              <td className={`sdt-td ${trendCls}`}>{row.trend}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="section">
              <div className="dummy-content">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p>Upload an Excel file with <strong>LW_Data</strong> and <strong>CW_Data</strong> sheets to generate the comparison.</p>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}
