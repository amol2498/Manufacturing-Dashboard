import SiteHeader from './SiteHeader'

export default function WowDashboard() {
  return (
    <div className="app">
      <SiteHeader>
        <div>
          <h1 className="header-title">Week On Week Dashboard</h1>
        </div>
        <div className="header-badge">Dashboard</div>
      </SiteHeader>

      <div className="main-layout" style={{ height: 'calc(100vh - 54px)' }}>
        <main className="content">
          <div className="section">
            <h2 className="section-title">Week on Week Comparison</h2>
            <div className="dummy-content">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M3 15h18M9 3v18" />
              </svg>
              <p>This page is under development.</p>
              <p>Week on Week comparison data will be available in a future release.</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
