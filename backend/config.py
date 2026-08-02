import os

# المجلدات
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
OUTPUT_FOLDER = os.path.join(BASE_DIR, "outputs")
REPORT_FOLDER = os.path.join(BASE_DIR, "reports")

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



