import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
OUTPUT_FOLDER = os.path.join(BASE_DIR, "outputs")
REPORT_FOLDER = os.path.join(BASE_DIR, "reports")

for folder in [UPLOAD_FOLDER, OUTPUT_FOLDER, REPORT_FOLDER]:
    os.makedirs(folder, exist_ok=True)

ALLOWED_EXTENSIONS = [".csv", ".xlsx", ".xls"]

# ============================================
# CORS - السماح بالنطاقات المحددة فقط
# ============================================
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS", "https://data-cleaning-agent-woad.vercel.app"
).split(",")

# ============================================
# قاعدة البيانات (اختياري، استخدمه إن أردت)
# ============================================
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")