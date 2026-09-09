"""Tests for analysis enrichment (recommendations/scatter/filters), merge and
convert endpoints."""

import io
import json

import pandas as pd


def _csv_bytes(df, name="data.csv"):
    buf = io.BytesIO()
    df.to_csv(buf, index=False)
    return name, buf.getvalue(), "text/csv"


class TestRecommendationsAndScatter:
    def test_analyze_data_has_recommendations(self, client, sample_csv, auth_headers):
        with open(sample_csv, "rb") as f:
            r = client.post(
                "/analyze-data",
                headers=auth_headers,
                files={"file": ("sample.csv", f, "text/csv")},
            )
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body["recommendations"], list)
        assert len(body["recommendations"]) >= 1
        assert all(isinstance(item, str) for item in body["recommendations"])

    def test_analyze_data_has_filter_options(self, client, sample_csv, auth_headers):
        with open(sample_csv, "rb") as f:
            r = client.post(
                "/analyze-data",
                headers=auth_headers,
                files={"file": ("sample.csv", f, "text/csv")},
            )
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body["filter_options"], list)
        kinds = {item["kind"] for item in body["filter_options"]}
        assert kinds.issuperset({"numeric", "categorical"})

    def test_analyze_data_scatter_uses_real_points(self, client, auth_headers):
        df = pd.DataFrame(
            {
                "x": [1.0, 2.0, 3.0, 4.0, 5.0] * 4,
                "y": [2.0, 4.0, 6.0, 8.0, 10.0] * 4,
            }
        )
        name, content, mime = _csv_bytes(df, "scatter.csv")
        r = client.post(
            "/analyze-data",
            headers=auth_headers,
            files={"file": (name, content, mime)},
        )
        assert r.status_code == 200
        body = r.json()
        assert len(body["scatter"]) >= 1
        points = body["scatter"][0]["points"]
        assert len(points) >= 1
        assert {"x", "y"} <= set(points[0])

    def test_analyze_data_with_filters(self, client, auth_headers):
        df = pd.DataFrame(
            {
                "city": ["cairo", "riyadh", "cairo", "dubai", "cairo"],
                "sales": [10, 20, 30, 40, 50],
            }
        )
        name, content, mime = _csv_bytes(df, "filters.csv")
        rules = json.dumps([{"column": "city", "op": "in", "value": ["cairo"]}])
        r = client.post(
            "/analyze-data",
            headers=auth_headers,
            data={"filters": rules},
            files={"file": (name, content, mime)},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["filtered"]["rows_before"] == 5
        assert body["rows"] == 3
        assert body["filtered"]["rows_after"] == 3

    def test_analyze_data_invalid_filters_rejected(self, client, sample_csv, auth_headers):
        with open(sample_csv, "rb") as f:
            r = client.post(
                "/analyze-data",
                headers=auth_headers,
                data={"filters": "not-json-at-all"},
                files={"file": ("sample.csv", f, "text/csv")},
            )
        assert r.status_code == 400


class TestMergeFiles:
    def test_merge_two_csvs(self, client, auth_headers):
        df1 = pd.DataFrame({"a": [1, 2], "b": ["x", "y"]})
        df2 = pd.DataFrame({"a": [3], "b": ["z"], "c": [9.0]})
        n1, c1, m1 = _csv_bytes(df1, "one.csv")
        n2, c2, m2 = _csv_bytes(df2, "two.csv")
        r = client.post(
            "/merge-files",
            headers=auth_headers,
            data={"target": "csv"},
            files=[
                ("files", (n1, c1, m1)),
                ("files", (n2, c2, m2)),
            ],
        )
        assert r.status_code == 200
        body = r.json()
        assert body["file_count"] == 2
        assert body["rows"] == 3
        assert "a" in body["columns"] and "b" in body["columns"] and "c" in body["columns"]
        assert body["download_url"].startswith("data:")
        assert body["format"] == "csv"

    def test_merge_single_file_minimum(self, client, sample_csv, auth_headers):
        with open(sample_csv, "rb") as f:
            r = client.post(
                "/merge-files",
                headers=auth_headers,
                data={"target": "xlsx"},
                files={"files": ("sample.csv", f, "text/csv")},
            )
        assert r.status_code == 200
        assert r.json()["rows"] == 5

    def test_merge_rejects_no_files(self, client, auth_headers):
        r = client.post("/merge-files", headers=auth_headers)
        assert r.status_code in (400, 422)


class TestConvert:
    def test_convert_to_xlsx(self, client, sample_csv, auth_headers):
        with open(sample_csv, "rb") as f:
            r = client.post(
                "/convert",
                headers=auth_headers,
                data={"target": "xlsx"},
                files={"file": ("sample.csv", f, "text/csv")},
            )
        assert r.status_code == 200
        body = r.json()
        assert body["target_format"] == "xlsx"
        assert body["rows"] == 5
        assert body["download_name"].endswith(".xlsx")

    def test_convert_rejects_bad_target(self, client, sample_csv, auth_headers):
        with open(sample_csv, "rb") as f:
            r = client.post(
                "/convert",
                headers=auth_headers,
                data={"target": "docx"},
                files={"file": ("sample.csv", f, "text/csv")},
            )
        assert r.status_code == 400


class TestPdfUpload:
    def test_analyze_rejects_fake_pdf(self, client, tmp_path, auth_headers):
        fake = tmp_path / "fake.pdf"
        fake.write_bytes(b"%PDF-1.4 not a real pdf at all")
        with open(fake, "rb") as f:
            r = client.post(
                "/analyze-data",
                headers=auth_headers,
                files={"file": ("fake.pdf", f, "application/pdf")},
            )
        assert r.status_code in (400, 422)
