# SPDX-License-Identifier: MIT
"""Authentication + per-user conversation routes (FastAPI router)."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address

import auth
import db
from config import (
    MIN_PASSWORD_LEN,
    MIN_USERNAME_LEN,
    RATE_LIMIT_LOGIN,
    RATE_LIMIT_MISC,
    RATE_LIMIT_REGISTER,
)

router = APIRouter()


def _client_key(request: Request) -> str:
    """Rate-limit key: the originating client IP.

    Behind the Vercel -> Fly proxy the direct TCP peer is a Vercel function
    egress IP shared by every user, so keying on get_remote_address() would
    treat all traffic as one actor and lock legitimate users out after a few
    logins. Prefer the first X-Forwarded-For hop (set by the trusted proxy);
    fall back to the direct peer for requests that bypass it.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    return get_remote_address(request)


# Single shared limiter. main.py sets app.state.limiter to this instance so
# the SlowAPIMiddleware enforces the per-route limits below (auth endpoints
# are throttled tightly to slow brute force / account spamming).
limiter = Limiter(
    key_func=_client_key,
    default_limits=[RATE_LIMIT_MISC],
    storage_uri="memory://",
)


async def _read_json_body(request: Request):
    try:
        return await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body.")


def _clean_username(raw):
    username = str(raw or "").strip()
    if not (MIN_USERNAME_LEN <= len(username) <= 64):
        raise HTTPException(
            status_code=400,
            detail=f"Username must be {MIN_USERNAME_LEN}-64 characters.",
        )
    if not all(c.isalnum() or c in "._-" for c in username):
        raise HTTPException(
            status_code=400,
            detail="Username may only contain letters, numbers, dots, dashes or underscores.",
        )
    return username


def _validate_password(raw):
    value = str(raw or "")
    if len(value) < MIN_PASSWORD_LEN:
        raise HTTPException(
            status_code=400,
            detail=f"Password must be at least {MIN_PASSWORD_LEN} characters.",
        )
    return value


def _issue(user_id, username):
    user = db.get_user_by_id(user_id)
    token_version = user["token_version"] if user else 0
    token = auth.create_access_token(user_id, token_version)
    return {"token": token, "user": {"id": user_id, "username": username}}


@router.post("/auth/register", status_code=status.HTTP_201_CREATED)
@limiter.limit(RATE_LIMIT_REGISTER, error_message="Too many registration attempts. Try again later.")
async def register(request: Request):
    payload = await _read_json_body(request)
    username = _clean_username(payload.get("username"))
    password = _validate_password(payload.get("password"))
    if db.username_exists(username):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That username is already taken.",
        )
    user_id = db.create_user(username, auth.hash_password(password))
    return _issue(user_id, username)


@router.post("/auth/login", status_code=status.HTTP_200_OK)
@limiter.limit(RATE_LIMIT_LOGIN, error_message="Too many login attempts. Try again later.")
async def login(request: Request):
    payload = await _read_json_body(request)
    username = str(payload.get("username") or "").strip()
    password = str(payload.get("password") or "")
    user = db.get_user_by_username(username)
    if user is None or not auth.verify_password(password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
        )
    return _issue(user["id"], user["username"])


@router.post("/auth/logout", status_code=status.HTTP_200_OK)
@limiter.limit(RATE_LIMIT_MISC, error_message="Too many logout attempts. Try again later.")
async def logout(request: Request, user: dict = Depends(auth.get_current_user)):
    auth.invalidate_user_tokens(user["id"])
    return {"ok": True}


@router.get("/auth/me", status_code=status.HTTP_200_OK)
async def me(user: dict = Depends(auth.get_current_user)):
    return {"user": {"id": user["id"], "username": user["username"]}}


@router.get("/chat/sessions", status_code=status.HTTP_200_OK)
async def list_sessions(user: dict = Depends(auth.get_current_user)):
    return {"sessions": db.list_sessions(user["id"])}


@router.post("/chat/sessions", status_code=status.HTTP_201_CREATED)
async def create_conversation(request: Request, user: dict = Depends(auth.get_current_user)):
    payload = await _read_json_body(request)
    title = str(payload.get("title") or "New conversation").strip()[:120] or "New conversation"
    sid = db.create_session(user["id"], title)
    return {"session": db.get_session(user["id"], sid)}


@router.get("/chat/sessions/{session_id}", status_code=status.HTTP_200_OK)
async def get_conversation(session_id: str, user: dict = Depends(auth.get_current_user)):
    session = db.get_session(user["id"], session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    messages = db.list_messages(user["id"], session_id)
    return {"session": session, "messages": messages}


@router.patch("/chat/sessions/{session_id}", status_code=status.HTTP_200_OK)
async def rename_conversation(
    session_id: str,
    request: Request,
    user: dict = Depends(auth.get_current_user),
):
    payload = await _read_json_body(request)
    title = str(payload.get("title") or "").strip()[:120]
    if not title:
        raise HTTPException(status_code=400, detail="Title is required.")
    if not db.rename_session(user["id"], session_id, title):
        raise HTTPException(status_code=404, detail="Conversation not found.")
    session = db.get_session(user["id"], session_id)
    return {"session": session}


@router.delete("/chat/sessions/{session_id}", status_code=status.HTTP_200_OK)
async def delete_conversation(session_id: str, user: dict = Depends(auth.get_current_user)):
    if not db.delete_session(user["id"], session_id):
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return {"ok": True}
