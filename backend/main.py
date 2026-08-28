# cspell:ignore OQZARO
"""Main module for OQZARO DataCleaning Agent."""

import base64
import logging
import os
import time
import uuid
import traceback
from io import BytesIO

import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import ALLOWED_EXTENSIONS, CORS_ORIGINS, MAX_FILE_SIZE, UPLOAD_FOLDER
from cleaner import clean_data
from report import generate_report

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
    return df

# ============================================================
# ✅ نقطة النهاية الرئيسية (مع ظهور الخطأ الكامل)
# ============================================================
@app.post("/clean", status_code=status.HTTP_200_OK)
async def clean_dataset(file: UploadFile = File(...)):
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
        csv_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
        report["download_url"] = f"data:text/csv;base64,{csv_base64}"
        report["cleaned_file_name"] = f"cleaned_{uuid.uuid4().hex[:8]}.csv"

        return JSONResponse(content=report)
    except Exception as error:
        # ✅ طباعة الخطأ الكامل في الطرفية
        print("=" * 60)
        print("❌ ERROR in /clean endpoint:")
        traceback.print_exc()
        print("=" * 60)
        logger.error("Unexpected error: %s", error, exc_info=True)
        # ✅ إرجاع التفاصيل في الرد (بدلاً من رسالة عامة)
        raise HTTPException(
            status_code=500,
            detail=f"Error: {str(error)}\nTraceback: {traceback.format_exc()}"
        ) from error

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
        content={"detail": "An unexpected error occurred. Please try again later."}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)