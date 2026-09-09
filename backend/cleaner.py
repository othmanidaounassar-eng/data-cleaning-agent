import pandas as pd
import numpy as np
import time
import math
import datetime
from decimal import Decimal

from ai import enrich_reasons


def json_safe(obj):
    """Recursively convert a value into a JSON-serializable form."""
    if obj is None:
        return None
    if isinstance(obj, (bool, np.bool_)):
        return bool(obj)
    if isinstance(obj, (int, np.integer)):
        return int(obj)
    if isinstance(obj, (float, np.floating)):
        f = float(obj)
        return None if (math.isnan(f) or math.isinf(f)) else f
    if isinstance(obj, (str, bytes)):
        return obj.decode("utf-8", errors="replace") if isinstance(obj, bytes) else obj
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, pd.Timestamp):
        return None if pd.isna(obj) else obj.isoformat()
    if isinstance(obj, (np.datetime64, datetime.datetime, datetime.date)):
        return None if pd.isna(obj) else obj.isoformat()
    if isinstance(obj, (pd.Timedelta, np.timedelta64, datetime.timedelta)):
        return str(obj)
    if isinstance(obj, (list, tuple)):
        return [json_safe(v) for v in obj]
    if isinstance(obj, dict):
        return {str(k): json_safe(v) for k, v in obj.items()}
    if hasattr(obj, "item"):
        try:
            return json_safe(obj.item())
        except Exception:
            pass
    return str(obj)


# ============================================================
# CSV / Excel formula-injection protection
# ============================================================
# Cell values (and headers) starting with these characters are treated as
# potential spreadsheet formulas to stop Excel/LibreOffice from executing
# arbitrary expressions (CSV injection / formula injection).
_FORMULA_TRIGGERS = ("=", "+", "-", "@", "\t", "\r")
# Optional ASCII control chars that can smuggle formula payloads (e.g. the
# "rich text" DDE vector on Windows Excel).
_CONTROL_CHARS = {chr(c) for c in range(0x00, 0x20)} - {"\t", "\r", "\n"}


def _strip_control_chars(value: str) -> str:
    cleaned = "".join(ch for ch in value if ch not in _CONTROL_CHARS)
    return cleaned


def sanitize_export_value(val):
    """Neutralize a possible formula-injection payload within a string cell."""
    if isinstance(val, str) and val:
        safe = _strip_control_chars(val)
        stripped = safe.lstrip()
        if stripped and stripped[0] in _FORMULA_TRIGGERS:
            safe = "'" + safe
        return safe
    if isinstance(val, bytes):
        decoded = val.decode("utf-8", errors="replace")
        return sanitize_export_value(decoded)
    return val


def sanitize_dataframe_for_export(df):
    """Return a copy of df whose string cells and headers are export-safe."""
    out = df.copy()
    for col in out.columns:
        safe_col = sanitize_export_value(str(col))
        if safe_col != str(col):
            out.rename(columns={col: safe_col}, inplace=True)
            col = safe_col
        if pd.api.types.is_object_dtype(out[col]) or isinstance(out[col].dtype, pd.StringDtype):
            out[col] = out[col].astype(object).map(sanitize_export_value)
    return out


# ============================================================
# Helper: reason placeholder (real reasons are added later by GROQ)
# ============================================================
def generate_reason_for_action(action_type, description, details, sample_data=None):
    """Placeholder; enrich_reasons() fills 'reason' for all operations at once."""
    return None


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
    if isinstance(val, Decimal):
        if val != val:
            return None
        return float(val)
    if isinstance(val, pd.Timestamp):
        if pd.isna(val):
            return None
        return val.isoformat()
    if isinstance(val, (np.datetime64, datetime.datetime, datetime.date)):
        if pd.isna(val):
            return None
        return val.isoformat()
    if isinstance(val, pd.Timedelta) or isinstance(val, np.timedelta64) or isinstance(val, datetime.timedelta):
        return str(val)
    return val


def clean_numeric_column(series):
    s = series.astype(str).str.strip()
    s = s.str.replace("$", "", regex=False)
    s = s.str.replace(",", "", regex=False)
    s = s.str.replace(r"\[[^\]]*\]|[a-zA-Z]+$", "", regex=True)
    s = s.str.replace(r"[^0-9.\-]", "", regex=True)
    s = s.replace("", np.nan)
    return pd.to_numeric(s, errors="coerce")


