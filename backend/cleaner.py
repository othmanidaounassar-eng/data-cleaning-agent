import pandas as pd
import numpy as np
import time

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
    score = 50  # baseline
    # Penalize rows removed (if too many removed, lower score)
    rows_before = len(df_before)
    rows_after = len(df_after)
    if rows_before > 0:
        removed_ratio = (rows_before - rows_after) / rows_before
        # if removed more than 30% of rows, penalize heavily
        if removed_ratio > 0.3:
            score -= 20
        elif removed_ratio > 0.1:
            score -= 10
    # Reward for filling missing values
    missing_filled = report.get('missing_values_filled', 0)
    if missing_filled > 0:
        score += min(10, missing_filled / 10)
    # Reward for removing duplicates
    dup_removed = report.get('duplicates_removed', 0)
    if dup_removed > 0:
        score += min(10, dup_removed / 5)
    # Penalize outliers detected (optional)
    outliers = report.get('outliers_detected', 0)
    if outliers > 0:
        score -= min(10, outliers / 2)
    # Ensure score between 0 and 100
    return max(0, min(100, int(score)))

def clean_data(df):
    """
    Clean the DataFrame with comprehensive steps and return cleaned df and report.
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
    }

    if df is None or df.empty:
        report["summary"] = "Dataset is empty or None. Nothing to clean."
        return df, report

    df_original = df.copy()
    df_cleaned = df.copy()
    operations = []
    alerts = []
    recommendations = []

    # ------------------------------
    # 1. Remove duplicates
    # ------------------------------
    before = len(df_cleaned)
    dup_before = df_cleaned.duplicated().sum()
    if dup_before > 0:
        df_cleaned = df_cleaned.drop_duplicates().reset_index(drop=True)
        report["duplicates_removed"] = int(dup_before)
        operations.append(f"Removed {dup_before} duplicate rows.")
    else:
        operations.append("No duplicate rows found.")

    # ------------------------------
    # 2. Handle missing values
    # ------------------------------
    total_missing = 0
    for col in df_cleaned.columns:
        missing = df_cleaned[col].isna().sum()
        if missing == 0:
            continue
        total_missing += missing
        if pd.api.types.is_numeric_dtype(df_cleaned[col]):
            # Use median for numeric
            value = df_cleaned[col].median()
        elif pd.api.types.is_datetime64_any_dtype(df_cleaned[col]):
            # Use mode for datetime
            mode_series = df_cleaned[col].mode()
            value = mode_series.iloc[0] if not mode_series.empty else pd.NaT
        else:
            # Use mode for categorical/text
            mode_series = df_cleaned[col].mode()
            value = mode_series.iloc[0] if not mode_series.empty else "Unknown"
        df_cleaned[col] = df_cleaned[col].fillna(value)
        report["columns_modified"].append(col)
    report["missing_values_filled"] = int(total_missing)
    report["missing_values_total"] = int(total_missing)
    if total_missing > 0:
        operations.append(f"Filled {total_missing} missing values (median/mode).")
    else:
        operations.append("No missing values found.")

    # ------------------------------
    # 3. Clean text columns (strip whitespace, normalize spaces)
    # ------------------------------
    text_cols = df_cleaned.select_dtypes(include=["object"]).columns.tolist()
    for col in text_cols:
        df_cleaned[col] = (
            df_cleaned[col]
            .fillna("")
            .astype(str)
            .str.strip()
            .str.replace(r"\s+", " ", regex=True)
        )
        report["text_columns_cleaned"].append(col)
    if text_cols:
        operations.append(f"Cleaned whitespace in {len(text_cols)} text columns.")

    # ------------------------------
    # 4. Data type conversion (numeric)
    # ------------------------------
    for col in df_cleaned.columns:
        if df_cleaned[col].dtype == "object":
            # Try to convert to numeric
            converted = pd.to_numeric(df_cleaned[col], errors='coerce')
            # Check if conversion was successful for at least one non-null value
            if converted.notna().sum() > 0:
                # But only convert if conversion doesn't lose too many values
                original_non_null = df_cleaned[col].notna().sum()
                converted_non_null = converted.notna().sum()
                if converted_non_null >= original_non_null * 0.8:
                    df_cleaned[col] = converted
                    report["datatype_converted"].append(col)
                    report["column_conversions"].append({
                        "column": col,
                        "from": "object",
                        "to": "numeric"
                    })
                    operations.append(f"Converted column '{col}' to numeric.")
    if not report["datatype_converted"]:
        operations.append("No numeric conversions performed.")

    # ------------------------------
    # 5. Detect outliers (only for numeric columns)
    # ------------------------------
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

    # ------------------------------
    # 6. Generate sample (first 5 rows)
    # ------------------------------
    sample = df_cleaned.head(5).to_dict(orient='records')
    report["sample"] = sample

    # ------------------------------
    # 7. Quality Score
    # ------------------------------
    quality_score = calculate_quality_score(df_original, df_cleaned, report)
    report["quality_score"] = quality_score

    # ------------------------------
    # 8. Summary and recommendations
    # ------------------------------
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

    # Final operations list
    report["operations"] = [{"label": op, "done": True} for op in operations]
    report["alerts"] = alerts
    report["recommendations"] = recommendations

    # Execution time in milliseconds
    report["processing_time_ms"] = int((time.time() - start_time) * 1000)

    # Return cleaned DataFrame and report
    return df_cleaned, report

# ============================================
# Optional test block (remove in production)
# ============================================
if __name__ == "__main__":
    import pandas as pd
    from io import StringIO

    # Sample data (with issues)
    data = """Name,Age,Salary,City
    Ali,20,5000,Marrakech
    Sara,25,,Casablanca
    Sara,25,,Casablanca
    ,,7000,
    """
    df = pd.read_csv(StringIO(data), dtype=str)
    # Convert Age and Salary to float for better testing
    df['Age'] = pd.to_numeric(df['Age'], errors='coerce')
    df['Salary'] = pd.to_numeric(df['Salary'], errors='coerce')

    print("Before cleaning:")
    print(df)
    print("\nData types:\n", df.dtypes)

    cleaned, report = clean_data(df)

    print("\nAfter cleaning:")
    print(cleaned)
    print("\nReport:")
    import json
    print(json.dumps(report, indent=2, default=str))
    print("\nData types after:\n", cleaned.dtypes)