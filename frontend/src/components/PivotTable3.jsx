export default function PivotTable3({ pivotData }) {
  const { stages, months, data, grand_total, has_current, has_previous } = pivotData

  if (!stages.length) return null

  return (
    <div className="table-container" style={{ marginTop: '20px' }}>
      <table className="pivot-table pivot-table-3">
        <thead>
          {/* Row 1: title + month group headers */}
          <tr>
            <th className="col-stage p3-header-title" rowSpan={2}>
              Stages
            </th>
            {months.map(month => (
              <th key={month} colSpan={2} className="p3-month-header">
                {month}
              </th>
            ))}
          </tr>
          {/* Row 2: Last Week / Current Week per month */}
          <tr>
            {months.map(month => (
              <>
                <th key={`${month}-prev`} className="p3-week-header">
                  {has_previous ? 'Last Week' : '—'}
                </th>
                <th key={`${month}-curr`} className="p3-week-header">
                  {has_current ? 'Current Week' : '—'}
                </th>
              </>
            ))}
          </tr>
        </thead>
        <tbody>
          {stages.map(stage => (
            <tr key={stage}>
              <td className="col-stage">{stage}</td>
              {months.map(month => {
                const cell = data[stage]?.[month] ?? { current: 0, previous: 0 }
                return (
                  <>
                    <td key={`${stage}-${month}-prev`} className="col-number p3-prev-cell">
                      {cell.previous || ''}
                    </td>
                    <td key={`${stage}-${month}-curr`} className="col-number p3-curr-cell">
                      {cell.current || ''}
                    </td>
                  </>
                )
              })}
            </tr>
          ))}
          {/* Grand Total row */}
          <tr className="grand-total-row">
            <td className="col-stage">Grand Total</td>
            {months.map(month => {
              const cell = grand_total?.[month] ?? { current: 0, previous: 0 }
              return (
                <>
                  <td key={`total-${month}-prev`} className="col-number p3-prev-cell">
                    {cell.previous || ''}
                  </td>
                  <td key={`total-${month}-curr`} className="col-number p3-curr-cell">
                    {cell.current || ''}
                  </td>
                </>
              )
            })}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
