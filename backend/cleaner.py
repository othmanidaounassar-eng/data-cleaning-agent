import pandas as pd
import numpy as np
import time
import math

# ============================================================
# Helper: Generate reason (AI disabled – returns fixed text)
# ============================================================
def generate_reason_for_action(action_type, description, details, sample_data=None):
    """Return a fixed reason (AI is disabled)."""
    return "تم تنفيذ هذه العملية لتحسين جودة البيانات."

# ============================================================
# Standard helpers
# ============================================================

def clean_sample_value(val):
    if isinstance(val, float):
        if math.isnan(val) or math.isinf(val):
            return None
        return val
    if isinstance(val, (np.floating, np.float64, np.float32)):
        if math.isnan(val) or math.isinf(val):
            return None
        return float(val)
    if isinstance(val, (np.integer, np.int64, np.int32)):
        return int(val)
    if isinstance(val, (list, tuple)):
        return [clean_sample_value(v) for v in val]
    if isinstance(val, dict):
        return {k: clean_sample_value(v) for k, v in val.items()}
    return val

def clean_numeric_column(series):
    s = series.astype(str).str.strip()
    s = s.str.replace(r"[\$,]", "", regex=True)
    s = s.str.replace(r"\[[^\]]*\]", "", regex=True)
    s = s.str.replace(r"[a-zA-Z]+$", "", regex=True)
    s = s.str.replace(r"[^0-9.\-]", "", regex=True)
    s = s.replace("", np.nan)
    return pd.to_numeric(s, errors="coerce")

def clean_text_column(series):
    s = series.astype(str).str.strip()
    s = s.str.replace(r"[†‡*]", "", regex=True)
    s = s.str.replace(r"\[\d+\]", "", regex=True)
    s = s.str.replace(r"\[[a-z]\]", "", regex=True)
    s = s.str.replace(r"\s+", " ", regex=True)
    s = s.str.strip()
    s = s.replace("", np.nan)
    return s

def extract_year_from_range(series):
    s = series.astype(str).str.strip()
    years = s.str.extract(r"(\b\d{4}\b)")
    return pd.to_numeric(years[0], errors="coerce")

def detect_outliers(df, column, method="iqr"):
    if df[column].dtype not in ["float64", "int64"]:
        return pd.Series([False] * len(df)), 0

    if method == "iqr":
        q1 = df[column].quantile(0.25)
        q3 = df[column].quantile(0.75)
        iqr = q3 - q1
        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr
        outliers = (df[column] < lower) | (df[column] > upper)
    elif method == "zscore":
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
    rows_before = len(df_before)
    dup_removed = report.get("duplicates_removed", 0)
    missing_filled = report.get("missing_values_filled", 0)
    outliers = report.get("outliers_detected", 0)

    score = 100
    if rows_before > 0:
        dup_ratio = dup_removed / rows_before
        score -= min(30, dup_ratio * 100 * 0.3)
        missing_ratio = missing_filled / (rows_before * len(df_before.columns))
        score -= min(30, missing_ratio * 100 * 0.3)
        outlier_ratio = outliers / rows_before
        score -= min(20, outlier_ratio * 100 * 0.2)
    return max(0, round(score))

# ============================================================
# Main clean_data function
# ============================================================

