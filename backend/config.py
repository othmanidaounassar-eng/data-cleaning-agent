"""Configuration module for OQZARO DataCleaning Agent."""

import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")

ALLOWED_EXTENSIONS = [".csv", ".xlsx", ".xls"]

# Limits (env-configurable) to support large datasets (1M+ rows) on dedicated hosts.
# MAX_ROWS:       max rows per dataset (default 1,000,000).
# MAX_COLUMNS:    max columns per dataset.
# MAX_FILE_SIZE:  max upload size in MB (default 100 MB).
MAX_ROWS = int(os.getenv("MAX_ROWS", "1000000"))
MAX_COLUMNS = int(os.getenv("MAX_COLUMNS", "500"))
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE_MB", "100")) * 1024 * 1024

# CORS: restrict to explicit origins via env var. Defaults to local dev + Vercel production.
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,https://data-claening-agent-ai-version2.vercel.app",
).split(",")

# Database URL (optional)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")
