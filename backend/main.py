# cspell:ignore OQZARO
"""Main module for OQZARO DataCleaning Agent."""

import base64
import json
import logging
import os
import re
import time
import uuid
import traceback
from io import BytesIO

import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from slowapi.middleware import SlowAPIMiddleware

from config import (
    ALLOWED_EXTENSIONS,
    CORS_ORIGINS,
    MAX_COLUMNS,
    MAX_FILE_SIZE,
    MAX_ROWS,
    UPLOAD_FOLDER,
)
from cleaner import clean_data, json_safe
from report import generate_report

# Files this size (or larger) are not embedded as base64 in the JSON response.
MAX_INLINE_DOWNLOAD_BYTES = 5 * 1024 * 1024  # 5 MB

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
    allow_credentials=False,
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type", "Accept"],
    expose_headers=["Content-Disposition"],
)

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Rate limiting
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["60/minute"],
    storage_uri="memory://",
)
app.state.limiter = limiter
app.add_exception_handler(
    RateLimitExceeded,
    lambda _, exc: JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please slow down."},
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


def _clean_dataframe(df):
    cleaned_df, cleaning_report = clean_data(df)
    return cleaned_df, cleaning_report


def _build_report(before, after, cleaning_report, exec_time):
    return generate_report(before, after, cleaning_report, exec_time)


def _read_uploaded_file(file):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is missing")
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(ALLOWED_EXTENSIONS)
        raise HTTPException(status_code=400, detail=f"Extension '{ext}' not allowed. Allowed: {allowed}")
    content = file.file.read(MAX_FILE_SIZE + 1)
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 50 MB)")
    try:
        if ext == ".csv":
            df = pd.read_csv(BytesIO(content), encoding="utf-8-sig")
        elif ext == ".xlsx":
            df = pd.read_excel(BytesIO(content), engine="openpyxl")
        elif ext == ".xls":
            df = pd.read_excel(BytesIO(content), engine="xlrd")
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type")
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(error)}") from error

    if len(df) > MAX_ROWS:
        raise HTTPException(status_code=413, detail=f"Dataset exceeds {MAX_ROWS:,} rows.")
    if len(df.columns) > MAX_COLUMNS:
        raise HTTPException(status_code=413, detail=f"Dataset exceeds {MAX_COLUMNS:,} columns.")
    return df


# ============================================================
# ✅ نقطة النهاية الرئيسية (مع ظهور الخطأ الكامل)
# ============================================================
@app.post("/clean", status_code=status.HTTP_200_OK)
@app.post("/upload", status_code=status.HTTP_200_OK)
@limiter.limit("10/minute")
async def clean_dataset(request: Request, file: UploadFile = File(...)):
    start_time = time.time()
    try:
        df = _read_uploaded_file(file)
        before = _analyze_dataframe(df)
        cleaned_df, cleaning_report = _clean_dataframe(df)
        after = _analyze_dataframe(cleaned_df)
        exec_time = time.time() - start_time
        report = _build_report(before, after, cleaning_report, exec_time)

        buffer = BytesIO()
        cleaned_df.to_csv(buffer, index=False, encoding="utf-8-sig")
        buffer.seek(0)
        buffer_bytes = buffer.getvalue()
        if len(buffer_bytes) > MAX_INLINE_DOWNLOAD_BYTES:
            file_id = uuid.uuid4().hex[:8]
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
            report["cleaned_file_name"] = f"cleaned_{uuid.uuid4().hex[:8]}.csv"

        # Record to local history (best-effort).
        store = _load_store()
        store["history"].insert(
            0,
            {
                "id": uuid.uuid4().hex[:8],
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
async def download_cleaned(file_id: str):
    if not _DOWNLOAD_ID_RE.match(file_id):
        raise HTTPException(status_code=400, detail="Invalid download id.")
    path = os.path.join(UPLOAD_FOLDER, f"cleaned_{file_id}.csv")
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Download expired or not found.")
    _prune_old_downloads()
    return FileResponse(path, media_type="text/csv", filename=os.path.basename(path))


@app.get("/history", status_code=status.HTTP_200_OK)
@limiter.limit("30/minute")
async def get_history(request: Request):
    store = _load_store()
    return JSONResponse(content={"history": store.get("history", [])})


@app.post("/history", status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def add_history(request: Request, item: dict):
    store = _load_store()
    entry = {
        "id": uuid.uuid4().hex[:8],
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
async def get_report(request: Request, report_id: str = ""):
    store = _load_store()
    for report in store.get("reports", []):
        if report.get("id") == report_id:
            return JSONResponse(content=json_safe(report))
    raise HTTPException(status_code=404, detail="Report not found.")


@app.post("/report", status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def save_report(request: Request, report: dict):
    store = _load_store()
    entry = json_safe(report)
    entry["id"] = entry.get("id") or uuid.uuid4().hex[:8]
    entry["timestamp"] = int(time.time())
    store["reports"].insert(0, entry)
    store["reports"] = store["reports"][:MAX_HISTORY_ITEMS]
    _save_store(store)
    return JSONResponse(status_code=201, content=entry)


@app.post("/clean-json", status_code=status.HTTP_200_OK)
@limiter.limit("10/minute")
async def clean_json(request: Request):
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body.")
    rows = payload.get("rows")
    headers = payload.get("headers")
    if not isinstance(rows, list) or not headers:
        raise HTTPException(status_code=400, detail="Body must contain 'headers' and 'rows'.")
    try:
        df = pd.DataFrame(rows, columns=headers)
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"Failed to build dataframe: {str(error)}") from error
    if len(df) > MAX_ROWS:
        raise HTTPException(status_code=413, detail=f"Dataset exceeds {MAX_ROWS:,} rows.")
    if len(df.columns) > MAX_COLUMNS:
        raise HTTPException(status_code=413, detail=f"Dataset exceeds {MAX_COLUMNS:,} columns.")
    start_time = time.time()
    before = _analyze_dataframe(df)
    cleaned_df, cleaning_report = _clean_dataframe(df)
    after = _analyze_dataframe(cleaned_df)
    exec_time = time.time() - start_time
    report = _build_report(before, after, cleaning_report, exec_time)
    return JSONResponse(content=json_safe(report))


@app.get("/", include_in_schema=False)
async def health_check():
    return {
        "status": "healthy",
        "timestamp": int(time.time()),
        "service": "OQZARO DataCleaning Agent",
        "version": "2.0.0",
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
