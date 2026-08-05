import time

import pandas as pd
from io import BytesIO

from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from config import OUTPUT_FOLDER
from exporter import save_output, dataframe_to_base64

app = FastAPI()

# ضروري إذا كان الفرونت (Vercel) على دومين مختلف عن الباك (Railway)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def read_csv(uploaded: bytes) -> pd.DataFrame:
    """قراءة الملف المرفوع مع كشف الترميز (UTF-8 ثم fallback)."""
    try:
        text = uploaded.decode("utf-8")
    except UnicodeDecodeError:
        text = uploaded.decode("latin-1")
    return pd.read_csv(BytesIO(text.encode("utf-8")))


def clean_logic(df: pd.DataFrame) -> pd.DataFrame:
    """مثال بسيط للتنظيف — استبدله بمنطق التنظيف الحقيقي لديك."""
    df = df.copy()
    for col in df.select_dtypes(include=["object"]).columns:
        df[col] = df[col].astype(str).str.strip()
    df = df.replace("", pd.NA).dropna(how="all")   # إزالة الصفوف الفارغة كلياً
    df = df.drop_duplicates().reset_index(drop=True)
    return df


@app.post("/clean")
async def clean_dataset(file: UploadFile = File(...)):
    raw = await file.read()
    df = read_csv(raw)

    cleaned_df = clean_logic(df)

    # حفظ اختياري على القرص (لا يُستخدم في التحميل إطلاقاً)
    save_output(cleaned_df, OUTPUT_FOLDER, file.filename)

    report = {
        "status": "success",
        "original_filename": file.filename,
        "rows_before": int(len(df)),
        "rows_after": int(len(cleaned_df)),
        "rows_removed": int(len(df) - len(cleaned_df)),
    }

    # الحل الجذري: الملف كامل داخل جسم الاستجابة — لا 404 ممكن
    return JSONResponse(content={
        "report": report,
        "download": {
            "filename": f"cleaned_{int(time.time())}.csv",
            "media_type": "text/csv",
            "content": dataframe_to_base64(cleaned_df),
        },
    })