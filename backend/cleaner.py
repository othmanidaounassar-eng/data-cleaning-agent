import pandas as pd


def clean_data(df):
    """
    تنظيف البيانات وإرجاع DataFrame نظيف مع تقرير.
    """

    report = {
        "duplicates_removed": 0,
        "missing_values_filled": 0,
        "text_columns_cleaned": [],
        "datatype_converted": [],
        "columns_modified": []
    }

    if df is None or df.empty:
        return df, report

    # =====================================
    # Remove Duplicate Rows
    # =====================================

    duplicates_before = df.duplicated().sum()

    if duplicates_before > 0:
        df = df.drop_duplicates().reset_index(drop=True)

    report["duplicates_removed"] = int(duplicates_before)



    # =====================================
    # Handle Missing Values
    # =====================================

    for column in df.columns:

        missing = df[column].isna().sum()

        if missing == 0:
            continue

        if pd.api.types.is_numeric_dtype(df[column]):

            value = df[column].median()

        elif pd.api.types.is_datetime64_any_dtype(df[column]):

            mode = df[column].mode()
            value = mode.iloc[0] if not mode.empty else pd.NaT

        else:

            mode = df[column].mode()
            value = mode.iloc[0] if not mode.empty else "Unknown"

        df[column] = df[column].fillna(value)

        report["missing_values_filled"] += missing

        if column not in report["columns_modified"]:
            report["columns_modified"].append(column)

    # =====================================
    # Clean Text Columns
    # =====================================

    text_columns = df.select_dtypes(include=["object"]).columns

    for column in text_columns:

        df[column] = (
            df[column]
            .fillna("")
            .astype(str)
            .str.strip()
            .str.replace(r"\s+", " ", regex=True)
        )

        report["text_columns_cleaned"].append(column)

    # =====================================
    # Data Type Conversion
    # =====================================

    for column in df.columns:

        if df[column].dtype == "object":

            converted = pd.to_numeric(df[column], errors="coerce")

            if converted.notna().sum() == df[column].notna().sum():
                df[column] = converted

                report["datatype_converted"].append(column)

    return df, report


import pandas as pd
from cleaner import clean_data

df = pd.DataFrame({
    "Name": ["  Ali  ", "Sara", "Sara", None],
    "Age": ["20", "25", "25", None],
    "Salary": [5000, None, None, 7000],
    "City": [" Marrakech ", "Casablanca", "Casablanca", None]
})

print("===== Before Cleaning =====")
print(df)

cleaned_df, report = clean_data(df)

print("\n===== After Cleaning =====")
print(cleaned_df)

print("\n===== Report =====")
print(report)

print("\n===== Data Types =====")
print(cleaned_df.dtypes)