import { useState, useEffect } from 'react'
import { fetchPivot1, fetchChart1 } from '../api/client'
import PivotTable1 from './PivotTable1'
import Chart1 from './Chart1'

/**
 * Tab1 – Two sections:
 *   Section 1: Pivot Table 1 – PO Line count by Stage × On-time/Delay
 *   Section 2: Stacked bar chart – PO Lines month-wise and stage-wise
 */
export default function Tab1({ filters }) {
  const [pivotData, setPivotData] = useState({ rows: [], columns: [] })
  const [chartData, setChartData] = useState({ data: [], stages: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Re-fetch whenever filters change
  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([fetchPivot1(filters), fetchChart1(filters)])
      .then(([pivot, chart]) => {
        setPivotData(pivot)
        setChartData(chart)
      })
      .catch(() => setError('Failed to load data. Please check that the backend is running on port 8000.'))
      .finally(() => setLoading(false))
  }, [JSON.stringify(filters)])

  if (error) {
    return (
      <div className="section">
        <div className="error-msg">{error}</div>
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

  // Total PO lines from the Total row (last row)
  const grandTotal = pivotData.rows?.find(r => r['Stages (Column I)'] === 'Total')
  const totalLines = grandTotal?.Total ?? 0

  return (
    <div>
      {/* Summary badge */}
      <div className="summary-bar">
        <span className="summary-badge">Total PO Lines: <strong>{totalLines}</strong></span>
      </div>

      {/* Section 1 – Pivot Table */}
      <div className="section">
        <h2 className="section-title">Pivot Table 1 — PO Line Count by Stage</h2>
        <PivotTable1 data={pivotData} />
      </div>

      {/* Section 2 – Month-wise Stage-wise Chart */}
      <div className="section">
        <h2 className="section-title">PO Lines — Month-wise &amp; Stage-wise</h2>
        <Chart1 data={chartData} />
      </div>
    </div>
  )
}
