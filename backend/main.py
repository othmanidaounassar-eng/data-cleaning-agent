# cspell:ignore OQZARO
"""Main module for OQZARO Data Analysis Agent."""

import base64
import json
import logging
import os
import re
import time
import uuid
import traceback
from io import BytesIO
from typing import List

import pandas as pd
import anyio
from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Form,
    HTTPException,
    status,
    Request,
    Depends,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from config import (
    ALLOWED_EXTENSIONS,
    AZURE_CLIENT_ID,
    AZURE_TENANT_ID,
    AZURE_CLIENT_SECRET,
    CORS_ORIGINS,
    MAX_CHAT_CONTEXT_CHARS,
    MAX_COLUMNS,
    MAX_FILE_SIZE,
    MAX_JSON_BODY,
    MAX_ROWS,
    MS_CONFIGURED,
    POWERBI_GROUP_ID,
    RATE_LIMIT_ANALYZE,
    RATE_LIMIT_CHAT,
    RATE_LIMIT_CLEAN,
    UPLOAD_FOLDER,
)
from cleaner import (
    ACTION_IDS,
    analyze_dataset,
    clean_data,
    json_safe,
    sanitize_dataframe_for_export,
    sanitize_export_value,
)
from report import generate_report
from ai import (
    chat_agent,
    plan_recommendations,
    explain_dataset,
    dataset_context,
)
import charting
import auth
import db
from auth_routes import router as auth_router, limiter

# Files this size (or larger) are not embedded as base64 in the JSON response.
# Kept low so the Clean JSON payload stays well under Vercel's ~4.5 MB
# buffered-response cap; larger cleaned files are served via /download/{id}.
MAX_INLINE_DOWNLOAD_BYTES = 2 * 1024 * 1024  # 2 MB

# History / reports retention.
MAX_HISTORY_ITEMS = 20

# Large cleaned files are saved to disk and served via /download/{id} instead of
# being embedded as base64. TTL for those files.
_DOWNLOAD_TTL_SECONDS = 60 * 60  # 1 hour
_DOWNLOAD_ID_RE = re.compile(r"^[0-9a-fA-F]{8}$")

# Simple JSON store for history / reports (persisted under UPLOAD_FOLDER).
_STORE_PATH = os.path.join(UPLOAD_FOLDER, "_store.json")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="OQZARO DataCleaning Agent",
    version="2.0.0",
    description="Secure and reliable data cleaning service for CSV files.",
    docs_url=None,
    redoc_url=None,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Accept", "Authorization"],
    expose_headers=["Content-Disposition"],
)

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Initialise the SQLite schema + rendering tables.
try:
    db.init_db()
except Exception as exc:  # pragma: no cover
    logger.warning("Failed to initialise database: %s", exc)

# Auth + per-user conversation routes.
app.include_router(auth_router)

# Rate limiting
# Shared limiter defined in auth_routes.py (also throttles login/register).
# NOTE: RATE_LIMIT_MISC originally set as default_limits on app state; it is
# now the default configured on the shared limiter instance.
app.state.limiter = limiter
app.add_exception_handler(
    RateLimitExceeded,
    lambda _, exc: JSONResponse(
        status_code=429,
        content={"detail": exc.detail or "Too many requests. Please slow down."},
    ),
)
app.add_middleware(SlowAPIMiddleware)


