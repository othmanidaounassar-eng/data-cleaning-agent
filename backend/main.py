import os
import shutil
import time
import traceback
import base64
from io import BytesIO
from typing import List, Dict, Any, Optional

import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from config import UPLOAD_FOLDER, OUTPUT_FOLDER, CORS_ORIGINS, ALLOWED_EXTENSIONS
from reader import read_data
from analyzer import analyze_data
from cleaner import clean_data
from report import generate_report
from exporter import save_output

# ============================================
# 1. إنشاء تطبيق FastAPI
# ============================================
app = FastAPI(
    title="OQZARO DataCleaning Agent",
    version="1.0",
    description="Clean and analyze CSV/Excel files, with JSON API for automation.",
)

# ============================================
# 2. CORS (مقيد بالنطاقات المسموح بها)
# ============================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,  # تأكد من أن CORS_ORIGINS في config.py يحتوي على رابط Vercel
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# 3. إنشاء مجلدات التحميل
# ============================================
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# ============================================
# 4. دالة مساعدة: تحويل DataFrame إلى Base64
# ============================================
def dataframe_to_base64(df: pd.DataFrame) -> str:
    buffer = BytesIO()
    df.to_csv(buffer, index=False, encoding='utf-8-sig')
    buffer.seek(0)
    return base64.b64encode(buffer.getvalue()).decode('utf-8')

# ============================================
# 5. نقطة تنظيف البيانات (رفع ملف)
# ============================================

@app.post("/clean")
def clean_dataset(file: UploadFile = File(...)):
    start_time = time.time()
    try:
        # التحقق من نوع الملف
        file_extension = os.path.splitext(file.filename)[1].lower()
        if file_extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(400, f"File type not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")

        # الحد الأقصى لحجم الملف (50 ميجابايت)
        MAX_FILE_SIZE = 50 * 1024 * 1024
        file.file.seek(0, 2)
        file_size = file.file.tell()
        file.file.seek(0)
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(413, "File too large. Maximum size is 50 MB.")

        # حفظ الملف المؤقت
        file_path = os.path.join(UPLOAD_FOLDER, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # معالجة البيانات
        df = read_data(file_path)
        before = analyze_data(df)
        cleaned_df, cleaning_report = clean_data(df)
        after = analyze_data(cleaned_df)
        _ = save_output(cleaned_df, OUTPUT_FOLDER, file.filename)

        execution_time = time.time() - start_time
        report = generate_report(before, after, cleaning_report, execution_time)

        # تحويل الملف المنظف إلى Base64 (للتحميل المباشر)
        csv_bytes = dataframe_to_base64(cleaned_df)
        report["download_url"] = f"data:text/csv;base64,{csv_bytes}"
        report["cleaned_file_name"] = f"cleaned_{int(time.time())}.csv"

        return JSONResponse(content=report)
    except Exception as error:
        traceback.print_exc()
        raise HTTPException(500, f"Error: {str(error)}")

# ============================================
# 6. نقطة تنظيف البيانات من JSON (للأتمتة)
# ============================================

class DataPayload(BaseModel):
    data: List[Dict[str, Any]]
    source: Optional[str] = "manual"

@app.post("/clean-json")
def clean_json(payload: DataPayload):
    start_time = time.time()
    try:
        # تحويل القائمة إلى DataFrame
        df = pd.DataFrame(payload.data)
        if df.empty:
            raise HTTPException(400, "No data provided.")

        # تحليل وتنظيف البيانات (نفس منطق /clean)
        before = analyze_data(df)
        cleaned_df, cleaning_report = clean_data(df)
        after = analyze_data(cleaned_df)

        execution_time = time.time() - start_time
        report = generate_report(before, after, cleaning_report, execution_time)

        # إضافة البيانات المنظفة كـ JSON
        return JSONResponse(content={
            "status": "success",
            "report": report,
            "cleaned_data": cleaned_df.to_dict(orient='records'),
            "source": payload.source,
            "execution_time": execution_time
        })
    except Exception as error:
        traceback.print_exc()
        raise HTTPException(500, f"Error: {str(error)}")

# ============================================
# 7. نقطة الصحة (Health Check)
# ============================================

@app.get("/")
def home():
    return {"message": "OQZARO DataCleaning Agent is Running", "status": "healthy"}

# ============================================
# 8. تشغيل الخادم محلياً
# ============================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)