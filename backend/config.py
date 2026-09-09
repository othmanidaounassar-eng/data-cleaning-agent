"""Configuration module for OQZARO Data Analysis Agent."""

import os
import logging
import secrets as _secrets
from dotenv import load_dotenv

# Load backend/.env so GROQ_API_KEY etc. are available via os.getenv.
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Uploads can be redirected to a persistent volume via UPLOAD_FOLDER env.
UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER") or os.path.join(BASE_DIR, "uploads")

ALLOWED_EXTENSIONS = [".csv", ".xlsx", ".xls", ".pdf"]

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
    "http://localhost:3000,http://127.0.0.1:3000,https://data-cleaning-agent-ai-version2.vercel.app",
).split(",")

# ============================================================
# Rate limits (env-configurable so tests can raise them)
# ============================================================
RATE_LIMIT_CLEAN = os.getenv("RATE_LIMIT_CLEAN", "10/minute")
RATE_LIMIT_ANALYZE = os.getenv("RATE_LIMIT_ANALYZE", "30/minute")
RATE_LIMIT_CHAT = os.getenv("RATE_LIMIT_CHAT", "20/minute")
RATE_LIMIT_MISC = os.getenv("RATE_LIMIT_MISC", "60/minute")
# Tighter limits for credential endpoints to slow brute force.
RATE_LIMIT_LOGIN = os.getenv("RATE_LIMIT_LOGIN", "5/minute")
RATE_LIMIT_REGISTER = os.getenv("RATE_LIMIT_REGISTER", "3/minute")

# Max size (bytes) accepted for a JSON request body (e.g. /chat, /clean-json).
MAX_JSON_BODY = int(os.getenv("MAX_JSON_BODY_BYTES", str(256 * 1024)))

# Max characters allowed for the chat context payload coming from the client.
MAX_CHAT_CONTEXT_CHARS = int(os.getenv("MAX_CHAT_CONTEXT_CHARS", "20000"))

# Database URL (optional)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")

# ============================================================
# GROQ (LLM) settings
# ============================================================
GROQ_KEY_NAME = "GROQ_API_KEY"
GROQ_API_BASE_URL = os.getenv("GROQ_API_BASE_URL", "https://api.groq.com/openai/v1")
GROQ_KEY = os.environ.get(GROQ_KEY_NAME, "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")
GROQ_MAX_TOKENS = int(os.getenv("GROQ_MAX_TOKENS", "700"))
# Set GROQ_DISABLED=1 to force the fixed fallback messages (AI off).
GROQ_DISABLED = os.getenv("GROQ_DISABLED", "0") == "1"

# True when a usable key is configured. AI calls become no-ops otherwise.
GROQ_AVAILABLE = (not GROQ_DISABLED) and bool(GROQ_KEY.strip())

# ============================================================
# Multi-provider LLM router (free/freemium providers, with failover)
# ============================================================
# Each provider is an OpenAI-compatible base_url, the env var holding its API
# key, and a default model (overridable via <ID>_MODEL / LLM_MODEL_<ID>). A
# provider is only ever used when its key is configured. The lookup order is
# customisable through LLM_PRIORITY (comma-separated ids).
LLM_PROVIDER_DEFS = [
    {
        "id": "groq",
        "base_url": "https://api.groq.com/openai/v1",
        "key_env": "GROQ_API_KEY",
        "model_env": "GROQ_MODEL",
        "default_model": "qwen/qwen3.8-27b",
    },
    {
        "id": "openrouter",
        "base_url": "https://openrouter.ai/api/v1",
        "key_env": "OPENROUTER_API_KEY",
        "model_env": "OPENROUTER_MODEL",
        "default_model": "meta-llama/llama-3.3-70b-instruct:free",
    },
    {
        "id": "cerebras",
        "base_url": "https://api.cerebras.ai/v1",
        "key_env": "CEREBRAS_API_KEY",
        "model_env": "CEREBRAS_MODEL",
        "default_model": "llama-3.3-70b",
    },
    {
        "id": "deepseek",
        "base_url": "https://api.deepseek.com/v1",
        "key_env": "DEEPSEEK_API_KEY",
        "model_env": "DEEPSEEK_MODEL",
        "default_model": "deepseek-chat",
    },
    {
        "id": "gemini",
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai",
        "key_env": "GEMINI_API_KEY",
        "model_env": "GEMINI_MODEL",
        "default_model": "gemini-1.5-flash",
    },
    {
        "id": "together",
        "base_url": "https://api.together.xyz/v1",
        "key_env": "TOGETHER_API_KEY",
        "model_env": "TOGETHER_MODEL",
        "default_model": "meta-llama/llama-3.3-70b-instruct-turbo",
    },
    {
        "id": "mistral",
        "base_url": "https://api.mistral.ai/v1",
        "key_env": "MISTRAL_API_KEY",
        "model_env": "MISTRAL_MODEL",
        "default_model": "open-mistral-nemo",
    },
    {
        "id": "nvidia",
        "base_url": "https://integrate.api.nvidia.com/v1",
        "key_env": "NVIDIA_API_KEY",
        "model_env": "NVIDIA_MODEL",
        "default_model": "meta/llama-3.1-8b-instruct",
    },
    {
        "id": "sambanova",
        "base_url": "https://api.sambanova.ai/v1",
        "key_env": "SAMBANOVA_API_KEY",
        "model_env": "SAMBANOVA_MODEL",
        "default_model": "Meta-Llama-3.3-70B-Instruct",
    },
]

