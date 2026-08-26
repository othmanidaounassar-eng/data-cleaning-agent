# cspell:ignore OQZARO
"""Report generation utilities for OQZARO DataCleaning Agent."""

# from ai_explainer import explain_cleaning_with_log   # <- تم التعطيل

def generate_report(before: dict, after: dict, cleaning_report: dict, execution_time: float) -> dict:
    """
    Generate the final cleaning report with detailed log and AI explanation.
    """
    rows_before = before.get("rows", 0)
    rows_after = after.get("rows", 0)

    cleaning_log = cleaning_report.get("operations", [])

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
        "alerts": cleaning_report.get("alerts", []),
        "recommendations": cleaning_report.get("recommendations", []),
        "sample": cleaning_report.get("sample", []),
        "summary": cleaning_report.get("summary", ""),
    }

    # ✅ شرح ثابت (دون ذكاء اصطناعي)
    report["ai_explanation"] = "تم تنظيف البيانات بنجاح. راجع السجل التفصيلي للتغييرات."

    return report