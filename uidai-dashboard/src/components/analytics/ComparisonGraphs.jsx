import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
} from "recharts";

function monthKeyFromRow(row) {
  if (row?.month) return String(row.month);
  const d = row?.date instanceof Date ? row.date : new Date(row?.date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("default", { month: "short", year: "numeric" });
}

function byMonth(rows, getValue) {
  const acc = new Map();
  for (const r of rows) {
    const key = monthKeyFromRow(r);
    if (!key) continue;
    acc.set(key, (acc.get(key) || 0) + (Number(getValue(r)) || 0));
  }
  return acc;
}

function safeSortMonthLabel(a, b) {
  // Labels like "Mar 2025". Date parsing is locale-sensitive; this is best-effort.
  return new Date(a).getTime() - new Date(b).getTime();
}

export default function ComparisonGraphs({ data, topStates = 10 }) {
  const model = useMemo(() => {
    const rows = Array.isArray(data) ? data : [];

    const stateTotals = new Map();
    for (const r of rows) {
      const s = String(r?.state || "").trim();
      if (!s || s.toLowerCase() === "unknown") continue;
      stateTotals.set(s, (stateTotals.get(s) || 0) + (Number(r?.total_enrolments) || 0));
    }

    const top = [...stateTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, topStates)
      .map(([name]) => name);

    const byMonthAll = new Map();
    const monthSet = new Set();

    for (const state of top) {
      const series = byMonth(
        rows.filter((r) => r?.state === state),
        (r) => r.total_enrolments,
      );
      for (const [m, v] of series.entries()) {
        monthSet.add(m);
        if (!byMonthAll.has(m)) byMonthAll.set(m, {});
        byMonthAll.get(m)[state] = v;
      }
    }

    const ageSeries = new Map();
    for (const r of rows) {
      const m = monthKeyFromRow(r);
      if (!m) continue;
      monthSet.add(m);
      if (!ageSeries.has(m)) {
        ageSeries.set(m, { month: m, age_0_5: 0, age_5_17: 0, age_18_greater: 0 });
      }
      const bucket = ageSeries.get(m);
      bucket.age_0_5 += Number(r?.age_0_5) || 0;
      bucket.age_5_17 += Number(r?.age_5_17) || 0;
      bucket.age_18_greater += Number(r?.age_18_greater) || 0;
    }

    const months = [...monthSet].sort(safeSortMonthLabel);

    const stateChart = months.map((m) => ({ month: m, ...(byMonthAll.get(m) || {}) }));
    const ageChart = months.map((m) => ageSeries.get(m) || { month: m, age_0_5: 0, age_5_17: 0, age_18_greater: 0 });

    return { topStates: top, stateChart, ageChart };
  }, [data, topStates]);

  const palette = [
    "#2563EB",
    "#06B6D4",
    "#F97316",
    "#16A34A",
    "#9333EA",
    "#DC2626",
    "#0F766E",
    "#B45309",
    "#64748B",
    "#DB2777",
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 bg-[color:var(--brand)] text-white font-extrabold flex items-center gap-2">
          <span className="text-lg">🔄</span>
          <span>State-wise Comparison Over Time</span>
        </div>
        <div className="p-4">
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={model.stateChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} minTickGap={18} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v) => Number(v).toLocaleString()} />
              <Legend />
              {model.topStates.map((s, idx) => (
                <Line
                  key={s}
                  type="monotone"
                  dataKey={s}
                  stroke={palette[idx % palette.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <div className="text-xs text-gray-500 mt-2">Showing top {model.topStates.length} states by enrollments.</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 bg-white text-[color:var(--brand)] font-extrabold flex items-center gap-2 border-b border-gray-200">
          <span className="text-lg">📊</span>
          <span>Age Group Trends (Stacked)</span>
        </div>
        <div className="p-4">
          <ResponsiveContainer width="100%" height={360}>
            <AreaChart data={model.ageChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} minTickGap={18} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v) => Number(v).toLocaleString()} />
              <Legend />
              <Area type="monotone" dataKey="age_18_greater" stackId="1" stroke="#16A34A" fill="#86EFAC" name="18+ Years" />
              <Area type="monotone" dataKey="age_5_17" stackId="1" stroke="#F59E0B" fill="#FCD34D" name="5-17 Years" />
              <Area type="monotone" dataKey="age_0_5" stackId="1" stroke="#2563EB" fill="#93C5FD" name="0-5 Years" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
