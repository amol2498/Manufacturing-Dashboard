import { useState } from 'react'
import FilterPanel from './components/FilterPanel'
import Tab1 from './components/Tab1'
import DummyTab from './components/DummyTab'
import Tab2 from './components/Tab2'
import Tab4 from './components/Tab4'
import Tab5 from './components/Tab5'
import UploadWidget from './components/UploadWidget'
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
  { id: 3, label: 'Pivot Table 3' },
  { id: 4, label: 'OTD Projection' },
  { id: 5, label: 'Past Due Recovery for Delay lines' },
]

const INITIAL_FILTERS = {
  stages: [],
  ontime_delay: [],
  delay_category: [],
  months: [],
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

  const handleUploadSuccess = () => {
    setFilters(INITIAL_FILTERS)
    setFilterKey(k => k + 1)
  }

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="header">
        <div>
          <h1 className="header-title">Proactive OTD Risk Line Identification</h1>
          <span className="header-sub">Supplier: Indo-Mim &nbsp;|&nbsp; Site: Niles</span>
        </div>
        <UploadWidget onUploadSuccess={handleUploadSuccess} />
        <div className="header-badge">Dashboard</div>
      </header>

      {/* ── Main layout: sidebar + content ── */}
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
                <span className="tab-num">Tab {tab.id}</span>
                <span className="tab-label">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="tab-content">
            {activeTab === 1 && <Tab1 key={filterKey} filters={filters} />}
            {activeTab === 2 && <Tab2 key={filterKey} filters={filters} />}
            {activeTab === 3 && <DummyTab title="Pivot Table 3" />}
            {activeTab === 4 && <Tab4 key={filterKey} filters={filters} />}
            {activeTab === 5 && <Tab5 key={filterKey} filters={filters} />}
          </div>
        </main>
      </div>
    </div>
  )
}
