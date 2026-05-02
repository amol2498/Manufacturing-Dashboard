/**
 * API Client – Controller layer for the React frontend.
 * Converts filter state into query params and fetches data from the Python backend.
 */

const BASE_URL = 'http://localhost:8000/api'

/** Convert filter object into URL query string, supporting multi-value params. */
function buildParams(filters) {
  const params = new URLSearchParams()
  if (filters.stages?.length)        filters.stages.forEach(v => params.append('stages', v))
  if (filters.ontime_delay?.length)  filters.ontime_delay.forEach(v => params.append('ontime_delay', v))
  if (filters.delay_category?.length) filters.delay_category.forEach(v => params.append('delay_category', v))
  if (filters.months?.length)        filters.months.forEach(v => params.append('months', v))
  return params.toString()
}

export async function fetchFilters() {
  const res = await fetch(`${BASE_URL}/filters`)
  if (!res.ok) throw new Error('Failed to fetch filters')
  return res.json()
}

export async function fetchPivot1(filters) {
  const params = buildParams(filters)
  const res = await fetch(`${BASE_URL}/pivot1?${params}`)
  if (!res.ok) throw new Error('Failed to fetch pivot data')
  return res.json()
}

export async function fetchChart1(filters) {
  const params = buildParams(filters)
  const res = await fetch(`${BASE_URL}/chart1?${params}`)
  if (!res.ok) throw new Error('Failed to fetch chart data')
  return res.json()
}

export async function fetchPivot2(filters) {
  const params = buildParams(filters)
  const res = await fetch(`${BASE_URL}/pivot2?${params}`)
  if (!res.ok) throw new Error('Failed to fetch pivot2 data')
  return res.json()
}

export async function fetchChart2(filters) {
  const params = buildParams(filters)
  const res = await fetch(`${BASE_URL}/chart2?${params}`)
  if (!res.ok) throw new Error('Failed to fetch chart2 data')
  return res.json()
}

export async function fetchPivot4(filters) {
  const params = buildParams(filters)
  const res = await fetch(`${BASE_URL}/pivot4?${params}`)
  if (!res.ok) throw new Error('Failed to fetch pivot4 data')
  return res.json()
}

export async function fetchPivot5(filters) {
  const params = buildParams(filters)
  const res = await fetch(`${BASE_URL}/pivot5?${params}`)
  if (!res.ok) throw new Error('Failed to fetch pivot5 data')
  return res.json()
}

export async function uploadExcel(file) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${BASE_URL}/upload`, { method: 'POST', body: formData })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }))
    throw new Error(err.detail || 'Upload failed')
  }
  return res.json()
}
