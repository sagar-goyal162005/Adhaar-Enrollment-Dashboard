from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from pathlib import Path

try:
    # When launched as a module: `uvicorn backend.main:app`
    from backend.cleaning import clean_dataframe, clean_dataframe_with_report, filter_df
except ModuleNotFoundError:
    # When launched as a script: `python backend/main.py`
    from cleaning import clean_dataframe, clean_dataframe_with_report, filter_df

app = FastAPI()

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _clean_dataframe(raw_df: pd.DataFrame) -> pd.DataFrame:
    try:
        return clean_dataframe(raw_df)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


def _load_default_dataframe() -> pd.DataFrame:
    print("Loading Aadhaar enrollment data...")
    csv_path = (Path(__file__).resolve().parent / ".." / "data" / "api_data_aadhar_enrolment.csv").resolve()
    raw = pd.read_csv(csv_path)
    print(f"Loaded {len(raw)} rows")
    cleaned, report = clean_dataframe_with_report(raw)
    global cleaning_report
    cleaning_report = report
    print(f"Cleaned data: {len(cleaned)} rows")
    return cleaned


# Current dataset used by API endpoints
cleaning_report: dict | None = None
df = _load_default_dataframe()

@app.get("/")
def read_root():
    return {"message": "Aadhaar Dashboard API", "rows": len(df)}

@app.get("/api/data")
def get_data(limit: int = 10000):
    """Get enrollment data with optional limit"""
    limit = max(1, int(limit))
    n = min(limit, len(df))

    # Sample for performance, but try to include coverage across states
    if n >= len(df):
        sample_df = df
    else:
        per_state = df.groupby("state", sort=False).head(1)
        remaining = max(0, n - len(per_state))

        if remaining > 0:
            rest = df.drop(index=per_state.index, errors="ignore").sample(
                n=min(remaining, max(0, len(df) - len(per_state))),
                random_state=42,
            )
            sample_df = pd.concat([per_state, rest], ignore_index=True)
        else:
            sample_df = per_state
    
    # Convert to JSON-friendly format
    data = sample_df.to_dict('records')
    
    # Convert dates to strings
    for row in data:
        row['date'] = row['date'].strftime('%Y-%m-%d')
    
    return {
        "data": data,
        "total_rows": len(df),
        "sampled_rows": len(data)
    }

@app.get("/api/summary")
def get_summary(
    district_min_total: int = Query(default=0, ge=0),
):
    """Get summary statistics.

    district_min_total can be used to compute an "active" district count that
    excludes extremely low-total districts (often typos/noise) from the KPI.
    """

    districts = int(df["district"].nunique())

    if district_min_total > 0 and len(df):
        district_totals = df.groupby("district", sort=False)["total_enrolments"].sum()
        districts_active = int((district_totals >= district_min_total).sum())
    else:
        districts_active = districts

    return {
        "total_enrollments": int(df["total_enrolments"].sum()),
        "total_records": int(len(df)),
        "states": int(df["state"].nunique()),
        "districts": districts,
        "districts_active": districts_active,
        "district_min_total": int(district_min_total),
        "date_range": {
            "start": df["date"].min().strftime("%Y-%m-%d"),
            "end": df["date"].max().strftime("%Y-%m-%d"),
        },
    }


@app.get("/api/filtered_summary")
def get_filtered_summary(
    start: str | None = None,
    end: str | None = None,
    states: list[str] | None = Query(default=None),
    districts: list[str] | None = Query(default=None),
    search: str | None = None,
    age_groups: list[str] | None = Query(default=None),
    district_min_total: int = Query(default=0, ge=0),
):
    """Return true filtered counts/totals from the full dataset."""
    filtered = filter_df(df, start=start, end=end, states=states, districts=districts, search=search)

    allowed = {"age_0_5", "age_5_17", "age_18_greater"}
    selected = [g for g in (age_groups or []) if g in allowed]
    if not selected:
        selected = ["age_0_5", "age_5_17", "age_18_greater"]

    total_enrollments = int(filtered[selected].sum(axis=1).sum()) if len(filtered) else 0

    district_count = int(filtered["district"].nunique()) if len(filtered) else 0
    if district_min_total > 0 and len(filtered):
        row_totals = filtered[selected].sum(axis=1)
        district_totals = row_totals.groupby(filtered["district"], sort=False).sum()
        districts_active = int((district_totals >= district_min_total).sum())
    else:
        districts_active = district_count

    return {
        "total_records": int(len(df)),
        "filtered_records": int(len(filtered)),
        "filtered_enrollments": total_enrollments,
        "states": int(filtered["state"].nunique()) if len(filtered) else 0,
        "districts": district_count,
        "districts_active": districts_active,
        "district_min_total": int(district_min_total),
        "date_range": {
            "start": df["date"].min().strftime("%Y-%m-%d"),
            "end": df["date"].max().strftime("%Y-%m-%d"),
        },
    }