def _load_store():
    if os.path.exists(_STORE_PATH):
        try:
            with open(_STORE_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return data
        except (json.JSONDecodeError, OSError):
            pass
    return {"history": [], "reports": []}


def _save_store(store):
    try:
        with open(_STORE_PATH, "w", encoding="utf-8") as f:
            json.dump(store, f, ensure_ascii=False)
    except OSError:
        logger.warning("Failed to persist store to disk.")


def _prune_old_downloads(ttl_seconds=_DOWNLOAD_TTL_SECONDS):
    try:
        now = time.time()
        for name in os.listdir(UPLOAD_FOLDER):
            if not name.startswith("cleaned_"):
                continue
            path = os.path.join(UPLOAD_FOLDER, name)
            try:
                if now - os.path.getmtime(path) > ttl_seconds:
                    os.remove(path)
            except OSError:
                pass
    except OSError:
        pass


def _analyze_dataframe(df):
    return {
        "rows": len(df),
        "columns": len(df.columns),
        "nulls": int(df.isnull().sum().sum()),
        "duplicates": int(df.duplicated().sum()),
    }


def _describe_column(series, numeric):
    """Generate a human-readable Arabic description for a column."""
    total = len(series)
    nulls = int(series.isnull().sum())
    null_pct = round(nulls * 100.0 / total, 1) if total else 0
    distinct = int(series.nunique(dropna=True))

    if numeric:
        valid = pd.to_numeric(series, errors="coerce").dropna()
        if len(valid):
            mean_val = float(valid.mean())
            std_val = float(valid.std())
            skew = float(valid.skew()) if len(valid) > 2 else 0
            if abs(skew) < 0.5:
                dist = "توزيع تقريباً متماثل"
            elif skew > 0:
                dist = "توزيع مائل لليمين"
            else:
                dist = "توزيع مائل لليسار"
            return (
                f"عمود رقمي يحتوي على {distinct} قيمة فريدة من أصل {total} صف. "
                f"المتوسط: {round(mean_val, 2)}، الانحراف المعياري: {round(std_val, 2)}. "
                f"{dist}. " + (f"يحتوي على {nulls} قيمة ناقصة ({null_pct}%)." if nulls > 0 else "مكتمل بدون قيم ناقصة.")
            )
        return f"عمود رقمي فارغ ({total} صف، جميعها قيم ناقصة)."
    else:
        top = series.dropna().astype(str).value_counts().head(3)
        top_str = "، ".join([f"'{str(k)[:30]}' ({int(v)} مرة)" for k, v in top.items()])
        return (
            f"عمود نصي/فئوي يحتوي على {distinct} قيمة فريدة من أصل {total} صف. "
            f"أكثر القيم تكراراً: {top_str}. "
            + (f"يحتوي على {nulls} قيمة ناقصة ({null_pct}%)." if nulls > 0 else "مكتمل بدون قيم ناقصة.")
        )


def _build_analysis_stats(df):
    """Build numeric stats + categorical value counts for the analysis page.

    Output is capped so it stays comfortably under the response-size limits.
    """
    stats = []
    numeric_cols = []
    for col in df.columns:
        series = df[col]
        try:
            numeric = pd.api.types.is_numeric_dtype(series)
        except Exception:
            numeric = False
        info = {
            "name": str(col)[:120],
            "dtype": str(series.dtype),
            "nulls": int(series.isnull().sum()),
            "distinct": int(series.nunique(dropna=True)),
            "description": _describe_column(series, numeric),
        }
        if numeric:
            try:
                valid = pd.to_numeric(series, errors="coerce").dropna()
                if len(valid):
                    numeric_cols.append(str(col))
                    info["min"] = float(valid.min())
                    info["max"] = float(valid.max())
                    info["mean"] = round(float(valid.mean()), 4)
                    info["median"] = round(float(valid.median()), 4)
                    info["std"] = round(float(valid.std()), 4)
                    qs = valid.quantile([0.25, 0.5, 0.75]).tolist()
                    info["q1"] = round(float(qs[0]), 4)
                    info["q3"] = round(float(qs[2]), 4)
                    info["skewness"] = round(float(valid.skew()), 4) if len(valid) > 2 else 0
                    iqr = info["q3"] - info["q1"]
                    lower = info["q1"] - 1.5 * iqr
                    upper = info["q3"] + 1.5 * iqr
                    info["outliers_count"] = int(((valid < lower) | (valid > upper)).sum())
                    info["outliers_pct"] = round(info["outliers_count"] * 100.0 / len(valid), 2) if len(valid) else 0
                    info["boxplot"] = {
                        "min": round(float(valid.min()), 4),
                        "q1": info["q1"],
                        "median": info["median"],
                        "q3": info["q3"],
                        "max": round(float(valid.max()), 4),
                        "whisker_low": round(float(max(valid.min(), lower)), 4),
                        "whisker_high": round(float(min(valid.max(), upper)), 4),
                    }
                    info["histogram"] = _histogram(valid, 12)
            except Exception:
                pass
        else:
            if 1 <= info["distinct"] <= 30:
                try:
                    counts = series.dropna().astype(str).value_counts().head(12)
                    info["top_values"] = [{"value": str(k)[:60], "count": int(v)} for k, v in counts.items()]
                except Exception:
                    pass
        stats.append(info)

    missing = int(df.isnull().sum().sum())
    duplicates = int(df.duplicated().sum())
    corr = _correlation_matrix(df[numeric_cols]) if numeric_cols else []
    group_by = _group_by_stats(df)
    highest = _highest_stats(df)
    kpis = _kpis(df, missing, duplicates, numeric_cols)
    insights = _generate_insights(kpis, corr, stats, group_by)
    recommendations = _generate_recommendations(kpis, corr, stats, group_by)
    scatter = _scatter_series(df, numeric_cols)

    sample_rows = []
    try:
        preview = df.head(5).fillna("").to_dict(orient="records")
        for row in preview:
            clean_row = {}
            for k, v in row.items():
                clean_row[str(k)[:120]] = str(v)[:200] if v != "" else ""
            sample_rows.append(clean_row)
    except Exception:
        pass

    col_types = {}
    for c in stats:
        dtype = c["dtype"]
        if dtype not in col_types:
            col_types[dtype] = {"count": 0, "columns": []}
        col_types[dtype]["count"] += 1
        col_types[dtype]["columns"].append(c["name"])

    return {
        "rows": len(df),
        "column_count": len(df.columns),
        "total_nulls": missing,
        "total_duplicates": duplicates,
        "numeric_columns": len(numeric_cols),
        "correlation": corr,
        "columns": stats,
        "kpis": kpis,
        "group_by": group_by,
        "highest": highest,
        "insights": insights,
        "recommendations": recommendations,
        "scatter": scatter,
        "sample": sample_rows,
        "column_types": col_types,
        "filter_options": _filter_options(df, stats),
    }


def _histogram(valid, buckets):
    try:
        counts, edges = pd.cut(valid, bins=buckets, retbins=True, duplicates="drop")
        labels = []
        for i in range(len(edges) - 1):
            labels.append((float(edges[i]) + float(edges[i + 1])) / 2)
        values = counts.value_counts(sort=False).reindex(range(len(labels)), fill_value=0).tolist()
        return [{"bin": round(float(labels[i]), 3), "count": int(values[i])} for i in range(len(labels))]
    except Exception:
        return []


def _correlation_matrix(frame):
    if frame.empty or frame.shape[1] < 1:
        return []
    try:
        corr = frame.corr()
        out = []
        for i, row_name in enumerate(corr.index):
            for j, col_name in enumerate(corr.columns):
                out.append(
                    {
                        "row": str(row_name)[:120],
                        "col": str(col_name)[:120],
                        "value": round(float(corr.iloc[i, j]), 3),
                    }
                )
        return out
    except Exception:
        return []


def _group_by_stats(df):
    """Group counts for low-cardinality categorical columns (bounded)."""
    out = []
    for col in df.columns:
        series = df[col]
        try:
            numeric = pd.api.types.is_numeric_dtype(series)
        except Exception:
            numeric = True
        if numeric:
            continue
        try:
            cnt = series.nunique(dropna=True)
        except Exception:
            continue
        if not (2 <= cnt <= 15):
            continue
        try:
            counts = series.dropna().astype(str).value_counts().head(10)
            groups = [{"value": str(k)[:60], "count": int(v)} for k, v in counts.items()]
            total = float(sum(g["count"] for g in groups)) or 1.0
            for g in groups:
                g["pct"] = round(g["count"] * 100.0 / total, 1)
            out.append({"column": str(col)[:120], "groups": groups})
        except Exception:
            continue
    return out


def _highest_stats(df):
    """Top / extreme values per column (bounded)."""
    out = []
    for col in df.columns:
        series = df[col]
        try:
            numeric = pd.api.types.is_numeric_dtype(series)
        except Exception:
            numeric = False
        info = {
            "column": str(col)[:120],
            "kind": "numeric" if numeric else "categorical",
        }
        try:
            if numeric:
                valid = pd.to_numeric(series, errors="coerce").dropna()
                if len(valid):
                    info["max"] = float(valid.max())
                    info["min"] = float(valid.min())
                    info["top"] = [
                        {"value": float(v), "count": int(c)} for v, c in valid.value_counts().head(5).items()
                    ]
                    out.append(info)
            else:
                counts = series.dropna().astype(str).value_counts().head(5)
                info["top"] = [{"value": str(k)[:60], "count": int(v)} for k, v in counts.items()]
                out.append(info)
        except Exception:
            pass
    return out


def _kpis(df, missing, duplicates, numeric_cols):
    """Top-level performance indicators for the dataset."""
    rows = len(df)
    cols = len(df.columns)
    cells = rows * cols
    missing_pct = round(missing * 100.0 / cells, 2) if cells else 0.0
    dup_pct = round(duplicates * 100.0 / rows, 2) if rows else 0.0
    return {
        "rows": rows,
        "columns": cols,
        "missing_values": missing,
        "missing_pct": missing_pct,
        "duplicate_rows": duplicates,
        "duplicate_pct": dup_pct,
        "completeness_score": round(100.0 - missing_pct, 2),
        "quality_score": round(max(0.0, 100.0 - missing_pct - dup_pct), 1),
        "numeric_columns": len(numeric_cols),
        "categorical_columns": cols - len(numeric_cols),
    }


def _generate_insights(kpis, corr, columns, group_by):
    """Generate readable, data-driven insight sentences (Arabic)."""
    insights = []

    if kpis["missing_values"] > 0:
        worst = None
        for c in columns:
            if c.get("nulls", 0) > 0:
                pct = round(c["nulls"] * 100.0 / kpis["rows"], 1) if kpis["rows"] else 0
                if worst is None or c["nulls"] > worst["nulls"]:
                    worst = {"name": c["name"], "nulls": c["nulls"], "pct": pct}
        if worst:
            insights.append(
                f"يوجد {kpis['missing_values']} قيمة ناقصة ({kpis['missing_pct']}%)؛"
                f" أكثر عمود تأثّر: '{worst['name']}' ({worst['nulls']} قيمة، {worst['pct']}%)."
            )
        else:
            insights.append(f"يوجد {kpis['missing_values']} قيمة ناقصة ({kpis['missing_pct']}%).")
    else:
        insights.append("لا توجد قيم ناقصة في البيانات. ✓")

    if kpis["duplicate_rows"] > 0:
        insights.append(f"يوجد {kpis['duplicate_rows']} صف مكرر ({kpis['duplicate_pct']}%)؛ يُنصح بإزالتها.")
    else:
        insights.append("لا توجد صفوف مكررة. ✓")

    strongest = None
    for r in corr:
        if r["row"] == r["col"]:
            continue
        mag = abs(r["value"])
        if strongest is None or mag > strongest[0]:
            strongest = (mag, r["row"], r["col"], r["value"])
    if strongest and strongest[0] >= 0.6:
        direction = "إيجابي" if strongest[3] > 0 else "سلبي"
        insights.append(
            f"ارتباط {direction} قوي بين '{strongest[1]}' و'{strongest[2]}'" f" (معامل {strongest[3]:.2f})."
        )

    for g in group_by:
        if g["groups"] and g["groups"][0]["pct"] >= 60:
            insights.append(
                f"العمود '{g['column']}': القيمة '{g['groups'][0]['value']}'" f" تهيمن بنسبة {g['groups'][0]['pct']}%."
            )

    return insights


def _generate_recommendations(kpis, corr, columns, group_by):
    """Data-driven, actionable recommendations (Arabic) for the analysis page."""
    recommendations = []
    quality = kpis["quality_score"]

    if quality >= 90:
        recommendations.append("جودة البيانات ممتازة — يمكنك المتابعة مباشرة في أي نموذج تحليلي.")
    else:
        if kpis["missing_values"] > 0:
            recommendations.append(
                f"عالج القيم الناقصة ({kpis['missing_values']} قيمة, {kpis['missing_pct']}%)"
                " عبر الحذف أو التعبئة بالوسط/المنوال أو باستخدام أداة التنظيف."
            )
        if kpis["duplicate_rows"] > 0:
            recommendations.append(f"أزل الصفوف المكررة ({kpis['duplicate_rows']} صفاً) قبل أي تجميع أو نمذجة.")

    outliers_cols = [c["name"] for c in columns if (c.get("outliers_count") or 0) > 0]
    if outliers_cols:
        names = "، ".join(outliers_cols[:4])
        recommendations.append(
            f"توجد قيم شاذة في الأعمدة ({names}) — راجعها واحكم إما بالتصحيح أو بالربط" " (winsorization)."
        )

    strongest = None
    for r in corr:
        if r["row"] == r["col"]:
            continue
        mag = abs(r["value"])
        if strongest is None or mag > strongest[0]:
            strongest = (mag, r["row"], r["col"], r["value"])
    if strongest and strongest[0] >= 0.6:
        direction = "إيجابي" if strongest[3] > 0 else "سلبي"
        recommendations.append(
            f"ارتباط {direction} قوي بين '{strongest[1]}' و'{strongest[2]}'"
            f" ({strongest[3]:.2f}) — انتبه للتعددية الخطية عند النمذجة."
        )

    constant_cols = [c["name"] for c in columns if c.get("distinct", 0) <= 1]
    if constant_cols:
        names = "، ".join(constant_cols[:4])
        recommendations.append(f"الأعمدة الثابتة ({names}) لا تضيف معلومات — يُنصح بحذفها.")

    highly_skewed = [c["name"] for c in columns if c.get("skewness") is not None and abs(c["skewness"]) > 2]
    if highly_skewed:
        names = "، ".join(highly_skewed[:4])
        recommendations.append(f"الأعمدة ({names}) منحرفة بشدة — جرّب تحويلاً لوغاريتمياً لتقريب التوزيع للتطبيع.")

    dominated = [g for g in group_by if g["groups"] and g["groups"][0]["pct"] >= 80]
    if dominated:
        g = dominated[0]
        recommendations.append(
            f"فئة '{g['groups'][0]['value']}' في العمود '{g['column']}' تستحوذ على"
            f" {g['groups'][0]['pct']}% — قد يتطلب الأمر دمج الفئات النادرة."
        )

    if not recommendations:
        recommendations.append("لا توجد توصيات عاجلة — البيانات جاهزة للاستخدام.")

    return recommendations[:6]


def _scatter_series(df, numeric_cols):
    """Real (x, y) scatter points for the first few numeric pairs (bounded)."""
    if len(numeric_cols) < 2:
        return []
    cols = numeric_cols[:4]
    pairs = []
    for i in range(len(cols)):
        for j in range(i + 1, len(cols)):
            if len(pairs) >= 2:
                break
            x_col, y_col = cols[i], cols[j]
            try:
                sub = df[[x_col, y_col]].apply(pd.to_numeric, errors="coerce").dropna()
            except Exception:
                continue
            if len(sub) == 0:
                continue
            step = max(1, len(sub) // 250)
            sampled = sub.iloc[::step].head(250)
            points = [
                {"x": round(float(r[0]), 5), "y": round(float(r[1]), 5)}
                for r in sampled.itertuples(index=False, name=None)
            ]
            pairs.append({"x_col": x_col, "y_col": y_col, "points": points})
            if len(pairs) >= 2:
                break
    return pairs


def _filter_options(df, stats):
    """Per-column value choices (categorical) + numeric bounds for the filter UI."""
    out = []
    by_name = {c["name"]: c for c in stats}
    for col in df.columns[:60]:
        info = by_name.get(str(col), {})
        if pd.api.types.is_numeric_dtype(df[col]):
            out.append(
                {
                    "column": str(col),
                    "kind": "numeric",
                    "min": info.get("min"),
                    "max": info.get("max"),
                }
            )
            continue
        try:
            counts = df[col].dropna().astype(str).value_counts().head(20)
            if counts.empty:
                continue
            values = [{"value": str(k)[:80], "count": int(v)} for k, v in counts.items()]
            out.append({"column": str(col), "kind": "categorical", "values": values})
        except Exception:
            continue
    return out


def _apply_filters(df, filters):
    """Apply a JSON list of {column, op, value} filter rules to a dataframe."""
    if not filters or not isinstance(filters, list):
        return df
    mask = pd.Series(True, index=df.index)
    for rule in filters:
        if not isinstance(rule, dict):
            continue
        col = str(rule.get("column", ""))
        if col not in df.columns:
            continue
        op = rule.get("op") or rule.get("operator")
        val = rule.get("value")
        s = df[col]
        try:
            if op in ("in",) and isinstance(val, list):
                vals = [str(v) for v in val]
                mask &= s.astype(str).isin(vals)
            elif op == "in":
                mask &= s.astype(str) == str(val)
            elif op == "notin" and isinstance(val, list):
                mask &= ~s.astype(str).isin([str(v) for v in val])
            elif op == "neq":
                mask &= s.astype(str) != str(val)
            elif op in ("gt", "gte", "lt", "lte", "between"):
                num = pd.to_numeric(s, errors="coerce")
                if op == "between" and isinstance(val, list) and len(val) == 2:
                    lo, hi = float(val[0]), float(val[1])
                    mask &= num.between(lo, hi)
                elif op == "gt":
                    mask &= num > float(val)
                elif op == "gte":
                    mask &= num >= float(val)
                elif op == "lt":
                    mask &= num < float(val)
                elif op == "lte":
                    mask &= num <= float(val)
            elif op == "notnull":
                mask &= s.notna()
            elif op == "isnull":
                mask &= s.isna()
        except Exception:
            continue
    return df[mask]


def _clean_dataframe(df, approved):
    cleaned_df, cleaning_report = clean_data(df, approved)
    return cleaned_df, cleaning_report


def _build_report(before, after, cleaning_report, exec_time):
    return generate_report(before, after, cleaning_report, exec_time)


def _read_pdf_table(content):
    """Extract a tabular DataFrame from a PDF.

    pdfplumber is preferred; pypdf text lines are used as a loose fallback.
    Returns a DataFrame or raises HTTPException(400) with a clear message.
    """
    try:
        import pdfplumber  # type: ignore
    except Exception as exc:  # pragma: no cover
        raise HTTPException(
            status_code=400,
            detail="تفعيل قراءة ملفات PDF يتطلب تثبيت مكتبة pdfplumber.",
        ) from exc

    rows = []
    try:
        with pdfplumber.open(BytesIO(content)) as pdf:
            if not pdf.pages:
                raise HTTPException(status_code=400, detail="ملف PDF فارغ.")
            for page in pdf.pages:
                try:
                    tables = page.extract_tables() or []
                except Exception:
                    tables = []
                for table in tables:
                    for row in table:
                        cells = ["" if c is None else str(c).strip() for c in row]
                        if any(cells) and not all(c == "" for c in cells):
                            rows.append(cells)
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=f"تعذّرت قراءة ملف PDF: {str(error)}",
        ) from error

    # Fallback: split plain text lines into columns (whitespace separation).
    if not rows:
        try:
            text = ""
            for page in pdf.pages:
                try:
                    text += (page.extract_text() or "") + "\n"
                except Exception:
                    continue
            for line in text.splitlines():
                parts = (
                    [p.strip() for p in line.split("\t")]
                    if "\t" in line
                    else [p.strip() for p in re.split(r"\s{2,}", line)]
                )
                parts = [p for p in parts if p]
                if parts:
                    rows.append(parts)
        except Exception:
            pass

    if not rows:
        raise HTTPException(
            status_code=400,
            detail="تعذّر استخراج جدول بيانات من ملف PDF. تأكد أن الملف يحتوي على جداول أو نصوص منظمة.",
        )

    # Normalise to a consistent width using the widest row as the header source.
    widths = [len(r) for r in rows]
    target_width = max(widths)
    header_candidates = [r for r in rows if len(r) == target_width]
    header = header_candidates[0] if header_candidates else [f"Column {i + 1}" for i in range(target_width)]

    padded = []
    for r in rows:
        row = list(r)
        while len(row) < target_width:
            row.append("")
        padded.append(row)

    # Treat the header row as the first row if it looks like one; otherwise use
    # generated names and drop the widest row from data.
    data_rows = padded
    if header_candidates:
        # Use the first row overall as the header when it matches the widest
        # shape (most PDF tables put the header first).
        data_rows = padded[1:] if padded and len(padded[0]) == target_width else padded
    else:
        header = [f"Column {i + 1}" for i in range(target_width)]

    if len(data_rows) > 0 and data_rows[0] == header:
        data_rows = data_rows[1:]

    return pd.DataFrame(data_rows, columns=header)


def _read_uploaded_file(file):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is missing")
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(ALLOWED_EXTENSIONS)
        raise HTTPException(status_code=400, detail=f"Extension '{ext}' not allowed. Allowed: {allowed}")
    content = file.file.read(MAX_FILE_SIZE + 1)
    if len(content) > MAX_FILE_SIZE:
        max_mb = MAX_FILE_SIZE // (1024 * 1024)
        raise HTTPException(status_code=413, detail=f"File too large (max {max_mb} MB)")
    try:
        if ext == ".csv":
            df = pd.read_csv(BytesIO(content), encoding="utf-8-sig")
        elif ext == ".xlsx":
            df = pd.read_excel(BytesIO(content), engine="openpyxl")
        elif ext == ".xls":
            df = pd.read_excel(BytesIO(content), engine="xlrd")
        elif ext == ".pdf":
            df = _read_pdf_table(content)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type")
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(error)}") from error

    if len(df) > MAX_ROWS:
        raise HTTPException(status_code=413, detail=f"Dataset exceeds {MAX_ROWS:,} rows.")
    if len(df.columns) > MAX_COLUMNS:
        raise HTTPException(status_code=413, detail=f"Dataset exceeds {MAX_COLUMNS:,} columns.")
    return df


