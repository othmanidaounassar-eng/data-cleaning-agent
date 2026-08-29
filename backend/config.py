"""Configuration module for OQZARO DataCleaning Agent."""

import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")

ALLOWED_EXTENSIONS = [".csv", ".xlsx", ".xls"]
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

# CORS: restrict to explicit origins via env var. Defaults to local dev origins only.
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
).split(",")

# Database URL (optional)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")
