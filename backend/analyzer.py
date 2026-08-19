# backend/analyzer.py

import pandas as pd


def analyze_data(df: pd.DataFrame) -> dict:
    """
    تحليل البيانات وإرجاع إحصائيات أساسية.
    """
    if df is None or df.empty:
        return {
            "rows": 0,
            "columns": 0,
            "column_names": [],
            "dtypes": {},
            "missing_values": {},
            "total_missing": 0,
        }

    return {
        "rows": len(df),
        "columns": len(df.columns),
        "column_names": df.columns.tolist(),
        "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
        "missing_values": {col: int(df[col].isna().sum()) for col in df.columns},
        "total_missing": int(df.isna().sum().sum()),
    }
