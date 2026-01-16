import Plot from "react-plotly.js";

function formatCompact(n) {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(Math.round(n));
}

export default function StateDistrictHeatmap({ data, topStates = 10, topDistricts = 20, getValue }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  const valueFn = typeof getValue === "function" ? getValue : (row) => row.total_enrolments;

  const stateTotals = new Map();
  const districtTotals = new Map();
  for (const row of data) {
    const v = Number(valueFn(row)) || 0;
    stateTotals.set(row.state, (stateTotals.get(row.state) || 0) + v);
    districtTotals.set(row.district, (districtTotals.get(row.district) || 0) + v);
  }

  const topStateNames = [...stateTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topStates)
    .map(([name]) => name);

  const topDistrictNames = [...districtTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topDistricts)
    .map(([name]) => name);

  const matrix = topDistrictNames.map(() => topStateNames.map(() => 0));

  const stateIndex = new Map(topStateNames.map((s, i) => [s, i]));
  const districtIndex = new Map(topDistrictNames.map((d, i) => [d, i]));

  for (const row of data) {
    const si = stateIndex.get(row.state);
    const di = districtIndex.get(row.district);
    if (si == null || di == null) continue;
    matrix[di][si] += Number(valueFn(row)) || 0;
  }

  const maxVal = Math.max(0, ...matrix.flat());
  const text = matrix.map((row) => row.map((v) => (v ? formatCompact(v) : "")));
  const textColor = matrix.map((row) =>
    row.map((v) => {
      if (!v) return "rgba(0,0,0,0)";
      // Use white on darker cells
      return v >= maxVal * 0.55 ? "#FFFFFF" : "#111827";
    }),
  );

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 bg-white text-[color:var(--brand)] font-extrabold border-b border-gray-200">
        Top Districts × Top States (Enrollment Heatmap with Values)
      </div>
      <div className="p-4">
        <Plot
          data={[
            {
              type: "heatmap",
              x: topStateNames,
              y: topDistrictNames,
              z: matrix,
              zmin: 0,
              colorscale: "YlOrRd",
              xgap: 2,
              ygap: 2,
              text,
              texttemplate: "%{text}",
              textfont: { size: 11, color: textColor },
              hovertemplate: "State: %{x}<br>District: %{y}<br>Enrollments: %{z:,}<extra></extra>",
              showscale: true,
              colorbar: { title: "Enrollments" },
            },
          ]}
          layout={{
            margin: { l: 170, r: 20, t: 10, b: 80 },
            height: 520,
            paper_bgcolor: "white",
            // plot background becomes the gridline color via xgap/ygap
            plot_bgcolor: "#000000",
            xaxis: {
              title: "State",
              tickangle: -35,
              automargin: true,
              showgrid: false,
              zeroline: false,
              color: "#6B7280",
            },
            yaxis: {
              title: "District",
              automargin: true,
              showgrid: false,
              zeroline: false,
              color: "#6B7280",
            },
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: "100%" }}
        />
      </div>
    </div>
  );

}
