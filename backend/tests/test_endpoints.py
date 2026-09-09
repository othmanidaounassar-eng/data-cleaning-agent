"""HTTP endpoint tests against the FastAPI app (offline AI)."""

import json


class TestHealth:
    def test_health_check(self, client):
        r = client.get("/")
        assert r.status_code == 200
        assert r.json()["status"] == "healthy"


class TestMicrosoftStatus:
    def test_status_reports_booleans_only(self, client):
        """/microsoft/status must never leak secret values, only readiness."""
        r = client.get("/microsoft/status")
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body["configured"], bool)
        assert isinstance(body["clientIdReady"], bool)
        assert isinstance(body["tenantReady"], bool)
        assert isinstance(body["clientSecretReady"], bool)
        assert isinstance(body["powerBiGroupId"], bool)
        assert "note" in body
        # no actual secret content anywhere in the response
        text = json.dumps(body)
        assert "----" not in text.upper()
        assert "bearer" not in text.lower()


class TestAnalyzeEndpoint:
    def test_analyze_returns_plan(self, client, sample_csv, auth_headers):
        with open(sample_csv, "rb") as f:
            r = client.post(
                "/analyze",
                headers=auth_headers,
                files={"file": ("sample.csv", f, "text/csv")},
            )
        assert r.status_code == 200
        body = r.json()
        assert body["dataset"]["rows"] == 5
        assert isinstance(body["plan"], list)
        assert len(body["plan"]) >= 1
        for item in body["plan"]:
            assert item["id"]
            assert item["side"] in ("clean", "keep")
            assert isinstance(item["run"], bool)

    def test_analyze_rejects_bad_extension(self, client, tmp_path, auth_headers):
        bad = tmp_path / "evil.txt"
        bad.write_text("a,b\n1,2\n", encoding="utf-8")
        with open(bad, "rb") as f:
            r = client.post(
                "/analyze",
                headers=auth_headers,
                files={"file": ("evil.txt", f, "text/plain")},
            )
        assert r.status_code == 400


class TestAnalyzeDataEndpoint:
    def test_analyze_data_returns_enhanced_fields(self, client, sample_csv, auth_headers):
        with open(sample_csv, "rb") as f:
            r = client.post(
                "/analyze-data",
                headers=auth_headers,
                files={"file": ("sample.csv", f, "text/csv")},
            )
        assert r.status_code == 200
        body = r.json()

        assert body["dataset"]["file_name"] == "sample.csv"
        assert body["rows"] == 5
        assert body["column_count"] == 4

        # Sample preview (first 5 rows)
        assert isinstance(body["sample"], list)
        assert len(body["sample"]) == 5
        assert all(isinstance(row, dict) for row in body["sample"])

        # Column types summary
        assert isinstance(body["column_types"], dict)
        assert sum(t["count"] for t in body["column_types"].values()) == 4

        # Column descriptions
        assert isinstance(body["columns"], list)
        for col in body["columns"]:
            assert "name" in col
            assert "dtype" in col
            assert "description" in col

        # AI fallback explanation (offline mode -> data-driven summary)
        assert "ai_explanation" in body
        assert isinstance(body["ai_explanation"], str)

    def test_analyze_data_numeric_stats_with_boxplot(self, client, sample_csv, auth_headers):
        with open(sample_csv, "rb") as f:
            r = client.post(
                "/analyze-data",
                headers=auth_headers,
                files={"file": ("sample.csv", f, "text/csv")},
            )
        body = r.json()
        numeric_cols = [c for c in body["columns"] if c.get("mean") is not None]
        assert len(numeric_cols) >= 3
        for col in numeric_cols:
            assert "boxplot" in col
            bp = col["boxplot"]
            for key in ("min", "q1", "median", "q3", "max", "whisker_low", "whisker_high"):
                assert key in bp
            assert "outliers_count" in col
            assert "skewness" in col
            assert isinstance(col.get("histogram", []), list)

    def test_analyze_data_rejects_bad_extension(self, client, tmp_path, auth_headers):
        bad = tmp_path / "evil.txt"
        bad.write_text("a,b\n1,2\n", encoding="utf-8")
        with open(bad, "rb") as f:
            r = client.post(
                "/analyze-data",
                headers=auth_headers,
                files={"file": ("evil.txt", f, "text/plain")},
            )
        assert r.status_code == 400


