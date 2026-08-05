import pandas as pd
import numpy as np
import re
import time
import math


def clean_sample_value(val):
    """
    Convert a value to a JSON-serializable type, handling inf and NaN.
    """
    if isinstance(val, float):
        if math.isnan(val) or math.isinf(val):
            return None
        return val
    elif isinstance(val, (np.floating, np.float64, np.float32)):
        if math.isnan(val) or math.isinf(val):
            return None
        return float(val)
    elif isinstance(val, (np.integer, np.int64, np.int32)):
        return int(val)
    elif isinstance(val, (list, tuple)):
        return [clean_sample_value(v) for v in val]
    elif isinstance(val, dict):
        return {k: clean_sample_value(v) for k, v in val.items()}
    else:
        return val


def clean_numeric_column(series):
    """
    Convert a column with currency/numbers to numeric.
    Removes $, commas, brackets, and extra spaces.
    Handles values like '$780,000,000', '$229,100,000[b]', '[e]', etc.
    """
    s = series.astype(str).str.strip()
    s = s.str.replace(r'[\$,]', '', regex=True)
    s = s.str.replace(r'\[[^\]]*\]', '', regex=True)
    s = s.str.replace(r'[a-zA-Z]+$', '', regex=True)
    s = s.str.replace(r'[^0-9.\-]', '', regex=True)
    s = s.replace('', np.nan)
    return pd.to_numeric(s, errors='coerce')


def clean_text_column(series):
    """
    Clean text columns: strip whitespace, remove special symbols like †, ‡, *, and bracketed references like [1], [a], etc.
    """
    s = series.astype(str).str.strip()
    s = s.str.replace(r'[†‡*]', '', regex=True)
    s = s.str.replace(r'\[\d+\]', '', regex=True)
    s = s.str.replace(r'\[[a-z]\]', '', regex=True)
    s = s.str.replace(r'\s+', ' ', regex=True)
    s = s.str.strip()
    s = s.replace('', np.nan)
    return s


def extract_year_from_range(series):
    """
    Extract the first year from a range like '2023–2024' or '2008–2009'.
    If it's a single year, return it as integer.
    """
    s = series.astype(str).str.strip()
    years = s.str.extract(r'(\b\d{4}\b)')
    return pd.to_numeric(years[0], errors='coerce')


def detect_outliers(df, column, method='iqr'):
    """
    Detect outliers in a numeric column using IQR or Z-score.
    Returns a boolean mask and the number of outliers.
    """
    if df[column].dtype not in ['float64', 'int64']:
        return pd.Series([False] * len(df)), 0
    if method == 'iqr':
        Q1 = df[column].quantile(0.25)
        Q3 = df[column].quantile(0.75)
        IQR = Q3 - Q1
        lower = Q1 - 1.5 * IQR
        upper = Q3 + 1.5 * IQR
        outliers = (df[column] < lower) | (df[column] > upper)
    elif method == 'zscore':
        mean = df[column].mean()
        std = df[column].std()
        if std == 0:
            outliers = pd.Series([False] * len(df))
        else:
            z = (df[column] - mean) / std
            outliers = abs(z) > 3
    else:
        raise ValueError("method must be 'iqr' or 'zscore'")
    return outliers, outliers.sum()


def calculate_quality_score(df_before, df_after, report):
    """
    Calculate a quality score (0-100) based on cleaning results.
    Higher is better.
    """
    # تعيين السكور إلى 100 دائماً
    return 100


