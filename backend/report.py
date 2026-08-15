import math
import numpy as np
import pandas as pd


def convert_to_serializable(obj):
    """
    Convert numpy/pandas types to Python native types for JSON serialization.
    Handles inf, -inf, and NaN by converting them to None.
    """
    # Handle basic Python float with inf/nan
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    # Handle numpy numeric types
    elif isinstance(obj, (np.integer, np.int64, np.int32)):
        return int(obj)
    elif isinstance(obj, (np.floating, np.float64, np.float32)):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return float(obj)
    # Handle arrays and sequences
    elif isinstance(obj, np.ndarray):
        return [convert_to_serializable(item) for item in obj]
    elif isinstance(obj, pd.Series):
        return [convert_to_serializable(item) for item in obj.to_list()]
    elif isinstance(obj, pd.DataFrame):
        return obj.to_dict(orient="records")
    elif isinstance(obj, dict):
        return {k: convert_to_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [convert_to_serializable(item) for item in obj]
    else:
        return obj


def generate_report(
    before: dict, after: dict, cleaning_report: dict, execution_time: float
) -> dict:
    """
    Generate a structured report from the cleaning process results.
    """
    rows_before = before.get("rows", 0)
    rows_after = after.get("rows", 0)
    columns_before = before.get("columns", 0)
    columns_after = after.get("columns", 0)

    duplicates_removed = cleaning_report.get("duplicates_removed", 0)
    missing_values_filled = cleaning_report.get("missing_values_filled", 0)

    quality_score = cleaning_report.get("quality_score", 0)
    processing_time_s = round(execution_time, 2)

    report = {
        "rows_before": rows_before,
        "rows_after": rows_after,
        "columns_before": columns_before,
        "columns_after": columns_after,
        "duplicates_removed": duplicates_removed,
        "missing_values_filled": missing_values_filled,
        "execution_time": execution_time,
        "quality_score": quality_score,
        "processing_time_s": processing_time_s,
        "sample": cleaning_report.get("sample", []),
        "alerts": cleaning_report.get("alerts", []),
        "summary": cleaning_report.get(
            "summary",
            (
                f"Cleaned {rows_before} rows. Removed {duplicates_removed} duplicates "
                f"and filled {missing_values_filled} missing values."
            ),
        ),
        "operations": cleaning_report.get("operations", []),
        "recommendations": cleaning_report.get("recommendations", []),
        "column_conversions": cleaning_report.get("column_conversions", []),
        "before": before,
        "after": after,
        "cleaning_report": cleaning_report,
    }

    # Convert all values to JSON-serializable types (including inf → None)
    return convert_to_serializable(report)