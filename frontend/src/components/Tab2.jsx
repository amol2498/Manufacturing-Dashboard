import { useState, useEffect } from 'react'
import { fetchPivot2, fetchChart2 } from '../api/client'
import PivotTable2 from './PivotTable2'
import Chart2 from './Chart2'

export default function Tab2({ filters }) {
  const [pivotData, setPivotData] = useState({ rows: [], columns: [] })
  const [chartData, setChartData] = useState({ data: [], stages: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showChart, setShowChart] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([fetchPivot2(filters), fetchChart2(filters)])
      .then(([pivot, chart]) => {
        setPivotData(pivot)
        setChartData(chart)
      })
      .catch(() => setError('Failed to load data. Please check that the backend is running on port 8000.'))
      .finally(() => setLoading(false))
  }, [JSON.stringify(filters)])

  if (error) return <div className="section"><div className="error-msg">{error}</div></div>
  if (loading) return <div className="section"><div className="loading">Loading data…</div></div>

  return (
    <div>
      <div className="section">
        <h2 className="section-title">Pivot Table 2 — Stage % Share by Month</h2>
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
