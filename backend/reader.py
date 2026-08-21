# cspell:ignore OQZARO
"""File reading utilities for OQZARO DataCleaning Agent."""

import os
import pandas as pd


def read_data(file_path: str) -> pd.DataFrame:  # type: ignore
    """
    Read data from CSV or Excel file.

    Args:
        file_path: Path to the input file.

    Returns:
        pandas.DataFrame: Loaded data.
    """
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".csv":
        return pd.read_csv(file_path, encoding="utf-8-sig")  # type: ignore
    elif ext in [".xlsx", ".xls"]:
        engine = "openpyxl" if ext == ".xlsx" else "xlrd"
        return pd.read_excel(file_path, engine=engine)  # type: ignore
    else:
        raise ValueError(f"Unsupported file format: {ext}")
