"""Tests for authentication and per-user chat isolation.

Verifies:
  - register / login / me flow
  - protected endpoints reject unauthenticated requests
  - duplicate usernames rejected
  - weak passwords and bad usernames rejected
  - conversations are stored per user and never shared between users
"""


def _auth(client):
    r = client.post("/auth/register", json={"username": "tester", "password": "passA12345"})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["token"]
    assert body["user"]["username"] == "tester"
    return "Bearer " + body["token"]


def test_register_login_me(client):
    token = _auth(client)
    r = client.get("/auth/me", headers={"Authorization": token})
    assert r.status_code == 200
    assert r.json()["user"]["username"] == "tester"

    # login with correct password
    r = client.post("/auth/login", json={"username": "tester", "password": "passA12345"})
    assert r.status_code == 200
    assert r.json()["token"]

    # login with wrong password
    r = client.post("/auth/login", json={"username": "tester", "password": "wrong"})
    assert r.status_code == 401


def test_duplicate_username(client):
    _auth(client)
    r = client.post("/auth/register", json={"username": "tester", "password": "other12345"})
    assert r.status_code == 409


def test_weak_password_rejected(client):
    r = client.post("/auth/register", json={"username": "weak", "password": "a"})
    assert r.status_code == 400


def test_invalid_username_rejected(client):
    r = client.post("/auth/register", json={"username": "bad name!!", "password": "passA12345"})
    assert r.status_code == 400


def test_protected_endpoints_require_auth(client, sample_csv):
    # analyze
    r = client.post("/analyze", files={"file": ("a.csv", sample_csv.read_bytes(), "text/csv")})
    assert r.status_code == 401
    # clean
    r = client.post("/clean", files={"file": ("a.csv", sample_csv.read_bytes(), "text/csv")}, data={"plan": "[]"})
    assert r.status_code == 401
    # chat
    r = client.post("/chat", json={"messages": [{"role": "user", "content": "hi"}]})
    assert r.status_code == 401
    # sessions list
    r = client.get("/chat/sessions")
    assert r.status_code == 401


def test_chat_sessions_isolated_between_users(client):
    def register(u, p):
        r = client.post("/auth/register", json={"username": u, "password": p})
        assert r.status_code == 201
        return "Bearer " + r.json()["token"]

    tok_a = register("user_a_auth", "passA12345")
    tok_b = register("user_b_auth", "passB12345")

    # A creates a session and sends a chat message
    r = client.post(
        "/chat/sessions",
        headers={"Authorization": tok_a},
        json={"title": "A conv"},
    )
    assert r.status_code == 201
    sid = r.json()["session"]["id"]

    r = client.post(
        "/chat",
        headers={"Authorization": tok_a},
        json={
            "messages": [{"role": "user", "content": "my private message"}],
            "session_id": sid,
        },
    )
    assert r.status_code == 200
    assert r.json()["session_id"] == sid

    # A can read their own messages
    r = client.get(f"/chat/sessions/{sid}", headers={"Authorization": tok_a})
    assert r.status_code == 200
    roles = [m["role"] for m in r.json()["messages"]]
    contents = [m["content"] for m in r.json()["messages"]]
    assert "user" in roles and "assistant" in roles
    assert "my private message" in contents

    # B cannot read A's conversation (404)
    r = client.get(f"/chat/sessions/{sid}", headers={"Authorization": tok_b})
    assert r.status_code == 404

    # B's session list is empty
    r = client.get("/chat/sessions", headers={"Authorization": tok_b})
    assert r.json()["sessions"] == []

    # A can delete their own conversation
    r = client.delete(f"/chat/sessions/{sid}", headers={"Authorization": tok_a})
    assert r.status_code == 200
    r = client.get(f"/chat/sessions/{sid}", headers={"Authorization": tok_a})
    assert r.status_code == 404


def _create_session(client, token, title="Original"):
    r = client.post(
        "/chat/sessions",
        headers={"Authorization": token},
        json={"title": title},
    )
    assert r.status_code == 201
    return r.json()["session"]["id"]


def test_chat_session_rename(client):
    token = _auth(client)
    sid = _create_session(client, token)

    r = client.patch(
        f"/chat/sessions/{sid}",
        headers={"Authorization": token},
        json={"title": "Renamed"},
    )
    assert r.status_code == 200
    assert r.json()["session"]["title"] == "Renamed"


def test_chat_session_rename_missing_title_rejected(client):
    token = _auth(client)
    sid = _create_session(client, token)

    r = client.patch(
        f"/chat/sessions/{sid}",
        headers={"Authorization": token},
        json={},
    )
    assert r.status_code == 400


def test_chat_session_rename_blank_title_rejected(client):
    token = _auth(client)
    sid = _create_session(client, token)

    r = client.patch(
        f"/chat/sessions/{sid}",
        headers={"Authorization": token},
        json={"title": "   "},
    )
    assert r.status_code == 400


def test_chat_session_rename_unknown_session_not_found(client):
    token = _auth(client)

    r = client.patch(
        "/chat/sessions/doesnotexist",
        headers={"Authorization": token},
        json={"title": "x"},
    )
    assert r.status_code == 404


def test_logout_invalidates_token(client, auth_headers):
    token = _auth(client)
    r = client.post("/auth/logout", headers={"Authorization": token})
    assert r.status_code == 200
    # Old token should no longer work
    r = client.get("/auth/me", headers={"Authorization": token})
    assert r.status_code == 401


def test_authenticated_clean_works(client, sample_csv):
    token = _auth(client)
    r = client.post(
        "/clean",
        headers={"Authorization": token},
        files={"file": ("a.csv", sample_csv.read_bytes(), "text/csv")},
        data={"plan": "[]"},
    )
    assert r.status_code == 200
    body = r.json()
    assert "rows_before" in body
    assert "download_url" in body
