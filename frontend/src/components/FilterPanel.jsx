import { useState, useEffect } from 'react'
import { fetchFilters } from '../api/client'

export default function FilterPanel({ filters, onFilterChange }) {
  const [options, setOptions] = useState({
    supplier_names: [],
    stages: [],
    ontime_delay: [],
    delay_category: [],
    months: [],
  })
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchFilters()
      .then(setOptions)
      .catch(() => setError('Could not load filters. Is the backend running?'))
  }, [])

  const toggle = (key, value) => {
    const current = filters[key] || []
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value]
    onFilterChange({ ...filters, [key]: updated })
  }

  const clearAll = () => {
    onFilterChange({ supplier_names: [], stages: [], ontime_delay: [], delay_category: [], months: [] })
  }

  if (error) return <div className="filter-error">{error}</div>

  return (
    <div className="filter-panel">
      <div className="filter-header">
        <h3>Filters</h3>
        <button className="clear-btn" onClick={clearAll}>Clear All</button>
      </div>

      {/* Supplier Name — combo box */}
      <div className="filter-group">
        <h4>Supplier Name</h4>
        <select
          className="filter-combo"
          value={filters.supplier_names?.[0] || ''}
          onChange={e => {
            const val = e.target.value
            onFilterChange({ ...filters, supplier_names: val ? [val] : [] })
          }}
        >
          <option value="">All Suppliers</option>
          {options.supplier_names.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <FilterGroup
        title="Stage"
        options={options.stages}
        selected={filters.stages}
        onToggle={v => toggle('stages', v)}
      />
      <FilterGroup
        title="On-Time / Delay"
        options={options.ontime_delay}
        selected={filters.ontime_delay}
        onToggle={v => toggle('ontime_delay', v)}
      />
      <FilterGroup
        title="Delay Category"
        options={options.delay_category}
        selected={filters.delay_category}
        onToggle={v => toggle('delay_category', v)}
      />
      <FilterGroup
        title="Dock Month"
        options={options.months}
        selected={filters.months}
        onToggle={v => toggle('months', v)}
      />
    </div>
  )
}

function FilterGroup({ title, options, selected, onToggle }) {
  if (!options.length) return null
  return (
    <div className="filter-group">
      <h4>{title}</h4>
      {options.map(opt => (
        <label key={opt} className="filter-option">
          <input
            type="checkbox"
            checked={selected?.includes(opt) || false}
            onChange={() => onToggle(opt)}
          />
          <span>{opt}</span>
        </label>
      ))}
    </div>
  )
}
