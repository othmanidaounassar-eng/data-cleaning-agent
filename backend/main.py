import os
import shutil
import time
import traceback
import uuid
from urllib.parse import quote, unquote

from fastapi import FastAPI, UploadFile, File, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse

from config import UPLOAD_FOLDER, OUTPUT_FOLDER
from reader import read_data
from analyzer import analyze_data
from cleaner import clean_data
from report import generate_report
from exporter import save_output, save_output_to_bytes

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

# إنشاء المجلدات (للملفات المؤقتة فقط)
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# تخزين مؤقت للملفات المنظفة (في الذاكرة)
downloaded_files = {}

# ============================================
# نقاط النهاية
# ============================================

@app.get("/")
def home():
    return {"message": "AI Data Cleaning Agent is Running"}

@app.get("/download/{file_id}")
async def download_file(file_id: str):
    """Serve cleaned file from memory using file_id."""
    if file_id not in downloaded_files:
        raise HTTPException(status_code=404, detail="File not found or expired")
    return Response(
        content=downloaded_files[file_id],
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=cleaned_data.csv"}
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

        # حفظ الملف في الذاكرة بدلاً من القرص
        csv_bytes = save_output_to_bytes(cleaned_df)
        file_id = str(uuid.uuid4())
        downloaded_files[file_id] = csv_bytes

        execution_time = time.time() - start_time
        report = generate_report(before, after, cleaning_report, execution_time)

        # إضافة رابط التحميل الجديد
        report["download_url"] = f"/download/{file_id}"
        report["cleaned_file_name"] = "cleaned_data.csv"

        return JSONResponse(content=report)

    except Exception as error:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(error))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)