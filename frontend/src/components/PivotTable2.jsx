/**
 * PivotTable2 – Stage % share pivot table.
 * Rows = Stages, Columns = Months + Total.
 * Each cell shows what % of that month's POs belong to that stage.
 */
const STAGE_COL = 'Stages'

export default function PivotTable2({ data }) {
  const { rows, columns } = data

  if (!rows || rows.length === 0) {
    return <div className="no-data">No data available for the selected filters.</div>
  }

  const monthCols = columns.filter(c => c !== STAGE_COL && c !== 'Total')

  return (
    <div className="table-container">
      <table className="pivot-table">
        <thead>
          <tr>
            <th className="col-stage">Stages</th>
            {monthCols.map(col => (
              <th key={col} className="col-number">{col}</th>
            ))}
            <th className="col-number col-total-header">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const isTotalRow = row[STAGE_COL] === 'Grand Total'
            return (
              <tr key={idx} className={isTotalRow ? 'grand-total-row' : ''}>
                <td className="col-stage">{row[STAGE_COL]}</td>
                {monthCols.map(col => (
                  <td key={col} className="col-number">
                    {row[col] != null && row[col] !== 0 ? `${row[col]}%` : ''}
                  </td>
                ))}
                <td className="col-number col-total-cell">
                  {row['Total'] != null ? `${row['Total']}%` : ''}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
