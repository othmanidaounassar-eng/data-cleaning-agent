import pandas as pd
import numpy as np
import time
import math

# ============================================
# دوال مساعدة للتنظيف (مأخوذة من ملفك السابق)
# ============================================

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
    """
    s = series.astype(str).str.strip()
    s = s.str.replace(r"[\$,]", "", regex=True)
    s = s.str.replace(r"\[[^\]]*\]", "", regex=True)
    s = s.str.replace(r"[a-zA-Z]+$", "", regex=True)
    s = s.str.replace(r"[^0-9.\-]", "", regex=True)
    s = s.replace("", np.nan)
    return pd.to_numeric(s, errors="coerce")

def clean_text_column(series):
    """
    Clean text columns: strip whitespace, remove special symbols and bracketed references.
    """
    s = series.astype(str).str.strip()
    s = s.str.replace(r"[†‡*]", "", regex=True)
    s = s.str.replace(r"\[\d+\]", "", regex=True)
    s = s.str.replace(r"\[[a-z]\]", "", regex=True)
    s = s.str.replace(r"\s+", " ", regex=True)
    s = s.str.strip()
    s = s.replace("", np.nan)
    return s

def extract_year_from_range(series):
    """
    Extract the first year from a range like '2023–2024' or '2008–2009'.
    """
    s = series.astype(str).str.strip()
    years = s.str.extract(r"(\b\d{4}\b)")
    return pd.to_numeric(years[0], errors="coerce")

def detect_outliers(df, column, method="iqr"):
    """
    Detect outliers in a numeric column using IQR or Z-score.
    """
    if df[column].dtype not in ["float64", "int64"]:
        return pd.Series([False] * len(df)), 0
    if method == "iqr":
        Q1 = df[column].quantile(0.25)
        Q3 = df[column].quantile(0.75)
        IQR = Q3 - Q1
        lower = Q1 - 1.5 * IQR
        upper = Q3 + 1.5 * IQR
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
    """
    Calculate a quality score (0-100) based on cleaning results.
    """
    # بسيط: كلما قلّ عدد التكرارات والقيم المفقودة زادت الجودة
    rows_before = len(df_before)
    rows_after = len(df_after)
    dup_removed = report.get("duplicates_removed", 0)
    missing_filled = report.get("missing_values_filled", 0)
    outliers = report.get("outliers_detected", 0)

    # نبدأ بـ 100 ثم نخصم بناءً على المشاكل
    score = 100
    if rows_before > 0:
        # خصم للتكرارات (لكل 10% تكرارات نخصم 10 نقاط)
        dup_ratio = dup_removed / rows_before if rows_before > 0 else 0
        score -= min(30, dup_ratio * 100 * 0.3)

        # خصم للقيم المفقودة
        missing_ratio = missing_filled / (rows_before * len(df_before.columns)) if rows_before > 0 else 0
        score -= min(30, missing_ratio * 100 * 0.3)

        # خصم للقيم الشاذة (لكل 1% شاذة نخصم 1 نقطة)
        outlier_ratio = outliers / rows_before if rows_before > 0 else 0
        score -= min(20, outlier_ratio * 100 * 0.2)

    return max(0, round(score))

# ============================================
# الدالة الرئيسية clean_data
# ============================================

def clean_data(df):
    """
    Clean the DataFrame with comprehensive steps and return a detailed log.
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
        "operations": [],           # detailed log entries
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
    operations = []  # ← This will hold detailed log entries
    alerts = []
    recommendations = []

    # Helper to add a log entry
    def add_log(action, description, details, rows_affected=0, status="completed"):
        operations.append({
            "action": action,
            "description": description,
            "details": details,
            "rows_affected": rows_affected,
            "status": status,
        })

    # 1. Remove duplicates
    dup_before = df_cleaned.duplicated().sum()
    if dup_before > 0:
        df_cleaned = df_cleaned.drop_duplicates().reset_index(drop=True)
        report["duplicates_removed"] = int(dup_before)
        add_log(
            action="duplicate_removal",
            description=f"Removed {dup_before} duplicate rows.",
            details=f"Duplicates were identified based on all columns. {dup_before} rows were removed.",
            rows_affected=dup_before,
            status="completed"
        )
    else:
        add_log(
            action="duplicate_removal",
            description="No duplicate rows found.",
            details="All rows are unique. No action taken.",
            rows_affected=0,
            status="skipped"
        )

    # 2. Clean numeric columns (as in your existing logic)
    numeric_like_cols = []
    for col in df_cleaned.columns:
        sample = df_cleaned[col].astype(str).head(100)
        has_currency = sample.str.contains(r"[\$,]", regex=True).mean() > 0.3
        if has_currency:
            numeric_like_cols.append(col)
        elif any(keyword in col.lower() for keyword in ["gross","salary","revenue","amount","price","avg","average","adjusted"]):
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
            add_log(
                action="type_conversion",
                description=f"Converted column '{col}' to numeric.",
                details=f"Removed currency symbols, commas, and brackets. Values like '$780,000' became 780000.",
                rows_affected=len(df_cleaned),
                status="completed"
            )

    # 3. Clean text columns
    text_cols = df_cleaned.select_dtypes(include=["object"]).columns.tolist()
    for col in text_cols:
        df_cleaned[col] = clean_text_column(df_cleaned[col])
        report["text_columns_cleaned"].append(col)
    if text_cols:
        add_log(
            action="text_cleaning",
            description=f"Cleaned special characters in {len(text_cols)} text columns.",
            details="Removed footnotes like †, ‡, *, bracketed references, and extra spaces.",
            rows_affected=len(df_cleaned),
            status="completed"
        )
    else:
        add_log(
            action="text_cleaning",
            description="No text columns needed cleaning.",
            details="All text columns were already clean.",
            rows_affected=0,
            status="skipped"
        )

    # 4. Handle Year columns
    year_cols = [col for col in df_cleaned.columns if "year" in col.lower() or "Year" in col]
    for col in year_cols:
        sample = df_cleaned[col].astype(str).head(20)
        if sample.str.contains(r"\d{4}[-–]\d{4}").any():
            df_cleaned[col] = extract_year_from_range(df_cleaned[col])
            report["datatype_converted"].append(col)
            report["column_conversions"].append({
                "column": col,
                "from": "string/range",
                "to": "numeric (year)"
            })
            add_log(
                action="type_conversion",
                description=f"Extracted first year from '{col}' column.",
                details="Converted ranges like '2023–2024' to 2023.",
                rows_affected=len(df_cleaned),
                status="completed"
            )
        else:
            converted = pd.to_numeric(df_cleaned[col], errors="coerce")
            if converted.notna().sum() > 0:
                df_cleaned[col] = converted
                report["datatype_converted"].append(col)
                report["column_conversions"].append({
                    "column": col,
                    "from": "string",
                    "to": "numeric"
                })
                add_log(
                    action="type_conversion",
                    description=f"Converted column '{col}' to numeric.",
                    details="All values were convertible to numbers.",
                    rows_affected=len(df_cleaned),
                    status="completed"
                )

    # 5. Handle missing values
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
        elif pd.api.types.is_datetime64_any_dtype(df_cleaned[col]):
            mode_series = df_cleaned[col].mode()
            value = mode_series.iloc[0] if not mode_series.empty else pd.NaT
            strategy = "mode"
        else:
            mode_series = df_cleaned[col].mode()
            value = mode_series.iloc[0] if not mode_series.empty else "Unknown"
            strategy = "mode"
        df_cleaned[col] = df_cleaned[col].fillna(value)
        report["columns_modified"].append(col)
        missing_details.append(f"Column '{col}': filled {missing} missing values using {strategy}.")

    report["missing_values_filled"] = int(total_missing)
    report["missing_values_total"] = int(total_missing)
    if total_missing > 0:
        add_log(
            action="missing_values",
            description=f"Filled {total_missing} missing values.",
            details="; ".join(missing_details),
            rows_affected=total_missing,
            status="completed"
        )
    else:
        add_log(
            action="missing_values",
            description="No missing values found.",
            details="All columns have complete data.",
            rows_affected=0,
            status="skipped"
        )

    # 6. Detect outliers
    numeric_cols = df_cleaned.select_dtypes(include=["float64","int64"]).columns.tolist()
    total_outliers = 0
    outlier_cols = []
    for col in numeric_cols:
        mask, count = detect_outliers(df_cleaned, col, method="iqr")
        if count > 0:
            total_outliers += count
            outlier_cols.append(col)
            alerts.append(f"Column '{col}' contains {count} outliers (based on IQR).")
    report["outliers_detected"] = int(total_outliers)
    if total_outliers > 0:
        add_log(
            action="outlier_detection",
            description=f"Detected {total_outliers} outliers across {len(outlier_cols)} columns.",
            details=f"Columns: {', '.join(outlier_cols)}. Used Interquartile Range (IQR) method.",
            rows_affected=total_outliers,
            status="completed"
        )
        recommendations.append("Consider further investigation or transformation of outlier values.")
    else:
        add_log(
            action="outlier_detection",
            description="No outliers detected.",
            details="All numeric columns have values within normal range (IQR method).",
            rows_affected=0,
            status="skipped"
        )

    # 7. Identify unchanged columns (clean already)
    for col in df_original.columns:
        if col in df_cleaned.columns:
            # If column appears in any conversion list, skip
            if col not in report["datatype_converted"] and col not in report["columns_modified"]:
                add_log(
                    action="unchanged",
                    description=f"Column '{col}' was not modified.",
                    details="The data was already clean and required no changes.",
                    rows_affected=0,
                    status="skipped"
                )

    # 8. Generate sample (existing)
    raw_sample = df_cleaned.head(5).to_dict(orient="records")
    clean_sample = [clean_sample_value(row) for row in raw_sample]
    report["sample"] = clean_sample

    # 9. Quality Score (existing)
    quality_score = calculate_quality_score(df_original, df_cleaned, report)
    if not math.isfinite(quality_score):
        quality_score = 0
    report["quality_score"] = quality_score

    # 10. Summary (existing)
    rows_before = len(df_original)
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

    # ⭐ Assign detailed operations to report
    report["operations"] = operations
    report["alerts"] = alerts
    report["recommendations"] = recommendations
    report["processing_time_ms"] = round((time.time() - start_time) * 1000, 2)

    return df_cleaned, report