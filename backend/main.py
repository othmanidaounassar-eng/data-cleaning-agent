import os
import shutil
import time
import traceback
import base64
from io import BytesIO
import pandas as pd

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import UPLOAD_FOLDER, OUTPUT_FOLDER
from reader import read_data
from analyzer import analyze_data
from cleaner import clean_data
from report import generate_report
from exporter import save_output

app = FastAPI(
    title="AI Data Cleaning Agent",
    version="1.0",
    description="API for cleaning and analyzing CSV/Excel files.",
)

# ============================================
# CORS - السماح للواجهة الأمامية بالاتصال
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
# إنشاء المجلدات
# ============================================
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# ============================================
# دالة تحويل DataFrame إلى Base64
# ============================================
def dataframe_to_base64(df: pd.DataFrame) -> str:
    """Convert DataFrame to base64 encoded CSV."""
    buffer = BytesIO()
    df.to_csv(buffer, index=False, encoding='utf-8-sig')
    buffer.seek(0)
    return base64.b64encode(buffer.getvalue()).decode('utf-8')

# ============================================
# نقاط النهاية (Endpoints)
# ============================================

@app.get("/")
def home():
    return {
        "message": "AI Data Cleaning Agent is Running",
        "status": "healthy",
        "version": "1.0"
    }

@app.post("/clean")
async def clean_dataset(file: UploadFile = File(...)):
    start_time = time.time()
    try:
        # حفظ الملف المؤقت
        file_path = os.path.join(UPLOAD_FOLDER, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        file_size = os.path.getsize(file_path)
        USE_CHUNKING = file_size > 10 * 1024 * 1024  # 10 ميجابايت

        if USE_CHUNKING:
            # ============================================
            # معالجة الملفات الكبيرة على شكل أجزاء (Chunking)
            # ============================================
            chunk_size = 10000
            cleaned_chunks = []
            cleaning_reports = []
            total_rows = 0

            for chunk in pd.read_csv(file_path, chunksize=chunk_size, encoding='utf-8', on_bad_lines='skip'):
                cleaned_chunk, chunk_report = clean_data(chunk)
                cleaned_chunks.append(cleaned_chunk)
                cleaning_reports.append(chunk_report)
                total_rows += len(chunk)

            cleaned_df = pd.concat(cleaned_chunks, ignore_index=True) if cleaned_chunks else pd.DataFrame()
            before = {}

            # دمج التقارير من جميع الأجزاء
            cleaning_report = {
                "duplicates_removed": sum(r.get("duplicates_removed", 0) for r in cleaning_reports),
                "missing_values_filled": sum(r.get("missing_values_filled", 0) for r in cleaning_reports),
                "outliers_detected": sum(r.get("outliers_detected", 0) for r in cleaning_reports),
                "text_columns_cleaned": list(set().union(*[set(r.get("text_columns_cleaned", [])) for r in cleaning_reports])),
                "operations": [op for r in cleaning_reports for op in r.get("operations", [])],
                "alerts": [alert for r in cleaning_reports for alert in r.get("alerts", [])],
                "sample": cleaned_df.head(5).to_dict(orient='records') if not cleaned_df.empty else [],
                "summary": f"Processed {total_rows} rows in chunks.",
                "recommendations": ["Data quality is acceptable for analysis."],
                "column_conversions": [],
            }
        else:
            # ============================================
            # للملفات الصغيرة: استخدام read_data (يدعم CSV, Excel, JSON)
            # ============================================
            df = read_data(file_path)
            before = analyze_data(df)
            cleaned_df, cleaning_report = clean_data(df)

        # تحليل البيانات بعد التنظيف
        after = analyze_data(cleaned_df)

        # حفظ الملف المنظف
        saved_file = save_output(cleaned_df, OUTPUT_FOLDER, file.filename)
        execution_time = time.time() - start_time

        # إنشاء التقرير النهائي
        report = generate_report(before, after, cleaning_report, execution_time)

        # تحويل الملف المنظف إلى Base64 للتحميل المباشر
        csv_bytes = dataframe_to_base64(cleaned_df)
        report["download_url"] = f"data:text/csv;base64,{csv_bytes}"
        report["cleaned_file_name"] = f"cleaned_{int(time.time())}.csv"

        return JSONResponse(content=report)

    except Exception as error:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(error)}")

# ============================================
# تشغيل الخادم محلياً
# ============================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )