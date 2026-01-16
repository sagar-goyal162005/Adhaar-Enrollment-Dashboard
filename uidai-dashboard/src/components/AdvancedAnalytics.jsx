import { useMemo, useState } from "react";
import { BarChart2, GitCompare, Radar, Layers, AlertTriangle } from "lucide-react";
import ComparisonGraphs from "./analytics/ComparisonGraphs";
import AgeGroupHeatmaps from "./analytics/AgeGroupHeatmaps";
import AnomalyDetection from "./analytics/AnomalyDetection";
import SunburstChart from "./charts/SunburstChart";

export default function AdvancedAnalytics({ data }) {
  if (!data || data.length === 0) return null;

  const tabs = useMemo(
    () => [
      { key: "comparison", label: "Comparative Analysis", icon: <GitCompare className="w-4 h-4" /> },
      { key: "heatmaps", label: "Age Group Heatmaps", icon: <Radar className="w-4 h-4" /> },
      { key: "hierarchy", label: "Hierarchical View", icon: <Layers className="w-4 h-4" /> },
      { key: "anomaly", label: "Anomaly Detection", icon: <AlertTriangle className="w-4 h-4" /> },
    ],
    [],
  );

  const [active, setActive] = useState(tabs[0].key);

  const [sunburstMode, setSunburstMode] = useState("ageBreakdown");
  const [sunburstAgeGroups, setSunburstAgeGroups] = useState([
    "age_0_5",
    "age_5_17",
    "age_18_greater",
  ]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="rounded-lg p-2 bg-[color:var(--brand)]/10">
          <BarChart2 className="w-6 h-6 text-[color:var(--brand)]" />
        </div>
        <h2 className="text-2xl font-extrabold text-[color:var(--text)]">ADVANCED ANALYTICS</h2>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3 mb-5">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            className={[
              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-extrabold transition border",
              active === t.key
                ? "bg-[color:var(--brand)] text-white border-[color:var(--brand)]"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50",
            ].join(" ")}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {active === "comparison" && <ComparisonGraphs data={data} />}

      {active === "heatmaps" && <AgeGroupHeatmaps data={data} />}

      {active === "hierarchy" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 bg-[color:var(--brand)] text-white font-extrabold">Hierarchical View (Sunburst)</div>
          <div className="p-4">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-gray-600 uppercase tracking-wide">View</span>
                <button
                  type="button"
                  onClick={() => setSunburstMode("total")}
                  className={[
                    "px-3 py-2 rounded-lg text-sm font-extrabold border transition",
                    sunburstMode === "total"
                      ? "bg-[color:var(--brand)] text-white border-[color:var(--brand)]"
                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50",
                  ].join(" ")}
                >
                  Total
                </button>
                <button
                  type="button"
                  onClick={() => setSunburstMode("ageBreakdown")}
                  className={[
                    "px-3 py-2 rounded-lg text-sm font-extrabold border transition",
                    sunburstMode === "ageBreakdown"
                      ? "bg-[color:var(--brand)] text-white border-[color:var(--brand)]"
                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50",
                  ].join(" ")}
                >
                  Age Group Comparison
                </button>
              </div>

              {sunburstMode === "ageBreakdown" && (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-extrabold text-gray-600 uppercase tracking-wide">Age Groups</span>
                  {[
                    { key: "age_0_5", label: "0-5" },
                    { key: "age_5_17", label: "5-17" },
                    { key: "age_18_greater", label: "18+" },
                  ].map((g) => (
                    <label key={g.key} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <input
                        type="checkbox"
                        checked={sunburstAgeGroups.includes(g.key)}
                        onChange={() => {
                          setSunburstAgeGroups((prev) => {
                            const next = prev.includes(g.key)
                              ? prev.filter((x) => x !== g.key)
                              : [...prev, g.key];
                            return next.length ? next : prev; // keep at least one selected
                          });
                        }}
                        className="w-4 h-4 accent-[color:var(--brand)]"
                      />
                      <span>{g.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <SunburstChart
              data={data}
              mode={sunburstMode}
              ageGroups={sunburstAgeGroups}
            />
          </div>
        </div>
      )}

      {active === "anomaly" && <AnomalyDetection data={data} />}
    </div>
  );
}
