# cspell:ignore OQZARO
"""Report generation utilities for OQZARO DataCleaning Agent."""

from ai_explainer import explain_cleaning_with_log

def generate_report(before: dict, after: dict, cleaning_report: dict, execution_time: float) -> dict:
    """
    Generate the final cleaning report with detailed log, AI explanation,
    and column data types.
    """
    rows_before = before.get("rows", 0)
    rows_after = after.get("rows", 0)

    cleaning_log = cleaning_report.get("operations", [])
    alerts = cleaning_report.get("alerts", [])
    recommendations = cleaning_report.get("recommendations", [])
    sample = cleaning_report.get("sample", [])
    summary = cleaning_report.get("summary", "")
    column_data_types = cleaning_report.get("column_data_types", {})

    if not column_data_types and sample:
        first_row = sample[0] if sample else {}
        for col, val in first_row.items():
            if val is None:
                column_data_types[col] = "null"
            elif isinstance(val, bool):
                column_data_types[col] = "boolean"
            elif isinstance(val, int):
                column_data_types[col] = "integer"
            elif isinstance(val, float):
                column_data_types[col] = "float"
            elif isinstance(val, str):
                column_data_types[col] = "text / string"
            else:
                column_data_types[col] = "unknown"

    report = {
        "rows_before": rows_before,
        "rows_after": rows_after,
        "duplicates_removed": cleaning_report.get("duplicates_removed", 0),
        "missing_values_filled": cleaning_report.get("missing_values_filled", 0),
        "missing_values_total": cleaning_report.get("missing_values_total", 0),
        "outliers_detected": cleaning_report.get("outliers_detected", 0),
        "quality_score": cleaning_report.get("quality_score", 0),
        "execution_time_seconds": round(execution_time, 2),
        "cleaning_log": cleaning_log,
        "alerts": alerts,
        "recommendations": recommendations,
        "sample": sample,
        "summary": summary,
        "column_data_types": column_data_types,
    }

    if cleaning_log:
        ai_explanation = explain_cleaning_with_log(rows_before, rows_after, cleaning_log)
        report["ai_explanation"] = ai_explanation
    else:
        report["ai_explanation"] = "No cleaning operations were performed."

    return report