def clean_data(df):
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
        "column_data_types": {},
    }

    if df is None or df.empty:
        report["summary"] = "Dataset is empty or None. Nothing to clean."
        return df, report

    df_original = df.copy()
    df_cleaned = df.copy()
    operations = []
    alerts = []
    recommendations = []

    def add_log(action, description, details, rows_affected=0, status="completed", reason=None):
        operations.append({
            "action": action,
            "description": description,
            "details": details,
            "rows_affected": rows_affected,
            "status": status,
            "reason": reason,
        })

    # --- 1. Duplicates ---
    dup_before = df_cleaned.duplicated().sum()
    if dup_before > 0:
        df_cleaned = df_cleaned.drop_duplicates().reset_index(drop=True)
        report["duplicates_removed"] = int(dup_before)
        reason = generate_reason_for_action("duplicate_removal", f"Removed {dup_before} duplicate rows.", "Duplicates were identified based on all columns.")
        add_log("duplicate_removal", f"Removed {dup_before} duplicate rows.", "Duplicates were identified based on all columns.", dup_before, "completed", reason)
    else:
        add_log("duplicate_removal", "No duplicate rows found.", "All rows are unique.", 0, "skipped", "Data was already clean; no duplicate rows to remove.")

    # --- 2. Numeric columns ---
    numeric_like_cols = []
    for col in df_cleaned.columns:
        sample = df_cleaned[col].astype(str).head(100)
        has_currency = sample.str.contains(r"[\$,]", regex=True).mean() > 0.3
        if has_currency:
            numeric_like_cols.append(col)
        elif any(kw in col.lower() for kw in ["gross", "salary", "revenue", "amount", "price", "avg", "average", "adjusted"]):
            numeric_like_cols.append(col)

    for col in numeric_like_cols:
        cleaned_series = clean_numeric_column(df_cleaned[col])
        if cleaned_series.notna().sum() > 0:
            df_cleaned[col] = cleaned_series
            report["datatype_converted"].append(col)
            report["column_conversions"].append({"column": col, "from": "object/string", "to": "numeric"})
            reason = generate_reason_for_action("type_conversion", f"Converted column '{col}' to numeric.", "Removed currency symbols, commas, and brackets.")
            add_log("type_conversion", f"Converted column '{col}' to numeric.", "Removed currency symbols, commas, and brackets.", len(df_cleaned), "completed", reason)

    # --- 3. Text cleaning ---
    text_cols = df_cleaned.select_dtypes(include=["object"]).columns.tolist()
    for col in text_cols:
        df_cleaned[col] = clean_text_column(df_cleaned[col])
        report["text_columns_cleaned"].append(col)
    if text_cols:
        reason = generate_reason_for_action("text_cleaning", f"Cleaned {len(text_cols)} text columns.", "Removed special characters and extra spaces.")
        add_log("text_cleaning", f"Cleaned {len(text_cols)} text columns.", "Removed special characters and extra spaces.", len(df_cleaned), "completed", reason)
    else:
        add_log("text_cleaning", "No text columns needed cleaning.", "All text columns were already clean.", 0, "skipped", "Data was already clean; no text cleaning required.")

    # --- 4. Year columns ---
    year_cols = [col for col in df_cleaned.columns if "year" in col.lower()]
    for col in year_cols:
        sample = df_cleaned[col].astype(str).head(20)
        if sample.str.contains(r"\d{4}[-–]\d{4}").any():
            df_cleaned[col] = extract_year_from_range(df_cleaned[col])
            report["datatype_converted"].append(col)
            report["column_conversions"].append({"column": col, "from": "string/range", "to": "numeric (year)"})
            reason = generate_reason_for_action("type_conversion", f"Extracted year from '{col}' column.", "Converted ranges like '2023–2024' to 2023.")
            add_log("type_conversion", f"Extracted year from '{col}' column.", "Converted ranges like '2023–2024' to 2023.", len(df_cleaned), "completed", reason)
        else:
            converted = pd.to_numeric(df_cleaned[col], errors="coerce")
            if converted.notna().sum() > 0:
                df_cleaned[col] = converted
                report["datatype_converted"].append(col)
                report["column_conversions"].append({"column": col, "from": "string", "to": "numeric"})
                reason = generate_reason_for_action("type_conversion", f"Converted column '{col}' to numeric.", "All values were convertible to numbers.")
                add_log("type_conversion", f"Converted column '{col}' to numeric.", "All values were convertible to numbers.", len(df_cleaned), "completed", reason)

    # --- 5. Missing values ---
    total_missing = 0
    missing_details = []
    for col in df_cleaned.columns:
        missing = df_cleaned[col].isna().sum()
        if missing == 0:
            continue
        total_missing += missing
        if pd.api.types.is_numeric_dtype(df_cleaned[col]):
            value = df_cleaned[col].median()
            if pd.isna(value):
                value = df_cleaned[col].mean()
            strategy = "median" if not pd.isna(df_cleaned[col].median()) else "mean"
        else:
            mode_series = df_cleaned[col].mode()
            value = mode_series.iloc[0] if not mode_series.empty else "Unknown"
            strategy = "mode"
        df_cleaned[col] = df_cleaned[col].fillna(value)
        report["columns_modified"].append(col)
        missing_details.append(f"Column '{col}': filled {missing} values using {strategy}.")

    report["missing_values_filled"] = int(total_missing)
    report["missing_values_total"] = int(total_missing)

    if total_missing > 0:
        reason = generate_reason_for_action("missing_values", f"Filled {total_missing} missing values.", "; ".join(missing_details))
        add_log("missing_values", f"Filled {total_missing} missing values.", "; ".join(missing_details), total_missing, "completed", reason)
    else:
        add_log("missing_values", "No missing values found.", "All columns have complete data.", 0, "skipped", "Data was already clean; no missing values to fill.")

    # --- 6. Outliers ---
    numeric_cols = df_cleaned.select_dtypes(include=["float64", "int64"]).columns.tolist()
    total_outliers = 0
    outlier_cols = []
    for col in numeric_cols:
        mask, count = detect_outliers(df_cleaned, col, method="iqr")
        if count > 0:
            total_outliers += count
            outlier_cols.append(col)
            alerts.append(f"Column '{col}' contains {count} outliers.")

    report["outliers_detected"] = int(total_outliers)

    if total_outliers > 0:
        reason = generate_reason_for_action("outlier_detection", f"Detected {total_outliers} outliers.", f"Columns: {', '.join(outlier_cols)}. Used IQR method.")
        add_log("outlier_detection", f"Detected {total_outliers} outliers.", f"Columns: {', '.join(outlier_cols)}. Used IQR method.", total_outliers, "completed", reason)
        recommendations.append("Consider investigating outlier values.")
    else:
        add_log("outlier_detection", "No outliers detected.", "All values are within normal range (IQR method).", 0, "skipped", "Data was already clean; no outliers found.")

    # --- 7. Unchanged columns ---
    for col in df_original.columns:
        if col in df_cleaned.columns:
            if col not in report["datatype_converted"] and col not in report["columns_modified"]:
                add_log("unchanged", f"Column '{col}' was not modified.", "The data was already clean.", 0, "skipped", "Data was already clean; no changes needed.")

    # --- 8. Sample ---
    raw_sample = df_cleaned.head(5).to_dict(orient="records")
    clean_sample = [clean_sample_value(row) for row in raw_sample]
    report["sample"] = clean_sample

    # --- 9. Quality Score ---
    quality_score = calculate_quality_score(df_original, df_cleaned, report)
    if not math.isfinite(quality_score):
        quality_score = 0
    report["quality_score"] = quality_score

    # --- 10. Summary ---
    rows_before = len(df_original)
    summary = (
        f"Cleaned {rows_before} rows. Removed {report['duplicates_removed']} duplicates, "
        f"filled {report['missing_values_filled']} missing values, "
        f"detected {report['outliers_detected']} outliers. "
        f"Quality score: {quality_score}/100."
    )
    report["summary"] = summary

    if quality_score < 60:
        recommendations.append("Dataset quality is low. Consider reviewing data collection.")
    else:
        recommendations.append("Data quality is acceptable for analysis.")

    report["operations"] = operations
    report["alerts"] = alerts
    report["recommendations"] = recommendations
    report["processing_time_ms"] = round((time.time() - start_time) * 1000, 2)

    # --- 11. Column Data Types ---
    column_data_types = {}
    for col in df_cleaned.columns:
        dtype = str(df_cleaned[col].dtype)
        if dtype.startswith("int"):
            col_type = "integer"
        elif dtype.startswith("float"):
            col_type = "float"
        elif dtype.startswith("bool"):
            col_type = "boolean"
        elif dtype.startswith("datetime"):
            col_type = "datetime"
        elif dtype.startswith("object"):
            col_type = "text / string"
        else:
            col_type = dtype
        column_data_types[col] = col_type

    report["column_data_types"] = column_data_types

    return df_cleaned, report