def _render_csv(df) -> bytes:
    buffer = BytesIO()
    sanitize_dataframe_for_export(df).to_csv(buffer, index=False, encoding="utf-8-sig")
    buffer.seek(0)
    return buffer.getvalue()


def _build_df_from_rows(headers, rows):
    return pd.DataFrame(rows, columns=headers)


def _parse_plan(plan_text):
    """Parse the approved cleaning plan sent by the client (JSON array).

    The agent refuses to clean anything unless the user explicitly authorises
    a plan produced by /analyze.
    """
    if not plan_text or not plan_text.strip():
        raise HTTPException(
            status_code=400,
            detail=(
                "لا بد من إرسال خطة التنظيف المعتمدة (من /analyze)"
                " قبل التنظيف. الوكيل لا ينظّف البيانات دون موافقة"
                " المستخدم."
            ),
        )
    if len(plan_text) > MAX_JSON_BODY:
        raise HTTPException(status_code=413, detail="Plan payload too large.")
    try:
        items = json.loads(plan_text)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid plan JSON.")
    if not isinstance(items, list):
        raise HTTPException(status_code=400, detail="Plan must be a JSON array.")
    approved = set()
    for item in items:
        if isinstance(item, dict) and isinstance(item.get("id"), str):
            if item.get("run") is True:
                approved.add(item["id"])
    # Only canonical, whitelisted action ids can ever execute.
    return approved & set(ACTION_IDS)


