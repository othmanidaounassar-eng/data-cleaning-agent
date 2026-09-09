"""Shared pytest fixtures for the OQZARO backend test-suite.

Relaxes rate limits and stubs out all GROQ calls so the suite runs fully
offline and deterministically.
"""

import os
import pathlib
import tempfile

# Must be set BEFORE importing main/config so limits are relaxed and the
# upload output folder is isolated from any real data.
os.environ.setdefault("RATE_LIMIT_CLEAN", "100000/hour")
os.environ.setdefault("RATE_LIMIT_ANALYZE", "100000/hour")
os.environ.setdefault("RATE_LIMIT_CHAT", "100000/hour")
os.environ.setdefault("RATE_LIMIT_MISC", "100000/hour")
os.environ.setdefault("RATE_LIMIT_LOGIN", "100000/hour")
os.environ.setdefault("RATE_LIMIT_REGISTER", "100000/hour")
# Use a throwaway DB for the whole test session (kept per-test by fixture).
_TMP_DB = os.path.join(tempfile.mkdtemp(), "test_oqzaro.db")
os.environ.setdefault("OQZARO_DB_PATH", _TMP_DB)

import sys  # noqa: E402

import pytest  # noqa: E402

BACKEND_DIR = pathlib.Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pandas as pd  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import cleaner  # noqa: E402
import main  # noqa: E402
import report  # noqa: E402
import db as dbmodule  # noqa: E402
import ai as aimodule  # noqa: E402


@pytest.fixture(autouse=True)
def offline_ai(monkeypatch):
    """Never touch the network during tests."""
    monkeypatch.setattr(cleaner, "enrich_reasons", lambda operations: None)
    monkeypatch.setattr(main, "plan_recommendations", lambda ctx: ({}, []))
    monkeypatch.setattr(main, "explain_dataset", aimodule._build_fallback_explanation)
    monkeypatch.setattr(main, "dataset_context", aimodule._fallback_dataset_context)
    monkeypatch.setattr(
        report,
        "explain_cleaning_with_log",
        lambda *args, **kwargs: "Offline AI explanation.",
    )


@pytest.fixture(autouse=True)
def isolated_db(tmp_path):
    """Give each test a fresh, empty database."""
    dbmodule.configure(str(tmp_path / "test.db"))


@pytest.fixture()
def isolated_store(monkeypatch, tmp_path):
    """Redirect the history/download store to a throwaway folder."""
    uploads = tmp_path / "uploads"
    uploads.mkdir()
    monkeypatch.setattr(main, "UPLOAD_FOLDER", str(uploads))
    monkeypatch.setattr(main, "_STORE_PATH", str(uploads / "_store.json"))


@pytest.fixture()
def client(isolated_store):
    with TestClient(main.app) as c:
        yield c


@pytest.fixture()
def sample_csv(tmp_path):
    """A small CSV that triggers duplicates, missing values and a mixed col."""
    df = pd.DataFrame(
        {
            "id": [1, 2, 2, 3, 4],
            "name": ["Alice", "Bob", "Bob", None, "Eve"],
            "age": [25, 30, 30, 35, "40"],
            "salary": [5000, 7000, 7000, 8000, 9000],
        }
    )
    path = tmp_path / "sample.csv"
    df.to_csv(path, index=False)
    return path


def upload_csv(client, path, plan=None, name=None):
    """POST /clean (aliased by /upload) with an optional plan."""
    if name is None:
        name = pathlib.Path(path).name
    files = {"file": (name, open(path, "rb").read(), "text/csv")}
    data = None
    if plan is not None:
        import json

        data = {"plan": json.dumps(plan)}
    return client.post("/clean", files=files, data=data)


@pytest.fixture()
def auth_headers(client):
    """Register a throwaway user and return Authorization headers."""
    r = client.post(
        "/auth/register",
        json={"username": "endpoint_user", "password": "s3curePass123"},
    )
    assert r.status_code == 201, r.text
    token = r.json()["token"]
    return {"Authorization": f"Bearer {token}"}
