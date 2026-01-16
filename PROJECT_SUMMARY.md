# Aadhaar Enrollment Dashboard — Project Summary

## What this project is
A full-stack dashboard to explore Aadhaar enrollment data with clean, filterable analytics and exportable summaries.

- **Backend**: FastAPI + pandas to load, clean, filter, and aggregate the dataset
- **Frontend**: React + Vite + Tailwind + Plotly for interactive charts and KPI cards

## Why it exists
- Provide **fast, judge-friendly** visual summaries of enrollment activity
- Ensure **accurate totals** under filters by computing aggregates server-side
- Keep the UI responsive by using **sampled rows** for visualizations where appropriate

## Data
- Primary input file: `data/api_data_aadhar_enrolment.csv`
- Backend performs cleaning and normalization at startup and when uploading new CSVs.

## Key features
- **KPI metrics**: total enrollments, records, states, districts, active districts (threshold-based)
- **Filtering**: date range, state(s), district(s), search, age groups
- **Accurate aggregates**: server-side computation for totals and exports
- **Exports**: download totals by state and by district (Excel)
- **Interactive charts**: trends, heatmaps, geographic bubble map, and advanced analytics panels

## Architecture at a glance
- Frontend requests:
  - `/api/data` for a sampled dataset used in charts
  - `/api/summary` and `/api/filtered_summary` for accurate totals
  - `/api/state_totals` and `/api/district_totals` for exports
- Backend holds the current cleaned dataframe in memory and can replace it via CSV upload.

## Main API endpoints (backend)
- `GET /api/data?limit=10000` — sampled rows for visualization
- `GET /api/summary` — full-dataset summary KPIs
- `GET /api/filtered_summary` — filtered summary KPIs (respects query params)
- `GET /api/state_totals` — state totals for export (respects filters)
- `GET /api/district_totals` — district totals for export (respects filters)

## Running the app
See [README.md](README.md) for run instructions and repo structure.