@app.get("/api/state_totals")
def get_state_totals(
    start: str | None = None,
    end: str | None = None,
    states: list[str] | None = Query(default=None),
    districts: list[str] | None = Query(default=None),
    search: str | None = None,
    age_groups: list[str] | None = Query(default=None),
):
    """Return total enrollments by state for the current filters.

    This endpoint uses the full in-memory dataset (not the frontend sample), and
    respects the selected age groups when computing totals.
    """

    filtered = filter_df(df, start=start, end=end, states=states, districts=districts, search=search)

    allowed = {"age_0_5", "age_5_17", "age_18_greater"}
    selected = [g for g in (age_groups or []) if g in allowed]
    if not selected:
        selected = ["age_0_5", "age_5_17", "age_18_greater"]

    if len(filtered) == 0:
        return {
            "states": [],
            "national_total": 0,
            "age_groups": selected,
        }

    row_totals = filtered[selected].sum(axis=1)
    state_totals = row_totals.groupby(filtered["state"], sort=False).sum().sort_values(ascending=False)

    states_out = [
        {"state": str(state), "total_enrollments": int(total)}
        for state, total in state_totals.items()
    ]

    return {
        "states": states_out,
        "national_total": int(row_totals.sum()),
        "age_groups": selected,
    }


@app.get("/api/district_totals")
def get_district_totals(
    start: str | None = None,
    end: str | None = None,
    states: list[str] | None = Query(default=None),
    districts: list[str] | None = Query(default=None),
    search: str | None = None,
    age_groups: list[str] | None = Query(default=None),
):
    """Return total enrollments by district for the current filters.

    Output includes both state and district columns so the export is unambiguous.
    Uses the full in-memory dataset (not the frontend sample) and respects the
    selected age groups when computing totals.
    """

    filtered = filter_df(df, start=start, end=end, states=states, districts=districts, search=search)

    allowed = {"age_0_5", "age_5_17", "age_18_greater"}
    selected = [g for g in (age_groups or []) if g in allowed]
    if not selected:
        selected = ["age_0_5", "age_5_17", "age_18_greater"]

    if len(filtered) == 0:
        return {
            "districts": [],
            "national_total": 0,
            "age_groups": selected,
        }

    row_totals = filtered[selected].sum(axis=1)
    grp = (
        row_totals.groupby([filtered["state"], filtered["district"]], sort=False)
        .sum()
        .sort_values(ascending=False)
    )

    district_df = grp.reset_index(name="total_enrollments")
    districts_out = [
        {
            "state": str(row["state"]),
            "district": str(row["district"]),
            "total_enrollments": int(row["total_enrollments"]),
        }
        for _, row in district_df.iterrows()
    ]

    return {
        "districts": districts_out,
        "national_total": int(row_totals.sum()),
        "age_groups": selected,
    }


@app.get("/api/cleaning_report")
def get_cleaning_report(
    district_min_total: int = Query(default=0, ge=0),
):
    """Return the latest data cleaning report for the currently loaded dataset."""

    base = cleaning_report or {}
    out = dict(base)

    # Add active district count if requested
    if district_min_total > 0 and len(df):
        district_totals = df.groupby("district", sort=False)["total_enrolments"].sum()
        out["districts_active"] = int((district_totals >= district_min_total).sum())
        out["district_min_total"] = int(district_min_total)
    else:
        out["districts_active"] = int(df["district"].nunique()) if len(df) else 0
        out["district_min_total"] = int(district_min_total)

    if len(df):
        out["date_range"] = {
            "start": df["date"].min().strftime("%Y-%m-%d"),
            "end": df["date"].max().strftime("%Y-%m-%d"),
        }

    return out


