import { useMemo, useState } from "react";
import CalendarHeatmap from "../charts/CalendarHeatmap";
import StateDistrictHeatmap from "../charts/StateDistrictHeatmap";

const AGE_TABS = [
  { key: "total", label: "Total" },
  { key: "age_0_5", label: "0-5" },
  { key: "age_5_17", label: "5-17" },
  { key: "age_18_greater", label: "18+" },
];

export default function AgeGroupHeatmaps({ data }) {
  const [active, setActive] = useState("total");

  const getValue = useMemo(() => {
    if (active === "total") return (r) => r.total_enrolments;
    return (r) => r?.[active];
  }, [active]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {AGE_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            className={[
              "px-3 py-2 rounded-lg text-sm font-bold border transition",
              active === t.key
                ? "bg-[color:var(--brand)] text-white border-[color:var(--brand)]"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <CalendarHeatmap data={data} getValue={getValue} variant="heatmap" />
        <StateDistrictHeatmap data={data} getValue={getValue} />
      </div>

      <div className="text-xs text-gray-500">
        Tip: switch tabs to compare intensity by age group.
      </div>
    </div>
  );
}
