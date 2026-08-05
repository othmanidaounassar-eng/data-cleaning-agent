import time
import base64
import pandas as pd
from io import BytesIO
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from config import OUTPUT_FOLDER
from exporter import save_output
from analyzer import analyze_data
from cleaner import clean_data
from report import generate_report

# ============================================
# 1. إنشاء التطبيق مع CORS محسّن
# ============================================
app = FastAPI(title="AI Data Cleaning Agent", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://data-cleaning-agent-woad.vercel.app",
        "https://data-cleaning-agent-production.up.railway.app",
        "http://localhost:3000",  # للتطوير المحلي
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# 2. دوال مساعدة
# ============================================

def dataframe_to_base64(df: pd.DataFrame) -> str:
    """تحويل DataFrame إلى CSV مشفر بـ Base64."""
    buffer = BytesIO()
    df.to_csv(buffer, index=False, encoding='utf-8-sig')
    buffer.seek(0)
    return base64.b64encode(buffer.getvalue()).decode('utf-8')

# ============================================
# 3. نقطة التنظيف الرئيسية
# ============================================

@app.post("/clean")
async def clean_dataset(file: UploadFile = File(...)):
    start_time = time.time()
    try:
        # قراءة الملف (مع دعم ترميزات مختلفة)
        raw = await file.read()
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError:
            text = raw.decode("latin-1")
        df = pd.read_csv(BytesIO(text.encode("utf-8")))

        # تحليل البيانات قبل التنظيف
        before = analyze_data(df)

        # تنظيف البيانات (يُعيد DataFrame + تقرير التنظيف)
        cleaned_df, cleaning_report = clean_data(df)

        # تحليل البيانات بعد التنظيف
        after = analyze_data(cleaned_df)

        # حساب وقت التنفيذ
        execution_time = time.time() - start_time

        # إنشاء التقرير النهائي (يحتوي على جميع الإحصائيات)
        report = generate_report(before, after, cleaning_report, execution_time)

        # تحويل الملف المنظف إلى Base64 للتحميل المباشر
        encoded_csv = dataframe_to_base64(cleaned_df)
        report["download_url"] = f"data:text/csv;base64,{encoded_csv}"
        report["cleaned_file_name"] = f"cleaned_{int(time.time())}.csv"

        # (اختياري) حفظ الملف على القرص – ليس ضروريًا للتحميل
        # save_output(cleaned_df, OUTPUT_FOLDER, file.filename)

        return JSONResponse(content=report)

    except Exception as error:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(error)}")

# ============================================
# 4. نقطة صحية (Health Check)
# ============================================

@app.get("/")
def home():
    return {"message": "AI Data Cleaning Agent is Running", "status": "healthy"}

# ============================================
# 5. تشغيل الخادم محلياً (اختياري)
# ============================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)