def clean_text_column(series):
    s = series.astype(str).str.strip()
    s = s.str.replace(r"[†‡*]|\[\d+\]|\[[a-z]\]", "", regex=True)
    s = s.str.replace(r"\s+", " ", regex=True)
    s = s.str.strip()
    s = s.replace("", np.nan)
    return s


def extract_year_from_range(series):
    s = series.astype(str).str.strip()
    years = s.str.extract(r"(\b\d{4}\b)")
    return pd.to_numeric(years[0], errors="coerce")


def detect_outliers(df, column, method="iqr"):
    if not pd.api.types.is_numeric_dtype(df[column]):
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


def calculate_quality_score(df_before, report):
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
# Pre-cleaning analysis: propose what to clean (and what to keep)
# ============================================================
# These ids are the canonical operation ids the frontend plan refers to.
ACTION_IDS = (
    "duplicate_removal",
    "numeric_conversion",
    "text_cleaning",
    "year_extraction",
    "missing_values",
    "outlier_detection",
)


def _detect_currency_like_columns(df):
    cols = []
    for col in df.columns:
        sample = df[col].astype(str).head(100)
        has_currency = sample.str.contains(r"[\$,]", regex=True).mean() > 0.3
        if has_currency:
            cols.append(col)
        elif any(
            kw in col.lower()
            for kw in [
                "gross",
                "salary",
                "revenue",
                "amount",
                "price",
                "avg",
                "average",
                "adjusted",
            ]
        ):
            cols.append(col)
    return cols


def _detect_year_range_columns(df):
    cols = []
    for col in df.columns:
        if "year" not in col.lower():
            continue
        sample = df[col].astype(str).head(20)
        if sample.str.contains(r"\d{4}[-–]\d{4}").any():
            cols.append(col)
    return cols


def analyze_dataset(df):
    """Return a deterministic cleaning proposal (before any modification).

    Candidates describe operations that COULD run; the AI later decides which
    are recommended and which should be left untouched.
    """
    if df is None or df.empty:
        return {"rows": 0, "columns": 0, "candidates": [], "keeps": []}

    dup_count = int(df.duplicated().sum())
    missing_details = []
    total_missing = 0
    for col in df.columns:
        missing = int(df[col].isna().sum())
        total_missing += missing
        if missing:
            missing_details.append(f"{col}: {missing}")

    currency_cols = _detect_currency_like_columns(df)
    year_cols = _detect_year_range_columns(df)
    text_cols = df.select_dtypes(include=["object", "str"]).columns.tolist() if not df.empty else []
    numeric_cols = df.select_dtypes(include=["float64", "int64"]).columns.tolist()
    outlier_cols = []
    total_outliers = 0
    for col in numeric_cols:
        try:
            _, count = detect_outliers(df, col, method="iqr")
        except Exception:
            count = 0
        if count > 0:
            total_outliers += int(count)
            outlier_cols.append(col)

    candidates = []
    if dup_count > 0:
        candidates.append(
            {
                "id": "duplicate_removal",
                "action": "duplicate_removal",
                "description": "إزالة الصفوف المكررة",
                "details": f"تم العثور على {dup_count} صفاً مكرراً.",
                "rows_affected": dup_count,
            }
        )
    if currency_cols:
        candidates.append(
            {
                "id": "numeric_conversion",
                "action": "numeric_conversion",
                "description": "تحويل أعمدة تشبه الأرقام/العملة",
                "details": "الأعمدة: " + ", ".join(currency_cols[:8]) + ("..." if len(currency_cols) > 8 else ""),
                "rows_affected": int(len(df)) if not df.empty else 0,
            }
        )
    if text_cols:
        candidates.append(
            {
                "id": "text_cleaning",
                "action": "text_cleaning",
                "description": "تنظيف النصوص",
                "details": f"إزالة الرموز الخاصة والمسافات الزائدة في {len(text_cols)} عمود نصي.",
                "rows_affected": int(len(df)) if not df.empty else 0,
            }
        )
    if year_cols:
        candidates.append(
            {
                "id": "year_extraction",
                "action": "year_extraction",
                "description": "استخراج السنوات من نطاقات",
                "details": "الأعمدة: " + ", ".join(year_cols),
                "rows_affected": int(len(df)) if not df.empty else 0,
            }
        )
    if total_missing > 0:
        candidates.append(
            {
                "id": "missing_values",
                "action": "missing_values",
                "description": "تعبئة القيم المفقودة",
                "details": "; ".join(missing_details[:8]) + ("..." if len(missing_details) > 8 else ""),
                "rows_affected": total_missing,
            }
        )
    if total_outliers > 0:
        candidates.append(
            {
                "id": "outlier_detection",
                "action": "outlier_detection",
                "description": "كشف القيم الشاذة (لا تعدّل البيانات)",
                "details": f"الأعمدة: {', '.join(outlier_cols[:8])} — طريقة IQR. "
                f"إجمالي {total_outliers} قيمة شاذة.",
                "rows_affected": total_outliers,
            }
        )

    return {
        "rows": int(len(df)),
        "columns": int(len(df.columns)),
        "nulls_total": int(df.isnull().sum().sum()),
        "duplicates": dup_count,
        "candidates": candidates,
        "keeps": [],  # AI may add keep-suggestions (things NOT to clean).
    }


