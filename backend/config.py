import os

# المجلدات
# في بيئة Railway، المسار المطلق هو /app
# نستخدم مساراً مطلقاً لضمان التطابق
UPLOAD_FOLDER = "/app/uploads"
OUTPUT_FOLDER = "/app/outputs"
REPORT_FOLDER = "/app/reports"

# إنشاء المجلدات تلقائياً
for folder in [UPLOAD_FOLDER, OUTPUT_FOLDER, REPORT_FOLDER]:
    os.makedirs(folder, exist_ok=True)

# أنواع الملفات المسموح بها
ALLOWED_EXTENSIONS = [
    ".csv",
    ".xlsx",
    ".xls",
    ".json",
    ".parquet"
]