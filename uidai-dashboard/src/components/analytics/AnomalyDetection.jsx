import { useMemo } from "react";
import Plot from "react-plotly.js";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Scatter,
  Legend,
} from "recharts";

function toDate(d) {
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatISO(d) {
  const dt = toDate(d);
  return dt ? dt.toISOString().slice(0, 10) : "";
}

export default function AnomalyDetection({ data, zThreshold = 3 }) {
  const model = useMemo(() => {
    const rows = Array.isArray(data) ? data : [];

    const daily = new Map();
    for (const r of rows) {
      const dt = toDate(r?.date);
      if (!dt) continue;
      const key = formatISO(dt);
      daily.set(key, (daily.get(key) || 0) + (Number(r?.total_enrolments) || 0));
    }

    const points = [...daily.entries()]
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (points.length < 10) {
      return { points, anomalies: [], mean: 0, std: 0 };
    }

    const values = points.map((p) => p.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
    const std = Math.sqrt(variance) || 1;

    const scored = points.map((p) => ({
      ...p,
      z: (p.value - mean) / std,
    }));

    const anomalies = scored.filter((p) => Math.abs(p.z) >= zThreshold);

    return { points: scored, anomalies, mean, std };
  }, [data, zThreshold]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 bg-[color:var(--brand)] text-white font-extrabold flex items-center gap-2">
          <span className="text-lg">🚨</span>
          <span>Anomaly Detection (Daily Total)</span>
        </div>
        <div className="p-4">
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={model.points}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} minTickGap={18} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip
                formatter={(v, k, p) => {
                  if (k === "z") return [Number(v).toFixed(2), "z-score"];
                  return [Number(v).toLocaleString(), "enrollments"];
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="value" stroke="#1E88E5" strokeWidth={2} dot={false} name="Daily Total" />
              <Scatter
                name={`Anomalies (|z| ≥ ${zThreshold})`}
                data={model.anomalies}
                fill="#DC2626"
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="text-xs text-gray-500 mt-2">
            Uses simple z-score on daily totals.
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 bg-white text-[color:var(--brand)] font-extrabold flex items-center gap-2 border-b border-gray-200">
          <span className="text-lg">📦</span>
          <span>Outliers (Distribution)</span>
        </div>
        <div className="p-4">
          {model.points.length < 3 ? (
            <div className="text-sm text-gray-600">Not enough data to show distribution.</div>
          ) : (
            <Plot
              data={[
                {
                  type: "box",
                  name: "Daily Total",
                  y: model.points.map((p) => p.value),
                  boxpoints: false,
                  marker: { color: "#1E88E5" },
                  line: { color: "#1E88E5" },
                },
                {
                  type: "scatter",
                  mode: "markers",
                  name: `Anomalies (|z| ≥ ${zThreshold})`,
                  x: new Array(model.anomalies.length).fill("Daily Total"),
                  y: model.anomalies.map((a) => a.value),
                  text: model.anomalies.map((a) => `${a.date} (z=${Number(a.z).toFixed(2)})`),
                  hovertemplate: "%{text}<br>Enrollments: %{y:,}<extra></extra>",
                  marker: { color: "#DC2626", size: 10, line: { color: "#991B1B", width: 1 } },
                },
              ]}
              layout={{
                height: 320,
                margin: { l: 50, r: 10, t: 10, b: 40 },
                yaxis: { title: "Enrollments" },
                xaxis: { title: "" },
                showlegend: true,
              }}
              config={{ responsive: true, displaylogo: false }}
              style={{ width: "100%" }}
            />
          )}
          <div className="text-xs text-gray-500 mt-2">
            Distribution view helps validate whether anomalies are true outliers.
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="text-sm font-extrabold text-[color:var(--brand)]">Detected Anomalies</div>
        {model.anomalies.length === 0 ? (
          <div className="text-sm text-gray-600 mt-2">No anomalies detected for the selected period.</div>
        ) : (
          <div className="mt-3 overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Enrollments</th>
                  <th className="py-2 pr-4">z-score</th>
                </tr>
              </thead>
              <tbody>
                {model.anomalies
                  .slice(0, 20)
                  .map((a) => (
                    <tr key={a.date} className="border-b last:border-b-0">
                      <td className="py-2 pr-4 font-medium text-gray-900">{a.date}</td>
                      <td className="py-2 pr-4 text-gray-800">{Math.round(a.value).toLocaleString()}</td>
                      <td className="py-2 pr-4 text-gray-800">{Number(a.z).toFixed(2)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