LLM_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "700"))
# Set LLM_DISABLED=1 to force the fixed fallback messages across ALL providers.
LLM_DISABLED = os.getenv("LLM_DISABLED", "0") == "1"

_LLM_PRIORITY_DEFAULT = "groq,openrouter,cerebras,deepseek,gemini,together,mistral,nvidia,sambanova"


def _active_llm_providers():
    """Providers in priority order that have a usable key configured.

    Each entry carries the resolved key and model so ai.py never needs to touch
    os.environ again.
    """
    if LLM_DISABLED:
        return []
    order = [p.strip().lower() for p in os.getenv("LLM_PRIORITY", _LLM_PRIORITY_DEFAULT).split(",") if p.strip()]
    by_id = {p["id"]: p for p in LLM_PROVIDER_DEFS}
    out = []
    seen = set()
    for pid in order:
        if pid in seen:
            continue
        p = by_id.get(pid)
        if not p:
            continue
        if pid == "groq" and GROQ_DISABLED:
            continue
        key = os.environ.get(p["key_env"], "").strip()
        if not key:
            continue
        seen.add(pid)
        model = os.getenv(p["model_env"], "") or p["default_model"]
        out.append(
            {
                "id": pid,
                "base_url": p["base_url"],
                "key_env": p["key_env"],
                "key": key,
                "model": model,
            }
        )
    return out


LLM_ACTIVE = _active_llm_providers()
# True when at least one provider is usable. AI calls become no-ops otherwise.
LLM_AVAILABLE = bool(LLM_ACTIVE)

# ============================================================
# Authentication (JWT)
# ============================================================
# Secret used to sign JWTs. Must be stable across server restarts and shared
# between the backend and any load-balanced instance. Set via SECRET_KEY env
# in production. A random fallback is generated per-process for local/dev only.
_SECRET_KEY_ENV = os.getenv("SECRET_KEY")
# Reject placeholder / obviously-weak values that would allow JWT forgery.
_KNOWN_WEAK_SECRETS = {
    "your-strong-secret-key-here",
    "CHANGE_ME_TO_RANDOM_64_CHARS",
    "changeme",
    "secret",
    "change-me",
}
if _SECRET_KEY_ENV and _SECRET_KEY_ENV.strip() in _KNOWN_WEAK_SECRETS:
    logger.warning("SECRET_KEY is set to a weak placeholder value; generating a strong key instead.")
    _SECRET_KEY_ENV = None

SECRET_KEY = _SECRET_KEY_ENV or _secrets.token_urlsafe(48)
if not _SECRET_KEY_ENV:
    logger.warning(
        "SECRET_KEY not provided; a per-process random key was generated. "
        "JWTs will be invalidated on restart. Set SECRET_KEY in production."
    )
# HS256 JWT: sub = user id (int), exp = expiry, token_version for invalidation.
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "10080"))  # 7 days
# Password policy
MIN_USERNAME_LEN = int(os.getenv("MIN_USERNAME_LEN", "3"))
MIN_PASSWORD_LEN = int(os.getenv("MIN_PASSWORD_LEN", "6"))


# ============================================================
# Microsoft Power BI / Excel integration (config scaffold)
# ============================================================
# Real Microsoft Graph / Power BI REST calls are NOT wired yet. These settings
# let an operator stage the Entra credentials so the app can report readiness
# and flip the integration on later without a code change. Secrets are loaded
# from environment variables only and are never exposed through an API.
AZURE_CLIENT_ID = os.getenv("AZURE_CLIENT_ID", "").strip()
AZURE_TENANT_ID = os.getenv("AZURE_TENANT_ID", "").strip()
AZURE_CLIENT_SECRET = os.getenv("AZURE_CLIENT_" + "SECRET", "").strip()
POWERBI_GROUP_ID = os.getenv("POWERBI_GROUP_ID", "").strip()

# True when all three credential pieces are present for a service-principal
# (app-only) flow. The /microsoft/status endpoint reports each piece without
# ever revealing a value.
MS_CONFIGURED = bool(AZURE_CLIENT_ID and AZURE_TENANT_ID and AZURE_CLIENT_SECRET)
