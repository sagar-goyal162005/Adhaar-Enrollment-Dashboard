from __future__ import annotations

import argparse
from pathlib import Path
import sys

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.cleaning import clean_dataframe


def main() -> int:
    parser = argparse.ArgumentParser(description="Logically clean Aadhaar enrollment CSV")
    parser.add_argument(
        "--input",
        default=str(Path("data") / "api_data_aadhar_enrolment.csv"),
        help="Input CSV path (default: data/api_data_aadhar_enrolment.csv)",
    )
    parser.add_argument(
        "--output",
        default=str(Path("data") / "api_data_aadhar_enrolment.cleaned.csv"),
        help="Output CSV path (default: data/api_data_aadhar_enrolment.cleaned.csv)",
    )
    parser.add_argument(
        "--no-merge-rare-districts",
        action="store_true",
        help="Disable rare district variant merging",
    )
    parser.add_argument(
        "--rare-max-occ",
        type=int,
        default=3,
        help="Max occurrences for a district to be considered 'rare' (default: 3)",
    )
    parser.add_argument(
        "--candidate-min-occ",
        type=int,
        default=8,
        help="Min occurrences for a district to be considered a merge target (default: 8)",
    )
    parser.add_argument(
        "--similarity",
        type=float,
        default=0.92,
        help="Similarity threshold for merging (default: 0.92)",
    )
    args = parser.parse_args()

    in_path = Path(args.input).resolve()
    out_path = Path(args.output).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    raw = pd.read_csv(in_path)
    cleaned = clean_dataframe(
        raw,
        merge_rare_district_variants=not args.no_merge_rare_districts,
        rare_max_occ=args.rare_max_occ,
        candidate_min_occ=args.candidate_min_occ,
        similarity_threshold=args.similarity,
    )

    cleaned.to_csv(out_path, index=False)

    print(f"Input rows:  {len(raw):,}")
    print(f"Cleaned rows:{len(cleaned):,}")
    print(f"States:      {cleaned['state'].nunique():,}")
    print(f"Districts:   {cleaned['district'].nunique():,}")
    print(f"Date range:  {cleaned['date'].min().date()} → {cleaned['date'].max().date()}")
    print(f"Wrote:       {out_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
