import { useState, useRef } from 'react'
import SiteHeader from './SiteHeader'
import { uploadDetails } from '../api/client'

const AGING_COLOR = {
  '60+ Days':   { bg: '#c0392b', color: '#fff' },
  '31-60 Days': { bg: '#e74c3c', color: '#fff' },
  '15-30 Days': { bg: '#e67e22', color: '#fff' },
  '8-14 Days':  { bg: '#f39c12', color: '#fff' },
  '1-7 Days':   { bg: '#f1c40f', color: '#333' },
}

const COLUMNS = [
  { key: 'item_number',  label: 'Item #'       },
  { key: 'po_number',    label: 'PO #'         },
  { key: 'supplier',     label: 'Supplier'     },
  { key: 'site',         label: 'Site'         },
  { key: 'due_date',     label: 'Due Date'     },
  { key: 'days_late',    label: 'Days Late'    },
  { key: 'stage',        label: 'Stage'        },
  { key: 'qty_due',      label: 'Qty Due'      },
  { key: 'aging_bucket', label: 'Aging Bucket' },
  { key: 'category',     label: 'Category'     },
  { key: 'delay_reason', label: 'Delay Reason' },
  { key: 'commit_date',  label: 'Commit Date'  },
]

function sortRows(rows, col, dir) {
  return [...rows].sort((a, b) => {
    let av = a[col], bv = b[col]
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    if (typeof av === 'number' && typeof bv === 'number') return dir === 'asc' ? av - bv : bv - av
    return dir === 'asc'
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av))
  })
}

const DAYS_LATE_OPTIONS = [
  { label: 'All',       min: null },
  { label: '≥ 1 day',  min: 1    },
  { label: '≥ 8 days', min: 8    },
  { label: '≥ 15 days', min: 15  },
  { label: '≥ 31 days', min: 31  },
  { label: '≥ 61 days', min: 61  },
]

export default function DetailsDashboard() {
  const [status, setStatus]       = useState('idle')
  const [fileName, setFileName]   = useState('')
  const [errorMsg, setErrorMsg]   = useState('')
  const [rows, setRows]           = useState([])
  const [sortCol, setSortCol]     = useState('days_late')
  const [sortDir, setSortDir]     = useState('desc')
  const [filterAging, setFilterAging]       = useState('')
  const [filterDaysLate, setFilterDaysLate] = useState('≥ 61 days')
  const fileRef = useRef(null)

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setStatus('loading')
    setErrorMsg('')
    try {
      const result = await uploadDetails(file)
      setRows(result.delay_details)
      setFileName(file.name)
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setErrorMsg(err.message)
    } finally {
      e.target.value = ''
    }
  }

  const handleSort = (key) => {
    if (sortCol === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(key)
      setSortDir(key === 'days_late' ? 'desc' : 'asc')
    }
  }

  const daysLateMin = DAYS_LATE_OPTIONS.find(o => o.label === filterDaysLate)?.min ?? null

  const displayRows = sortRows(rows, sortCol, sortDir).filter(row => {
    if (filterAging && row.aging_bucket !== filterAging) return false
    if (daysLateMin != null && (row.days_late == null || row.days_late < daysLateMin)) return false
    return true
  })

  const agingOptions = Object.keys(AGING_COLOR)

  return (
    <div className="app">
      <SiteHeader>
        <div>
          <h1 className="header-title">Details — All Delay Lines</h1>
        </div>
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
                  <span className="tab3-file-rows">{rows.length} delayed lines loaded</span>
                </div>
              )}
              {status === 'error' && <span className="tab3-upload-error">{errorMsg}</span>}
            </div>
          </div>

          {/* Table */}
          {rows.length > 0 ? (
            <div className="section">
              <div className="details-summary-bar">
                <span className="details-count">
                  <span className="details-count-num">{displayRows.length}</span>
                  {displayRows.length !== rows.length && (
                    <span> of {rows.length}</span>
                  )} delayed lines
                </span>
                <div className="details-filters">
                  <label className="details-filter-label">Days Late</label>
                  <select
                    className="details-filter-select"
                    value={filterDaysLate}
                    onChange={e => setFilterDaysLate(e.target.value)}
                  >
                    <option value="">All</option>
                    {DAYS_LATE_OPTIONS.filter(o => o.min != null).map(o => (
                      <option key={o.label} value={o.label}>{o.label}</option>
                    ))}
                  </select>
                  <label className="details-filter-label">Aging Bucket</label>
                  <select
                    className="details-filter-select"
                    value={filterAging}
                    onChange={e => setFilterAging(e.target.value)}
                  >
                    <option value="">All</option>
                    {agingOptions.map(bucket => (
                      <option key={bucket} value={bucket}>{bucket}</option>
                    ))}
                  </select>
                  {(filterAging || filterDaysLate) && (
                    <button
                      className="details-filter-clear"
                      onClick={() => { setFilterAging(''); setFilterDaysLate('') }}
                    >✕ Clear</button>
                  )}
                </div>
              </div>
              <div className="details-table-wrap">
                <table className="details-table">
                  <thead>
                    <tr>
                      {COLUMNS.map(col => (
                        <th key={col.key} className="details-th" onClick={() => handleSort(col.key)}>
                          {col.label}
                          <span className="details-sort-icon">
                            {sortCol === col.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅'}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayRows.map((row, i) => {
                      const aging = AGING_COLOR[row.aging_bucket]
                      return (
                        <tr key={i} className={`details-row ${i % 2 === 0 ? '' : 'details-row-alt'}`}>
                          <td className="details-td details-td-bold">{row.item_number}</td>
                          <td className="details-td">{row.po_number}</td>
                          <td className="details-td">{row.supplier}</td>
                          <td className="details-td">{row.site}</td>
                          <td className="details-td">{row.due_date}</td>
                          <td className="details-td details-td-center"
                            style={aging ? { background: aging.bg, color: aging.color, fontWeight: 700 } : {}}>
                            {row.days_late ?? ''}
                          </td>
                          <td className="details-td">{row.stage}</td>
                          <td className="details-td details-td-center">{row.qty_due}</td>
                          <td className="details-td"
                            style={aging ? { color: aging.bg, fontWeight: 600 } : {}}>
                            {row.aging_bucket}
                          </td>
                          <td className="details-td">{row.category}</td>
                          <td className="details-td">{row.delay_reason}</td>
                          <td className="details-td">{row.commit_date}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : status !== 'idle' && status !== 'loading' ? null : (
            <div className="section">
              <div className="dummy-content">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p>Upload an Excel file with a <strong>CW_Data</strong> sheet to view all delayed lines.</p>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}