# ============================================================
# Main clean_data function
# ============================================================


def clean_data(df, approved=None):
    """Clean df, running only the operations in `approved` (a set of action ids).

    If `approved` is None, every applicable operation runs (legacy behaviour).
    Declined operations are logged as 'skipped' and never modify the data.
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
        "column_data_types": {},
        "declined": [],
    }

    allowed = None if approved is None else set(approved)

    def enabled(action_id):
        return allowed is None or action_id in allowed

    def decline(action_id, description, details):
        """Log a user-declined operation without touching the data."""
        operations.append(
            {
                "action": action_id,
                "description": description,
                "details": details,
                "rows_affected": 0,
                "status": "skipped",
                "reason": "تم تأجيل هذه العملية حسب اختيار المستخدم.",
            }
        )
        report["declined"].append(
            {
                "action": action_id,
                "description": description,
                "details": details,
                "reason": "تم تأجيل هذه العملية حسب اختيار المستخدم.",
            }
        )

    if df is None or df.empty:
        report["summary"] = "Dataset is empty or None. Nothing to clean."
        return df, json_safe(report)

    df_original = df.copy()
    df_cleaned = df.copy()
    operations = []
    alerts = []
    recommendations = []

    def add_log(action, description, details, rows_affected=0, status="completed", reason=None):
        operations.append(
            {
                "action": action,
                "description": description,
                "details": details,
                "rows_affected": rows_affected,
                "status": status,
                "reason": reason,
            }
        )

    # --- 1. Duplicates ---
    dup_before = df_cleaned.duplicated().sum()
    if not enabled("duplicate_removal"):
        decline(
            "duplicate_removal",
            f"إزالة {dup_before} صف مكرر (معلّق).",
            "وجدت صفوف مكررة لكن المستخدم لم يسمح بتنفيذ هذه العملية.",
        )
    elif dup_before > 0:
        df_cleaned = df_cleaned.drop_duplicates().reset_index(drop=True)
        report["duplicates_removed"] = int(dup_before)
        reason = generate_reason_for_action(
            "duplicate_removal",
            f"Removed {dup_before} duplicate rows.",
            "Duplicates were identified based on all columns.",
        )
        add_log(
            "duplicate_removal",
            f"Removed {dup_before} duplicate rows.",
            "Duplicates were identified based on all columns.",
            dup_before,
            "completed",
            reason,
        )
    else:
        add_log(
            "duplicate_removal",
            "No duplicate rows found.",
            "All rows are unique.",
            0,
            "skipped",
            "Data was already clean; no duplicate rows to remove.",
        )

    # --- 2. Numeric columns ---
    numeric_like_cols = []
    for col in df_cleaned.columns:
        sample = df_cleaned[col].astype(str).head(100)
        has_currency = sample.str.contains(r"[\$,]", regex=True).mean() > 0.3
        if has_currency:
            numeric_like_cols.append(col)
        elif any(
            kw in col.lower()
            for kw in [
                "gross",
                "salary",
                "revenue",
                "amount",
                "price",
                "avg",
                "average",
                "adjusted",
            ]
        ):
            numeric_like_cols.append(col)

    if numeric_like_cols and not enabled("numeric_conversion"):
        decline(
            "numeric_conversion",
            "تحويل الأعمدة الرقمية (معلّق).",
            "أعمدة تشبه الأرقام: " + ", ".join(numeric_like_cols[:8]),
        )

    for col in numeric_like_cols:
        if not enabled("numeric_conversion"):
            break
        cleaned_series = clean_numeric_column(df_cleaned[col])
        if cleaned_series.notna().sum() > 0:
            df_cleaned[col] = cleaned_series
            report["datatype_converted"].append(col)
            report["column_conversions"].append({"column": col, "from": "object/string", "to": "numeric"})
            reason = generate_reason_for_action(
                "numeric_conversion",
                f"Converted column '{col}' to numeric.",
                "Removed currency symbols, commas, and brackets.",
            )
            add_log(
                "numeric_conversion",
                f"Converted column '{col}' to numeric.",
                "Removed currency symbols, commas, and brackets.",
                len(df_cleaned),
                "completed",
                reason,
            )

    # --- 3. Text cleaning ---
    text_cols = df_cleaned.select_dtypes(include=["object", "str"]).columns.tolist()
    if text_cols and not enabled("text_cleaning"):
        decline(
            "text_cleaning",
            "تنظيف النصوص (معلّق).",
            f"{len(text_cols)} عموداً نصياً يحتاج تنظيفاً لكنه لم يُسَمَّح.",
        )

    if not enabled("text_cleaning"):
        pass  # decline() was already logged above when text_cols was non-empty.
    elif text_cols:
        for col in text_cols:
            df_cleaned[col] = clean_text_column(df_cleaned[col])
            report["text_columns_cleaned"].append(col)
        reason = generate_reason_for_action(
            "text_cleaning",
            f"Cleaned {len(text_cols)} text columns.",
            "Removed special characters and extra spaces.",
        )
        add_log(
            "text_cleaning",
            f"Cleaned {len(text_cols)} text columns.",
            "Removed special characters and extra spaces.",
            len(df_cleaned),
            "completed",
            reason,
        )
    else:
        add_log(
            "text_cleaning",
            "No text columns needed cleaning.",
            "All text columns were already clean.",
            0,
            "skipped",
            "Data was already clean; no text cleaning required.",
        )

    # --- 4. Year columns ---
    year_cols = [col for col in df_cleaned.columns if "year" in col.lower()]
    if year_cols and not enabled("year_extraction"):
        decline(
            "year_extraction",
            "استخراج السنوات من النطاقات (معلّق).",
            "أعمدة سنوات: " + ", ".join(year_cols),
        )

    for col in year_cols:
        if not enabled("year_extraction"):
            break
        sample = df_cleaned[col].astype(str).head(20)
        if sample.str.contains(r"\d{4}[-–]\d{4}").any():
            df_cleaned[col] = extract_year_from_range(df_cleaned[col])
            report["datatype_converted"].append(col)
            report["column_conversions"].append({"column": col, "from": "string/range", "to": "numeric (year)"})
            reason = generate_reason_for_action(
                "year_extraction",
                f"Extracted year from '{col}' column.",
                "Converted ranges like '2023–2024' to 2023.",
            )
            add_log(
                "year_extraction",
                f"Extracted year from '{col}' column.",
                "Converted ranges like '2023–2024' to 2023.",
                len(df_cleaned),
                "completed",
                reason,
            )
        else:
            converted = pd.to_numeric(df_cleaned[col], errors="coerce")
            if converted.notna().sum() > 0:
                df_cleaned[col] = converted
                report["datatype_converted"].append(col)
                report["column_conversions"].append({"column": col, "from": "string", "to": "numeric"})
                reason = generate_reason_for_action(
                    "year_extraction",
                    f"Converted column '{col}' to numeric.",
                    "All values were convertible to numbers.",
                )
                add_log(
                    "year_extraction",
                    f"Converted column '{col}' to numeric.",
                    "All values were convertible to numbers.",
                    len(df_cleaned),
                    "completed",
                    reason,
                )

    # --- 5. Missing values ---
    total_missing = 0
    missing_details = []
    for col in df_cleaned.columns:
        missing = int(df_cleaned[col].isna().sum())
        total_missing += missing
        if missing:
            missing_details.append(f"Column '{col}' has {missing} missing value(s).")

    if not enabled("missing_values"):
        if total_missing:
            decline(
                "missing_values",
                f"تعبئة {total_missing} قيمة مفقودة (معلّق).",
                "; ".join(missing_details[:8]),
            )
    elif total_missing:
        for col in df_cleaned.columns:
            missing = df_cleaned[col].isna().sum()
            if missing == 0:
                continue
            if pd.api.types.is_numeric_dtype(df_cleaned[col]):
                median_val = df_cleaned[col].median()
                if pd.isna(median_val):
                    mean_val = df_cleaned[col].mean()
                    if pd.isna(mean_val):
                        value = df_cleaned[col].mode().iloc[0] if not df_cleaned[col].mode().empty else np.nan
                        strategy = "mode"
                    else:
                        value = mean_val
                        strategy = "mean"
                else:
                    value = median_val
                    strategy = "median"
            else:
                mode_series = df_cleaned[col].mode()
                value = mode_series.iloc[0] if not mode_series.empty else "Unknown"
                strategy = "mode"
            if pd.isna(value) and value is not None:
                df_cleaned[col] = df_cleaned[col].fillna(value)
                missing_details.append(
                    f"Column '{col}': {missing} values could not be filled (no finite median/mean/mode)."
                )
                continue
            df_cleaned[col] = df_cleaned[col].fillna(value)
            report["columns_modified"].append(col)
            missing_details.append(f"Column '{col}': filled {missing} values using {strategy}.")
        report["missing_values_filled"] = int(total_missing)
        report["missing_values_total"] = int(total_missing)
        reason = generate_reason_for_action(
            "missing_values",
            f"Filled {total_missing} missing values.",
            "; ".join(missing_details),
        )
        add_log(
            "missing_values",
            f"Filled {total_missing} missing values.",
            "; ".join(missing_details),
            total_missing,
            "completed",
            reason,
        )
    else:
        report["missing_values_filled"] = 0
        report["missing_values_total"] = 0
        add_log(
            "missing_values",
            "No missing values found.",
            "All columns have complete data.",
            0,
            "skipped",
            "Data was already clean; no missing values to fill.",
        )

    # --- 6. Outliers ---
    numeric_cols = df_cleaned.select_dtypes(include=["float64", "int64"]).columns.tolist()
    total_outliers = 0
    outlier_cols = []

    if not enabled("outlier_detection"):
        decline(
            "outlier_detection",
            "كشف القيم الشاذة (معلّق).",
            "القيم الشاذة لن تُفحص لأن المستخدم لم يسمح بذلك.",
        )
    elif numeric_cols:
        for col in numeric_cols:
            mask, count = detect_outliers(df_cleaned, col, method="iqr")
            if count > 0:
                total_outliers += int(count)
                outlier_cols.append(col)
                alerts.append(f"Column '{col}' contains {count} outliers.")
        report["outliers_detected"] = int(total_outliers)
        if total_outliers > 0:
            reason = generate_reason_for_action(
                "outlier_detection",
                f"Detected {total_outliers} outliers.",
                f"Columns: {', '.join(outlier_cols)}. Used IQR method.",
            )
            add_log(
                "outlier_detection",
                f"Detected {total_outliers} outliers.",
                f"Columns: {', '.join(outlier_cols)}. Used IQR method.",
                total_outliers,
                "completed",
                reason,
            )
            recommendations.append("Consider investigating outlier values.")
        else:
            add_log(
                "outlier_detection",
                "No outliers detected.",
                "All values are within normal range (IQR method).",
                0,
                "skipped",
                "Data was already clean; no outliers found.",
            )
    else:
        report["outliers_detected"] = 0
        add_log(
            "outlier_detection",
            "No outliers detected.",
            "No numeric columns to check.",
            0,
            "skipped",
            "No numeric columns present.",
        )

    # --- 7. Unchanged columns ---
    for col in df_original.columns:
        if col in df_cleaned.columns:
            if col not in report["datatype_converted"] and col not in report["columns_modified"]:
                add_log(
                    "unchanged",
                    f"Column '{col}' was not modified.",
                    "The data was already clean.",
                    0,
                    "skipped",
                    "Data was already clean; no changes needed.",
                )

    # --- 8. Sample ---
    raw_sample = df_cleaned.head(5).to_dict(orient="records")
    clean_sample = [clean_sample_value(row) for row in raw_sample]
    report["sample"] = clean_sample

    # --- 9. Quality Score ---
    quality_score = calculate_quality_score(df_original, report)
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

    # --- 10. AI reasons for every completed operation (single batched call) --
    enrich_reasons(operations)

    report["operations"] = operations
    report["alerts"] = alerts
    report["recommendations"] = recommendations
    report["processing_time_ms"] = round((time.time() - start_time) * 1000, 2)

    # --- 11. Column Data Types ---
    # Keys are the column names; sanitize them so a hostile header (e.g.
    # "=SUM(A1)") cannot flow from the stored report into HTML/export views.
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
        column_data_types[str(sanitize_export_value(col))] = col_type

    report["column_data_types"] = column_data_types

    return df_cleaned, json_safe(report)
