from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Iterable

import pandas as pd


AGE_COLS: tuple[str, str, str] = ("age_0_5", "age_5_17", "age_18_greater")
REQUIRED_COLS: set[str] = {"date", "state", "district", *AGE_COLS}


def _standardize_columns(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out.columns = [str(c).strip().lower() for c in out.columns]

    # Common aliases (kept minimal; add more if your source varies)
    rename = {
        "enrollment_date": "date",
        "enrolment_date": "date",
        "state_name": "state",
        "district_name": "district",
        "age_18_plus": "age_18_greater",
        "age_18+": "age_18_greater",
    }
    out = out.rename(columns={k: v for k, v in rename.items() if k in out.columns})
    return out


def _normalize_state(value: object) -> str:
    if value is None:
        return "Unknown"
    s = str(value).strip()
    if not s:
        return "Unknown"

    # Remove junk values like "100000"
    if re.fullmatch(r"\d+", s):
        return "Unknown"

    s = re.sub(r"^the\s+", "", s, flags=re.IGNORECASE)
    s = s.replace("&", "and")
    s = re.sub(r"\s+", " ", s)

    lower = s.lower()
    mapping = {
        "andaman & nicobar islands": "Andaman And Nicobar Islands",
        "andaman and nicobar islands": "Andaman And Nicobar Islands",
        "dadra and nagar haveli": "Dadra And Nagar Haveli And Daman And Diu",
        "daman and diu": "Dadra And Nagar Haveli And Daman And Diu",
        "dadra and nagar haveli and daman and diu": "Dadra And Nagar Haveli And Daman And Diu",
        "the dadra and nagar haveli and daman and diu": "Dadra And Nagar Haveli And Daman And Diu",
        "nct of delhi": "Nct Of Delhi",
        "delhi": "Nct Of Delhi",
        "orissa": "Odisha",
        "pondicherry": "Puducherry",
        "jammu & kashmir": "Jammu And Kashmir",
        "westbengal": "West Bengal",
        "west bangal": "West Bengal",
    }
    if lower in mapping:
        return mapping[lower]

    parts = lower.split(" ")
    titled = " ".join([p if p in {"and", "of"} else (p[:1].upper() + p[1:]) for p in parts if p])
    return titled or "Unknown"


def _normalize_district(value: object) -> str:
    if value is None:
        return "Unknown"

    s = str(value).strip()
    if not s:
        return "Unknown"

    s = s.replace("&", "and")
    s = s.replace("\u00A0", " ")
    s = re.sub(r"\s+", " ", s)

    # Drop leading/trailing 'district' labels
    s = re.sub(r"^district\s+", "", s, flags=re.IGNORECASE)
    s = re.sub(r"\s+district\s*$", "", s, flags=re.IGNORECASE)

    # Normalize punctuation spacing and hyphens
    s = re.sub(r"\s*[-–—]\s*", "-", s)
    s = re.sub(r"\s*\(\s*", " (", s)
    s = re.sub(r"\s*\)\s*", ")", s)
    s = re.sub(r"[\.,;:/\[\]{}]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()

    # Remove stray punctuation-only values
    if not s or re.fullmatch(r"[\W_]+", s):
        return "Unknown"

    lower = s.lower()

    # Small set of high-confidence known variants
    variant_map = {
        "anugul": "angul",
        "aurangabad(bh)": "aurangabad (bh)",
    }
    lower = variant_map.get(lower, lower)

    def _title_token(tok: str) -> str:
        if not tok:
            return tok
        if tok.isdigit():
            return tok
        if tok in {"and", "of", "the"}:
            return tok
        return tok[:1].upper() + tok[1:]

    def _title_phrase(phrase: str) -> str:
        parts = []
        for raw in phrase.split(" "):
            if "-" in raw:
                hy = "-".join(_title_token(p) for p in raw.split("-") if p)
                parts.append(hy)
            else:
                parts.append(_title_token(raw))
        return " ".join([p for p in parts if p])

    # Handle parentheses content separately for consistent casing
    m = re.fullmatch(r"(.+?)\s*\((.+)\)", lower)
    if m:
        left = _title_phrase(m.group(1).strip())
        inside = m.group(2).strip()
        # Short codes (e.g., bh) -> upper
        inside_norm = inside.upper() if inside.isalpha() and len(inside) <= 3 else _title_phrase(inside)
        return f"{left} ({inside_norm})".strip() or "Unknown"

    return _title_phrase(lower) or "Unknown"


def _merge_rare_district_variants(
    df: pd.DataFrame,
    *,
    rare_max_occ: int = 3,
    candidate_min_occ: int = 8,
    similarity_threshold: float = 0.92,
) -> pd.DataFrame:
    """Merge rare district strings into the closest common district (per state).

    Goal: reduce typo/case/punctuation-driven fragmentation without needing a full
    external district master list.

    This only merges within the same state, and only when the source district is
    rare and the best match is both common and highly similar.
    """

    if df.empty:
        return df

    occ = df.groupby(["state", "district"], sort=False).size().rename("n")
    occ = occ.reset_index()

    # Pre-compute token sets for speed and safety
    def tokens(s: str) -> set[str]:
        parts = re.split(r"[\s\-]+", s.lower().strip())
        return {p for p in parts if p and p not in {"and", "of", "the"}}

    by_state = {}
    for state, sub in occ.groupby("state", sort=False):
        by_state[state] = {
            row["district"]: {
                "n": int(row["n"]),
                "tok": tokens(str(row["district"]))
            }
            for _, row in sub.iterrows()
        }

    mapping: dict[tuple[str, str], str] = {}

    for state, info in by_state.items():
        rare = [d for d, meta in info.items() if meta["n"] <= rare_max_occ]
        common = [d for d, meta in info.items() if meta["n"] >= candidate_min_occ]
        if not rare or len(common) < 2:
            continue

        for d in rare:
            d_tok = info[d]["tok"]
            if not d_tok:
                continue

            best = None
            best_score = 0.0
            for c in common:
                if c == d:
                    continue

                c_tok = info[c]["tok"]
                inter = len(d_tok & c_tok)
                union = len(d_tok | c_tok)
                jacc = (inter / union) if union else 0.0

                # Guardrail: require meaningful token overlap
                if jacc < 0.5:
                    continue

                score = SequenceMatcher(None, d.lower(), c.lower()).ratio()
                if score > best_score:
                    best_score = score
                    best = c

            if best and best_score >= similarity_threshold:
                mapping[(state, d)] = best

    if not mapping:
        return df

    out = df.copy()
    out["district"] = out.apply(
        lambda r: mapping.get((r["state"], r["district"]), r["district"]), axis=1
    )
    return out


def clean_dataframe(
    raw_df: pd.DataFrame,
    *,
    merge_rare_district_variants: bool = True,
    rare_max_occ: int = 3,
    candidate_min_occ: int = 8,
    similarity_threshold: float = 0.92,
) -> pd.DataFrame:
    """Logically clean the raw Aadhaar enrollment dataset.

    - Standardizes column names
    - Drops rows missing key identifiers
    - Parses date robustly
    - Normalizes state/district strings
    - Converts age columns to non-negative numeric
    - Aggregates duplicate (date,state,district) rows by summing age columns
    - Computes total_enrolments and time dimensions
    """

    df = _standardize_columns(raw_df)

    missing = REQUIRED_COLS - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(sorted(missing))}")

    df = df.copy()

    # Basic cleaning
    df = df.dropna(subset=["date", "state", "district"])  # type: ignore[arg-type]

    # Parse date: DD-MM-YYYY first, then common fallbacks
    parsed = pd.to_datetime(df["date"], format="%d-%m-%Y", errors="coerce")
    parsed_fallback = pd.to_datetime(df["date"], errors="coerce", dayfirst=True)
    df["date"] = parsed.fillna(parsed_fallback)
    df = df.dropna(subset=["date"])

    # Normalize strings
    df["state"] = df["state"].map(_normalize_state)
    df["district"] = df["district"].map(_normalize_district)

    # Convert numeric columns (handle commas)
    for col in AGE_COLS:
        series = df[col]
        if series.dtype == object:
            series = series.astype(str).str.replace(",", "", regex=False)
        df[col] = pd.to_numeric(series, errors="coerce").fillna(0)

    # Clamp negative values
    for col in AGE_COLS:
        df[col] = df[col].clip(lower=0)

    # Drop Unknown identifiers
    df = df[(df["state"] != "Unknown") & (df["district"] != "Unknown")]

    if merge_rare_district_variants:
        df = _merge_rare_district_variants(
            df,
            rare_max_occ=rare_max_occ,
            candidate_min_occ=candidate_min_occ,
            similarity_threshold=similarity_threshold,
        )

    # Aggregate duplicates by summing age buckets
    df = (
        df.groupby(["date", "state", "district"], as_index=False)[list(AGE_COLS)].sum()
    )

    # Calculate total
    df["total_enrolments"] = df[list(AGE_COLS)].sum(axis=1)

    # Remove zero enrollments
    df = df[df["total_enrolments"] > 0]

    # Add time dimensions
    df["year"] = df["date"].dt.year
    df["month"] = df["date"].dt.strftime("%b %Y")
    df["day_of_week"] = df["date"].dt.day_name()

    # Sort for stability
    df = df.sort_values(["date", "state", "district"], kind="mergesort").reset_index(drop=True)

    return df


def clean_dataframe_with_report(
    raw_df: pd.DataFrame,
    *,
    merge_rare_district_variants: bool = True,
    rare_max_occ: int = 3,
    candidate_min_occ: int = 8,
    similarity_threshold: float = 0.92,
) -> tuple[pd.DataFrame, dict]:
    """Clean the dataset and also return a summary report of what changed.

    The report is intended for UI display (high-level quality and reduction stats)
    and is not meant to be a strict audit log.
    """

    report: dict[str, int | float | dict] = {}
    report["original_records"] = int(len(raw_df))
    report["exact_duplicates"] = int(raw_df.duplicated().sum())

    df = _standardize_columns(raw_df)

    missing = REQUIRED_COLS - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(sorted(missing))}")

    df = df.copy()

    # Drop rows missing identifiers
    before = len(df)
    df = df.dropna(subset=["date", "state", "district"])  # type: ignore[arg-type]
    report["missing_required_fields"] = int(before - len(df))

    # Parse date
    before = len(df)
    parsed = pd.to_datetime(df["date"], format="%d-%m-%Y", errors="coerce")
    parsed_fallback = pd.to_datetime(df["date"], errors="coerce", dayfirst=True)
    df["date"] = parsed.fillna(parsed_fallback)
    df = df.dropna(subset=["date"])
    report["invalid_dates"] = int(before - len(df))

    # Normalize strings
    df["state"] = df["state"].map(_normalize_state)
    df["district"] = df["district"].map(_normalize_district)

    # Convert numeric columns
    for col in AGE_COLS:
        series = df[col]
        if series.dtype == object:
            series = series.astype(str).str.replace(",", "", regex=False)
        df[col] = pd.to_numeric(series, errors="coerce").fillna(0)

    for col in AGE_COLS:
        df[col] = df[col].clip(lower=0)

    # Drop Unknown identifiers
    before = len(df)
    df = df[(df["state"] != "Unknown") & (df["district"] != "Unknown")]
    report["invalid_identifiers"] = int(before - len(df))

    if merge_rare_district_variants:
        df = _merge_rare_district_variants(
            df,
            rare_max_occ=rare_max_occ,
            candidate_min_occ=candidate_min_occ,
            similarity_threshold=similarity_threshold,
        )

    # Logical duplicates: multiple rows per (date,state,district)
    pre_group = len(df)
    df = df.groupby(["date", "state", "district"], as_index=False)[list(AGE_COLS)].sum()
    report["logical_duplicates"] = int(pre_group - len(df))

    # Calculate total and drop zeros
    df["total_enrolments"] = df[list(AGE_COLS)].sum(axis=1)
    before = len(df)
    df = df[df["total_enrolments"] > 0]
    report["zero_enrollments"] = int(before - len(df))

    # Outliers: not removed by default cleaner
    report["outliers_removed"] = 0

    # Time dimensions
    df["year"] = df["date"].dt.year
    df["month"] = df["date"].dt.strftime("%b %Y")
    df["day_of_week"] = df["date"].dt.day_name()

    df = df.sort_values(["date", "state", "district"], kind="mergesort").reset_index(drop=True)

    report["final_clean_records"] = int(len(df))
    report["states"] = int(df["state"].nunique())
    report["districts"] = int(df["district"].nunique())

    orig = int(report["original_records"]) or 1
    report["data_quality_score_pct"] = float(report["final_clean_records"]) / orig * 100.0

    return df, dict(report)


def filter_df(
    source: pd.DataFrame,
    *,
    start: str | None,
    end: str | None,
    states: list[str] | None,
    districts: list[str] | None,
    search: str | None,
) -> pd.DataFrame:
    out = source

    if start:
        start_dt = pd.to_datetime(start, errors="coerce")
        if pd.notna(start_dt):
            out = out[out["date"] >= start_dt]

    if end:
        end_dt = pd.to_datetime(end, errors="coerce")
        if pd.notna(end_dt):
            out = out[out["date"] <= end_dt]

    if states:
        out = out[out["state"].isin(states)]

    if districts:
        out = out[out["district"].isin(districts)]

    q = (search or "").strip()
    if q:
        terms = [t for t in re.split(r"\s+", q) if t]
        if terms:
            masks: list[pd.Series] = []
            for term in terms:
                pat = rf"\b{re.escape(term)}\b"
                m = out["state"].astype(str).str.contains(pat, case=False, regex=True) | out[
                    "district"
                ].astype(str).str.contains(pat, case=False, regex=True)
                masks.append(m)
            if masks:
                mask = masks[0]
                for m in masks[1:]:
                    mask = mask & m
                out = out[mask]

    return out
