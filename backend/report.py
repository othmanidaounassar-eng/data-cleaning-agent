from datetime import datetime
import numpy as np


def convert_numpy(obj):
    """
    Convert NumPy types to native Python types
    so they can be serialized to JSON.
    """

    if isinstance(obj, np.integer):
        return int(obj)

    if isinstance(obj, np.floating):
        return float(obj)

    if isinstance(obj, np.ndarray):
        return obj.tolist()

    if isinstance(obj, dict):
        return {
            key: convert_numpy(value)
            for key, value in obj.items()
        }

    if isinstance(obj, list):
        return [
            convert_numpy(item)
            for item in obj
        ]

    return obj


def generate_report(
    analysis_before,
    analysis_after,
    cleaning_report,
    execution_time
):
    """
    Generate a cleaning report.
    """

    report = {}

    report["generated_at"] = datetime.now().strftime(
        "%Y-%m-%d %H:%M:%S"
    )

    report["execution_time"] = round(
        execution_time,
        2
    )

    # Dataset Information
    report["rows_before"] = analysis_before["rows"]
    report["rows_after"] = analysis_after["rows"]

    report["columns"] = analysis_after["columns"]

    # Missing Values
    report["missing_before"] = (
        analysis_before["total_missing"]
    )

    report["missing_after"] = (
        analysis_after["total_missing"]
    )

    # Duplicate Rows
    report["duplicates_before"] = (
        analysis_before["duplicate_rows"]
    )

    report["duplicates_removed"] = (
        cleaning_report["duplicates_removed"]
    )

    # Cleaning Summary
    report["missing_filled"] = (
        cleaning_report["missing_values_filled"]
    )

    report["text_columns_cleaned"] = (
        cleaning_report["text_columns_cleaned"]
    )

    report["columns_modified"] = (
        cleaning_report["columns_modified"]
    )

    # Convert NumPy values before returning
    return convert_numpy(report)


def print_report(report):

    print("\n========== AI DATA CLEANING REPORT ==========\n")

    print(
        f"Generated At : {report['generated_at']}"
    )

    print(
        f"Execution Time : {report['execution_time']} sec"
    )

    print()

    print(
        f"Rows Before : {report['rows_before']}"
    )

    print(
        f"Rows After : {report['rows_after']}"
    )

    print(
        f"Columns : {report['columns']}"
    )

    print()

    print(
        f"Missing Before : {report['missing_before']}"
    )

    print(
        f"Missing After : {report['missing_after']}"
    )

    print()

    print(
        f"Duplicates Before : {report['duplicates_before']}"
    )

    print(
        f"Duplicates Removed : {report['duplicates_removed']}"
    )

    print()

    print(
        f"Missing Values Filled : {report['missing_filled']}"
    )

    print()

    print(
        "Modified Columns:"
    )

    print(
        report["columns_modified"]
    )

    print()

    print(
        "Text Columns Cleaned:"
    )

    print(
        report["text_columns_cleaned"]
    )