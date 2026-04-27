const METRIC_COL = 'Metric'
const PCT_ROWS   = new Set(['% OTD with Past Due', '% OTD without Past Due'])
const DIVIDER_ABOVE = new Set(['Total Lines', '% OTD with Past Due'])

function fmt(metric, value) {
  if (value === undefined || value === null) return ''
  if (PCT_ROWS.has(metric)) return value === 0 ? '0.0%' : `${value}%`
  return value === 0 ? '' : value
}

export default function PivotTable4({ data }) {
  const { rows, columns } = data

  if (!rows || rows.length === 0) {
    return <div className="no-data">No data available for the selected filters.</div>
  }

  const monthCols = columns.filter(c => c !== METRIC_COL && c !== 'Total')

  return (
    <div className="table-container">
      <table className="pivot-table pivot-table-4">
        <thead>
          <tr>
            <th className="col-metric">OTD Projection</th>
            {monthCols.map(col => (
              <th key={col} className="col-number">{col}</th>
            ))}
            <th className="col-number col-total-header">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const metric = row[METRIC_COL]
            const isPct      = PCT_ROWS.has(metric)
            const isTotalRow = metric === 'Total Lines'
            const hasDivider = DIVIDER_ABOVE.has(metric)
            const cls = [
              isPct      ? 'p4-pct-row'   : '',
              isTotalRow ? 'p4-total-row' : '',
              hasDivider ? 'p4-divider'   : '',
            ].filter(Boolean).join(' ')

            return (
              <tr key={idx} className={cls}>
                <td className="col-metric">{metric}</td>
                {monthCols.map(col => (
                  <td key={col} className="col-number">
                    {fmt(metric, row[col])}
                  </td>
                ))}
                <td className="col-number col-total-cell">
                  {fmt(metric, row['Total'])}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
