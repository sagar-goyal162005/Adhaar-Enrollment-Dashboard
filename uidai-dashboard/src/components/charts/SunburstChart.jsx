import { useMemo } from "react";
import Plot from "react-plotly.js";

const AGE_GROUPS = [
  { key: "age_0_5", label: "0-5 Years" },
  { key: "age_5_17", label: "5-17 Years" },
  { key: "age_18_greater", label: "18+ Years" },
];

export default function SunburstChart({
  data,
  maxDistrictsPerState = 15,
  mode = "total",
  ageGroups = ["age_0_5", "age_5_17", "age_18_greater"],
}) {
  const sunburst = useMemo(() => {
    if (!data || data.length === 0) return null;

    const stateTotals = new Map();
    const districtTotals = new Map(); // key: state||district
    const districtAgeTotals = new Map(); // key: state||district||ageKey

    let grandTotal = 0;
    for (const row of data) {
      const state = String(row.state || "Unknown").trim() || "Unknown";
      const district = String(row.district || "Unknown").trim() || "Unknown";

      if (mode === "ageBreakdown") {
        let rowTotal = 0;
        for (const g of ageGroups) {
          const v = Number(row?.[g] ?? 0);
          if (!Number.isFinite(v) || v <= 0) continue;
          rowTotal += v;
          const ageKey = `${state}||${district}||${g}`;
          districtAgeTotals.set(ageKey, (districtAgeTotals.get(ageKey) || 0) + v);
        }
        if (rowTotal <= 0) continue;

        grandTotal += rowTotal;
        stateTotals.set(state, (stateTotals.get(state) || 0) + rowTotal);
        const key = `${state}||${district}`;
        districtTotals.set(key, (districtTotals.get(key) || 0) + rowTotal);
      } else {
        const v = Number(row.total_enrolments || 0);
        if (!Number.isFinite(v) || v <= 0) continue;

        grandTotal += v;
        stateTotals.set(state, (stateTotals.get(state) || 0) + v);

        const key = `${state}||${district}`;
        districtTotals.set(key, (districtTotals.get(key) || 0) + v);
      }
    }

    if (grandTotal <= 0) return null;

    const ids = [];
    const labels = [];
    const parents = [];
    const values = [];

    const labelForAgeKey = (k) => AGE_GROUPS.find((x) => x.key === k)?.label ?? String(k);

    // Root
    ids.push("root");
    labels.push("India");
    parents.push("");
    values.push(grandTotal);

    // States
    const states = Array.from(stateTotals.entries()).sort((a, b) => b[1] - a[1]);
    for (const [state, stateTotal] of states) {
      const stateId = `state:${state}`;
      ids.push(stateId);
      labels.push(state);
      parents.push("root");
      values.push(stateTotal);

      // Districts within state
      const districts = [];
      for (const [key, total] of districtTotals.entries()) {
        const [s, d] = key.split("||");
        if (s === state) districts.push([d, total]);
      }

      districts.sort((a, b) => b[1] - a[1]);
      const top = districts.slice(0, maxDistrictsPerState);
      const rest = districts.slice(maxDistrictsPerState);

      for (const [district, total] of top) {
        const districtId = `district:${state}:${district}`;
        ids.push(districtId);
        labels.push(district);
        parents.push(stateId);
        values.push(total);

        if (mode === "ageBreakdown") {
          for (const g of ageGroups) {
            const ageTotal = districtAgeTotals.get(`${state}||${district}||${g}`) || 0;
            if (ageTotal <= 0) continue;
            const ageId = `age:${state}:${district}:${g}`;
            ids.push(ageId);
            labels.push(labelForAgeKey(g));
            parents.push(districtId);
            values.push(ageTotal);
          }
        }
      }

      if (rest.length > 0) {
        const otherTotal = rest.reduce((sum, [, t]) => sum + t, 0);
        const otherId = `district:${state}:__other__`;
        ids.push(otherId);
        labels.push("Other");
        parents.push(stateId);
        values.push(otherTotal);

        if (mode === "ageBreakdown") {
          for (const g of ageGroups) {
            let ageOther = 0;
            for (const [district] of rest) {
              ageOther += districtAgeTotals.get(`${state}||${district}||${g}`) || 0;
            }
            if (ageOther <= 0) continue;
            const ageId = `age:${state}:__other__:${g}`;
            ids.push(ageId);
            labels.push(labelForAgeKey(g));
            parents.push(otherId);
            values.push(ageOther);
          }
        }
      }
    }

    return { ids, labels, parents, values };
  }, [data, maxDistrictsPerState, mode, ageGroups]);

  if (!sunburst) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="text-sm font-extrabold text-[color:var(--brand)]">Sunburst</div>
        <div className="text-gray-600 mt-2">No data available for sunburst chart.</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <div>
          <div className="text-xs text-gray-500 font-bold uppercase tracking-wide">Sunburst</div>
          <div className="text-xl font-extrabold text-[color:var(--text)]">
            {mode === "ageBreakdown"
              ? "Enrollments by State → District → Age Group"
              : "Enrollments by State → District"}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            Showing top {maxDistrictsPerState} districts per state.
          </div>
        </div>
      </div>

      <Plot
        data={[
          {
            type: "sunburst",
            ids: sunburst.ids,
            labels: sunburst.labels,
            parents: sunburst.parents,
            values: sunburst.values,
            branchvalues: "total",
            insidetextorientation: "radial",
            hovertemplate: "%{label}<br>Enrollments: %{value:,}<extra></extra>",
          },
        ]}
        layout={{
          margin: { l: 0, r: 0, t: 10, b: 10 },
          height: 560,
        }}
        config={{ responsive: true, displaylogo: false }}
        style={{ width: "100%" }}
      />
    </div>
  );
}
