import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

const STAGE_COLORS = [
  '#1D4ED8',
  '#16A34A',
  '#DC2626',
  '#D97706',
  '#7C3AED',
  '#0891B2',
  '#BE185D',
  '#65A30D',
  '#EA580C',
]

export default function Chart2({ data }) {
  const { data: chartData, stages } = data

  if (!chartData || chartData.length === 0) {
    return <div className="no-data">No data available for the selected filters.</div>
  }

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={420}>
        <BarChart
          data={chartData}
          margin={{ top: 16, right: 24, left: 8, bottom: 8 }}
          barCategoryGap="30%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="Month" tick={{ fontSize: 12, fill: '#555' }} />
          <YAxis
            domain={[0, 100]}
            tickFormatter={v => `${v}%`}
            tick={{ fontSize: 12, fill: '#555' }}
            label={{
              value: '% Share',
              angle: -90,
              position: 'insideLeft',
              offset: 10,
              style: { fontSize: 12, fill: '#555' },
            }}
          />
          <Tooltip
            formatter={(value, name) => [`${value}%`, name]}
            contentStyle={{ fontSize: 12, borderRadius: 6 }}
            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          {stages.map((stage, idx) => (
            <Bar
              key={stage}
              dataKey={stage}
              stackId="stack"
              fill={STAGE_COLORS[idx % STAGE_COLORS.length]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
