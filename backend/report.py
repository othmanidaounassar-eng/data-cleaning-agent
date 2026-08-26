# cspell:ignore OQZARO
"""Report generation utilities for OQZARO DataCleaning Agent."""

from ai_explainer import explain_cleaning_with_log

def generate_report(before: dict, after: dict, cleaning_report: dict, execution_time: float) -> dict:
    """
    Generate the final cleaning report with detailed log and AI explanation.

    Args:
        before: Analysis results before cleaning.
        after: Analysis results after cleaning.
        cleaning_report: Dictionary containing cleaning statistics and operations log.
        execution_time: Total execution time in seconds.

    Returns:
        dict: Formatted report with statistics, log, and AI explanation.
    """
    rows_before = before.get("rows", 0)
    rows_after = after.get("rows", 0)

    # Extract cleaning log (list of operation dicts) from the cleaning_report
    cleaning_log = cleaning_report.get("operations", [])

    # Basic statistics
    report = {
        "rows_before": rows_before,
        "rows_after": rows_after,
        "duplicates_removed": cleaning_report.get("duplicates_removed", 0),
        "missing_values_filled": cleaning_report.get("missing_values_filled", 0),
        "missing_values_total": cleaning_report.get("missing_values_total", 0),
        "outliers_detected": cleaning_report.get("outliers_detected", 0),
        "quality_score": cleaning_report.get("quality_score", 0),
        "execution_time_seconds": round(execution_time, 2),
        "cleaning_log": cleaning_log,                     # ← detailed log
        "alerts": cleaning_report.get("alerts", []),
        "recommendations": cleaning_report.get("recommendations", []),
        "sample": cleaning_report.get("sample", []),
        "summary": cleaning_report.get("summary", ""),
    }

    # Generate AI explanation if there is a log
    if cleaning_log:
        ai_explanation = explain_cleaning_with_log(rows_before, rows_after, cleaning_log)
        report["ai_explanation"] = ai_explanation
    else:
        report["ai_explanation"] = "No cleaning operations were performed."

    return report