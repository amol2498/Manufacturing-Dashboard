import * as XLSX from 'xlsx'

function write(wsData, filename) {
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Data')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

export function exportStandardPivot(rows, columns, filename) {
  if (!rows?.length || !columns?.length) return
  write(
    [columns, ...rows.map(row => columns.map(col => row[col] ?? ''))],
    filename
  )
}

export function exportPivot3(pivotData, filename) {
  const { stages, months, data, grand_total } = pivotData
  if (!stages?.length || !months?.length) return

  const headers = ['Stages']
  months.forEach(m => {
    headers.push(`${m} - Last Week`)
    headers.push(`${m} - Current Week`)
  })

  const wsData = [headers]
  stages.forEach(stage => {
    const row = [stage]
    months.forEach(month => {
      const cell = data[stage]?.[month] ?? { previous: '', current: '' }
      row.push(cell.previous ?? '')
      row.push(cell.current  ?? '')
    })
    wsData.push(row)
  })

  const totalRow = ['Grand Total']
  months.forEach(month => {
    const cell = grand_total?.[month] ?? { previous: '', current: '' }
    totalRow.push(cell.previous ?? '')
    totalRow.push(cell.current  ?? '')
  })
  wsData.push(totalRow)

  write(wsData, filename)
}
