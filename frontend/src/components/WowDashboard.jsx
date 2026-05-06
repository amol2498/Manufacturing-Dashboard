import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import SiteHeader from './SiteHeader'

// ── Excel parsing ──────────────────────────────────────────────────────────────

function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true })
        const sheetName = wb.SheetNames.find(n => /supplier/i.test(n)) ?? wb.SheetNames[0]
        const ws = wb.Sheets[sheetName]

        // Auto-detect header row that contains 'PO #'
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
        let headerRow = 0
        for (let i = 0; i < Math.min(raw.length, 5); i++) {
          if (raw[i].some(c => String(c ?? '').trim() === 'PO #')) { headerRow = i; break }
        }

        const rows = XLSX.utils.sheet_to_json(ws, { range: headerRow, defval: null, cellDates: true })
        resolve(rows.filter(r => r['PO #'] != null))
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

// ── Metric helpers ─────────────────────────────────────────────────────────────

const isOntime  = r => /ontime/i.test(String(r['Ontime/Delay'] ?? ''))
const isDelayed = r => /delay/i.test(String(r['Ontime/Delay'] ?? ''))

function computeMaxDaysLate(rows) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  let max = 0
  rows.filter(isDelayed).forEach(r => {
    const explicit = r['Days Late'] ?? r['# Days Late'] ?? r['No. of Days Late']
    if (explicit != null) {
      const n = Number(explicit)
      if (!isNaN(n) && n > max) max = n
      return
    }
    const due = r['Due Date'] ? new Date(r['Due Date']) : null
    if (due && !isNaN(due)) {
      const diff = Math.floor((today - due) / 86400000)
      if (diff > max) max = diff
    }
  })
  return max
}

function computeMetrics(lw, cw) {
  const lwTotal   = lw.length
  const cwTotal   = cw.length
  const lwOTD     = lwTotal ? +(lw.filter(isOntime).length / lwTotal * 100).toFixed(1) : 0
  const cwOTD     = cwTotal ? +(cw.filter(isOntime).length / cwTotal * 100).toFixed(1) : 0
  const lwDelayed = lw.filter(isDelayed).length
  const cwDelayed = cw.filter(isDelayed).length

  const lwDelayedPOs = new Set(lw.filter(isDelayed).map(r => String(r['PO #'])))
  const cwDelayedPOs = new Set(cw.filter(isDelayed).map(r => String(r['PO #'])))
  const newDelays = cw.filter(r => isDelayed(r) && !lwDelayedPOs.has(String(r['PO #']))).length
  const resolved  = lw.filter(r => isDelayed(r) && !cwDelayedPOs.has(String(r['PO #']))).length

  const cwMaxDays = computeMaxDaysLate(cw)

  return { lwTotal, cwTotal, lwOTD, cwOTD, lwDelayed, cwDelayed, newDelays, resolved, cwMaxDays }
}

// ── Supplier OTD computation ───────────────────────────────────────────────────