async def _read_json_body(request):
    """Read a JSON body with a hard cap to stop oversized payloads."""
    try:
        payload = await request.body()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request body.")
    if len(payload) > MAX_JSON_BODY:
        raise HTTPException(status_code=413, detail="JSON body too large.")
    try:
        return json.loads(payload)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body.")


def _build_analysis_context(df, analysis):
    """Compact, AI-friendly context built from a pre-cleaning analysis."""
    columns = []
    for col in df.columns[:300]:
        series = df[col]
        try:
            sample_values = json_safe(series.dropna().head(3).tolist())
        except Exception:
            sample_values = []
        columns.append(
            {
                "name": str(col)[:80],
                "dtype": str(series.dtype),
                "sample": sample_values,
            }
        )
    return {
        "rows": analysis.get("rows", 0),
        "col_count": analysis.get("columns", 0),
        "nulls_total": analysis.get("nulls_total", 0),
        "duplicates": analysis.get("duplicates", 0),
        "columns": columns,
        "candidates": analysis.get("candidates", []),
    }


def _derive_title(sanitized):
    """Auto-name a new conversation from the first user message."""
    for msg in sanitized:
        if msg.get("role") == "user":
            text = re.sub(r"\s+", " ", str(msg.get("content", "")).strip())
            if len(text) > 60:
                text = text[:60].rstrip() + "…"
            return text or "New conversation"
    return "New conversation"


