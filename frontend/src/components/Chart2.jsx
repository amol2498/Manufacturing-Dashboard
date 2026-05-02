import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

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
    <div style={{ padding: '8px 0' }}>
      {/* Shared legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 20px', justifyContent: 'center', marginBottom: 16 }}>
        {stages.map((stage, idx) => (
          <span key={stage} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#444' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: STAGE_COLORS[idx % STAGE_COLORS.length], display: 'inline-block' }} />
            {stage}
          </span>
        ))}
      </div>

      {/* Grid of donuts — one per month */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'center' }}>
        {chartData.map((monthEntry) => {
          const slices = stages
            .map((stage, idx) => ({ name: stage, value: monthEntry[stage] ?? 0, color: STAGE_COLORS[idx % STAGE_COLORS.length] }))
            .filter(s => s.value > 0)

          return (
            <div key={monthEntry.Month} style={{ textAlign: 'center', width: 160 }}>
              <PieChart width={160} height={160}>
                <Pie
                  data={slices}
                  cx={75}
                  cy={75}
                  innerRadius={42}
                  outerRadius={72}
                  dataKey="value"
                  strokeWidth={1}
                  labelLine={false}
                  label={({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
                    if (value < 6) return null
                    const RADIAN = Math.PI / 180
                    const r = innerRadius + (outerRadius - innerRadius) * 0.55
                    const x = cx + r * Math.cos(-midAngle * RADIAN)
                    const y = cy + r * Math.sin(-midAngle * RADIAN)
                    return (
                      <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
                        style={{ fontSize: 10, fontWeight: 700, fill: '#fff' }}>
                        {`${value}%`}
                      </text>
                    )
                  }}
                >
                  {slices.map((s, i) => (
                    <Cell key={i} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [`${value}%`, name]}
                  contentStyle={{ fontSize: 11, borderRadius: 6 }}
                />
              </PieChart>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginTop: 4 }}>
                {monthEntry.Month}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
