import { useRef, useState } from 'react'
import { uploadExcel, fetchDataVersion } from '../api/client'

export default function UploadWidget({ onUploadSuccess }) {
  const inputRef = useRef(null)
  const [status, setStatus] = useState('idle') // 'idle' | 'uploading' | 'success' | 'error'
  const [message, setMessage] = useState('')

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setStatus('uploading')
    setMessage('')
    try {
      const result = await uploadExcel(file)
      setStatus('success')
      setMessage(`${file.name} (${result.rows} rows)`)
      let newVersion
      try {
        const { version } = await fetchDataVersion()
        newVersion = version
      } catch {
        // version fetch failed — upload still succeeded
      }
      onUploadSuccess(newVersion)
    } catch (err) {
      setStatus('error')
      setMessage(err.message)
    } finally {
      e.target.value = ''
    }
  }

  return (
    <div className="upload-widget">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <button
        className={`upload-btn upload-btn--${status}`}
        onClick={() => inputRef.current.click()}
        disabled={status === 'uploading'}
      >
        {status === 'uploading' ? 'Uploading...' : 'Upload Excel'}
      </button>
      {status === 'success' && (
        <span className="upload-status upload-status--success">{message}</span>
      )}
      {status === 'error' && (
        <span className="upload-status upload-status--error">{message}</span>
      )}
    </div>
  )
}
