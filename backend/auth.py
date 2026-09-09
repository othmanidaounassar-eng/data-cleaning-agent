"""JWT authentication for the OQZARO backend.

Passwords are hashed with bcrypt; tokens are unsigned JWT (HS256) carrying the
user id and token version for server-side invalidation. The `get_current_user`
dependency reads the `Authorization: Bearer` header and returns the
authenticated user dict, raising 401 otherwise.
"""

import logging
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt
from fastapi import HTTPException, Request, status

from config import JWT_ALGORITHM, JWT_EXPIRE_MINUTES, SECRET_KEY
import db

logger = logging.getLogger(__name__)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(user_id: int, token_version: int = 0) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expire, "token_version": token_version}
    return jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_token(token: str):
    """Return the (user_id, token_version) tuple if the token is valid, else None."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return int(payload["sub"]), int(payload.get("token_version", 0))
    except (JWTError, KeyError, ValueError, TypeError):
        return None


def _extract_token(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.lower().startswith("bearer "):
        return None
    token = auth[7:].strip()
    return token or None


def get_current_user(request: Request) -> dict:
    """FastAPI dependency -> authenticated user dict (or 401)."""
    token = _extract_token(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Please log in.",
        )
    decoded = decode_token(token)
    if decoded is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token. Please log in again.",
        )
    user_id, token_version = decoded
    user = db.get_user_by_id(user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists.",
        )
    if int(user.get("token_version", 0)) != token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been invalidated. Please log in again.",
        )
    return user


def invalidate_user_tokens(user_id: int) -> None:
    """Increment token_version to invalidate all existing JWTs for this user."""
    db.increment_token_version(user_id)