def _dedupe_column_names(columns):
    """Make a list of column names unique (used after concatenation)."""
    seen = {}
    out = []
    for col in columns:
        key = str(col)
        n = seen.get(key, 0)
        seen[key] = n + 1
        out.append(f"{key}_{n + 1}" if n else key)
    return out


def _export_df(df, target):
    """Serialise a dataframe to bytes for the requested export format."""
    safe = sanitize_dataframe_for_export(df)
    if target == "csv":
        buffer = BytesIO()
        safe.to_csv(buffer, index=False, encoding="utf-8-sig")
        return buffer.getvalue(), ".csv"
    if target == "xlsx":
        buffer = BytesIO()
        safe.to_excel(buffer, index=False, engine="openpyxl")
        return buffer.getvalue(), ".xlsx"
    if target == "xls":
        try:
            import xlwt  # type: ignore
        except Exception as exc:  # pragma: no cover
            raise HTTPException(status_code=400, detail="تنسيق XLS يتطلب تثبيت مكتبة xlwt.") from exc
        safe = safe.assign(**{c: safe[c].astype(object) for c in safe.columns})
        wb = xlwt.Workbook(encoding="utf-8")
        ws = wb.add_sheet("Sheet1")
        for j, col in enumerate(safe.columns):
            ws.write(0, j, str(col))
        for i, (_, row) in enumerate(safe.iterrows(), start=1):
            for j, col in enumerate(safe.columns):
                val = row[col]
                try:
                    has_nan = pd.isna(val)
                except Exception:
                    has_nan = False
                cell = "" if has_nan else sanitize_export_value(str(val))
                ws.write(i, j, cell)
        buffer = BytesIO()
        wb.save(buffer)
        return buffer.getvalue(), ".xls"
    if target == "json":
        records = safe.to_dict(orient="records")
        return (
            json.dumps(records, ensure_ascii=False, default=str).encode("utf-8"),
            ".json",
        )
    raise HTTPException(status_code=400, detail=f"Unsupported target format: {target}")


def _inline_or_saved(payload_bytes, ext, request):
    """Embed small payloads in the JSON response; save larger ones to disk."""
    file_id = uuid.uuid4().hex[:12]
    if len(payload_bytes) > MAX_INLINE_DOWNLOAD_BYTES:
        fname = f"cleaned_{file_id}{ext}"
        with open(os.path.join(UPLOAD_FOLDER, fname), "wb") as f:
            f.write(payload_bytes)
        _prune_old_downloads()
        base = (os.getenv("PUBLIC_BASE_URL", "").rstrip("/")) or str(request.base_url).rstrip("/")
        return {
            "download_url": f"{base}/download/{file_id}",
            "download_name": fname,
            "inline": False,
        }
    data_url = base64.b64encode(payload_bytes).decode("utf-8")
    return {
        "download_url": f"data:{ext};base64,{data_url}",
        "download_name": f"cleaned_{file_id}{ext}",
        "inline": True,
    }


# ============================================================
# تحليل أولي: خطة "ماذا ننظّف ولماذا / ماذا لا ننظّف"
# ============================================================
@app.post("/analyze", status_code=status.HTTP_200_OK)
@limiter.limit(RATE_LIMIT_ANALYZE)
async def analyze_dataset_endpoint(
    request: Request,
    file: UploadFile = File(...),
    user: dict = Depends(auth.get_current_user),
):
    try:
        df = await anyio.to_thread.run_sync(_read_uploaded_file, file)
        analysis = await anyio.to_thread.run_sync(analyze_dataset, df)
        data_ctx = await anyio.to_thread.run_sync(_build_analysis_context, df, analysis)
        sides, keeps = await anyio.to_thread.run_sync(plan_recommendations, data_ctx)

        plan = []
        for candidate in analysis.get("candidates", []):
            decision = sides.get(candidate["id"], {}) or {}
            side = decision.get("side") if decision.get("side") in ("clean", "keep") else "clean"
            plan.append(
                {
                    **candidate,
                    "side": side,
                    "reason": decision.get("reason") or "عملية مقترحة لتحسين جودة البيانات.",
                    "run": side == "clean",
                }
            )
        for keep in keeps:
            keep.setdefault("run", False)
            keep.setdefault("side", "keep")
            plan.append(keep)

        return JSONResponse(
            content={
                "dataset": {
                    "file_name": file.filename,
                    "rows": analysis.get("rows", 0),
                    "columns": analysis.get("columns", 0),
                    "nulls_total": analysis.get("nulls_total", 0),
                    "duplicates": analysis.get("duplicates", 0),
                },
                "plan": plan,
            }
        )
    except HTTPException:
        raise
    except Exception as error:
        logger.error("Unexpected error in /analyze: %s", error, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while analyzing the file.",
        ) from error


# ============================================================
# تحليل البيانات الإحصائي: إحصائيات، توزيعات، ارتباطات
# ============================================================
@app.post("/analyze-data", status_code=status.HTTP_200_OK)
@limiter.limit(RATE_LIMIT_ANALYZE)
async def analyze_data_endpoint(
    request: Request,
    file: UploadFile = File(...),
    filters: str = Form(""),
    user: dict = Depends(auth.get_current_user),
):
    try:
        df = await anyio.to_thread.run_sync(_read_uploaded_file, file)
        rows_before = len(df)
        filter_rules = []
        if filters and filters.strip():
            if len(filters) > MAX_JSON_BODY:
                raise HTTPException(status_code=413, detail="Filters payload too large.")
            try:
                parsed = json.loads(filters)
                if isinstance(parsed, list):
                    filter_rules = parsed
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid filters JSON.")
        if filter_rules:
            df = await anyio.to_thread.run_sync(_apply_filters, df, filter_rules)
        analysis = await anyio.to_thread.run_sync(_build_analysis_stats, df)
        filtered_info = None
        if filter_rules:
            filtered_info = {
                "active": True,
                "rules": filter_rules,
                "rows_before": rows_before,
                "rows_after": len(df),
            }
        ai_explanation = await anyio.to_thread.run_sync(explain_dataset, analysis)
        charts = await anyio.to_thread.run_sync(charting.charts_for_dataframe, df)
        context = await anyio.to_thread.run_sync(dataset_context, analysis)
        return JSONResponse(
            content={
                "dataset": {"file_name": file.filename},
                "ai_explanation": ai_explanation,
                "dataset_context": context,
                "charts": charts,
                "filtered": filtered_info,
                **json_safe(analysis),
            }
        )
    except HTTPException:
        raise
    except Exception as error:
        logger.error("Unexpected error in /analyze-data: %s", error, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while analyzing the data.",
        ) from error


