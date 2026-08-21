# cspell:ignore OQZARO
"""Data analysis utilities for OQZARO DataCleaning Agent."""

import pandas as pd


def analyze_data(df: pd.DataFrame) -> dict:  # type: ignore
    """
    Perform basic statistical analysis on the dataframe.

    Args:
        df: Input pandas DataFrame.

    Returns:
        dict: Analysis results (rows, columns, nulls, duplicates).
    """
    return {
        "rows": len(df),
        "columns": len(df.columns),
        "nulls": int(df.isnull().sum().sum()),
        "duplicates": int(df.duplicated().sum()),
    }
