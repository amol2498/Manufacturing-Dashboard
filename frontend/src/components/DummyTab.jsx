/**
 * DummyTab – Placeholder for Pivot Tables 2-5 (under development).
 */
export default function DummyTab({ title }) {
  return (
    <div className="section">
      <h2 className="section-title">{title}</h2>
      <div className="dummy-content">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M3 15h18M9 3v18" />
        </svg>
        <p>This pivot table is under development.</p>
        <p>Data will be available in a future release.</p>
      </div>
    </div>
  )
}
