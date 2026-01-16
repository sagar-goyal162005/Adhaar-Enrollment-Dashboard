from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd


def main() -> None:
    p = Path("D:/Uidai/data/api_data_aadhar_enrolment.cleaned.csv")
    df = pd.read_csv(p)

    print("districts unique:", df["district"].nunique())
    agg = (
        df.groupby("district", sort=False)
        .agg(rows=("district", "size"), total=("total_enrolments", "sum"))
        .reset_index()
    )

    print("min/max rows per district", int(agg["rows"].min()), int(agg["rows"].max()))

    for t in [1, 2, 3, 5, 10, 20, 50, 100]:
        print("districts with rows>=", t, ":", int((agg["rows"] >= t).sum()))

    for tot in [0, 10, 50, 100, 200, 500, 1000, 2000, 5000]:
        print("districts with total>=", tot, ":", int((agg["total"] >= tot).sum()))

    target = 813
    candidates = np.unique(agg["total"].values)
    candidates.sort()
    best = None
    for thr in candidates:
        c = int((agg["total"] >= thr).sum())
        d = abs(c - target)
        if best is None or d < best[0]:
            best = (d, float(thr), c)
            if d == 0:
                break

    print(f"closest total threshold for {target} districts:", best)


if __name__ == "__main__":
    main()
