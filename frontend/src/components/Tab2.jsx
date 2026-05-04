import { useState, useEffect } from 'react'
import { fetchPivot2, fetchChart2 } from '../api/client'
import PivotTable2 from './PivotTable2'
import Chart2 from './Chart2'
import DownloadButton from './DownloadButton'
import { exportStandardPivot } from '../utils/exportExcel'

export default function Tab2({ filters }) {
  const [pivotData, setPivotData] = useState({ rows: [], columns: [] })
  const [chartData, setChartData] = useState({ data: [], stages: [] })
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [showChart, setShowChart] = useState(true)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([fetchPivot2(filters), fetchChart2(filters)])
      .then(([pivot, chart]) => {
        setPivotData(pivot)
        setChartData(chart)
      })
      .catch(() => setError('Could not reach the server. The backend may be starting up — please retry in a moment.'))
      .finally(() => setLoading(false))
  }, [JSON.stringify(filters), retryCount])

  if (error)   return <div className="section"><div className="error-msg">{error} <button className="retry-btn" onClick={() => setRetryCount(c => c + 1)}>Retry</button></div></div>
  if (loading) return <div className="section"><div className="loading">Loading data…</div></div>

  return (
    <div>
      <div className="section">
        <div className="section-toolbar">
          <DownloadButton
            onClick={() => exportStandardPivot(pivotData.rows, pivotData.columns, 'Stage_Distribution')}
            disabled={!pivotData.rows?.length}
          />
        </div>
        <PivotTable2 data={pivotData} />
      </div>
      <div className="section">
        <h2
          className={`section-title section-title-toggle${showChart ? ' open' : ''}`}
          onClick={() => setShowChart(v => !v)}
        >
          Stage % Share — Month-wise
          <span className={`chevron${showChart ? ' open' : ''}`}>▼</span>
        </h2>
        {showChart && <Chart2 data={chartData} />}
      </div>
    </div>
  )
}
