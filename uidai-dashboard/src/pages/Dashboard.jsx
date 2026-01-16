import { useMemo, useState, useEffect } from "react";
import { loadAndCleanData } from "../utils/dataLoader";
import KpiCard from "../components/KpiCard";
import Filters from "../components/Filters";
import AppShell from "../components/layout/AppShell";
import TrendChart from "../components/charts/LineChart";
import StateBarChart from "../components/charts/BarChart";
import CalendarHeatmap from "../components/charts/CalendarHeatmap";
import GeographicMap from "../components/charts/GeographicMap";
import InsightPanel from "../components/InsightPanel";
import AdvancedAnalytics from "../components/AdvancedAnalytics";
import ChartErrorBoundary from "../components/ChartErrorBoundary";
import ExecutiveSummaryReport from "../components/reports/ExecutiveSummaryReport";
import { Download, FileText, FileSpreadsheet, TrendingUp, Users, MapPin, Building } from "lucide-react";
import * as XLSX from "xlsx";
import {
  LineChart as ReLineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

export default function Dashboard() {
  const PALETTE = {
    primary: "#1E88E5",
    secondary: "#1E88E5",
    success: "#2E7D32",
    warning: "#FB8C00",
    danger: "#C62828",
  };

  // "Active" district threshold (helps avoid inflated counts from very rare/noisy districts)
  const DISTRICT_MIN_TOTAL_FOR_COUNT = 285;

  // What-if analysis configuration
  const WHATIF_BOTTOM_N = 5;
  const WHATIF_COST_PER_ENROLLMENT = 50; // INR
  const WHATIF_ENROLLMENTS_PER_OPERATOR = 100;
  const WHATIF_ENROLLMENTS_PER_CENTER = 50_000;

  const [activeTab, setActiveTab] = useState("Dashboard");
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [apiSummary, setApiSummary] = useState(null);
  const [filteredSummary, setFilteredSummary] = useState(null);
  const [stateTotalsPayload, setStateTotalsPayload] = useState(null);
  const [cleaningReport, setCleaningReport] = useState(null);
  const [actionRecs, setActionRecs] = useState(null);
  const [whatIfImprovementPct, setWhatIfImprovementPct] = useState(25);
  const [benchmarkStates, setBenchmarkStates] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [filters, setFilters] = useState({
    dateRange: { start: null, end: null },
    states: [],
    districts: [],
    searchQuery: "",
    ageGroups: ['age_0_5', 'age_5_17', 'age_18_greater'],
    viewAllStates: true,
    viewAllDistricts: true
  });

  const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const matchesWholeWords = (text, query) => {
    const q = String(query || "").trim();
    if (!q) return true;

    const terms = q.split(/\s+/).filter(Boolean);
    const hay = String(text || "");

    return terms.every((term) => {
      const re = new RegExp(`\\b${escapeRegExp(term)}\\b`, "i");
      return re.test(hay);
    });
  };

  const loadData = () => {
    console.log('Starting data load...');

    setLoading(true);
    setError(null);

    // Set a timeout to show error if loading takes too long
    const timeout = setTimeout(() => {
      console.error('Data loading timeout - CSV file may be too large');
      setError('Data loading is taking too long. The CSV file may be too large. Please wait or try refreshing.');
      setLoading(false);
    }, 30000); // 30 seconds timeout

    loadAndCleanData()
      .then((loadedData) => {
        clearTimeout(timeout);
        console.log('Data loaded successfully:', loadedData.length, 'records');

        if (!loadedData || loadedData.length === 0) {
          setError('No valid data found in CSV file');
          setLoading(false);
          return;
        }

        setData(loadedData);
        setFilteredData(loadedData);

        // Fetch full-dataset summary (total enrollments, total records, date range)
        fetch(`/api/summary?district_min_total=${DISTRICT_MIN_TOTAL_FOR_COUNT}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((s) => {
            if (s && typeof s === "object") setApiSummary(s);
          })
          .catch(() => {
            // ignore; dashboard can still work off sampled/filtered rows
          });

        // Fetch cleaning report
        fetch(`/api/cleaning_report?district_min_total=${DISTRICT_MIN_TOTAL_FOR_COUNT}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((payload) => {
            if (payload && typeof payload === "object") setCleaningReport(payload);
          })
          .catch(() => {
            // ignore
          });

        // Set default date range
        const dates = loadedData.map(d => d.date);
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));

        setFilters(prev => ({
          ...prev,
          dateRange: { start: minDate, end: maxDate },
          // Keep selections empty when viewing all; lists are derived inside Filters.
          states: [],
          districts: []
        }));

        setLoading(false);
      })
      .catch(err => {
        clearTimeout(timeout);
        console.error("Error loading data:", err);
        setError(err.message || 'Failed to load data');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filters, data]);

  useEffect(() => {
    // Get true filtered counts from the backend (full dataset)
    const controller = new AbortController();

    const params = buildFilterParams();
    params.set("district_min_total", String(DISTRICT_MIN_TOTAL_FOR_COUNT));

    fetch(`/api/filtered_summary?${params.toString()}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        if (payload && typeof payload === "object") setFilteredSummary(payload);
      })
      .catch((e) => {
        if (e?.name === "AbortError") return;
        // ignore; UI can fall back to local counts
      });

    // State totals for What-If analysis (full dataset)
    const params2 = buildFilterParams();
    fetch(`/api/state_totals?${params2.toString()}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        if (payload && typeof payload === "object") setStateTotalsPayload(payload);
      })
      .catch((e) => {
        if (e?.name === "AbortError") return;
      });

    // Action recommendations (full dataset)
    const params3 = buildFilterParams();
    fetch(`/api/action_recommendations?${params3.toString()}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        if (payload && typeof payload === "object") setActionRecs(payload);
      })
      .catch((e) => {
        if (e?.name === "AbortError") return;
      });

    return () => controller.abort();
  }, [filters]);

  // Default benchmark states: top 2 by total (if none selected yet)
  useEffect(() => {
    if (Array.isArray(benchmarkStates) && benchmarkStates.length) return;
    const list = Array.isArray(stateTotalsPayload?.states) ? stateTotalsPayload.states : [];
    const top = list.slice(0, 2).map((s) => s?.state).filter(Boolean);
    if (top.length) setBenchmarkStates(top);
  }, [stateTotalsPayload, benchmarkStates]);

  const applyFilters = () => {
    if (!data.length) return;

    let filtered = data.filter(row => {
      const dateMatch = (!filters.dateRange.start || !filters.dateRange.end) || 
        (row.date >= filters.dateRange.start && row.date <= filters.dateRange.end);
      
      const stateMatch = filters.viewAllStates || 
        filters.states.includes(row.state);
      
      const districtMatch = filters.viewAllDistricts || 
        filters.districts.includes(row.district);

      const q = (filters.searchQuery || "").trim().toLowerCase();
      const searchMatch = !q ||
        matchesWholeWords(row.state, q) ||
        matchesWholeWords(row.district, q);

      return dateMatch && stateMatch && districtMatch && searchMatch;
    });

    const selectedAgeGroups = (filters.ageGroups && filters.ageGroups.length > 0)
      ? filters.ageGroups
      : ['age_0_5', 'age_5_17', 'age_18_greater'];

    const withSelectedTotals = filtered.map((row) => {
      const selectedTotal = selectedAgeGroups.reduce(
        (sum, key) => sum + (Number(row?.[key]) || 0),
        0,
      );

      return {
        ...row,
        total_enrolments: selectedTotal,
      };
    });

    setFilteredData(withSelectedTotals);
  };

  const forecast = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return null;

    // Aggregate to daily totals
    const dailyTotals = new Map();
    for (const row of filteredData) {
      const d = row?.date instanceof Date ? row.date : new Date(row?.date);
      if (Number.isNaN(d.getTime())) continue;
      const dayKey = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      dailyTotals.set(dayKey, (dailyTotals.get(dayKey) || 0) + (row.total_enrolments || 0));
    }

    const history = Array.from(dailyTotals.entries())
      .map(([t, y]) => ({ date: new Date(Number(t)), y }))
      .sort((a, b) => a.date - b.date);

    if (history.length < 2) {
      return {
        history: history.map((p) => ({ label: p.date.toISOString().slice(0, 10), enrollments: Math.round(p.y) })),
        forecast: [],
        slope: 0,
        predicted30Total: 0,
      };
    }

    // Use a recent window for stability
    const windowSize = Math.min(180, history.length);
    const series = history.slice(-windowSize);

    // Least-squares linear regression: y = a + b*x
    const n = series.length;
    let sumX = 0;
    let sumY = 0;
    let sumXX = 0;
    let sumXY = 0;

    for (let i = 0; i < n; i++) {
      const x = i;
      const y = series[i].y;
      sumX += x;
      sumY += y;
      sumXX += x * x;
      sumXY += x * y;
    }

    const denom = n * sumXX - sumX * sumX;
    const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;

    const last = series[series.length - 1].date;
    const forecastPoints = [];
    let predicted30Total = 0;
    for (let i = 1; i <= 30; i++) {
      const date = new Date(last);
      date.setDate(date.getDate() + i);
      const x = (n - 1) + i;
      const y = Math.max(0, Math.round(intercept + slope * x));
      predicted30Total += y;
      forecastPoints.push({ label: date.toISOString().slice(0, 10), enrollments: y });
    }

    return {
      history: series.map((p) => ({ label: p.date.toISOString().slice(0, 10), enrollments: Math.round(p.y) })),
      forecast: forecastPoints,
      slope,
      predicted30Total,
    };
  }, [filteredData]);

  const whatIf = useMemo(() => {
    const states = Array.isArray(stateTotalsPayload?.states) ? stateTotalsPayload.states : [];
    const nationalTotal = Number(stateTotalsPayload?.national_total) || 0;

    const cleaned = states
      .map((s) => ({
        state: String(s?.state || "").trim(),
        total: Number(s?.total_enrollments) || 0,
      }))
      .filter((s) => s.state && s.total > 0);

    const byTotalAsc = [...cleaned].sort((a, b) => a.total - b.total);
    const bottom = byTotalAsc.slice(0, Math.min(WHATIF_BOTTOM_N, byTotalAsc.length));

    const improvementPct = Math.min(100, Math.max(0, Number(whatIfImprovementPct) || 0));
    const boostFactor = improvementPct / 100;
    const currentBottomTotal = bottom.reduce((sum, s) => sum + s.total, 0);
    const additionalBoost = Math.round(currentBottomTotal * boostFactor);
    const improvedBottomTotal = currentBottomTotal + additionalBoost;
    const overallImpactPct = nationalTotal > 0 ? (additionalBoost / nationalTotal) * 100 : 0;

    // Benchmark scenario
    const selectedBench = Array.isArray(benchmarkStates) ? benchmarkStates : [];
    const benchItems = cleaned.filter((s) => selectedBench.includes(s.state));
    const benchmarkAvg = benchItems.length
      ? benchItems.reduce((sum, s) => sum + s.total, 0) / benchItems.length
      : 0;

    const lowAvg = bottom.length ? currentBottomTotal / bottom.length : 0;
    const gapPerState = Math.max(0, benchmarkAvg - lowAvg);
    const totalPotential = Math.round(gapPerState * bottom.length);

    // Resource estimates for boost scenario
    const centers = Math.round(additionalBoost / WHATIF_ENROLLMENTS_PER_CENTER);
    const operators = Math.max(0, Math.ceil(additionalBoost / WHATIF_ENROLLMENTS_PER_OPERATOR));
    const campaignBudget = Math.round(additionalBoost * WHATIF_COST_PER_ENROLLMENT);

    return {
      hasData: cleaned.length > 0,
      bottom,
      nationalTotal,
      improvementPct,
      boost: {
        currentBottomTotal,
        improvedBottomTotal,
        additionalBoost,
        overallImpactPct,
        centers,
        operators,
        campaignBudget,
      },
      benchmark: {
        benchmarkAvg,
        lowAvg,
        gapPerState,
        totalPotential,
      },
    };
  }, [stateTotalsPayload, whatIfImprovementPct, benchmarkStates]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600 font-semibold">Loading Aadhaar Enrollment Data...</p>
          <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center bg-white p-8 rounded-xl shadow-lg max-w-md">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Error Loading Data</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-opacity-90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center bg-white p-8 rounded-xl shadow-lg max-w-md">
          <div className="text-yellow-500 text-6xl mb-4">📊</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">No Data Available</h2>
          <p className="text-gray-600">Please check if the CSV file exists in the public/data folder</p>
        </div>
      </div>
    );
  }

  // Calculate KPIs
  const filteredAllAgeEnrollments = filteredData.reduce(
    (sum, row) =>
      sum +
      (Number(row?.age_0_5) || 0) +
      (Number(row?.age_5_17) || 0) +
      (Number(row?.age_18_greater) || 0),
    0,
  );

  const isFullRange = (() => {
    const start = filters?.dateRange?.start;
    const end = filters?.dateRange?.end;
    const apiStart = apiSummary?.date_range?.start;
    const apiEnd = apiSummary?.date_range?.end;
    if (!start || !end || !apiStart || !apiEnd) return false;
    return (
      start.toISOString().slice(0, 10) === String(apiStart) &&
      end.toISOString().slice(0, 10) === String(apiEnd)
    );
  })();

  const isAllStatesDistricts = Boolean(filters?.viewAllStates) && Boolean(filters?.viewAllDistricts);
  const isNoSearch = !(filters?.searchQuery || "").trim();
  const isAllAgeGroups = (() => {
    const sel = filters?.ageGroups;
    if (!Array.isArray(sel)) return true;
    const s = new Set(sel);
    return s.has("age_0_5") && s.has("age_5_17") && s.has("age_18_greater") && s.size === 3;
  })();

  const totalEnrollments =
    apiSummary && isFullRange && isAllStatesDistricts && isNoSearch && isAllAgeGroups
      ? Number(apiSummary.total_enrollments) || filteredAllAgeEnrollments
      : filteredAllAgeEnrollments;

  const trueFilteredRows = Number(filteredSummary?.filtered_records);
  const trueFilteredRowsValue = Number.isFinite(trueFilteredRows) ? trueFilteredRows : null;

  const localStatesCount = new Set(
    filteredData
      .map(d => String(d.state || '').trim())
      .filter(s => s && s.toLowerCase() !== 'unknown')
  ).size;
  const localDistrictsCount = new Set(
    filteredData
      .map(d => String(d.district || '').trim())
      .filter(s => s && s.toLowerCase() !== 'unknown')
  ).size;

  const statesCount = Number.isFinite(Number(filteredSummary?.states))
    ? Number(filteredSummary?.states)
    : localStatesCount;

  const districtsCount = Number.isFinite(Number(filteredSummary?.districts_active))
    ? Number(filteredSummary?.districts_active)
    : (Number.isFinite(Number(filteredSummary?.districts))
        ? Number(filteredSummary?.districts)
        : localDistrictsCount);
  const avgDaily = filteredData.length > 0 
    ? Math.round(totalEnrollments / new Set(filteredData.map(d => d.date.toDateString())).size) 
    : 0;

  // Growth rate calculation
  const midDate = filters.dateRange.start && filters.dateRange.end 
    ? new Date((filters.dateRange.start.getTime() + filters.dateRange.end.getTime()) / 2)
    : new Date();
  
  const firstHalf = filteredData
    .filter(d => d.date < midDate)
    .reduce((sum, row) => sum + row.total_enrolments, 0);
  
  const secondHalf = filteredData
    .filter(d => d.date >= midDate)
    .reduce((sum, row) => sum + row.total_enrolments, 0);
  
  const growthRate = firstHalf > 0 
    ? (((secondHalf - firstHalf) / firstHalf) * 100).toFixed(1)
    : 0;

  const growthRateNum = Number(growthRate) || 0;
  const growthColor = growthRateNum >= 0 ? PALETTE.success : PALETTE.danger;

  const downloadCSV = () => {
    const csv = [
      ['Date', 'State', 'District', 'Age 0-5', 'Age 5-17', 'Age 18+', 'Total'],
      ...filteredData.map(row => [
        row.date.toLocaleDateString(),
        row.state,
        row.district,
        row.age_0_5,
        row.age_5_17,
        row.age_18_greater,
        row.total_enrolments
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aadhaar_enrollment_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const exportExcel = () => {
    if (!filteredData || filteredData.length === 0) return;

    const rows = filteredData.map((row) => ({
      Date: row.date?.toISOString?.().slice(0, 10) ?? String(row.date ?? ""),
      State: row.state,
      District: row.district,
      "Age 0-5": row.age_0_5,
      "Age 5-17": row.age_5_17,
      "Age 18+": row.age_18_greater,
      Total: row.total_enrolments,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Enrollments");

    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([out], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aadhaar_enrollment_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportRowsToExcel = (rows, sheetName, filePrefix) => {
    if (!Array.isArray(rows) || rows.length === 0) return;

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([out], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filePrefix}_${new Date().toISOString().split("T")[0]}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  function buildFilterParams() {
    const params = new URLSearchParams();
    if (filters?.dateRange?.start) params.set("start", filters.dateRange.start.toISOString().slice(0, 10));
    if (filters?.dateRange?.end) params.set("end", filters.dateRange.end.toISOString().slice(0, 10));

    if (!filters?.viewAllStates && Array.isArray(filters?.states) && filters.states.length) {
      filters.states.forEach((s) => params.append("states", s));
    }

    if (!filters?.viewAllDistricts && Array.isArray(filters?.districts) && filters.districts.length) {
      filters.districts.forEach((d) => params.append("districts", d));
    }

    const q = (filters?.searchQuery || "").trim();
    if (q) params.set("search", q);

    const selAge = Array.isArray(filters?.ageGroups) && filters.ageGroups.length
      ? filters.ageGroups
      : ["age_0_5", "age_5_17", "age_18_greater"];
    selAge.forEach((g) => params.append("age_groups", g));

    return params;
  }

  const downloadByState = async () => {
    try {
      const params = buildFilterParams();
      const res = await fetch(`/api/state_totals?${params.toString()}`);
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const payload = await res.json();
      const rows = (Array.isArray(payload?.states) ? payload.states : []).map((r) => ({
        State: r.state,
        "Total Enrollments": Number(r.total_enrollments || 0),
      }));
      exportRowsToExcel(rows, "By State", "aadhaar_by_state");
    } catch (e) {
      console.error("Download by state failed:", e);
    }
  };

  const downloadByDistrict = async () => {
    try {
      const params = buildFilterParams();
      const res = await fetch(`/api/district_totals?${params.toString()}`);
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const payload = await res.json();
      const rows = (Array.isArray(payload?.districts) ? payload.districts : []).map((r) => ({
        State: r.state,
        District: r.district,
        "Total Enrollments": Number(r.total_enrollments || 0),
      }));
      exportRowsToExcel(rows, "By District", "aadhaar_by_district");
    } catch (e) {
      console.error("Download by district failed:", e);
    }
  };

  return (
    <AppShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      sidebar={
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-[color:var(--sidebar-border)] overflow-hidden">
            <div className="px-4 py-3 bg-white text-[color:var(--brand)] font-extrabold text-sm border-b border-[color:var(--sidebar-border)]">
              Filters
            </div>
            <div className="p-3">
              <Filters
                data={data}
                filters={filters}
                setFilters={setFilters}
                labelCounts={{ states: statesCount, districts: districtsCount }}
              />
            </div>
          </div>
        </div>
      }
    >
      {activeTab === "Cleaning Report" && (
        <div className="max-w-[1400px] mx-auto space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="text-xs text-gray-500 font-bold uppercase tracking-wide">Report</div>
            <div className="text-xl font-extrabold text-[color:var(--text)]">Data Cleaning Report</div>
            <div className="text-sm text-gray-600 mt-1">Summary of cleaning, validation, and standardization.</div>

            {!cleaningReport ? (
              <div className="mt-4 text-sm text-gray-600">Loading report…</div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                  <KpiCard title="Original Records" value={Number(cleaningReport.original_records || 0).toLocaleString()} color={PALETTE.primary} icon={<FileText className="w-6 h-6" />} />
                  <KpiCard title="Exact Duplicates" value={Number(cleaningReport.exact_duplicates || 0).toLocaleString()} color={PALETTE.warning} icon={<FileText className="w-6 h-6" />} />
                  <KpiCard title="Invalid Entries" value={Number((cleaningReport.missing_required_fields || 0) + (cleaningReport.invalid_dates || 0) + (cleaningReport.invalid_identifiers || 0)).toLocaleString()} color={PALETTE.danger} icon={<FileText className="w-6 h-6" />} />
                  <KpiCard title="Data Quality Score" value={`${(Number(cleaningReport.data_quality_score_pct || 0)).toFixed(2)}%`} color={PALETTE.success} icon={<TrendingUp className="w-6 h-6" />} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                  <KpiCard title="Final Clean Records" value={Number(cleaningReport.final_clean_records || 0).toLocaleString()} color={PALETTE.primary} icon={<FileText className="w-6 h-6" />} />
                  <KpiCard title="Logical Duplicates" value={Number(cleaningReport.logical_duplicates || 0).toLocaleString()} color={PALETTE.warning} icon={<FileText className="w-6 h-6" />} />
                  <KpiCard title="Outliers Removed" value={Number(cleaningReport.outliers_removed || 0).toLocaleString()} color={PALETTE.secondary} icon={<FileText className="w-6 h-6" />} />
                  <KpiCard title="States/Districts" value={`${Number(cleaningReport.states || 0)}/${Number(cleaningReport.districts_active ?? cleaningReport.districts ?? 0)}`} color={PALETTE.primary} icon={<MapPin className="w-6 h-6" />} />
                </div>

                <details className="mt-6">
                  <summary className="cursor-pointer text-sm font-extrabold text-[color:var(--brand)]">View Data Cleaning Report</summary>
                  <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <div className="text-lg font-extrabold text-[color:var(--text)]">Detailed Cleaning Breakdown</div>
                      <div className="mt-3 text-sm font-bold text-gray-800">Duplicate Removal:</div>
                      <ul className="mt-2 space-y-1 text-sm text-gray-800 list-disc pl-5">
                        <li>Exact duplicates (identical rows): {Number(cleaningReport.exact_duplicates || 0).toLocaleString()}</li>
                        <li>Logical duplicates (same date/state/district): {Number(cleaningReport.logical_duplicates || 0).toLocaleString()}</li>
                      </ul>

                      <div className="mt-4 text-sm font-bold text-gray-800">Data Validation:</div>
                      <ul className="mt-2 space-y-1 text-sm text-gray-800 list-disc pl-5">
                        <li>Missing required fields removed: {Number(cleaningReport.missing_required_fields || 0).toLocaleString()}</li>
                        <li>Invalid dates removed: {Number(cleaningReport.invalid_dates || 0).toLocaleString()}</li>
                        <li>Invalid identifiers removed: {Number(cleaningReport.invalid_identifiers || 0).toLocaleString()}</li>
                        <li>Zero enrollments removed: {Number(cleaningReport.zero_enrollments || 0).toLocaleString()}</li>
                      </ul>
                    </div>

                    <div>
                      <div className="text-lg font-extrabold text-[color:var(--text)]">Standardization</div>
                      <ul className="mt-3 space-y-1 text-sm text-gray-800 list-disc pl-5">
                        <li>Final states standardized: {Number(cleaningReport.states || 0)}</li>
                        <li>Final districts standardized: {Number(cleaningReport.districts || 0)}</li>
                        <li>Active districts (min total {Number(cleaningReport.district_min_total || 0)}): {Number(cleaningReport.districts_active || 0)}</li>
                      </ul>
                      {cleaningReport.date_range && (
                        <div className="mt-4 text-sm text-gray-700">
                          Date range: <span className="font-bold">{String(cleaningReport.date_range.start)}</span> to <span className="font-bold">{String(cleaningReport.date_range.end)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </details>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === "Summary" && (
        <div className="max-w-[1400px] mx-auto space-y-6">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={downloadByState}
              className="flex items-center gap-2 bg-white text-gray-800 px-5 py-2 rounded-xl border border-gray-200 shadow-sm hover:bg-black/5 transition"
            >
              <MapPin className="w-4 h-4" />
              Download by State
            </button>
            <button
              onClick={downloadByDistrict}
              className="flex items-center gap-2 bg-white text-gray-800 px-5 py-2 rounded-xl border border-gray-200 shadow-sm hover:bg-black/5 transition"
            >
              <Building className="w-4 h-4" />
              Download by District
            </button>
          </div>

          <ExecutiveSummaryReport
            data={filteredData}
            dateRange={filters.dateRange}
            meta={{
              totalRecords: apiSummary?.total_records,
              sampledRows: data.length,
              filteredRows: trueFilteredRowsValue ?? filteredData.length,
            }}
          />
          <InsightPanel data={filteredData} />
        </div>
      )}

      {activeTab === "Forecast" && (
        <div className="max-w-[1400px] mx-auto space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="text-xs text-gray-500 font-bold uppercase tracking-wide">Forecast</div>
            <div className="text-xl font-extrabold text-[color:var(--text)]">30-Day Enrollment Forecast</div>
            <div className="text-sm text-gray-600 mt-1">Simple linear trend based on recent daily totals.</div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <KpiCard
                title="Predicted 30-Day Total"
                value={(forecast?.predicted30Total || 0).toLocaleString()}
                color={PALETTE.primary}
                icon={<TrendingUp className="w-6 h-6" />}
              />
              <KpiCard
                title="Predicted Daily Avg"
                value={Math.round((forecast?.predicted30Total || 0) / 30).toLocaleString()}
                color={PALETTE.secondary}
                icon={<Users className="w-6 h-6" />}
              />
              <KpiCard
                title="Trend (Δ/day)"
                value={Math.round(forecast?.slope || 0).toLocaleString()}
                color={PALETTE.warning}
                icon={<FileText className="w-6 h-6" />}
              />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="text-sm font-extrabold text-[color:var(--text)] mb-3">History + Forecast</div>
            <ResponsiveContainer width="100%" height={360}>
              <ReLineChart data={[...(forecast?.history || []), ...(forecast?.forecast || [])]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#666" minTickGap={18} />
                <YAxis tick={{ fontSize: 12 }} stroke="#666" tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(value) => Number(value).toLocaleString()} />
                <Legend />
                <Line type="monotone" dataKey="enrollments" stroke={PALETTE.primary} strokeWidth={2} dot={false} name="Enrollments" />
              </ReLineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-2">
              <div className="text-xs text-gray-500 font-bold uppercase tracking-wide">Recommendations</div>
              <div className="text-xl font-extrabold text-[color:var(--text)]">Data-Driven Action Recommendations</div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-white font-extrabold text-[color:var(--text)]">Priority Action Items</div>
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="text-left px-3 py-2">Priority</th>
                        <th className="text-left px-3 py-2">State</th>
                        <th className="text-left px-3 py-2">Issue</th>
                        <th className="text-left px-3 py-2">Recommendation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(Array.isArray(actionRecs?.priority_items) ? actionRecs.priority_items : []).map((row, idx) => {
                        const p = String(row?.priority || "");
                        const dot = p === "HIGH" ? "bg-red-500" : p === "MEDIUM" ? "bg-orange-500" : "bg-yellow-500";
                        return (
                          <tr key={`${row?.state}-${idx}`} className="border-t border-gray-100">
                            <td className="px-3 py-2 font-bold text-gray-800"><span className={`inline-block w-3 h-3 rounded-full mr-2 ${dot}`} />{p}</td>
                            <td className="px-3 py-2 text-gray-800">{row?.state}</td>
                            <td className="px-3 py-2 text-gray-800">{row?.issue}</td>
                            <td className="px-3 py-2 text-gray-800">{row?.recommendation}</td>
                          </tr>
                        );
                      })}
                      {!(Array.isArray(actionRecs?.priority_items) && actionRecs.priority_items.length) && (
                        <tr>
                          <td className="px-3 py-3 text-gray-600" colSpan={4}>No recommendations for current filters.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-white font-extrabold text-[color:var(--text)]">Best Practice Replication</div>
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="text-left px-3 py-2">State</th>
                        <th className="text-left px-3 py-2">Success Metric</th>
                        <th className="text-left px-3 py-2">Insight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(Array.isArray(actionRecs?.best_practices) ? actionRecs.best_practices : []).map((row, idx) => (
                        <tr key={`${row?.state}-${idx}`} className="border-t border-gray-100">
                          <td className="px-3 py-2 text-gray-800">{row?.state}</td>
                          <td className="px-3 py-2 text-gray-800">{row?.success_metric}</td>
                          <td className="px-3 py-2 text-gray-800">{row?.insight}</td>
                        </tr>
                      ))}
                      {!(Array.isArray(actionRecs?.best_practices) && actionRecs.best_practices.length) && (
                        <tr>
                          <td className="px-3 py-3 text-gray-600" colSpan={3}>No best-practice candidates for current filters.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-2">
              <div className="text-xs text-gray-500 font-bold uppercase tracking-wide">What-If</div>
              <div className="text-xl font-extrabold text-[color:var(--text)]">What-If Impact Analysis</div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
              <div>
                <div className="text-sm font-bold text-gray-700">Target Improvement for Low Performers (%)</div>
                <div className="flex items-center gap-3 mt-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={whatIfImprovementPct}
                    onChange={(e) => setWhatIfImprovementPct(Number(e.target.value))}
                    className="w-full accent-[color:var(--brand)]"
                  />
                  <div className="text-sm font-extrabold text-[color:var(--brand)] w-12 text-right">{whatIfImprovementPct}%</div>
                </div>
              </div>

              <div>
                <div className="text-sm font-bold text-gray-700">Select High Performers to Replicate</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {(benchmarkStates || []).map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-lg text-sm"
                    >
                      {s}
                      <button
                        type="button"
                        onClick={() => setBenchmarkStates((prev) => (prev || []).filter((x) => x !== s))}
                        className="text-white/90 hover:text-white font-bold"
                        aria-label={`Remove ${s}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}

                  <select
                    value=""
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) return;
                      setBenchmarkStates((prev) => {
                        const p = Array.isArray(prev) ? prev : [];
                        return p.includes(v) ? p : [...p, v];
                      });
                      // eslint-disable-next-line no-param-reassign
                      e.target.value = "";
                    }}
                    className="min-w-[220px] px-3 py-2 rounded-lg border border-gray-300 text-sm bg-gray-50"
                  >
                    <option value="">Add state…</option>
                    {(Array.isArray(stateTotalsPayload?.states) ? stateTotalsPayload.states : []).map((it) => (
                      <option key={it.state} value={it.state}>
                        {it.state}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setBenchmarkStates([])}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            {!whatIf?.hasData ? (
              <div className="mt-6 text-sm text-gray-600">What-if analysis needs state totals (no data for current filters).</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
                <div>
                  <div className="text-2xl font-extrabold text-[color:var(--text)]">
                    Scenario: Boost Bottom {WHATIF_BOTTOM_N} States by {whatIf.improvementPct}%
                  </div>
                  <div className="mt-4 space-y-2 text-gray-800">
                    <div>• <span className="font-bold">Current Total:</span> {whatIf.boost.currentBottomTotal.toLocaleString()} enrollments</div>
                    <div>• <span className="font-bold">Improved Total:</span> {whatIf.boost.improvedBottomTotal.toLocaleString()} enrollments</div>
                    <div>• <span className="font-bold">Additional Enrollments:</span> {whatIf.boost.additionalBoost.toLocaleString()}</div>
                    <div>• <span className="font-bold">Overall Impact:</span> +{whatIf.boost.overallImpactPct.toFixed(2)}% national increase</div>
                  </div>

                  <div className="mt-6 text-sm font-extrabold text-gray-800">Required Resources:</div>
                  <div className="mt-2 space-y-2 text-gray-800">
                    <div>• <span className="font-bold">Additional enrollment centers:</span> ~{whatIf.boost.centers} centers</div>
                    <div>• <span className="font-bold">Estimated operators needed:</span> ~{whatIf.boost.operators} operators</div>
                    <div>• <span className="font-bold">Campaign budget:</span> ₹{whatIf.boost.campaignBudget.toLocaleString()} (est. ₹{WHATIF_COST_PER_ENROLLMENT}/enrollment)</div>
                  </div>
                </div>

                <div>
                  <div className="text-2xl font-extrabold text-[color:var(--text)]">Scenario: Replicate Best Practice Model</div>
                  <div className="mt-4 space-y-2 text-gray-800">
                    <div>• <span className="font-bold">Benchmark Average:</span> {Math.round(whatIf.benchmark.benchmarkAvg).toLocaleString()} enrollments/state</div>
                    <div>• <span className="font-bold">Current Low Performer Avg:</span> {Math.round(whatIf.benchmark.lowAvg).toLocaleString()}</div>
                    <div>• <span className="font-bold">Gap per State:</span> {Math.round(whatIf.benchmark.gapPerState).toLocaleString()} enrollments</div>
                    <div>• <span className="font-bold">Total Potential:</span> {Math.round(whatIf.benchmark.totalPotential).toLocaleString()} additional enrollments</div>
                  </div>

                  <div className="mt-6 text-sm font-extrabold text-gray-800">Implementation Timeline:</div>
                  <div className="mt-2 space-y-2 text-gray-800">
                    <div>• <span className="font-bold">Phase 1 (Months 1-2):</span> Study and adapt best practices</div>
                    <div>• <span className="font-bold">Phase 2 (Months 3-4):</span> Pilot in 2 states</div>
                    <div>• <span className="font-bold">Phase 3 (Months 5-6):</span> Full rollout to remaining states</div>
                    <div>• <span className="font-bold">Expected ROI:</span> 2x (enrollment value vs campaign cost)</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "Dashboard" && (
      <div className="max-w-[1400px] mx-auto">
        {/* KPI Cards */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <div className="text-xs text-gray-500 font-bold uppercase tracking-wide">Overview</div>
              <div className="text-xl font-extrabold text-[color:var(--text)]">Key Performance Indicators</div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={downloadCSV}
                className="flex items-center gap-2 bg-[color:var(--brand)] text-white px-4 py-2 rounded-lg transition shadow-sm hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand)] focus:ring-offset-2"
              >
                <Download className="w-4 h-4" />
                Download CSV
              </button>
              <button
                onClick={exportExcel}
                className="flex items-center gap-2 bg-white text-[color:var(--brand)] px-4 py-2 rounded-lg transition border border-[color:var(--brand)]/40 hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand)] focus:ring-offset-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Export Excel
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <KpiCard
              title="Total Enrollments"
              value={totalEnrollments.toLocaleString()}
              color={PALETTE.primary}
              icon={<Users className="w-6 h-6" />}
            />
            <KpiCard
              title="Growth Rate"
              value={`${growthRateNum >= 0 ? "+" : ""}${growthRateNum.toFixed(1)}%`}
              color={growthColor}
              icon={<TrendingUp className="w-6 h-6" />}
            />
            <KpiCard title="States Covered" value={statesCount} color={PALETTE.primary} icon={<MapPin className="w-6 h-6" />} />
            <KpiCard title="Districts" value={districtsCount} color={PALETTE.warning} icon={<Building className="w-6 h-6" />} />
            <KpiCard title="Avg Daily" value={avgDaily.toLocaleString()} color={PALETTE.primary} icon={<FileText className="w-6 h-6" />} />
          </div>
        </div>

        {/* Content grid (table/charts feel like the reference UI) */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
          <div className="xl:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 bg-white text-[color:var(--brand)] font-extrabold border-b border-gray-200">
                Enrollment Trends
              </div>
              <div className="p-4">
                <TrendChart data={filteredData} />
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 bg-white text-[color:var(--brand)] font-extrabold border-b border-gray-200">
                Top Performing States
              </div>
              <div className="p-4">
                <StateBarChart data={filteredData} />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <InsightPanel data={filteredData} />
          </div>
        </div>

        {/* Geographic */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="px-5 py-3 bg-white text-[color:var(--brand)] font-extrabold border-b border-gray-200">Geographic Distribution</div>
          <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartErrorBoundary title="Enrollment Intensity by Week & Day">
              <CalendarHeatmap data={filteredData} />
            </ChartErrorBoundary>
            <ChartErrorBoundary title="India Enrollment Map">
              <GeographicMap data={filteredData} />
            </ChartErrorBoundary>
          </div>
        </div>

        <ChartErrorBoundary title="Advanced Analytics">
          <AdvancedAnalytics data={filteredData} />
        </ChartErrorBoundary>

        {/* Data Quality */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="text-xs text-gray-500 font-bold uppercase tracking-wide">Data Quality</div>
          <div className="text-xl font-extrabold text-[color:var(--text)] mb-4">Summary</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-gray-600 text-sm">Total Records</p>
              <p className="text-2xl font-extrabold text-primary">{Number(apiSummary?.total_records || data.length).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Filtered Rows</p>
              <p className="text-2xl font-extrabold text-secondary">{Number((trueFilteredRowsValue ?? filteredData.length)).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Sampled Rows</p>
              <p className="text-2xl font-extrabold text-[color:var(--brand)]">{data.length.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">States/UTs</p>
              <p className="text-2xl font-extrabold text-[color:var(--brand)]">36</p>
            </div>
          </div>
        </div>
      </div>
      )}
    </AppShell>
  );
}
