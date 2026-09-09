"""SQLite storage for OQZARO: users + per-user chat conversations.

Every chat query is scoped by user_id so conversations are fully isolated
between authenticated users. A plain Python SQLite connection is used
(via sqlite3, part of the stdlib) with a per-thread connection to keep the
async FastAPI app simple and safe.
"""

import logging
import os
import sqlite3
import threading
import time
import uuid

from config import BASE_DIR

logger = logging.getLogger(__name__)

_DB_PATH = os.getenv("OQZARO_DB_PATH") or os.path.join(BASE_DIR, "oqzaro.db")

_local = threading.local()

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at REAL NOT NULL,
    token_version INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New conversation',
    created_at REAL NOT NULL,
    updated_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_session ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_user ON chat_messages(user_id);

CREATE TABLE IF NOT EXISTS user_files (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    cleaned_file_name TEXT NOT NULL,
    file_bytes BLOB NOT NULL,
    report_json TEXT NOT NULL,
    rows_before INTEGER,
    rows_after INTEGER,
    columns INTEGER,
    quality_score REAL,
    created_at REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_files_user ON user_files(user_id);
"""


def _conn():
    conn = getattr(_local, "conn", None)
    if conn is None:
        conn = sqlite3.connect(_DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        _local.conn = conn
    return conn


def configure(path: str):
    """Point the store at a specific DB file and drop any cached connection.

    Used by tests to isolate each test against a throwaway database.
    """
    global _DB_PATH
    if hasattr(_local, "conn") and getattr(_local, "conn", None) is not None:
        try:
            getattr(_local, "conn").close()
        except Exception:
            pass
        delattr(_local, "conn")
    _DB_PATH = path
    init_db()
    migrate()


def migrate():
    """Ensure schema is up-to-date (adds missing columns for existing DBs)."""
    conn = _conn()
    cols = [r[1] for r in conn.execute("PRAGMA table_info(users)").fetchall()]
    if "token_version" not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0")
        conn.commit()


def init_db():
    conn = _conn()
    conn.executescript(SCHEMA)
    conn.commit()


# ============================================================
# Users
# ============================================================


def create_user(username: str, password_hash: str) -> int:
    created = time.time()
    cur = _conn().execute(
        "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)",
        (username, password_hash, created),
    )
    _conn().commit()
    return cur.lastrowid


def get_user_by_username(username: str):
    row = _conn().execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    return dict(row) if row else None


def get_user_by_id(user_id: int):
    row = _conn().execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return dict(row) if row else None


def username_exists(username: str) -> bool:
    row = _conn().execute("SELECT 1 FROM users WHERE lower(username) = lower(?)", (username,)).fetchone()
    return row is not None


def increment_token_version(user_id: int) -> None:
    _conn().execute(
        "UPDATE users SET token_version = token_version + 1 WHERE id = ?",
        (user_id,),
    )
    _conn().commit()


# ============================================================
# Chat sessions
# ============================================================


def create_session(user_id: int, title: str = "New conversation") -> str:
    sid = uuid.uuid4().hex
    now = time.time()
    _conn().execute(
        "INSERT INTO chat_sessions (id, user_id, title, created_at, updated_at)" " VALUES (?, ?, ?, ?, ?)",
        (sid, user_id, title, now, now),
    )
    _conn().commit()
    return sid


def list_sessions(user_id: int, limit: int = 100):
    rows = (
        _conn()
        .execute(
            "SELECT id, user_id, title, created_at, updated_at FROM chat_sessions"
            " WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?",
            (user_id, limit),
        )
        .fetchall()
    )
    return [dict(r) for r in rows]


def get_session(user_id: int, session_id: str):
    row = (
        _conn()
        .execute(
            "SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?",
            (session_id, user_id),
        )
        .fetchone()
    )
    return dict(row) if row else None


def rename_session(user_id: int, session_id: str, title: str) -> bool:
    cur = _conn().execute(
        "UPDATE chat_sessions SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?",
        (title, time.time(), session_id, user_id),
    )
    _conn().commit()
    return cur.rowcount > 0


def delete_session(user_id: int, session_id: str) -> bool:
    cur = _conn().execute(
        "DELETE FROM chat_sessions WHERE id = ? AND user_id = ?",
        (session_id, user_id),
    )
    _conn().commit()
    return cur.rowcount > 0


def touch_session(user_id: int, session_id: str):
    _conn().execute(
        "UPDATE chat_sessions SET updated_at = ? WHERE id = ? AND user_id = ?",
        (time.time(), session_id, user_id),
    )
    _conn().commit()


# ============================================================
# Chat messages
# ============================================================


def add_message(user_id: int, session_id: str, role: str, content: str) -> dict:
    created = time.time()
    cur = _conn().execute(
        "INSERT INTO chat_messages (session_id, user_id, role, content, created_at)" " VALUES (?, ?, ?, ?, ?)",
        (session_id, user_id, role, content, created),
    )
    _conn().commit()
    return {
        "id": cur.lastrowid,
        "session_id": session_id,
        "role": role,
        "content": content,
        "created_at": created,
    }


def list_messages(user_id: int, session_id: str, limit: int = 200):
    rows = (
        _conn()
        .execute(
            "SELECT id, role, content, created_at FROM chat_messages"
            " WHERE session_id = ? AND user_id = ? ORDER BY id ASC LIMIT ?",
            (session_id, user_id, limit),
        )
        .fetchall()
    )
    return [dict(r) for r in rows]


def clear_session_messages(user_id: int, session_id: str) -> bool:
    cur = _conn().execute(
        "DELETE FROM chat_messages WHERE session_id = ? AND user_id = ?",
        (session_id, user_id),
    )
    _conn().commit()
    return cur.rowcount > 0


# ============================================================
# User files (per-user persisted cleaning files + full reports)
# ============================================================


def save_user_file(
    user_id: int,
    file_id: str,
    file_name: str,
    cleaned_file_name: str,
    file_bytes: bytes,
    report_json: str,
    rows_before,
    rows_after,
    columns,
    quality_score,
) -> None:
    _conn().execute(
        "INSERT INTO user_files"
        " (id, user_id, file_name, cleaned_file_name, file_bytes, report_json,"
        "  rows_before, rows_after, columns, quality_score, created_at)"
        " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            file_id,
            user_id,
            file_name,
            cleaned_file_name,
            file_bytes,
            report_json,
            rows_before,
            rows_after,
            columns,
            quality_score,
            time.time(),
        ),
    )
    _conn().commit()


def list_user_files(user_id: int, limit: int = 500):
    rows = (
        _conn()
        .execute(
            "SELECT id, file_name, cleaned_file_name, rows_before, rows_after,"
            " columns, quality_score, created_at FROM user_files"
            " WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
            (user_id, limit),
        )
        .fetchall()
    )
    return [dict(r) for r in rows]


def get_user_file(user_id: int, file_id: str):
    row = (
        _conn()
        .execute(
            "SELECT * FROM user_files WHERE id = ? AND user_id = ?",
            (file_id, user_id),
        )
        .fetchone()
    )
    return dict(row) if row else None


def delete_user_file(user_id: int, file_id: str) -> bool:
    cur = _conn().execute(
        "DELETE FROM user_files WHERE id = ? AND user_id = ?",
        (file_id, user_id),
    )
    _conn().commit()
    return cur.rowcount > 0
