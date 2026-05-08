import { useState, useEffect, useRef } from 'react'
import { Routes, Route } from 'react-router-dom'
import SiteHeader from './components/SiteHeader'
import FilterPanel from './components/FilterPanel'
import Tab1 from './components/Tab1'
import Tab3 from './components/Tab3'
import Tab2 from './components/Tab2'
import Tab4 from './components/Tab4'
import Tab5 from './components/Tab5'
import RecordsPage from './components/RecordsPage'
import OTDRiskDashboard from './components/OTDRiskDashboard'
import DetailsDashboard from './components/DetailsDashboard'
import WowComparisonDashboard from './components/WowComparisonDashboard'
import OTDProjectionsDashboard from './components/OTDProjectionsDashboard'
import UploadWidget from './components/UploadWidget'
import { fetchDataVersion } from './api/client'
import './App.css'

/**
 * App – Root component (MVC View layer).
 * Manages:
 *   - Active tab selection
 *   - Global filter state (passed down to FilterPanel and Tab components)
 */

const TABS = [
  { id: 1, label: 'PO Lines Analysis' },
  { id: 2, label: 'Stage-wise Distribution' },
  { id: 3, label: 'Week-over-Week' },
  { id: 4, label: 'OTD Projection' },
  { id: 5, label: 'Past Due Recovery for Delay lines' },
]

const INITIAL_FILTERS = {
  supplier_names: [],
  stages: [],
  ontime_delay: [],
  delay_category: [],
  months: [],
  item_number: '',
  po_number: '',
}

export default function App() {
  const [activeTab, setActiveTab] = useState(() => {
    const saved = parseInt(localStorage.getItem('activeTab'), 10)
    return TABS.some(t => t.id === saved) ? saved : 1
  })

  const handleTabChange = (id) => {
    setActiveTab(id)
    localStorage.setItem('activeTab', id)
  }
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [filterKey, setFilterKey] = useState(0)
  const [backendReady, setBackendReady] = useState(false)
  const isReady = useRef(false)
  const knownVersion = useRef(null)

  const handleUploadSuccess = (newVersion) => {
    if (newVersion !== undefined) knownVersion.current = newVersion
    setFilters(INITIAL_FILTERS)
    setFilterKey(k => k + 1)
  }
  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const { version } = await fetchDataVersion()
        if (cancelled) return
        if (!isReady.current) {
          isReady.current = true
          knownVersion.current = version
          setBackendReady(true)
        } else if (version !== knownVersion.current) {
          knownVersion.current = version
          setFilters(INITIAL_FILTERS)
          setFilterKey(k => k + 1)
        }
      } catch {
        // keep polling — backend still starting up
      }
    }
    poll()
    const id = setInterval(poll, 5000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  return (
    <Routes>
      <Route path="/records" element={<RecordsPage />} />
<Route path="/otd-risk-dashboard" element={<OTDRiskDashboard />} />
      <Route path="/details" element={<DetailsDashboard />} />
      <Route path="/wow-comparison" element={<WowComparisonDashboard />} />
      <Route path="/otd-projections-dashboard" element={<OTDProjectionsDashboard />} />
      <Route path="/" element={
        <div className="app">
          {/* ── Header ── */}
          <SiteHeader>
            <div>
              <h1 className="header-title">Proactive OTD Risk Line Identification</h1>
            </div>
            <UploadWidget onUploadSuccess={handleUploadSuccess} />
            <div className="header-badge">Dashboard</div>
          </SiteHeader>

          {/* ── Connecting splash — shown during B1 cold start ── */}
          {!backendReady ? (
            <div className="connecting-overlay">
              <div className="connecting-box">
                <div className="connecting-spinner" />
                <p className="connecting-msg">Connecting to server, please wait…</p>
                <p className="connecting-sub">The server may take up to 2 minutes to start on first load.</p>
              </div>
            </div>
          ) : (
            /* ── Main layout: sidebar + content ── */
            <div className="main-layout">
              {/* Left sidebar – Filters */}
              <aside className="sidebar">
                <FilterPanel key={filterKey} filters={filters} onFilterChange={setFilters} />
              </aside>

              {/* Right area – Tabs + content */}
              <main className="content">
                {/* Tab bar */}
                <div className="tab-bar">
                  {TABS.map(tab => (
                    <button
                      key={tab.id}
                      className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                      onClick={() => handleTabChange(tab.id)}
                    >
                      <span className="tab-label">{tab.label}</span>
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div className="tab-content">
                  {activeTab === 1 && <Tab1 key={filterKey} filters={filters} />}
                  {activeTab === 2 && <Tab2 key={filterKey} filters={filters} />}
                  {activeTab === 3 && <Tab3 filters={filters} />}
                  {activeTab === 4 && <Tab4 key={filterKey} filters={filters} />}
                  {activeTab === 5 && <Tab5 key={filterKey} filters={filters} />}
                </div>
              </main>
            </div>
          )}
        </div>
      } />
    </Routes>
  )
}