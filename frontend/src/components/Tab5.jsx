import { useState, useEffect } from 'react'
import { fetchPivot5 } from '../api/client'
import PivotTable5 from './PivotTable5'
import Chart5 from './Chart5'
import DownloadButton from './DownloadButton'
import { exportStandardPivot } from '../utils/exportExcel'

export default function Tab5({ filters }) {
  const [pivotData, setPivotData] = useState({ rows: [], columns: [] })
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [showChart, setShowChart] = useState(true)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchPivot5(filters)
      .then(setPivotData)
      .catch(() => setError('Could not reach the server. The backend may be starting up — please retry in a moment.'))
      .finally(() => setLoading(false))
  }, [JSON.stringify(filters), retryCount])

  if (error)   return <div className="section"><div className="error-msg">{error} <button className="retry-btn" onClick={() => setRetryCount(c => c + 1)}>Retry</button></div></div>
  if (loading) return <div className="section"><div className="loading">Loading data…</div></div>

  const totalLines = pivotData.rows?.find(r => r['Metric'] === 'Total Lines')?.Total ?? 0

  return (
    <div>
      <div className="summary-bar">
        <span className="summary-badge">Total PO Lines: <strong>{totalLines}</strong></span>
      </div>
      <div className="section">
        <div className="section-toolbar">
          <DownloadButton
            onClick={() => exportStandardPivot(pivotData.rows, pivotData.columns, 'Past_Due_Recovery')}
            disabled={!pivotData.rows?.length}
          />
        </div>
        <PivotTable5 data={pivotData} />
      </div>
      <div className="section">
        <h2
          className={`section-title section-title-toggle${showChart ? ' open' : ''}`}
          onClick={() => setShowChart(v => !v)}
        >
          Delay Lines vs Dock Lines — Month-wise
          <span className={`chevron${showChart ? ' open' : ''}`}>▼</span>
        </h2>
        {showChart && <Chart5 pivotData={pivotData} />}
      </div>
    </div>
  )
}
