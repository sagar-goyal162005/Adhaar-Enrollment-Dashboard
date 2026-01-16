import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

export default function TrendChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white p-6 rounded-xl shadow">
        <h3 className="font-semibold mb-3">Enrollment Trend</h3>
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  // Aggregate by month
  const monthlyData = data.reduce((acc, row) => {
    const month = row.month;
    if (!acc[month]) {
      acc[month] = { month, enrollments: 0 };
    }
    acc[month].enrollments += row.total_enrolments;
    return acc;
  }, {});

  const chartData = Object.values(monthlyData)
    .sort((a, b) => new Date(a.month) - new Date(b.month))
    .slice(-12); // Last 12 months

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="month" 
            tick={{ fontSize: 12 }}
            stroke="#666"
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            stroke="#666"
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
          />
          <Tooltip 
            formatter={(value) => value.toLocaleString()}
            contentStyle={{ backgroundColor: '#fff', border: '1px solid #ddd' }}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="enrollments" 
            stroke="#1E3A8A" 
            strokeWidth={3}
            dot={{ fill: '#1E3A8A', r: 4 }}
            activeDot={{ r: 6 }}
            name="Total Enrollments"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
