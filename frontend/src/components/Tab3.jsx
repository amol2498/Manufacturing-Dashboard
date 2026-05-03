import { useRef, useState, useCallback, useEffect } from 'react'
import { uploadTab3Current, uploadTab3Previous, fetchPivot3 } from '../api/client'
import PivotTable3 from './PivotTable3'
import DownloadButton from './DownloadButton'
import { exportPivot3 } from '../utils/exportExcel'

function FileUploader({ label, uploadFn, onSuccess }) {
  const inputRef = useRef(null)
  const [status, setStatus]     = useState('idle')   // idle | uploading | success | error
  const [fileName, setFileName] = useState('')
  const [message, setMessage]   = useState('')

  const handleChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setStatus('uploading')
    setMessage('')
    try {
      const result = await uploadFn(file)
      setFileName(file.name)
      setStatus('success')
      setMessage(`${result.rows} rows`)
      onSuccess()
    } catch (err) {
      setStatus('error')
      setMessage(err.message)
    } finally {
      e.target.value = ''
    }
  }

  return (
    <div className="tab3-uploader">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      <button
        className={`tab3-upload-btn tab3-upload-btn--${status}`}
        onClick={() => inputRef.current.click()}
        disabled={status === 'uploading'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        {status === 'uploading' ? 'Uploading…' : label}
      </button>
      {status === 'success' && (
        <div className="tab3-file-info">
          <span className="tab3-file-name">{fileName}</span>
          <span className="tab3-file-rows">{message}</span>
        </div>
      )}
      {status === 'error' && (
        <span className="tab3-upload-error">{message}</span>
      )}
    </div>
  )
}

export default function Tab3({ filters }) {
  const [pivotData, setPivotData] = useState(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  const refreshPivot = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchPivot3(filters)
      setPivotData(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { refreshPivot() }, [refreshPivot])

  return (
    <div className="section" style={{ padding: '16px' }}>
      <div className="tab3-upload-row">
        <FileUploader
          label="Upload previous week data"
          uploadFn={uploadTab3Previous}
          onSuccess={refreshPivot}
        />
        <FileUploader
          label="Upload current week data"
          uploadFn={uploadTab3Current}
          onSuccess={refreshPivot}
        />
      </div>

      {loading && <div className="loading">Loading…</div>}
      {error   && <div className="error-msg">{error}</div>}
      {pivotData && pivotData.has_current && pivotData.has_previous && pivotData.stages.length > 0 && (
        <>
          <div className="section-toolbar">
            <DownloadButton
              onClick={() => exportPivot3(pivotData, 'Week_over_Week')}
            />
          </div>
          <PivotTable3 pivotData={pivotData} />
        </>
      )}
    </div>
  )
}