# ============================================================
# دمج عدة ملفات في مجموعة بيانات موحدة + تحويل الصيغ
# ============================================================
@app.post("/merge-files", status_code=status.HTTP_200_OK)
@limiter.limit(RATE_LIMIT_CLEAN)
async def merge_files_endpoint(
    request: Request,
    files: List[UploadFile] = File(...),
    target: str = Form("csv"),
    user: dict = Depends(auth.get_current_user),
):
    if not files:
        raise HTTPException(status_code=400, detail="أرسل ملفاً واحداً على الأقل.")
    if len(files) > 20:
        raise HTTPException(status_code=400, detail="الحد الأقصى هو 20 ملفاً.")
    if target not in ("csv", "xlsx", "xls", "json"):
        raise HTTPException(status_code=400, detail="صيغة الإخراج غير مدعومة.")
    try:
        frames = []
        names = []
        for f in files:
            df = await anyio.to_thread.run_sync(_read_uploaded_file, f)
            frames.append(df)
            names.append(f.filename)
        total_rows = sum(len(d) for d in frames)
        if total_rows > MAX_ROWS:
            raise HTTPException(status_code=413, detail=f"إجمالي الصفوف يتجاوز الحد الأقصى ({MAX_ROWS:,}).")
        merged = pd.concat(frames, ignore_index=True, sort=False)
        if len(merged.columns) != len(set(merged.columns)):
            merged.columns = _dedupe_column_names(merged.columns)
        cols = [str(c)[:120] for c in merged.columns]
        payload_bytes, ext = await anyio.to_thread.run_sync(_export_df, merged, target)
        dl = _inline_or_saved(payload_bytes, ext, request)
        return JSONResponse(
            content=json_safe(
                {
                    "files": names,
                    "file_count": len(files),
                    "rows": len(merged),
                    "column_count": len(merged.columns),
                    "columns": cols,
                    "preview": merged.head(15).fillna("").to_dict(orient="records"),
                    "download_url": dl["download_url"],
                    "download_name": dl["download_name"],
                    "format": target,
                }
            )
        )
    except HTTPException:
        raise
    except Exception as error:
        logger.error("Unexpected error in /merge-files: %s", error, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while merging the files.",
        ) from error


@app.post("/convert", status_code=status.HTTP_200_OK)
@limiter.limit(RATE_LIMIT_ANALYZE)
async def convert_endpoint(
    request: Request,
    file: UploadFile = File(...),
    target: str = Form("xlsx"),
    user: dict = Depends(auth.get_current_user),
):
    if target not in ("csv", "xlsx", "xls", "json"):
        raise HTTPException(status_code=400, detail="صيغة الإخراج غير مدعومة.")
    try:
        df = await anyio.to_thread.run_sync(_read_uploaded_file, file)
        payload_bytes, ext = await anyio.to_thread.run_sync(_export_df, df, target)
        dl = _inline_or_saved(payload_bytes, ext, request)
        return JSONResponse(
            content=json_safe(
                {
                    "source_file_name": file.filename,
                    "rows": len(df),
                    "column_count": len(df.columns),
                    "target_format": target,
                    "download_url": dl["download_url"],
                    "download_name": dl["download_name"],
                }
            )
        )
    except HTTPException:
        raise
    except Exception as error:
        logger.error("Unexpected error in /convert: %s", error, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while converting the file.",
        ) from error


# ============================================================
# Power Pivot: تفكيك البيانات إلى جدول حقائق + أبعاد
# ينتج ملف Excel متعدّد الأوراق جاهزاً لنمذجة Power Pivot
# ============================================================
def _build_power_pivot_workbook_df(df):
    """Split a dataframe into a fact table plus categorical dimension tables.

    Returns (workbook_bytes, model) where model describes the relationship model.
    """
    import openpyxl  # local import: openpyxl is an optional heavy dependency

    df = sanitize_dataframe_for_export(df).reset_index(drop=True)
    wb = openpyxl.Workbook()

    # Prominence: pick categorical columns for dimensions when their cardinality
    # is reasonable and they are not mostly-unique (would be a waste).
    categorical = []
    for col in df.columns:
        if pd.api.types.is_object_dtype(df[col]) or pd.api.types.is_categorical_dtype(df[col]):
            nunique = df[col].nunique(dropna=True)
            total = len(df)
            ratio = nunique / total if total else 0
            if 0 < ratio <= 0.5 and nunique <= 500:
                categorical.append(str(col))

    fact = df.copy()
    dimension_ids = {}
    model = {"fact": "Fact", "dimensions": []}

    # Write the Fact sheet first.
    fact_ws = wb.active
    fact_ws.title = "Fact"
    fact_ws.append([str(c) for c in df.columns])
    for _, row in fact.iterrows():
        fact_ws.append([sanitize_export_value(row[c]) for c in df.columns])
    for cell in fact_ws[1]:
        cell.font = openpyxl.styles.Font(bold=True)

    # Build one dimension sheet per categorical column.
    for col in categorical:
        dim_name = f"Dim_{col[:20]}"
        values = fact[col].dropna().astype(str).unique().tolist()
        if len(values) > 200:
            values = sorted(values)[:200]
        ws = wb.create_sheet(title=dim_name[:31])
        ws.append([col])
        for v in values:
            ws.append([v])
        for cell in ws[1]:
            cell.font = openpyxl.styles.Font(bold=True)
        dim_id = f"{dim_name}.{col}"
        dimension_ids[col] = dim_id
        model["dimensions"].append({"sheet": dim_name, "column": col, "values": len(values)})

    # Relationships sheet documenting how to join in Power Pivot.
    rel_ws = wb.create_sheet(title="Relationships")
    rel_ws.append(["FactFK", "DimensionTable", "DimensionKey"])
    if dimension_ids:
        for col, dim_id in dimension_ids.items():
            rel_ws.append([col, dim_id.split(".")[0], col])
    else:
        rel_ws.append(["", "", "No dimensions detected"])

    # About sheet with structural notes.
    about_ws = wb.create_sheet(title="About")
    about_lines = [
        "OQZARO Power Pivot model",
        f"Fact rows: {len(df)}",
        f"Fact columns: {len(df.columns)}",
        f"Dimension sheets: {len(model['dimensions'])}",
        "",
        "Join each categorical column to its Dim_* sheet by primary key.",
    ]
    for line in about_lines:
        about_ws.append([line])

    buffer = BytesIO()
    wb.save(buffer)
    return buffer.getvalue(), model


@app.post("/power-pivot", status_code=status.HTTP_200_OK)
@limiter.limit(RATE_LIMIT_ANALYZE)
async def power_pivot_endpoint(
    request: Request,
    file: UploadFile = File(...),
    user: dict = Depends(auth.get_current_user),
):
    try:
        df = await anyio.to_thread.run_sync(_read_uploaded_file, file)
        if len(df) > MAX_ROWS:
            raise HTTPException(status_code=413, detail=f"عدد الصفوف يتجاوز الحد الأقصى ({MAX_ROWS:,}).")
        payload_bytes, model = await anyio.to_thread.run_sync(_build_power_pivot_workbook_df, df)
        dl = _inline_or_saved(payload_bytes, ".xlsx", request)
        return JSONResponse(
            content=json_safe(
                {
                    "source_file_name": file.filename,
                    "rows": len(df),
                    "column_count": len(df.columns),
                    "model": model,
                    "download_url": dl["download_url"],
                    "download_name": dl["download_name"],
                    "format": "xlsx",
                }
            )
        )
    except HTTPException:
        raise
    except Exception as error:
        logger.error("Unexpected error in /power-pivot: %s", error, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while building the Power Pivot model.",
        ) from error


