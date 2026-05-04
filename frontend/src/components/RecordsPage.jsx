import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchRecords } from '../api/client'

export default function RecordsPage() {
  const [searchParams] = useSearchParams()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const month = searchParams.get('month')
  const stage = searchParams.get('stage')
  const itemNumber = searchParams.get('item_number')
  const poNumber = searchParams.get('po_number')

  useEffect(() => {
    if (!month || !stage) {
      setError('Missing month or stage parameters')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    fetchRecords({ month, stage, item_number: itemNumber, po_number: poNumber })
      .then(data => {
        setRecords(data)
      })
      .catch(err => {
        setError('Could not load records: ' + err.message)
      })
      .finally(() => setLoading(false))
  }, [month, stage, itemNumber, poNumber])

  if (loading) {
    return (
      <div className="section">
        <div className="loading">Loading records…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="section">
        <div className="error-msg">{error}</div>
      </div>
    )
  }

  return (
    <div className="records-page">
      <div className="summary-bar">
        <span className="summary-badge">
          Records for Month: <strong>{month}</strong>, Stage: <strong>{stage}</strong>
          &nbsp;|&nbsp; Total Records: <strong>{records.length}</strong>
        </span>
        <button
          className="back-btn"
          onClick={() => window.history.back()}
        >
          ← Back to Dashboard
        </button>
      </div>

      <div className="section">
        {records.length === 0 ? (
          <div className="no-data">No records found for the selected filters.</div>
        ) : (
          <div className="table-container">
            <table className="records-table">
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>Item Number</th>
                  <th>Stage</th>
                  <th>Month</th>
                  <th>Supplier Name</th>
                  <th>On Time/Delay</th>
                  <th>Delay Category</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record, idx) => (
                  <tr key={idx}>
                    <td>{record['PO #'] || record['PO Number'] || ''}</td>
                    <td>{record['Item #'] || record['Item Number'] || ''}</td>
                    <td>{record['Stages'] || record['Stage'] || ''}</td>
                    <td>{record['Month'] || ''}</td>
                    <td>{record['Supplier Name'] || ''}</td>
                    <td>{record['Ontime/Delay'] || record['On Time/Delay'] || ''}</td>
                    <td>{record['Delay Category'] || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}