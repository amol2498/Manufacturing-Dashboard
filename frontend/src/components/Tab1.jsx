import { useState, useEffect } from 'react'
import { fetchPivot1, fetchChart1 } from '../api/client'
import PivotTable1 from './PivotTable1'
import Chart1 from './Chart1'
import DownloadButton from './DownloadButton'
import { exportStandardPivot } from '../utils/exportExcel'

export default function Tab1({ filters }) {
  const [pivotData, setPivotData] = useState({ rows: [], columns: [] })
  const [chartData, setChartData] = useState({ data: [], stages: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showChart, setShowChart] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([fetchPivot1(filters), fetchChart1(filters)])
      .then(([pivot, chart]) => {
        setPivotData(pivot)
        setChartData(chart)
      })
      .catch(() => setError('Could not reach the server. The backend may be starting up — please retry in a moment.'))
      .finally(() => setLoading(false))
  }, [JSON.stringify(filters), retryCount])

  if (error) {
    return (
      <div className="section">
        <div className="error-msg">
          {error}
          <button className="retry-btn" onClick={() => setRetryCount(c => c + 1)}>Retry</button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="section">
        <div className="loading">Loading data…</div>
      </div>
    )
  }

  const grandTotal = pivotData.rows?.find(r => r['Stages'] === 'Grand Total')
  const totalLines = grandTotal?.Total ?? 0

  return (
    <div>
      <div className="summary-bar">
        <span className="summary-badge">Total PO Lines: <strong>{totalLines}</strong></span>
      </div>

      <div className="section">
        <div className="section-toolbar">
          <DownloadButton
            onClick={() => exportStandardPivot(pivotData.rows, pivotData.columns, 'PO_Lines_Analysis')}
            disabled={!pivotData.rows?.length}
          />
        </div>
        <PivotTable1 data={pivotData} />
      </div>

      <div className="section">
        <h2
          className={`section-title section-title-toggle${showChart ? ' open' : ''}`}
          onClick={() => setShowChart(v => !v)}
        >
          PO Lines — Month-wise &amp; Stage-wise
          <span className={`chevron${showChart ? ' open' : ''}`}>▼</span>
        </h2>
        {showChart && <Chart1 data={chartData} />}
      </div>
    </div>
  )
}