# ============================================================
# التنظيف: لا ينفّذ إلا بخطة معتمدة من المستخدم
# ============================================================
@app.post("/clean", status_code=status.HTTP_200_OK)
@app.post("/upload", status_code=status.HTTP_200_OK)
@limiter.limit(RATE_LIMIT_CLEAN)
async def clean_dataset(
    request: Request,
    file: UploadFile = File(...),
    plan: str = Form(""),
    user: dict = Depends(auth.get_current_user),
):
    start_time = time.time()
    try:
        approved = _parse_plan(plan)
        df = await anyio.to_thread.run_sync(_read_uploaded_file, file)
        before = _analyze_dataframe(df)
        cleaned_df, cleaning_report = await anyio.to_thread.run_sync(_clean_dataframe, df, approved)
        after = _analyze_dataframe(cleaned_df)
        exec_time = time.time() - start_time
        report = await anyio.to_thread.run_sync(_build_report, before, after, cleaning_report, exec_time)

        buffer_bytes = await anyio.to_thread.run_sync(_render_csv, cleaned_df)
        file_id = uuid.uuid4().hex[:12]
        if len(buffer_bytes) > MAX_INLINE_DOWNLOAD_BYTES:
            cleaned_name = f"cleaned_{file_id}.csv"
            with open(os.path.join(UPLOAD_FOLDER, cleaned_name), "wb") as f:
                f.write(buffer_bytes)
            _prune_old_downloads()
            base = (os.getenv("PUBLIC_BASE_URL", "").rstrip("/")) or str(request.base_url).rstrip("/")
            report["download_url"] = f"{base}/download/{file_id}"
            report["cleaned_file_name"] = cleaned_name
        else:
            csv_base64 = base64.b64encode(buffer_bytes).decode("utf-8")
            report["download_url"] = f"data:text/csv;base64,{csv_base64}"
            report["cleaned_file_name"] = f"cleaned_{file_id}.csv"

        report["file_id"] = file_id
        report["source_file_name"] = file.filename

        # Persist the cleaned file + the FULL report (no truncation) to the
        # authenticated user's storage so it survives logout / login again.
        try:
            report_for_db = dict(report)
            report_for_db.pop("download_url", None)
            db.save_user_file(
                user_id=user["id"],
                file_id=file_id,
                file_name=file.filename,
                cleaned_file_name=report["cleaned_file_name"],
                file_bytes=buffer_bytes,
                report_json=json.dumps(report_for_db, ensure_ascii=False, default=str),
                rows_before=before["rows"],
                rows_after=after["rows"],
                columns=after["columns"],
                quality_score=report.get("quality_score"),
            )
        except Exception as exc:
            logger.error("Failed to persist user file: %s", exc, exc_info=True)

        # Record to local history (best-effort).
        store = _load_store()
        store["history"].insert(
            0,
            {
                "id": file_id,
                "user_id": user["id"],
                "file_name": file.filename,
                "rows_before": before["rows"],
                "rows_after": after["rows"],
                "columns": after["columns"],
                "quality_score": report.get("quality_score"),
                "timestamp": int(time.time()),
            },
        )
        store["history"] = store["history"][:MAX_HISTORY_ITEMS]
        _save_store(store)

        return JSONResponse(content=json_safe(report))
    except HTTPException:
        raise
    except Exception as error:
        # ✅ طباعة الخطأ الكامل في الطرفية فقط (لا يُرسل للمستخدم)
        print("=" * 60)
        print("ERROR in /clean endpoint:")
        traceback.print_exc()
        print("=" * 60)
        logger.error("Unexpected error: %s", error, exc_info=True)
        # الأمان: لا تُرسل تفاصيل التتبع أو بنية الخادم إلى العميل
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while cleaning. Please try a smaller file or contact support.",
        ) from error


