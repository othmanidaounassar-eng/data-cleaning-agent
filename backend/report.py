# cspell:ignore OQZARO
"""Report generation utilities for OQZARO DataCleaning Agent."""


def generate_report(before: dict, after: dict, cleaning_report: dict, execution_time: float) -> dict:  # type: ignore
    """
    Generate the final cleaning report.

    Args:
        before: Analysis results before cleaning.
        after: Analysis results after cleaning.
        cleaning_report: Dictionary with duplicates_removed and missing_filled.
        execution_time: Total execution time in seconds.

    Returns:
        dict: Formatted report.
    """
    return {
        "rows_before": before.get("rows", 0),
        "rows_after": after.get("rows", 0),
        "duplicates_removed": cleaning_report.get("duplicates_removed", 0),
        "missing_values_filled": cleaning_report.get("missing_filled", 0),
        "execution_time_seconds": round(execution_time, 2),
    }
