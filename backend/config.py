import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
OUTPUT_FOLDER = os.path.join(BASE_DIR, "outputs")
REPORT_FOLDER = os.path.join(BASE_DIR, "reports")

for folder in [UPLOAD_FOLDER, OUTPUT_FOLDER, REPORT_FOLDER]:
    os.makedirs(folder, exist_ok=True)

ALLOWED_EXTENSIONS = [".csv", ".xlsx", ".xls"]

# ============================================
# CORS - يُفضل ضبطه عبر متغير البيئة CORS_ORIGINS
# ============================================
# ✅ القيمة الاحتياطية "*" تسمح لأي نطاق مؤقتاً (آمن للتجربة)
# ✅ في الإنتاج، اضبط CORS_ORIGINS في Railway Variables
_raw_origins = os.getenv("CORS_ORIGINS", "*")

# تنظيف القائمة (إزالة المسافات والشرطات المائلة الزائدة)
CORS_ORIGINS = [origin.strip().rstrip("/") for origin in _raw_origins.split(",") if origin.strip()]

# ============================================
# قاعدة البيانات (اختياري)
# ============================================
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")
