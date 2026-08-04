import os
import re
import shutil
import time
import traceback
from urllib.parse import quote, unquote

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse

from config import UPLOAD_FOLDER, OUTPUT_FOLDER
from reader import read_data
from analyzer import analyze_data
from cleaner import clean_data
from report import generate_report
from exporter import save_output

app = FastAPI(
    title="AI Data Cleaning Agent",
    version="1.0"
)

# ============================================
# CORS - السماح للواجهة الأمامية بالاتصال
# ============================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://data-cleaning-agent-woad.vercel.app",
        "https://data-cleaning-agent-production.up.railway.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# إنشاء المجلدات
# ============================================
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# ============================================
# نقاط النهاية (Endpoints)
# ============================================

@app.get("/")
def home():
    return {
        "message": "AI Data Cleaning Agent is Running"
    }

# ============================================
# نقطة نهاية مخصصة لتحميل الملف المنظف
# ============================================
@app.get("/download/{filename:path}")
async def download_file(filename: str):
    """
    Download a cleaned file from the OUTPUT_FOLDER.
    Uses :path to capture full filename including extensions.
    """
    # Decode URL-encoded characters (e.g., %20 -> space)
    decoded_filename = unquote(filename)
    # Prevent directory traversal attacks
    safe_filename = os.path.basename(decoded_filename)
    file_path = os.path.join(OUTPUT_FOLDER, safe_filename)

    print(f"[DOWNLOAD] Requested file: {safe_filename}")
    print(f"[DOWNLOAD] Looking for: {file_path}")

    if not os.path.exists(file_path):
        print(f"[DOWNLOAD] File not found: {file_path}")
        raise HTTPException(status_code=404, detail=f"File not found: {safe_filename}")

    # Determine media type based on extension
    media_type = 'text/csv'
    if safe_filename.endswith('.xlsx'):
        media_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    elif safe_filename.endswith('.xls'):
        media_type = 'application/vnd.ms-excel'

    return FileResponse(
        file_path,
        media_type=media_type,
        filename=safe_filename
    )

# ============================================
# نقطة تنظيف البيانات
# ============================================
@app.post("/clean")
async def clean_dataset(file: UploadFile = File(...)):
    start_time = time.time()
    try:
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        os.makedirs(OUTPUT_FOLDER, exist_ok=True)

        file_path = os.path.join(UPLOAD_FOLDER, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        df = read_data(file_path)
        before = analyze_data(df)
        cleaned_df, cleaning_report = clean_data(df)
        after = analyze_data(cleaned_df)

        # Pass the original filename to create a unique cleaned file name
        saved_file = save_output(cleaned_df, OUTPUT_FOLDER, file.filename)
        execution_time = time.time() - start_time

        report = generate_report(before, after, cleaning_report, execution_time)

        raw_filename = os.path.basename(saved_file)
        # URL-encode the filename to safely include spaces and special characters
        encoded_filename = quote(raw_filename)
        report["cleaned_file"] = f"/download/{encoded_filename}"
        report["download_url"] = f"/download/{encoded_filename}"
        report["cleaned_file_name"] = raw_filename

        return JSONResponse(content=report)

    except Exception as error:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(error))

# ============================================
# (اختياري) تشغيل الخادم محلياً
# ============================================
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )