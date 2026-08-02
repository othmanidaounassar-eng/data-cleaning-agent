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


app = FastAPI(
    title="AI Data Cleaning Agent",
    version="1.0"
)

# السماح للواجهة الأمامية بالاتصال
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# مشاركة مجلد الملفات المنظفة
app.mount(
    "/outputs",
    StaticFiles(directory=OUTPUT_FOLDER),
    name="outputs"
)


@app.get("/")
def home():
    return {
        "message": "AI Data Cleaning Agent is Running"
    }


@app.post("/clean")
async def clean_dataset(file: UploadFile = File(...)):

    start_time = time.time()

    try:

        # إنشاء المجلد إذا لم يكن موجوداً
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        os.makedirs(OUTPUT_FOLDER, exist_ok=True)

        # حفظ الملف المرفوع
        file_path = os.path.join(
            UPLOAD_FOLDER,
            file.filename
        )

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # قراءة البيانات
        df = read_data(file_path)

        # تحليل قبل التنظيف
        before = analyze_data(df)

        # تنظيف البيانات
        cleaned_df, cleaning_report = clean_data(df)

        # تحليل بعد التنظيف
        after = analyze_data(cleaned_df)

        # حفظ الملف المنظف
        saved_file = save_output(
            cleaned_df,
            OUTPUT_FOLDER
        )

        # زمن التنفيذ
        execution_time = time.time() - start_time

        # إنشاء التقرير
        report = generate_report(
            before,
            after,
            cleaning_report,
            execution_time
        )

        # اسم الملف فقط
        filename = os.path.basename(saved_file)

        # البيانات التي يحتاجها الـ Frontend
        report["cleaned_file"] = f"/outputs/{filename}"
        report["download_url"] = f"/outputs/{filename}"
        report["cleaned_file_name"] = filename

        return JSONResponse(
            content=report
        )

    except Exception as error:

        traceback.print_exc()

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )
    