@app.get("/api/action_recommendations")
def get_action_recommendations(
    start: str | None = None,
    end: str | None = None,
    states: list[str] | None = Query(default=None),
    districts: list[str] | None = Query(default=None),
    search: str | None = None,
    age_groups: list[str] | None = Query(default=None),
):
    """Return data-driven action recommendations for the Forecast tab."""

    filtered = filter_df(df, start=start, end=end, states=states, districts=districts, search=search)

    allowed = {"age_0_5", "age_5_17", "age_18_greater"}
    selected = [g for g in (age_groups or []) if g in allowed]
    if not selected:
        selected = ["age_0_5", "age_5_17", "age_18_greater"]

    if len(filtered) == 0:
        return {"priority_items": [], "best_practices": [], "age_groups": selected}

    row_totals = filtered[selected].sum(axis=1)

    # Total by state
    state_total = row_totals.groupby(filtered["state"], sort=False).sum().sort_values(ascending=False)

    # Daily totals by state (for growth/anomaly)
    daily = row_totals.groupby([filtered["state"], filtered["date"]], sort=False).sum().reset_index(name="y")
    max_date = pd.to_datetime(daily["date"]).max()
    recent_start = max_date - pd.Timedelta(days=29)
    prev_start = max_date - pd.Timedelta(days=59)
    prev_end = max_date - pd.Timedelta(days=30)

    priority_items: list[dict] = []

    # Low enrollment: bottom 5 states by total
    bottom = state_total.sort_values(ascending=True).head(5)
    for st, tot in bottom.items():
        priority_items.append(
            {
                "priority": "HIGH",
                "state": str(st),
                "issue": f"Low enrollment ({int(tot):,})",
                "recommendation": "Increase outreach and add enrollment operators",
            }
        )

    # Growth/decline by comparing last 30 days vs previous 30 days
    daily["date"] = pd.to_datetime(daily["date"])
    recent = daily[(daily["date"] >= recent_start) & (daily["date"] <= max_date)].groupby("state")["y"].sum()
    prev = daily[(daily["date"] >= prev_start) & (daily["date"] <= prev_end)].groupby("state")["y"].sum()

    growth_pct = {}
    for st in state_total.index:
        p = float(prev.get(st, 0.0))
        r = float(recent.get(st, 0.0))
        if p > 0:
            growth_pct[st] = (r - p) / p * 100.0

    declining = [(st, g) for st, g in growth_pct.items() if g <= -10.0]
    declining.sort(key=lambda x: x[1])
    for st, g in declining[:5]:
        priority_items.append(
            {
                "priority": "MEDIUM",
                "state": str(st),
                "issue": f"Declining trend ({g:.1f}% drop)",
                "recommendation": "Investigate bottlenecks and run targeted enrollment drives",
            }
        )

    # Statistical anomaly: z-score on daily totals per state
    for st in state_total.index[:25]:
        ys = daily[daily["state"] == st]["y"].astype(float)
        if len(ys) < 10:
            continue
        mu = float(ys.mean())
        sd = float(ys.std(ddof=0))
        if sd <= 0:
            continue
        z = float(((ys - mu) / sd).abs().max())
        if z >= 2.0:
            priority_items.append(
                {
                    "priority": "REVIEW",
                    "state": str(st),
                    "issue": f"Statistical anomaly (z-score: {z:.2f})",
                    "recommendation": "Validate data quality or investigate sudden operational changes",
                }
            )

    # De-dup priority items by (state, issue)
    seen = set()
    deduped = []
    for it in priority_items:
        k = (it.get("state"), it.get("issue"))
        if k in seen:
            continue
        seen.add(k)
        deduped.append(it)

    order = {"HIGH": 0, "MEDIUM": 1, "REVIEW": 2}
    deduped.sort(key=lambda it: (order.get(it.get("priority"), 99), str(it.get("state"))))

    # Best practice replication: top totals + top growth
    best_practices: list[dict] = []
    top_total = state_total.head(5)
    for st, tot in top_total.items():
        best_practices.append(
            {
                "state": str(st),
                "success_metric": f"{int(tot):,} enrollments",
                "insight": "Study operational model for replication",
            }
        )

    top_growth = sorted([(st, g) for st, g in growth_pct.items() if g > 0], key=lambda x: x[1], reverse=True)[:3]
    for st, g in top_growth:
        if any(x["state"] == str(st) for x in best_practices):
            continue
        best_practices.append(
            {
                "state": str(st),
                "success_metric": f"+{g:.1f}% growth",
                "insight": "Analyze recent policy changes or campaigns",
            }
        )

    return {
        "priority_items": deduped[:10],
        "best_practices": best_practices,
        "age_groups": selected,
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
