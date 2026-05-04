/**
 * API Client – Controller layer for the React frontend.
 * Converts filter state into query params and fetches data from the Python backend.
 */

const BASE_URL = import.meta.env.VITE_API_URL

// One UUID per browser tab, persisted across page refreshes within the same tab.
const SESSION_ID = (() => {
  let id = sessionStorage.getItem('dashboardSessionId')
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem('dashboardSessionId', id)
  }
  return id
})()

/** Wrapper around fetch() that surfaces both network errors and HTTP error bodies. */
async function apiFetch(url, options) {
  let res
  try {
    res = await fetch(url, options)
  } catch (err) {
    // TypeError — browser could not reach the server at all
    throw new Error(`Network error (${err.message}) calling ${url.replace(BASE_URL, '')}`)
  }
  if (!res.ok) {
    let detail = `HTTP ${res.status} ${res.statusText}`
    try {
      const body = await res.clone().json()
      detail = body.detail || body.message || JSON.stringify(body)
    } catch {
      try { const t = await res.text(); if (t) detail = t } catch { /* ignore */ }
    }
    throw new Error(detail)
  }
  return res.json()
}

/** Convert filter object into URL query string, supporting multi-value params. */
function buildParams(filters) {
  const params = new URLSearchParams()
  params.append('session_id', SESSION_ID)
  if (filters.supplier_names?.length) filters.supplier_names.forEach(v => params.append('supplier_names', v))
  if (filters.stages?.length)         filters.stages.forEach(v => params.append('stages', v))
  if (filters.ontime_delay?.length)   filters.ontime_delay.forEach(v => params.append('ontime_delay', v))
  if (filters.delay_category?.length) filters.delay_category.forEach(v => params.append('delay_category', v))
  if (filters.months?.length)         filters.months.forEach(v => params.append('months', v))
  if (filters.item_number?.trim())    params.append('item_number', filters.item_number.trim())
  if (filters.po_number?.trim())      params.append('po_number', filters.po_number.trim())
  return params.toString()
}

export async function fetchFilters() {
  return apiFetch(`${BASE_URL}/filters?session_id=${SESSION_ID}`)
}

export async function fetchPivot1(filters) {
  return apiFetch(`${BASE_URL}/pivot1?${buildParams(filters)}`)
}

export async function fetchChart1(filters) {
  return apiFetch(`${BASE_URL}/chart1?${buildParams(filters)}`)
}

export async function fetchPivot2(filters) {
  return apiFetch(`${BASE_URL}/pivot2?${buildParams(filters)}`)
}

export async function fetchChart2(filters) {
  return apiFetch(`${BASE_URL}/chart2?${buildParams(filters)}`)
}

export async function fetchPivot4(filters) {
  return apiFetch(`${BASE_URL}/pivot4?${buildParams(filters)}`)
}

export async function fetchPivot5(filters) {
  return apiFetch(`${BASE_URL}/pivot5?${buildParams(filters)}`)
}

export async function fetchPivot3(filters) {
  return apiFetch(`${BASE_URL}/pivot3?${buildParams(filters || {})}`)
}

export async function fetchDataVersion() {
  return apiFetch(`${BASE_URL}/data-version?session_id=${SESSION_ID}`)
}

export async function uploadExcel(file) {
  const formData = new FormData()
  formData.append('file', file)
  return apiFetch(`${BASE_URL}/upload?session_id=${SESSION_ID}`, { method: 'POST', body: formData })
}

export async function uploadTab3Current(file) {
  const formData = new FormData()
  formData.append('file', file)
  return apiFetch(`${BASE_URL}/upload-tab3-current?session_id=${SESSION_ID}`, { method: 'POST', body: formData })
}

export async function uploadTab3Previous(file) {
  const formData = new FormData()
  formData.append('file', file)
  return apiFetch(`${BASE_URL}/upload-tab3-previous?session_id=${SESSION_ID}`, { method: 'POST', body: formData })
}