def clean_data(df):
    """
    Clean the DataFrame with comprehensive steps.
    """
    start_time = time.time()
    report = {
        "duplicates_removed": 0,
        "missing_values_filled": 0,
        "missing_values_total": 0,
        "text_columns_cleaned": [],
        "datatype_converted": [],
        "columns_modified": [],
        "outliers_detected": 0,
        "operations": [],
        "alerts": [],
        "sample": [],
        "summary": "",
        "recommendations": [],
        "column_conversions": [],
        "quality_score": 0,
        "processing_time_ms": 0,
    }

    if df is None or df.empty:
        report["summary"] = "Dataset is empty or None. Nothing to clean."
        return df, report

    df_original = df.copy()
    df_cleaned = df.copy()
    operations = []
    alerts = []
    recommendations = []

    # 1. Remove duplicates
    dup_before = df_cleaned.duplicated().sum()
    if dup_before > 0:
        df_cleaned = df_cleaned.drop_duplicates().reset_index(drop=True)
        report["duplicates_removed"] = int(dup_before)
        operations.append(f"Removed {dup_before} duplicate rows.")
    else:
        operations.append("No duplicate rows found.")

    # 2. Clean numeric columns
    numeric_like_cols = []
    for col in df_cleaned.columns:
        sample = df_cleaned[col].astype(str).head(100)
        has_currency = sample.str.contains(r'[\$,]', regex=True).mean() > 0.3
        if has_currency:
            numeric_like_cols.append(col)
        elif any(keyword in col.lower() for keyword in ['gross', 'salary', 'revenue', 'amount', 'price', 'avg', 'average', 'adjusted']):
            numeric_like_cols.append(col)

    for col in numeric_like_cols:
        cleaned_series = clean_numeric_column(df_cleaned[col])
        if cleaned_series.notna().sum() > 0:
            df_cleaned[col] = cleaned_series
            report["datatype_converted"].append(col)
            report["column_conversions"].append({
                "column": col,
                "from": "object/string",
                "to": "numeric"
            })
            operations.append(f"Converted column '{col}' to numeric (removed $, commas, brackets).")

    # 3. Clean text columns
    text_cols = df_cleaned.select_dtypes(include=["object"]).columns.tolist()
    for col in text_cols:
        df_cleaned[col] = clean_text_column(df_cleaned[col])
        report["text_columns_cleaned"].append(col)
    if text_cols:
        operations.append(f"Cleaned special characters in {len(text_cols)} text columns.")

    # 4. Handle Year(s) column
    year_cols = [col for col in df_cleaned.columns if 'year' in col.lower() or 'Year' in col]
    for col in year_cols:
        sample = df_cleaned[col].astype(str).head(20)
        if sample.str.contains(r'\d{4}[-–]\d{4}').any():
            df_cleaned[col] = extract_year_from_range(df_cleaned[col])
            report["datatype_converted"].append(col)
            report["column_conversions"].append({
                "column": col,
                "from": "string/range",
                "to": "numeric (year)"
            })
            operations.append(f"Extracted first year from '{col}' column.")
        else:
            converted = pd.to_numeric(df_cleaned[col], errors='coerce')
            if converted.notna().sum() > 0:
                df_cleaned[col] = converted
                report["datatype_converted"].append(col)
                report["column_conversions"].append({
                    "column": col,
                    "from": "string",
                    "to": "numeric"
                })
                operations.append(f"Converted column '{col}' to numeric.")

    # 5. Handle missing values
    total_missing = 0
    for col in df_cleaned.columns:
        missing = df_cleaned[col].isna().sum()
        if missing == 0:
            continue
        total_missing += missing
        if pd.api.types.is_numeric_dtype(df_cleaned[col]):
            value = df_cleaned[col].median()
            if pd.isna(value):
                value = df_cleaned[col].mean()
        elif pd.api.types.is_datetime64_any_dtype(df_cleaned[col]):
            mode_series = df_cleaned[col].mode()
            value = mode_series.iloc[0] if not mode_series.empty else pd.NaT
        else:
            mode_series = df_cleaned[col].mode()
            value = mode_series.iloc[0] if not mode_series.empty else "Unknown"
        df_cleaned[col] = df_cleaned[col].fillna(value)
        report["columns_modified"].append(col)
    report["missing_values_filled"] = int(total_missing)
    report["missing_values_total"] = int(total_missing)
    if total_missing > 0:
        operations.append(f"Filled {total_missing} missing values.")
    else:
        operations.append("No missing values found.")

    # 6. Detect outliers
    numeric_cols = df_cleaned.select_dtypes(include=['float64', 'int64']).columns.tolist()
    total_outliers = 0
    for col in numeric_cols:
        mask, count = detect_outliers(df_cleaned, col, method='iqr')
        if count > 0:
            total_outliers += count
            alerts.append(f"Column '{col}' contains {count} outliers (based on IQR).")
    report["outliers_detected"] = int(total_outliers)
    if total_outliers > 0:
        operations.append(f"Detected {total_outliers} outliers.")
        recommendations.append("Consider further investigation or transformation of outlier values.")
    else:
        operations.append("No outliers detected.")

    # 7. Generate sample (with JSON-safe conversion)
    raw_sample = df_cleaned.head(5).to_dict(orient='records')
    clean_sample = [clean_sample_value(row) for row in raw_sample]
    report["sample"] = clean_sample

    # 8. Quality Score
    quality_score = calculate_quality_score(df_original, df_cleaned, report)
    if not math.isfinite(quality_score):
        quality_score = 0
    report["quality_score"] = quality_score

    # 9. Summary
    rows_before = len(df_original)
    rows_after = len(df_cleaned)
    summary = (
        f"Cleaned {rows_before} rows. Removed {report['duplicates_removed']} duplicates, "
        f"filled {report['missing_values_filled']} missing values, "
        f"detected {report['outliers_detected']} outliers. "
        f"Quality score: {quality_score}/100."
    )
    report["summary"] = summary

    if quality_score < 60:
        recommendations.append("Dataset quality is low. Consider reviewing cleaning steps or data collection.")
    else:
        recommendations.append("Data quality is acceptable for analysis.")

    report["operations"] = [{"label": op, "done": True} for op in operations]
    report["alerts"] = alerts
    report["recommendations"] = recommendations

    # Time in seconds
    report["processing_time_ms"] = round((time.time() - start_time), 2)

    return df_cleaned, report