function computeSupplierOTD(rows) {
  const map = {}
  rows.forEach(r => {
    const name = String(r['Supplier Name'] || r['Supplier'] || '').trim()
    if (!name || name === 'undefined' || name === 'null') return
    if (!map[name]) map[name] = { total: 0, onTime: 0, delayed: 0 }
    map[name].total++
    if (isOntime(r)) map[name].onTime++
    else if (isDelayed(r)) map[name].delayed++
  })
  return Object.entries(map)
    .map(([name, d]) => ({
      name,
      total: d.total,
      onTime: d.onTime,
      delayed: d.delayed,
      otdPct: d.total ? +(d.onTime / d.total * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => b.total - a.total)
}

const PIE_COLORS = [
  '#1e3a5f','#2a6496','#16a34a','#d97706','#dc2626',
  '#7c3aed','#0891b2','#be185d','#65a30d','#ea580c',
]

function SupplierOTDTable({ rows, label }) {
  const data = computeSupplierOTD(rows)
  const pieData = data.map(r => ({ name: r.name, value: r.total }))

  return (
    <div className="monthly-otd-row">
      {/* Table */}
      <div className="sotd-panel monthly-otd-table-wrap">
        <p className="sotd-label">{label}</p>
        <div className="table-container">
          <table className="pivot-table sotd-table">
            <thead>
              <tr>
                <th className="sotd-th sotd-th-supplier">Supplier</th>
                <th className="sotd-th">Total</th>
                <th className="sotd-th sotd-th-ontime">On Time</th>
                <th className="sotd-th sotd-th-delayed">Delayed</th>
                <th className="sotd-th">OTD %</th>
              </tr>
            </thead>
            <tbody>
              {data.length ? data.map((row, i) => (
                <tr key={row.name}>
                  <td className="sotd-td sotd-supplier">
                    <span className="sotd-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    {row.name}
                  </td>
                  <td className="sotd-td">{row.total}</td>
                  <td className="sotd-td sotd-ontime-cell">{row.onTime}</td>
                  <td className="sotd-td sotd-delayed-cell">{row.delayed}</td>
                  <td className={`sotd-td sotd-otd ${row.otdPct >= 90 ? 'wow-good' : 'wow-bad'}`}>
                    {row.otdPct}%
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="no-data">No supplier data found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pie chart */}
      {pieData.length > 0 && (
        <div className="monthly-otd-chart-wrap">
          <p className="sotd-label" style={{ textAlign: 'center' }}>Total Lines by Supplier</p>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="45%"
                outerRadius={85}
                dataKey="value"
                labelLine={false}
                label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                  if (percent < 0.04) return null
                  const r = innerRadius + (outerRadius - innerRadius) * 0.55
                  const x = cx + r * Math.cos(-midAngle * Math.PI / 180)
                  const y = cy + r * Math.sin(-midAngle * Math.PI / 180)
                  return (
                    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central"
                      style={{ fontSize: 11, fontWeight: 700 }}>
                      {`${(percent * 100).toFixed(0)}%`}
                    </text>
                  )
                }}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v, name) => [v, name]} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ── Monthly OTD computation ────────────────────────────────────────────────────

function computeMonthlyOTD(rows) {
  const map = {}
  const fmt = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' })
  rows.forEach(r => {
    const due = r['Due Date'] ? new Date(r['Due Date']) : null
    if (!due || isNaN(due)) return
    const sort = due.getFullYear() * 100 + due.getMonth()
    const key  = fmt.format(new Date(due.getFullYear(), due.getMonth(), 1))
    if (!map[key]) map[key] = { total: 0, onTime: 0, delayed: 0, sort }
    map[key].total++
    if (isOntime(r)) map[key].onTime++
    else if (isDelayed(r)) map[key].delayed++
  })
  return Object.entries(map)
    .map(([month, d]) => ({
      month,
      total: d.total,
      onTime: d.onTime,
      delayed: d.delayed,
      otdPct: d.total ? +(d.onTime / d.total * 100).toFixed(1) : 0,
      sort: d.sort,
    }))
    .sort((a, b) => a.sort - b.sort)
}

function MonthlyOTDTable({ rows, label }) {
  const data = computeMonthlyOTD(rows)
  const otdClass = (pct) => pct >= 90 ? 'sotd-otd-good' : pct >= 70 ? 'sotd-otd-warn' : 'sotd-otd-bad'

  const chartData = data.map(r => ({
    month: r.month,
    'OTD %': r.otdPct,
  }))

  return (
    <div className="monthly-otd-row">
      {/* Table */}
      <div className="sotd-panel monthly-otd-table-wrap">
        <p className="sotd-label">{label}</p>
        <div className="table-container">
          <table className="pivot-table sotd-table">
            <thead>
              <tr>
                <th className="sotd-th sotd-th-supplier">Month</th>
                <th className="sotd-th">Total</th>
                <th className="sotd-th sotd-th-ontime">On Time</th>
                <th className="sotd-th sotd-th-delayed">Delayed</th>
                <th className="sotd-th">OTD %</th>
              </tr>
            </thead>
            <tbody>
              {data.length ? data.map(row => (
                <tr key={row.month}>
                  <td className="sotd-td sotd-supplier">{row.month}</td>
                  <td className="sotd-td">{row.total}</td>
                  <td className="sotd-td sotd-ontime-cell">{row.onTime}</td>
                  <td className="sotd-td sotd-delayed-cell">{row.delayed}</td>
                  <td className={`sotd-td sotd-otd ${otdClass(row.otdPct)}`}>{row.otdPct}%</td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="no-data">No monthly data found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bar chart */}
      {data.length > 0 && (
        <div className="monthly-otd-chart-wrap">
          <p className="sotd-label" style={{ textAlign: 'center' }}>Monthly OTD % Trend</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: 10, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: '#555' }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#555' }}
                domain={[0, 100]}
                tickFormatter={v => `${v}%`}
                label={{ value: 'OTD %', angle: -90, position: 'insideLeft', offset: -2, style: { fontSize: 11, fill: '#888' } }}
              />
              <Tooltip
                formatter={(v) => [`${v}%`, 'OTD %']}
                contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #dde1e7' }}
              />
              <Bar dataKey="OTD %" fill="#1e3a5f" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ── Banner helpers ─────────────────────────────────────────────────────────────

function getWeekEnding(rows) {
  let max = null
  rows.forEach(r => {
    const d = r['Due Date'] ? new Date(r['Due Date']) : null
    if (d && !isNaN(d) && (!max || d > max)) max = d
  })
  if (!max) return '—'
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(max)
}

function getSupplierList(rows) {
  const names = [...new Set(rows.map(r => String(r['Supplier Name'] || r['Supplier'] || '').trim()).filter(Boolean))]
  return names.join(' & ') || '—'
}

function DashboardBanner({ cwRows, lwRows }) {
  return (
    <div className="intel-banner">
      <h2 className="intel-banner-title">OTD Proactive Risk Intelligence Dashboard</h2>
      {cwRows && (
        <p className="intel-banner-sub">
          <span>Week Ending {getWeekEnding(cwRows)}</span>
          <span className="intel-sep">|</span>
          <span>Suppliers: {getSupplierList(cwRows)}</span>
          <span className="intel-sep">|</span>
          <span>CW Lines: {cwRows.length.toLocaleString()}</span>
          <span className="intel-sep">|</span>
          <span>LW Lines: {lwRows ? lwRows.length.toLocaleString() : '—'}</span>
          <span className="intel-sep">|</span>
          <span>Power Query Ready</span>
        </p>
      )}
    </div>
  )
}

// ── File uploader ──────────────────────────────────────────────────────────────

function FileUploader({ label, onLoaded }) {
  const ref = useRef(null)
  const [st, setSt] = useState({ status: 'idle', fileName: '', rows: 0, error: '' })

  const handleChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setSt(s => ({ ...s, status: 'loading', error: '' }))
    try {
      const rows = await parseExcelFile(file)
      setSt({ status: 'success', fileName: file.name, rows: rows.length, error: '' })
      onLoaded(rows)
    } catch (err) {
      setSt({ status: 'error', fileName: '', rows: 0, error: err.message })
    } finally {
      e.target.value = ''
    }
  }

  return (
    <div className="wow-uploader">
      <input ref={ref} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleChange} />
      <button
        className={`tab3-upload-btn${st.status === 'success' ? ' tab3-upload-btn--success' : ''}`}
        onClick={() => ref.current.click()}
        disabled={st.status === 'loading'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        {st.status === 'loading' ? 'Reading…' : label}
      </button>
      {st.status === 'success' && (
        <div className="tab3-file-info">
          <span className="tab3-file-name">{st.fileName}</span>
          <span className="tab3-file-rows">{st.rows.toLocaleString()} rows loaded</span>
        </div>
      )}
      {st.status === 'error' && <span className="tab3-upload-error">{st.error}</span>}
    </div>
  )
}

// ── Table cell helpers ─────────────────────────────────────────────────────────

function ChangeCell({ type, lw, cw }) {
  if (type === 'totalLines') {
    if (lw == null || cw == null) return <td className="wow-td wow-change">—</td>
    const diff = cw - lw
    const pct  = lw ? `${((diff / lw) * 100).toFixed(1)}%` : '—'
    return (
      <td className="wow-td wow-change wow-neutral">
        {diff >= 0 ? '+' : ''}{diff} ({pct})
      </td>
    )
  }
  if (type === 'otdRate') {
    const diff = +(cw - lw).toFixed(1)
    const good = diff >= 0
    return (
      <td className={`wow-td wow-change ${good ? 'wow-good' : 'wow-bad'}`}>
        {good ? '▲' : '▼'} {Math.abs(diff)}%
      </td>
    )
  }
  if (type === 'delayedLines') {
    const diff = lw - cw
    const good = diff >= 0
    return (
      <td className={`wow-td wow-change ${good ? 'wow-good' : 'wow-bad'}`}>
        {good ? '▼' : '▲'} {Math.abs(diff)} {good ? 'better' : 'worse'}
      </td>
    )
  }
  if (type === 'newDelays')   return <td className="wow-td wow-change wow-warn">→</td>
  if (type === 'resolved')    return <td className="wow-td wow-change wow-good">↑ Improvement</td>
  if (type === 'maxDaysLate') return <td className="wow-td wow-change wow-warn">⚠ Open</td>
  return <td className="wow-td wow-change">—</td>
}

function StatusCell({ type, lw, cw }) {
  if (type === 'otdRate') {
    const diff = cw - lw
    if (diff < -5) return <td className="wow-td wow-status wow-bad">At Risk</td>
    if (diff < 0)  return <td className="wow-td wow-status wow-warn">Monitor</td>
    return <td className="wow-td wow-status wow-good">On Track</td>
  }
  if (type === 'maxDaysLate') return <td className="wow-td wow-status wow-warn">Open</td>
  return <td className="wow-td wow-status">—</td>
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function WowDashboard() {
  const [lwRows, setLwRows] = useState(null)
  const [cwRows, setCwRows] = useState(null)

  const metrics = lwRows && cwRows ? computeMetrics(lwRows, cwRows) : null

  return (
    <div className="app">
      <SiteHeader>
        <div>
          <h1 className="header-title">Week On Week Dashboard</h1>
        </div>
        <div className="header-badge">Dashboard</div>
      </SiteHeader>

      <div className="main-layout" style={{ height: 'calc(100vh - 54px)' }}>
        <main className="content">

          {/* ── Intelligence banner (title always, subtitle after data loads) ── */}
          <DashboardBanner cwRows={cwRows} lwRows={lwRows} />

          {/* ── Upload section ── */}
          <div className="section">
            <h2 className="section-title">Upload Weekly Data</h2>
            <div className="tab3-upload-row">
              <FileUploader label="Last Week Data" onLoaded={setLwRows} />
              <FileUploader label="Current Week Data" onLoaded={setCwRows} />
            </div>
          </div>

          {/* ── Supplier OTD Performance ── */}
          {cwRows && (
            <div className="section">
              <h2 className="section-title">Supplier OTD Performance</h2>
              <SupplierOTDTable rows={cwRows} label="Current Week" />
            </div>
          )}

          {/* ── Monthly OTD Breakdown ── */}
          {cwRows && (
            <div className="section">
              <h2 className="section-title">Monthly OTD Breakdown</h2>
              <MonthlyOTDTable rows={cwRows} label="Current Week" />
            </div>
          )}

          {/* ── Comparison report ── */}
          {metrics ? (
            <div className="section">
              <h2 className="section-title">Week on Week Comparison</h2>
              <div className="table-container">
                <table className="pivot-table wow-table">
                  <thead>
                    <tr>
                      <th className="wow-th wow-th-metric">Metric</th>
                      <th className="wow-th">Last Week</th>
                      <th className="wow-th">Current Week</th>
                      <th className="wow-th">Change</th>
                      <th className="wow-th">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="wow-td wow-metric">Total Lines</td>
                      <td className="wow-td wow-lw">{metrics.lwTotal.toLocaleString()}</td>
                      <td className="wow-td wow-cw">{metrics.cwTotal.toLocaleString()}</td>
                      <ChangeCell type="totalLines" lw={metrics.lwTotal} cw={metrics.cwTotal} />
                      <StatusCell type="totalLines" />
                    </tr>
                    <tr>
                      <td className="wow-td wow-metric">OTD Rate %</td>
                      <td className="wow-td wow-lw">{metrics.lwOTD}%</td>
                      <td className="wow-td wow-cw">{metrics.cwOTD}%</td>
                      <ChangeCell type="otdRate" lw={metrics.lwOTD} cw={metrics.cwOTD} />
                      <StatusCell type="otdRate" lw={metrics.lwOTD} cw={metrics.cwOTD} />
                    </tr>
                    <tr>
                      <td className="wow-td wow-metric">Delayed Lines</td>
                      <td className="wow-td wow-lw">{metrics.lwDelayed}</td>
                      <td className="wow-td wow-cw">{metrics.cwDelayed}</td>
                      <ChangeCell type="delayedLines" lw={metrics.lwDelayed} cw={metrics.cwDelayed} />
                      <StatusCell type="delayedLines" />
                    </tr>
                    <tr>
                      <td className="wow-td wow-metric">New Delays</td>
                      <td className="wow-td wow-lw wow-dash">—</td>
                      <td className="wow-td wow-cw">{metrics.newDelays}</td>
                      <ChangeCell type="newDelays" />
                      <StatusCell type="newDelays" />
                    </tr>
                    <tr>
                      <td className="wow-td wow-metric">Resolved</td>
                      <td className="wow-td wow-lw wow-dash">—</td>
                      <td className="wow-td wow-cw">{metrics.resolved}</td>
                      <ChangeCell type="resolved" />
                      <StatusCell type="resolved" />
                    </tr>
                    <tr>
                      <td className="wow-td wow-metric">Max Days Late</td>
                      <td className="wow-td wow-lw wow-dash">—</td>
                      <td className="wow-td wow-cw">{metrics.cwMaxDays > 0 ? `${metrics.cwMaxDays}d` : '0d'}</td>
                      <ChangeCell type="maxDaysLate" />
                      <StatusCell type="maxDaysLate" />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="section">
              <div className="dummy-content">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p>Upload both <strong>Last Week</strong> and <strong>Current Week</strong> files above to generate the comparison report.</p>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}
