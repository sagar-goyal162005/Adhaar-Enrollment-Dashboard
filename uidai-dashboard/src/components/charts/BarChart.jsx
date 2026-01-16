import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell } from "recharts";

const COLOR_PALETTE = [
  "#1E88E5", // blue
  "#1565C0", // blue (darker)
  "#2E7D32", // green
  "#43A047", // green (alt)
  "#FB8C00", // orange
  "#F59E0B", // amber
  "#475569", // slate
  "#64748B", // slate (alt)
];

function hashStringToIndex(input, modulo) {
  const s = String(input ?? "");
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    // eslint-disable-next-line no-bitwise
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % modulo;
  return idx;
}

export default function StateBarChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white p-6 rounded-xl shadow">
        <h3 className="font-semibold mb-3">Top States by Enrollment</h3>
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  // Aggregate by state
  const stateData = data.reduce((acc, row) => {
    if (!acc[row.state]) {
      acc[row.state] = { state: row.state, value: 0 };
    }
    acc[row.state].value += row.total_enrolments;
    return acc;
  }, {});

  const chartData = Object.values(stateData)
    .sort((a, b) => b.value - a.value)
    .slice(0, 15); // Top 15 states

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={chartData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            type="number" 
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
          />
          <YAxis 
            type="category" 
            dataKey="state" 
            width={150}
            tick={{ fontSize: 11 }}
          />
          <Tooltip 
            formatter={(value) => value.toLocaleString()}
            contentStyle={{ backgroundColor: '#fff', border: '1px solid #ddd' }}
          />
          <Legend />
          <Bar 
            dataKey="value" 
            name="Total Enrollments"
            radius={[0, 8, 8, 0]}
          >
            {chartData.map((entry) => (
              <Cell
                key={entry.state}
                fill={COLOR_PALETTE[hashStringToIndex(entry.state, COLOR_PALETTE.length)]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