@app.get("/download/{file_id}", include_in_schema=False)
async def download_cleaned(file_id: str, user: dict = Depends(auth.get_current_user)):
    if not _DOWNLOAD_ID_RE.match(file_id):
        raise HTTPException(status_code=400, detail="Invalid download id.")
    # Ownership check (anti-IDOR): a user may only download files they created.
    record = await anyio.to_thread.run_sync(db.get_user_file, user["id"], file_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Download expired or not found.")
    for ext, media in (
        (".csv", "text/csv"),
        (".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        (".xls", "application/vnd.ms-excel"),
        (".json", "application/json"),
    ):
        path = os.path.join(UPLOAD_FOLDER, f"cleaned_{file_id}{ext}")
        if os.path.isfile(path):
            _prune_old_downloads()
            return FileResponse(path, media_type=media, filename=os.path.basename(path))
    raise HTTPException(status_code=404, detail="Download expired or not found.")


@app.get("/history", status_code=status.HTTP_200_OK)
@limiter.limit("30/minute")
async def get_history(request: Request, user: dict = Depends(auth.get_current_user)):
    store = _load_store()
    user_history = [h for h in store.get("history", []) if h.get("user_id") == user["id"]]
    return JSONResponse(content={"history": user_history})


@app.post("/history", status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def add_history(request: Request, item: dict, user: dict = Depends(auth.get_current_user)):
    store = _load_store()
    entry = {
        "id": uuid.uuid4().hex[:8],
        "user_id": user["id"],
        "file_name": item.get("file_name"),
        "rows_before": item.get("rows_before"),
        "rows_after": item.get("rows_after"),
        "columns": item.get("columns"),
        "quality_score": item.get("quality_score"),
        "timestamp": int(time.time()),
    }
    store["history"].insert(0, entry)
    store["history"] = store["history"][:MAX_HISTORY_ITEMS]
    _save_store(store)
    return JSONResponse(status_code=201, content=entry)


@app.get("/report", status_code=status.HTTP_200_OK)
@limiter.limit("30/minute")
async def get_report(
    request: Request,
    report_id: str = "",
    user: dict = Depends(auth.get_current_user),
):
    store = _load_store()
    for report in store.get("reports", []):
        if report.get("id") == report_id and report.get("user_id") == user["id"]:
            return JSONResponse(content=json_safe(report))
    raise HTTPException(status_code=404, detail="Report not found.")


@app.post("/report", status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def save_report(request: Request, report: dict, user: dict = Depends(auth.get_current_user)):
    store = _load_store()
    entry = json_safe(report)
    entry["id"] = entry.get("id") or uuid.uuid4().hex[:8]
    entry["user_id"] = user["id"]
    entry["timestamp"] = int(time.time())
    store["reports"].insert(0, entry)
    store["reports"] = store["reports"][:MAX_HISTORY_ITEMS]
    _save_store(store)
    return JSONResponse(status_code=201, content=entry)


# ============================================================
# ملفات المستخدم: حفظ واسترجاع ملفات كل مستخدم من قاعدة البيانات
# ============================================================
@app.get("/files", status_code=status.HTTP_200_OK)
@limiter.limit("60/minute")
async def list_files(request: Request, user: dict = Depends(auth.get_current_user)):
    files = await anyio.to_thread.run_sync(db.list_user_files, user["id"])
    return JSONResponse(content={"files": files})


@app.get("/files/{file_id}", status_code=status.HTTP_200_OK)
@limiter.limit("60/minute")
async def get_file(request: Request, file_id: str, user: dict = Depends(auth.get_current_user)):
    record = await anyio.to_thread.run_sync(db.get_user_file, user["id"], file_id)
    if not record:
        raise HTTPException(status_code=404, detail="File not found or not yours.")
    try:
        report = json.loads(record["report_json"])
    except Exception:
        report = {}
    return JSONResponse(content={"file": report})


@app.get("/files/{file_id}/download", status_code=status.HTTP_200_OK)
@limiter.limit("60/minute")
async def download_user_file(request: Request, file_id: str, user: dict = Depends(auth.get_current_user)):
    record = await anyio.to_thread.run_sync(db.get_user_file, user["id"], file_id)
    if not record:
        raise HTTPException(status_code=404, detail="File not found or not yours.")
    return Response(
        content=bytes(record["file_bytes"]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{record["cleaned_file_name"]}"'},
    )


@app.delete("/files/{file_id}", status_code=status.HTTP_200_OK)
@limiter.limit("60/minute")
async def delete_file(request: Request, file_id: str, user: dict = Depends(auth.get_current_user)):
    deleted = await anyio.to_thread.run_sync(db.delete_user_file, user["id"], file_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="File not found or not yours.")
    return JSONResponse(content={"deleted": True})


@app.post("/clean-json", status_code=status.HTTP_200_OK)
@limiter.limit(RATE_LIMIT_CLEAN)
async def clean_json(request: Request, user: dict = Depends(auth.get_current_user)):
    payload = await _read_json_body(request)
    raw_plan = payload.get("plan", "")
    if isinstance(raw_plan, list):
        approved = _parse_plan(json.dumps(raw_plan))
    else:
        approved = _parse_plan(str(raw_plan))
    rows = payload.get("rows")
    headers = payload.get("headers")
    if not isinstance(rows, list) or not headers:
        raise HTTPException(status_code=400, detail="Body must contain 'headers' and 'rows'.")
    try:
        df = await anyio.to_thread.run_sync(_build_df_from_rows, headers, rows)
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"Failed to build dataframe: {str(error)}") from error
    if len(df) > MAX_ROWS:
        raise HTTPException(status_code=413, detail=f"Dataset exceeds {MAX_ROWS:,} rows.")
    if len(df.columns) > MAX_COLUMNS:
        raise HTTPException(status_code=413, detail=f"Dataset exceeds {MAX_COLUMNS:,} columns.")
    start_time = time.time()
    before = _analyze_dataframe(df)
    cleaned_df, cleaning_report = await anyio.to_thread.run_sync(_clean_dataframe, df, approved)
    after = _analyze_dataframe(cleaned_df)
    exec_time = time.time() - start_time
    report = await anyio.to_thread.run_sync(_build_report, before, after, cleaning_report, exec_time)
    csv_base64 = base64.b64encode(await anyio.to_thread.run_sync(_render_csv, cleaned_df)).decode("utf-8")
    report["download_url"] = f"data:text/csv;base64,{csv_base64}"
    report["cleaned_file_name"] = f"cleaned_{uuid.uuid4().hex[:8]}.csv"
    return JSONResponse(content=json_safe(report))


@app.post("/chat", status_code=status.HTTP_200_OK)
@limiter.limit(RATE_LIMIT_CHAT)
async def chat(request: Request, user: dict = Depends(auth.get_current_user)):
    """Chat with the OQZARO agent (backed by GROQ).

    Messages are persisted to the authenticated user's conversation so each
    user's history is kept separately and never shared with others.
    """
    payload = await _read_json_body(request)

    messages = payload.get("messages")
    context = payload.get("context")
    language = str(payload.get("language") or "").strip().lower()
    if language not in ("ar", "fr", "en"):
        language = None
    # Optional: target an existing session (the newest user message is appended).
    session_id = str(payload.get("session_id") or "").strip()
    if not isinstance(messages, list) or not messages:
        raise HTTPException(status_code=400, detail="Body must contain a non-empty 'messages' list.")
    if len(messages) > 50:
        raise HTTPException(status_code=400, detail="Too many messages (max 50).")

    sanitized = []
    for msg in messages:
        role = msg.get("role")
        content = str(msg.get("content", "")).strip()
        if role not in ("user", "assistant"):
            raise HTTPException(
                status_code=400,
                detail="Each message must have role 'user' or 'assistant'.",
            )
        if not content:
            raise HTTPException(status_code=400, detail="Message content cannot be empty.")
        if len(content) > 4000:
            raise HTTPException(status_code=400, detail="Message too long (max 4000 chars).")
        sanitized.append({"role": role, "content": content})
    if sanitized[-1]["role"] != "user":
        raise HTTPException(status_code=400, detail="The last message must be from the user.")

    # Keep only recent turns as conversation context.
    conversation = sanitized[-20:]

    # Cap the untrusted context size (guards token waste and prompt injection surface).
    if not isinstance(context, dict):
        context = None
    else:
        try:
            rendered = json.dumps(context, ensure_ascii=False, default=str)
        except Exception:
            context = None
        else:
            if len(rendered) > MAX_CHAT_CONTEXT_CHARS:
                raise HTTPException(
                    status_code=400,
                    detail=f"Context too large (max {MAX_CHAT_CONTEXT_CHARS} chars).",
                )

    try:
        reply, fallback = chat_agent(conversation, context, language)
    except Exception as error:
        logger.error("Chat error: %s", error, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while chatting. Please try again.",
        ) from error

    # Persist the user question and the assistant reply to the user's session.
    # Resolve/create the session; the whole turn is scoped to this user only.
    user_message = sanitized[-1]
    if session_id:
        session = db.get_session(user["id"], session_id)
    else:
        session = None
    if session is None:
        session_id = db.create_session(user["id"], _derive_title(sanitized))
    else:
        session_id = session["id"]
    db.add_message(user["id"], session_id, "user", user_message["content"])
    db.add_message(user["id"], session_id, "assistant", reply)
    db.touch_session(user["id"], session_id)

    return JSONResponse(
        content={
            "reply": reply,
            "fallback": fallback,
            "model": "GROQ" if fallback is False else "GROQ-fallback",
            "session_id": session_id,
        }
    )


@app.get("/", include_in_schema=False)
@app.get("/health", include_in_schema=False)
async def health_check():
    return {
        "status": "healthy",
        "timestamp": int(time.time()),
        "service": "OQZARO DataCleaning Agent",
        "version": "2.0.0",
    }


@app.get("/microsoft/status", status_code=200)
async def microsoft_status():
    """Microsoft Excel / Power BI integration readiness (never leaks values)."""
    return {
        "configured": MS_CONFIGURED,
        "clientIdReady": bool(AZURE_CLIENT_ID),
        "tenantReady": bool(AZURE_TENANT_ID),
        "clientSecretReady": bool(AZURE_CLIENT_SECRET),
        "powerBiGroupId": bool(POWERBI_GROUP_ID),
        "note": "Microsoft Graph / Power BI REST wiring is staged but not enabled yet.",
    }


@app.exception_handler(HTTPException)
async def http_exception_handler(_, exc):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(Exception)
async def generic_exception_handler(_, exc):
    logger.error("Unhandled exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred. Please try again later."},
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "8000")),
        reload=os.getenv("RELOAD", "0") == "1",
    )
