const METRIC_COL  = 'Metric'
const TOTAL_ROW   = 'Total Past Due Lines'

export default function PivotTable5({ data }) {
  const { rows, columns } = data

  if (!rows || rows.length === 0) {
    return <div className="no-data">No data available for the selected filters.</div>
  }

  const monthCols = columns.filter(c => c !== METRIC_COL && c !== 'Total')

  return (
    <div className="table-container">
      <table className="pivot-table pivot-table-5">
        <thead>
          <tr>
            <th className="col-metric"></th>
            {monthCols.map(col => (
              <th key={col} className="col-number">{col}</th>
            ))}
            <th className="col-number col-total-header">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.filter(r => r[METRIC_COL] !== 'Total Lines').map((row, idx) => {
            const metric     = row[METRIC_COL]
            const isTotalRow = metric === TOTAL_ROW
            return (
              <tr key={idx} className={isTotalRow ? 'p5-total-row' : ''}>
                <td className="col-metric">{metric}</td>
                {monthCols.map(col => (
                  <td key={col} className="col-number">
                    {row[col] ? row[col] : ''}
                  </td>
                ))}
                <td className="col-number col-total-cell">
                  {row['Total'] || ''}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
