import { useMemo } from "react";
import { AlertTriangle, Trophy, Target } from "lucide-react";

function formatInt(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0";
  return Math.round(v).toLocaleString();
}

function daysBetween(start, end) {
  if (!(start instanceof Date) || !(end instanceof Date)) return 0;
  const ms = end.getTime() - start.getTime();
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.floor(ms / 86400000) + 1;
}

function normalizeDate(d) {
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default function ExecutiveSummaryReport({ data, dateRange, meta }) {
  const metrics = useMemo(() => {
    const rows = Array.isArray(data) ? data : [];

    const start = normalizeDate(dateRange?.start);
    const end = normalizeDate(dateRange?.end);

    const byState = new Map();
    let total = 0;
    let age0 = 0;
    let age5 = 0;
    let age18 = 0;

    for (const r of rows) {
      const state = String(r?.state || "").trim();
      if (!state || state.toLowerCase() === "unknown") continue;

      const t = Number(r?.total_enrolments) || 0;
      total += t;
      byState.set(state, (byState.get(state) || 0) + t);

      age0 += Number(r?.age_0_5) || 0;
      age5 += Number(r?.age_5_17) || 0;
      age18 += Number(r?.age_18_greater) || 0;
    }

    const statesCovered = byState.size;
    const districtsCovered = new Set(
      rows
        .map((r) => String(r?.district || "").trim())
        .filter((d) => d && d.toLowerCase() !== "unknown"),
    ).size;

    const topStates = [...byState.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, value], idx) => ({ rank: idx + 1, name, value }));

    const performanceTop10 = [...byState.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value }));

    const attention = [...byState.entries()]
      .sort((a, b) => a[1] - b[1])
      .slice(0, 2)
      .map(([name, value]) => ({ name, value }));

    const dominantAge = (() => {
      const pairs = [
        { label: "0-5 Years", value: age0 },
        { label: "5-17 Years", value: age5 },
        { label: "18+ Years", value: age18 },
      ].sort((a, b) => b.value - a.value);
      return pairs[0]?.label || "N/A";
    })();

    return {
      start,
      end,
      periodDays: daysBetween(start, end),
      topStates,
      attention,
      performanceTop10,
      statesCovered,
      districtsCovered,
      total,
      dominantAge,
    };
  }, [data, dateRange]);

  const records = useMemo(() => {
    const totalRecords = Number(meta?.totalRecords);
    const sampledRows = Number(meta?.sampledRows);
    const filteredRows = Number(meta?.filteredRows);

    return {
      totalRecords: Number.isFinite(totalRecords) ? totalRecords : null,
      sampledRows: Number.isFinite(sampledRows) ? sampledRows : null,
      filteredRows: Number.isFinite(filteredRows) ? filteredRows : (Array.isArray(data) ? data.length : null),
    };
  }, [meta, data]);

  const periodLabel =
    metrics.start && metrics.end
      ? `${metrics.start.toISOString().slice(0, 10)} to ${metrics.end.toISOString().slice(0, 10)} (${metrics.periodDays} days)`
      : "All available data";

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="min-w-[320px] flex-1">
          <div className="text-3xl font-extrabold text-[color:var(--text)] flex items-center gap-3">
            <span className="text-2xl">📊</span>
            <span>Executive Summary Report</span>
          </div>
          <div className="text-sm text-gray-600 mt-2">Analysis Period: {periodLabel}</div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div className="text-xs text-gray-500 font-bold uppercase tracking-wide">Total Records</div>
              <div className="text-2xl font-extrabold text-[color:var(--text)] mt-1">
                {records.totalRecords !== null ? records.totalRecords.toLocaleString() : "—"}
              </div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div className="text-xs text-gray-500 font-bold uppercase tracking-wide">Sampled Rows</div>
              <div className="text-2xl font-extrabold text-[color:var(--text)] mt-1">
                {records.sampledRows !== null ? records.sampledRows.toLocaleString() : "—"}
              </div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div className="text-xs text-gray-500 font-bold uppercase tracking-wide">Filtered Rows</div>
              <div className="text-2xl font-extrabold text-[color:var(--text)] mt-1">
                {records.filteredRows !== null ? records.filteredRows.toLocaleString() : "—"}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center gap-2 text-xl font-extrabold text-[color:var(--text)]">
              <Trophy className="w-6 h-6 text-amber-500" />
              <span>Top Performers:</span>
            </div>

            <div className="mt-3 space-y-2 text-sm">
              {metrics.topStates.map((s) => (
                <div key={s.name} className="text-gray-800">
                  <span className="font-bold">#{s.rank} {s.name}:</span> {formatInt(s.value)} enrollments
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10">
            <div className="flex items-center gap-2 text-xl font-extrabold text-[color:var(--text)]">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
              <span>Attention Needed:</span>
            </div>
            <div className="mt-3 space-y-2 text-sm">
              {metrics.attention.map((s) => (
                <div key={s.name} className="text-gray-800">
                  <span className="font-bold">{s.name}:</span> {formatInt(s.value)} enrollments (needs support)
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10">
            <div className="flex items-center gap-2 text-xl font-extrabold text-[color:var(--text)]">
              <Target className="w-6 h-6 text-sky-600" />
              <span>Key Insights:</span>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <div className="text-xs text-gray-500 font-bold uppercase tracking-wide">Dominant Age Group</div>
                <div className="text-3xl font-extrabold text-[color:var(--text)] mt-1">{metrics.dominantAge}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 font-bold uppercase tracking-wide">Coverage</div>
                <div className="text-sm text-gray-800 mt-2">
                  Coverage: <span className="font-bold">{metrics.statesCovered}</span> states /{" "}
                  <span className="font-bold">{metrics.districtsCovered}</span> districts with{" "}
                  <span className="font-bold">{formatInt(metrics.total)}</span> total enrollments
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-[320px] w-[420px] max-w-full">
          <div className="text-2xl font-extrabold text-[color:var(--text)] flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            <span>Performance Status (Top 10)</span>
          </div>

          <div className="mt-4 space-y-3">
            {metrics.performanceTop10.map((s) => (
              <div
                key={s.name}
                className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-4 flex items-center gap-3"
              >
                <span className="w-3 h-3 rounded-full bg-emerald-400 shadow" />
                <div className="text-sm text-emerald-900 font-semibold">
                  {s.name} ({formatInt(s.value)})
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
