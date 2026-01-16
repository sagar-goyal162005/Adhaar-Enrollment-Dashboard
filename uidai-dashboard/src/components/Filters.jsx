import { useState } from "react";
import { Search, Calendar, MapPin, Users } from "lucide-react";

export default function Filters({ data, filters, setFilters, labelCounts }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(true);

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

  const normalizedStates = data
    .map((d) => String(d.state || "").trim())
    .filter((s) => s && s.toLowerCase() !== "unknown");
  const uniqueStatesAll = [...new Set(normalizedStates)]
    .filter((s) => !/^\d+$/.test(s))
    .sort();

  const normalizedDistricts = data
    .filter((d) => filters.viewAllStates || filters.states.includes(d.state))
    .map((d) => String(d.district || "").trim())
    .filter((s) => s && s.toLowerCase() !== "unknown");
  const uniqueDistrictsAll = [...new Set(normalizedDistricts)]
    .filter((s) => !/^\d+$/.test(s))
    .sort();

  const stateCountLabel = Number.isFinite(Number(labelCounts?.states))
    ? Number(labelCounts?.states)
    : uniqueStatesAll.length;
  const districtCountLabel = Number.isFinite(Number(labelCounts?.districts))
    ? Number(labelCounts?.districts)
    : uniqueDistrictsAll.length;

  const q = (searchQuery || "").trim();
  const uniqueStates = q ? uniqueStatesAll.filter((s) => matchesWholeWords(s, q)) : uniqueStatesAll;
  const uniqueDistricts = q
    ? uniqueDistrictsAll.filter((d) => matchesWholeWords(d, q))
    : uniqueDistrictsAll;

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    setFilters((prev) => ({ ...prev, searchQuery: query }));
    
    if (query.length > 2) {
      const matchingStates = uniqueStates.filter((s) => matchesWholeWords(s, query));
      const matchingDistricts = uniqueDistricts.filter((d) => matchesWholeWords(d, query));
      
      console.log(`Found ${matchingStates.length} states, ${matchingDistricts.length} districts`);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-primary">
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-3">
          <div className="bg-primary bg-opacity-10 rounded-lg p-2">
            <Search className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-primary">Filters & Search</h2>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="text-sm px-4 py-2 rounded-lg transition font-semibold border bg-white text-[color:var(--brand)] border-[color:var(--brand)] hover:bg-[color:var(--brand)] hover:text-white hover:border-white focus:outline-none focus:ring-2 focus:ring-[color:var(--brand)] focus:ring-offset-2"
        >
          {showFilters ? 'Hide' : 'Show'} Filters
        </button>
      </div>

      {showFilters && (
        <div className="space-y-6">
          
          {/* Quick Search */}
          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
              <Search className="w-5 h-5 text-primary" />
              <span>Quick Search</span>
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search state or district..."
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary shadow-sm transition"
            />
          </div>

          {/* Date Range */}
          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
              <Calendar className="w-5 h-5 text-primary" />
              <span>Date Range</span>
            </label>
            <div className="space-y-3">
              <div className="relative">
                <Calendar className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  value={filters.dateRange.start?.toISOString().split('T')[0] || ''}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    dateRange: { ...prev.dateRange, start: new Date(e.target.value) }
                  }))}
                  className="w-full pl-11 pr-3 py-3 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary shadow-sm"
                />
              </div>
              <div className="relative">
                <Calendar className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  value={filters.dateRange.end?.toISOString().split('T')[0] || ''}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    dateRange: { ...prev.dateRange, end: new Date(e.target.value) }
                  }))}
                  className="w-full pl-11 pr-3 py-3 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary shadow-sm"
                />
              </div>
            </div>
          </div>

          {/* Age Groups */}
          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
              <Users className="w-5 h-5 text-primary" />
              <span>Age Groups</span>
            </label>

            <div className="space-y-2">
              {[
                { key: "age_0_5", label: "0–5 years" },
                { key: "age_5_17", label: "5–17 years" },
                { key: "age_18_greater", label: "18+ years" },
              ].map((g) => {
                const selected = (filters.ageGroups || []).includes(g.key);
                return (
                  <label key={g.key} className="flex items-center gap-2 text-sm text-gray-700 font-medium">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(e) => {
                        const nextChecked = e.target.checked;
                        setFilters((prev) => {
                          const current = prev.ageGroups || [];
                          const next = nextChecked
                            ? [...new Set([...current, g.key])]
                            : current.filter((k) => k !== g.key);

                          // Keep at least one selected
                          if (next.length === 0) return prev;
                          return { ...prev, ageGroups: next };
                        });
                      }}
                      className="w-5 h-5 rounded border border-gray-400 bg-white accent-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand)]"
                    />
                    <span>{g.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* State Filter */}
          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
              <MapPin className="w-5 h-5 text-primary" />
              <span>States</span>
            </label>
            <div className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                checked={filters.viewAllStates}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  viewAllStates: e.target.checked,
                  states: e.target.checked ? [] : prev.states
                }))}
                className="w-5 h-5 rounded border border-gray-400 bg-white accent-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand)]"
              />
              <span className="text-sm text-gray-700 font-medium">View All States ({stateCountLabel})</span>
            </div>
            {!filters.viewAllStates && (
              <select
                multiple
                size={10}
                value={filters.states}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  states: Array.from(e.target.selectedOptions, option => option.value)
                }))}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-primary focus:border-primary shadow-sm"
              >
                {uniqueStates.map(state => (
                  <option key={state} value={state} title={state}>
                    {state}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* District Filter */}
          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
              <MapPin className="w-5 h-5 text-primary" />
              <span>Districts</span>
            </label>
            <div className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                checked={filters.viewAllDistricts}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  viewAllDistricts: e.target.checked,
                  districts: e.target.checked ? [] : prev.districts
                }))}
                className="w-5 h-5 rounded border border-gray-400 bg-white accent-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand)]"
              />
              <span className="text-sm text-gray-700 font-medium">View All Districts ({districtCountLabel})</span>
            </div>
            {!filters.viewAllDistricts && (
              <select
                multiple
                size={10}
                value={filters.districts}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  districts: Array.from(e.target.selectedOptions, option => option.value)
                }))}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-primary focus:border-primary shadow-sm"
              >
                {uniqueDistricts.map(district => (
                  <option key={district} value={district} title={district}>
                    {district}
                  </option>
                ))}
              </select>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