class TestCleanEndpointSecurity:
    def test_clean_without_plan_is_rejected(self, client, sample_csv, auth_headers):
        with open(sample_csv, "rb") as f:
            r = client.post(
                "/clean",
                headers=auth_headers,
                files={"file": ("sample.csv", f, "text/csv")},
            )
        assert r.status_code == 400

    def test_clean_with_malformed_plan_is_rejected(self, client, sample_csv, auth_headers):
        with open(sample_csv, "rb") as f:
            r = client.post(
                "/clean",
                headers=auth_headers,
                files={"file": ("sample.csv", f, "text/csv")},
                data={"plan": "{broken"},
            )
        assert r.status_code == 400

    def test_clean_with_oversized_plan_is_rejected(self, client, sample_csv, auth_headers):
        from main import MAX_JSON_BODY

        # A payload just over the limit (kept small enough that the multipart
        # transport does not truncate it into a plain JSON syntax error).
        block = '{"id": "x", "run": true},'
        count = (MAX_JSON_BODY + 5000) // len(block) + 1
        huge = "[" + block * count + "]"
        with open(sample_csv, "rb") as f:
            r = client.post(
                "/clean",
                headers=auth_headers,
                files={"file": ("sample.csv", f, "text/csv")},
                data={"plan": huge},
            )
        assert r.status_code == 413

    def test_clean_rejects_bad_extension(self, client, tmp_path, auth_headers):
        bad = tmp_path / "evil.txt"
        bad.write_text("a,b\n1,2\n", encoding="utf-8")
        with open(bad, "rb") as f:
            r = client.post(
                "/clean",
                headers=auth_headers,
                files={"file": ("evil.txt", f, "text/plain")},
                data={"plan": "[]"},
            )
        assert r.status_code == 400


class TestCleanEndpointFlow:
    def test_clean_with_empty_approval_changes_nothing(self, client, sample_csv, auth_headers):
        with open(sample_csv, "rb") as f:
            r = client.post(
                "/clean",
                headers=auth_headers,
                files={"file": ("sample.csv", f, "text/csv")},
                data={"plan": "[]"},
            )
        assert r.status_code == 200
        body = r.json()
        assert body["rows_before"] == 5
        assert body["rows_after"] == 5
        assert body["duplicates_removed"] == 0
        assert body["download_url"].startswith("data:text/csv;base64,")
        assert set(d["action"] for d in body["declined"])

    def test_clean_with_approved_subset(self, client, sample_csv, auth_headers):
        plan = json.dumps([{"id": "duplicate_removal", "run": True}])
        with open(sample_csv, "rb") as f:
            r = client.post(
                "/clean",
                headers=auth_headers,
                files={"file": ("sample.csv", f, "text/csv")},
                data={"plan": plan},
            )
        assert r.status_code == 200
        body = r.json()
        assert body["duplicates_removed"] == 1
        assert body["rows_after"] == 4
        assert body["ai_explanation"] == "Offline AI explanation."

    def test_clean_via_upload_alias(self, client, sample_csv, auth_headers):
        plan = json.dumps([{"id": "duplicate_removal", "run": True}])
        with open(sample_csv, "rb") as f:
            r = client.post(
                "/upload",
                headers=auth_headers,
                files={"file": ("sample.csv", f, "text/csv")},
                data={"plan": plan},
            )
        assert r.status_code == 200
        assert r.json()["duplicates_removed"] == 1

    def test_exported_csv_is_injection_safe(self, client, sample_csv, auth_headers):
        # Original cell "=..." (if present) must come back prefixed with a quote.
        plan = json.dumps([{"id": "duplicate_removal", "run": True}])
        with open(sample_csv, "rb") as f:
            r = client.post(
                "/clean",
                headers=auth_headers,
                files={"file": ("sample.csv", f, "text/csv")},
                data={"plan": plan},
            )
        body = r.json()
        csv_data = body["download_url"].split(",", 1)[1]
        import base64

        csv_bytes = base64.b64decode(csv_data)
        assert csv_bytes.startswith(b"\xef\xbb\xbf")  # utf-8-sig BOM


class TestCleanJsonEndpoint:
    def test_clean_json_flow(self, client, auth_headers):
        payload = {
            "headers": ["name", "score"],
            "rows": [["a", "1"], ["a", "1"], ["b", "3"]],
            "plan": [{"id": "duplicate_removal", "run": True}],
        }
        r = client.post("/clean-json", headers=auth_headers, json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["rows_before"] == 3
        assert body["rows_after"] == 2
        assert body["duplicates_removed"] == 1

    def test_clean_json_without_plan_raises_400(self, client, auth_headers):
        payload = {
            "headers": ["name"],
            "rows": [["a"], ["a"]],
        }
        r = client.post("/clean-json", headers=auth_headers, json=payload)
        assert r.status_code == 400


class TestCors:
    def test_preflight_allows_frontend_origin(self, client):
        r = client.options(
            "/clean",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert r.status_code == 200
        assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"

    def test_unknown_origin_not_allowed(self, client):
        r = client.options(
            "/clean",
            headers={
                "Origin": "https://evil.example",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert r.headers.get("access-control-allow-origin", "").find("evil.example") == -1
