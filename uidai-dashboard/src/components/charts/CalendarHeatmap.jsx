import Plot from "react-plotly.js";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function formatShortNumber(value) {
  const n = Number(value) || 0;
  if (n >= 1_000_000) {
    const m = Math.round((n / 1_000_000) * 10) / 10;
    return `${String(m).replace(/\.0$/, "")}M`;
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n ? String(Math.round(n)) : "";
}

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function dayColor(dayIndex) {
  // Warm palette that fits the dashboard template
  const palette = ["#b91c1c", "#c2410c", "#d97706", "#ca8a04", "#65a30d", "#0ea5e9", "#6366f1"];
  return palette[dayIndex % palette.length];
}

function hexToRgba(hex, alpha) {
  const raw = hex.replace("#", "");
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function CalendarHeatmap({ data, getValue, variant = "ridge" }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  const weekSet = new Set();
  const byWeekDay = new Map();
  const valueFn = typeof getValue === "function" ? getValue : (row) => row.total_enrolments;

  for (const row of data) {
    const date = row.date instanceof Date ? row.date : new Date(row.date);
    if (Number.isNaN(date.getTime())) continue;

    const week = getISOWeek(date);
    const day = date.toLocaleDateString("en-US", { weekday: "long" });
    if (!DAYS.includes(day)) continue;

    weekSet.add(week);
    const key = `${week}__${day}`;
    byWeekDay.set(key, (byWeekDay.get(key) || 0) + (Number(valueFn(row)) || 0));
  }

  const weeks = [...weekSet].sort((a, b) => a - b);
  if (weeks.length === 0) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  if (variant === "heatmap") {
    const z = DAYS.map((day) => weeks.map((week) => byWeekDay.get(`${week}__${day}`) || 0));
    const maxZ = z.reduce((m, row) => Math.max(m, ...row), 0) || 1;
    const dtick = weeks.length > 40 ? 4 : weeks.length > 24 ? 2 : 1;
    const text = z.map((row) => row.map((v) => formatShortNumber(v)));

    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 bg-[color:var(--brand)] text-white font-extrabold">Enrollment Intensity by Week & Day</div>
        <div className="p-4">
          <Plot
            data={[
              {
                type: "heatmap",
                x: weeks,
                y: DAYS,
                z,
                text,
                texttemplate: "%{text}",
                textfont: { color: "#111827", size: 12 },
                colorscale: "RdYlGn",
                zmin: 0,
                zmax: maxZ,
                hovertemplate: "Day: %{y}<br>Week: %{x}<br>Enrollments: %{z:,}<extra></extra>",
                colorbar: { title: { text: "Enrollments" }, tickformat: "~s" },
                xgap: 2,
                ygap: 2,
              },
            ]}
            layout={{
              margin: { l: 80, r: 10, t: 10, b: 40 },
              height: 520,
              paper_bgcolor: "white",
              plot_bgcolor: "#000000",
              xaxis: {
                title: "Week of Year",
                tickmode: "linear",
                dtick,
                showgrid: false,
                zeroline: false,
                color: "#6B7280",
              },
              yaxis: {
                title: "",
                automargin: true,
                autorange: "reversed",
                showgrid: false,
                zeroline: false,
                color: "#6B7280",
              },
              font: { color: "#111827" },
            }}
            style={{ width: "100%" }}
            config={{ displayModeBar: false, responsive: true }}
          />
        </div>
      </div>
    );
  }

  // Ridge plot: one ridge per weekday, stacked with offsets (2.5D effect)
  const series = DAYS.map((day, dayIndex) => {
    const values = weeks.map((week) => byWeekDay.get(`${week}__${day}`) || 0);
    const max = values.reduce((m, v) => (v > m ? v : m), 0);
    return { day, dayIndex, values, max };
  });

  const globalMax = series.reduce((m, s) => (s.max > m ? s.max : m), 0) || 1;
  const ridgeHeight = 1.0;
  const gap = 1.15;
  const scale = ridgeHeight / globalMax;
  const dtick = weeks.length > 40 ? 4 : weeks.length > 24 ? 2 : 1;

  const traces = [];
  for (const s of series) {
    const offset = s.dayIndex * gap;
    const baseY = weeks.map(() => offset);
    const ridgeY = s.values.map((v) => offset + v * scale);
    const color = dayColor(s.dayIndex);

    // Baseline (invisible) so fill works with tonexty
    traces.push({
      type: "scatter",
      mode: "lines",
      x: weeks,
      y: baseY,
      line: { width: 0 },
      hoverinfo: "skip",
      showlegend: false,
    });

    // Filled ridge
    traces.push({
      type: "scatter",
      mode: "lines",
      x: weeks,
      y: ridgeY,
      fill: "tonexty",
      fillcolor: hexToRgba(color, 0.35),
      line: { color, width: 2 },
      customdata: s.values,
      hovertemplate: `Day: ${s.day}<br>Week: %{x}<br>Enrollments: %{customdata:,}<extra></extra>`,
      showlegend: false,
    });
  }

  const yTickVals = series.map((s) => s.dayIndex * gap + ridgeHeight * 0.45);
  const yMax = (DAYS.length - 1) * gap + ridgeHeight * 1.25;

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 bg-[color:var(--brand)] text-white font-extrabold">Enrollment Intensity by Week & Day</div>
      <div className="p-4">
        <Plot
          data={traces}
          layout={{
            margin: { l: 10, r: 10, t: 10, b: 30 },
            height: 520,
            paper_bgcolor: "white",
            plot_bgcolor: "white",
            xaxis: {
              title: "Week of Year",
              tickmode: "linear",
              dtick,
              gridcolor: "#E5E7EB",
              zerolinecolor: "#E5E7EB",
              color: "#6B7280",
            },
            yaxis: {
              title: "",
              tickmode: "array",
              tickvals: yTickVals,
              ticktext: DAYS,
              range: [-0.15, yMax],
              showgrid: false,
              zeroline: false,
              color: "#6B7280",
            },
            font: { color: "#111827" },
          }}
          style={{ width: "100%" }}
          config={{ displayModeBar: false, responsive: true }}
        />
      </div>
    </div>
  );
}
