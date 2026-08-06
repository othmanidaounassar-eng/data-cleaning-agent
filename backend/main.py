import os
import shutil
import time
import traceback
import base64
from io import BytesIO
from urllib.parse import quote, unquote

import pandas as pd

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, Response

# استيراد الدوال من ملفات المشروع
from config import UPLOAD_FOLDER, OUTPUT_FOLDER
from reader import read_data
from analyzer import analyze_data
from cleaner import clean_data
from report import generate_report
from exporter import save_output

# ============================================
# 1. إنشاء تطبيق FastAPI
# ============================================
app = FastAPI(
    title="AI Data Cleaning Agent",
    version="1.0",
    description="API for cleaning and analyzing CSV/Excel files.",
)

# ============================================
# 2. إعدادات CORS
# ============================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://data-cleaning-agent-woad.vercel.app",
        "https://data-cleaning-agent-production.up.railway.app",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# 3. إنشاء المجلدات
# ============================================
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# ============================================
# 4. دالة تحويل DataFrame إلى Base64
# ============================================
def dataframe_to_base64(df: pd.DataFrame) -> str:
    """Convert DataFrame to base64 encoded CSV."""
    buffer = BytesIO()
    df.to_csv(buffer, index=False, encoding='utf-8-sig')
    buffer.seek(0)
    return base64.b64encode(buffer.getvalue()).decode('utf-8')

# ============================================
# 5. نقاط النهاية (Endpoints)
# ============================================

@app.get("/")
def home():
    """Health check endpoint."""
    return {
        "message": "AI Data Cleaning Agent is Running",
        "status": "healthy",
        "version": "1.0"
    }

@app.post("/clean")
async def clean_dataset(file: UploadFile = File(...)):
    """
    Clean uploaded CSV or Excel file and return report with download link.
    """
    start_time = time.time()
    try:
        # حفظ الملف المؤقت
        file_path = os.path.join(UPLOAD_FOLDER, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # قراءة الملف (يدعم CSV و Excel)
        df = read_data(file_path)

        # تحليل قبل التنظيف
        before = analyze_data(df)

        # تنظيف البيانات
        cleaned_df, cleaning_report = clean_data(df)

        # تحليل بعد التنظيف
        after = analyze_data(cleaned_df)

        # حساب وقت التنفيذ
        execution_time = time.time() - start_time

        # إنشاء التقرير
        report = generate_report(before, after, cleaning_report, execution_time)

        # إضافة رابط التحميل (Base64)
        encoded_csv = dataframe_to_base64(cleaned_df)
        report["download_url"] = f"data:text/csv;base64,{encoded_csv}"
        report["cleaned_file_name"] = f"cleaned_{int(time.time())}.csv"

        return JSONResponse(content=report)

    except Exception as error:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(error)}")

# ============================================
# 6. تشغيل الخادم محلياً
# ============================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )