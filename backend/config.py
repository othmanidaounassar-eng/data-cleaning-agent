import os

# استخدام مسار مطلق ثابت لضمان التطابق في بيئة Railway
UPLOAD_FOLDER = "/app/uploads"
OUTPUT_FOLDER = "/app/outputs"
REPORT_FOLDER = "/app/reports"

# إنشاء المجلدات تلقائياً
for folder in [UPLOAD_FOLDER, OUTPUT_FOLDER, REPORT_FOLDER]:
    os.makedirs(folder, exist_ok=True)

ALLOWED_EXTENSIONS = [".csv", ".xlsx", ".xls", ".json", ".parquet"]