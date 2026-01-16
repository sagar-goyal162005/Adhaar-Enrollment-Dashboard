import Plot from "react-plotly.js";

const STATE_CENTROIDS = {
  "Andaman And Nicobar Islands": { lat: 11.74, lon: 92.66 },
  "Andhra Pradesh": { lat: 15.91, lon: 79.74 },
  "Arunachal Pradesh": { lat: 28.22, lon: 94.73 },
  Assam: { lat: 26.2, lon: 92.94 },
  Bihar: { lat: 25.09, lon: 85.31 },
  Chandigarh: { lat: 30.73, lon: 76.78 },
  Chhattisgarh: { lat: 21.28, lon: 81.86 },
  "Dadra And Nagar Haveli And Daman And Diu": { lat: 20.18, lon: 73.02 },
  "Nct Of Delhi": { lat: 28.61, lon: 77.21 },
  Goa: { lat: 15.3, lon: 74.12 },
  Gujarat: { lat: 22.26, lon: 71.19 },
  Haryana: { lat: 29.06, lon: 76.09 },
  "Himachal Pradesh": { lat: 31.1, lon: 77.17 },
  "Jammu And Kashmir": { lat: 33.78, lon: 76.58 },
  Jharkhand: { lat: 23.61, lon: 85.28 },
  Karnataka: { lat: 15.32, lon: 75.71 },
  Kerala: { lat: 10.85, lon: 76.27 },
  Ladakh: { lat: 34.15, lon: 77.58 },
  Lakshadweep: { lat: 10.56, lon: 72.64 },
  "Madhya Pradesh": { lat: 22.97, lon: 78.65 },
  Maharashtra: { lat: 19.75, lon: 75.71 },
  Manipur: { lat: 24.66, lon: 93.91 },
  Meghalaya: { lat: 25.47, lon: 91.36 },
  Mizoram: { lat: 23.16, lon: 92.94 },
  Nagaland: { lat: 26.16, lon: 94.56 },
  Odisha: { lat: 20.95, lon: 85.1 },
  Puducherry: { lat: 11.94, lon: 79.81 },
  Punjab: { lat: 31.15, lon: 75.34 },
  Rajasthan: { lat: 27.02, lon: 74.22 },
  Sikkim: { lat: 27.53, lon: 88.51 },
  "Tamil Nadu": { lat: 11.13, lon: 78.66 },
  Telangana: { lat: 18.11, lon: 79.02 },
  Tripura: { lat: 23.94, lon: 91.99 },
  "Uttar Pradesh": { lat: 26.85, lon: 80.91 },
  Uttarakhand: { lat: 30.07, lon: 79.02 },
  "West Bengal": { lat: 22.99, lon: 87.85 },
};

function normalizeState(state) {
  if (!state) return "";
  let s = String(state).trim();
  s = s.replace(/&/g, "and");
  s = s.replace(/\s+/g, " ");
  s = s.toLowerCase();
  const map = {
    "andaman & nicobar islands": "Andaman And Nicobar Islands",
    "andaman and nicobar islands": "Andaman And Nicobar Islands",
    "dadra and nagar haveli": "Dadra And Nagar Haveli And Daman And Diu",
    "daman and diu": "Dadra And Nagar Haveli And Daman And Diu",
    "dadra and nagar haveli and daman and diu": "Dadra And Nagar Haveli And Daman And Diu",
    delhi: "Nct Of Delhi",
    "nct of delhi": "Nct Of Delhi",
    "national capital territory of delhi": "Nct Of Delhi",
    orissa: "Odisha",
    pondicherry: "Puducherry",
    "jammu & kashmir": "Jammu And Kashmir",
  };
  if (map[s]) return map[s];
  return s
    .split(" ")
    .map((w) => (w === "and" || w === "of" ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

export default function GeographicMap({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  const stateTotals = new Map();
  for (const row of data) {
    const s = normalizeState(row.state);
    if (!s) continue;
    stateTotals.set(s, (stateTotals.get(s) || 0) + row.total_enrolments);
  }

  const points = [...stateTotals.entries()]
    .map(([state, total]) => ({ state, total, geo: STATE_CENTROIDS[state] }))
    .filter((p) => p.geo);

  points.sort((a, b) => b.total - a.total);

  const max = points[0]?.total || 1;
  const lats = points.map((p) => p.geo.lat);
  const lons = points.map((p) => p.geo.lon);
  const labels = points.map((p) => p.state);
  const values = points.map((p) => p.total);
  const sizes = points.map((p) => 12 + (p.total / max) * 40);

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 bg-[color:var(--brand)] text-white font-extrabold">India Enrollment Map</div>
      <div className="p-4">
        <Plot
          data={[
            {
              type: "scattergeo",
              lat: lats,
              lon: lons,
              text: labels,
              mode: "markers+text",
              textposition: "top center",
              marker: {
                size: sizes,
                color: values,
                colorscale: "YlOrRd",
                showscale: true,
                colorbar: { title: "Enrollments" },
                line: { color: "#111827", width: 0.5 },
                opacity: 0.75,
              },
              hovertemplate: "%{text}<br>Enrollments: %{marker.color:,}<extra></extra>",
            },
          ]}
          layout={{
            geo: {
              scope: "asia",
              projection: { type: "mercator" },
              center: { lat: 22.5, lon: 79 },
              lonaxis: { range: [65, 100] },
              lataxis: { range: [6, 37] },
              showland: true,
              landcolor: "#f3f4f6",
              showcountries: true,
              countrycolor: "#d1d5db",
              showlakes: true,
              lakecolor: "#dbeafe",
              bgcolor: "white",
            },
            margin: { l: 10, r: 10, t: 10, b: 10 },
            height: 420,
            paper_bgcolor: "white",
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: "100%" }}
        />
      </div>
    </div>
  );
}
