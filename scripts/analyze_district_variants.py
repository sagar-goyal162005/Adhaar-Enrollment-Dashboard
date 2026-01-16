from __future__ import annotations

from pathlib import Path

import pandas as pd


def main() -> None:
    p = Path("D:/Uidai/data/api_data_aadhar_enrolment.cleaned.csv")
    df = pd.read_csv(p)

    print("rows", len(df))
    print("states", df["state"].nunique())
    print("districts(name)", df["district"].nunique())
    print("districts(state,district)", df[["state", "district"]].drop_duplicates().shape[0])

    d = df["district"].astype(str)
    key = d.str.lower().str.strip()
    key2 = (
        key.str.replace(r"\s+district\s*$", "", regex=True)
        .str.replace(r"^district\s+", "", regex=True)
        .str.replace(r"\s+", " ", regex=True)
    )

    collapsed = pd.DataFrame({"orig": d, "key2": key2}).drop_duplicates()
    multi = collapsed.groupby("key2")["orig"].nunique().sort_values(ascending=False)

    print("unique orig district strings", collapsed["orig"].nunique())
    print("unique key2", collapsed["key2"].nunique())
    print("keys with >1 variants", int((multi > 1).sum()))

    top = multi[multi > 1].head(25)
    if len(top):
        print("\nTop variant keys:")
        print(top.to_string())
        print("\nExamples:")
        for k in list(top.index)[:10]:
            vars_ = collapsed[collapsed["key2"] == k]["orig"].tolist()[:10]
            print("-", k, "=>", vars_)


if __name__ == "__main__":
    main()
