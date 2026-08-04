import os
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

app = FastAPI(title="AI Data Cleaning Agent", version="1.0")

# CORS
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

# إنشاء المجلدات
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# ============================================
# نقاط النهاية
# ============================================

@app.get("/")
def home():
    return {"message": "AI Data Cleaning Agent is Running"}

@app.get("/download/{filename:path}")
async def download_file(filename: str):
    # فك الترميز ومنع هجمات المسار
    decoded = unquote(filename)
    safe = os.path.basename(decoded)
    file_path = os.path.join(OUTPUT_FOLDER, safe)

    print(f"[DOWNLOAD] OUTPUT_FOLDER: {OUTPUT_FOLDER}")
    print(f"[DOWNLOAD] Requested: {safe}")
    print(f"[DOWNLOAD] Full path: {file_path}")

    if not os.path.exists(file_path):
        print(f"[DOWNLOAD] File not found!")
        # سرد الملفات الموجودة للمساعدة في التشخيص
        try:
            files = os.listdir(OUTPUT_FOLDER)
            print(f"[DOWNLOAD] Existing files: {files}")
        except Exception as e:
            print(f"[DOWNLOAD] Error listing dir: {e}")
        raise HTTPException(status_code=404, detail=f"File not found: {safe}")

    return FileResponse(
        file_path,
        media_type='text/csv' if safe.endswith('.csv') else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename=safe
    )

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

        saved_file = save_output(cleaned_df, OUTPUT_FOLDER, file.filename)
        execution_time = time.time() - start_time

        report = generate_report(before, after, cleaning_report, execution_time)

        raw_filename = os.path.basename(saved_file)
        encoded = quote(raw_filename)
        report["cleaned_file"] = f"/download/{encoded}"
        report["download_url"] = f"/download/{encoded}"
        report["cleaned_file_name"] = raw_filename

        return JSONResponse(content=report)

    except Exception as error:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(error))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)