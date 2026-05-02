import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, LabelList,
} from 'recharts'

const COLOR_DELAY = '#DC2626'
const COLOR_DOCK  = '#1D4ED8'

export default function Chart5({ pivotData }) {
  const { rows, columns } = pivotData

  if (!rows || rows.length === 0) return null

  const monthCols = columns.filter(c => c !== 'Metric' && c !== 'Total')
  const delayRow  = rows.find(r => r['Metric'] === 'Delay Line')
  const dockRow   = rows.find(r => r['Metric'] === 'Docking Lines')

  if (!delayRow && !dockRow) return null

  const chartData = monthCols.map(m => ({
    Month:         m,
    'Delay Lines': delayRow?.[m] ?? 0,
    'Dock Lines':  dockRow?.[m]  ?? 0,
  }))

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={360}>
        <BarChart
          data={chartData}
          margin={{ top: 24, right: 24, left: 8, bottom: 8 }}
          barCategoryGap="35%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="Month" tick={{ fontSize: 12, fill: '#555' }} />
          <YAxis tick={{ fontSize: 12, fill: '#555' }} allowDecimals={false} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 6 }}
            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Bar dataKey="Delay Lines" stackId="a" fill={COLOR_DELAY} radius={[0, 0, 0, 0]}>
            <LabelList dataKey="Delay Lines" position="inside" style={{ fontSize: 11, fill: '#fff', fontWeight: 700 }}
              formatter={v => v > 0 ? v : ''} />
          </Bar>
          <Bar dataKey="Dock Lines" stackId="a" fill={COLOR_DOCK} radius={[4, 4, 0, 0]}>
            <LabelList dataKey="Dock Lines" position="inside" style={{ fontSize: 11, fill: '#fff', fontWeight: 700 }}
              formatter={v => v > 0 ? v : ''} />
            <LabelList dataKey="Dock Lines" position="top" style={{ fontSize: 11, fill: '#374151', fontWeight: 700 }}
              formatter={(v, entry) => {
                const delay = entry?.['Delay Lines'] ?? 0
                return v + delay > 0 ? v + delay : ''
              }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
