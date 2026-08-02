import pandas as pd


def analyze_data(df):
    """
    Analyze dataset and return a summary dictionary.
    """

    if df is None or df.empty:
        return {
            "status": "Empty Dataset"
        }

    analysis = {}

    # Basic Information
    analysis["rows"] = df.shape[0]
    analysis["columns"] = df.shape[1]
    analysis["memory_usage_mb"] = round(
        df.memory_usage(deep=True).sum() / 1024**2,
        2
    )

    # Data Types
    analysis["numeric_columns"] = (
        df.select_dtypes(include="number")
        .columns
        .tolist()
    )

    analysis["text_columns"] = (
        df.select_dtypes(include="object")
        .columns
        .tolist()
    )

    analysis["datetime_columns"] = (
        df.select_dtypes(include="datetime")
        .columns
        .tolist()
    )

    # Missing Values
    analysis["missing_values"] = (
        df.isna().sum().to_dict()
    )

    analysis["total_missing"] = int(
        df.isna().sum().sum()
    )

    # Duplicate Rows
    analysis["duplicate_rows"] = int(
        df.duplicated().sum()
    )

    # Unique Values
    analysis["unique_values"] = (
        df.nunique().to_dict()
    )

    # Constant Columns
    constant_columns = []

    for column in df.columns:

        if df[column].nunique() <= 1:

            constant_columns.append(column)

    analysis["constant_columns"] = constant_columns

    return analysis