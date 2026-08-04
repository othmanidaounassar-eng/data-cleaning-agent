import os
import shutil
import time
import traceback

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

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

@app.options("/clean")
async def options_clean():
    return JSONResponse(
        content={},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Credentials": "true",
        }
    )

# ============================================
# 2. إعداد CORS (السماح بالاتصال من Frontend)
# ============================================
origins = [
    "https://data-cleaning-agent-woad.vercel.app",  # رابط Vercel (الإنتاج)
    "https://data-cleaning-agent-production.up.railway.app",  # رابط Railway (للاختبار)
    "http://localhost:3000",  # التطوير المحلي
    "http://127.0.0.1:3000",  # التطوير المحلي (بديل)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],     # السماح فقط لهذه العناوين
    allow_credentials=True,     # السماح بإرسال الكوكيز والبيانات الحساسة
    allow_methods=["*"],        # السماح بجميع أنواع الطلبات (GET, POST, PUT, DELETE, ...)
    allow_headers=["*"],        # السماح بجميع الرؤوس (Headers)
)

# ============================================سس
# 3. إنشاء المجلدات إذا لم تكن موجودة
# ============================================
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# ============================================
# 4. مشاركة مجلد الملفات المنظفة (Static Files)
# ============================================
app.mount(
    "/outputs",
    StaticFiles(directory=OUTPUT_FOLDER),
    name="outputs",
)

# ============================================
# 5. نقاط النهاية (Endpoints)
# ============================================

@app.get("/")
def home():
    """نقطة دخول للتحقق من أن الخادم يعمل."""
    return {
        "message": "AI Data Cleaning Agent is Running",
        "status": "healthy",
        "version": "1.0"
    }

@app.post("/clean")
async def clean_dataset(file: UploadFile = File(...)):
    """
    يستقبل ملف CSV أو Excel، ينظفه، ويُعيد تقريراً مفصلاً.
    """
    start_time = time.time()

    try:
        # 1. حفظ الملف المرفوع
        file_path = os.path.join(UPLOAD_FOLDER, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 2. قراءة البيانات
        df = read_data(file_path)

        # 3. تحليل قبل التنظيف
        before = analyze_data(df)

        # 4. تنظيف البيانات
        cleaned_df, cleaning_report = clean_data(df)

        # 5. تحليل بعد التنظيف
        after = analyze_data(cleaned_df)

        # 6. حفظ الملف المنظف
        saved_file = save_output(cleaned_df, OUTPUT_FOLDER)

        # 7. حساب زمن التنفيذ
        execution_time = time.time() - start_time

        # 8. إنشاء التقرير النهائي
        report = generate_report(
            before=before,
            after=after,
            cleaning_report=cleaning_report,
            execution_time=execution_time
        )

        # 9. إضافة معلومات الملف المنظف للتقرير
        filename = os.path.basename(saved_file)
        report["cleaned_file"] = f"/outputs/{filename}"
        report["download_url"] = f"/outputs/{filename}"
        report["cleaned_file_name"] = filename
        report["rows_before"] = before.get("rows", 0)
        report["rows_after"] = after.get("rows", 0)
        report["columns_before"] = before.get("columns", 0)
        report["columns_after"] = after.get("columns", 0)
        report["duplicates_removed"] = cleaning_report.get("duplicates_removed", 0)
        report["missing_values_filled"] = cleaning_report.get("missing_values_filled", 0)

        # 10. إرجاع التقرير كـ JSON
        return JSONResponse(content=report)

    except Exception as error:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error processing file: {str(error)}"
        )

# ============================================
# 6. (اختياري) تشغيل الخادم للتطوير المحلي
# ============================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )