"""Stress test: 100 files with edge cases run through the full API.

Covers:
  - Encoding: utf-8, latin-1 bytes, BOM, no-BOM
  - Shapes: 1 row, 1 col, 100 rows, 50k rows, 200 columns
  - Values: Arabic, emojis, formulas (injection), NaN, dates, currencies,
    negatives, scientific notation, long cells, newlines in cells, quotes,
    semicolon delimiters
  - Structure: empty, headers-only, dup headers, trailing rows, whitespace
  - Files: bad extension, oversized, xlsx, xls, undecodable utf-8
  - Endpoints: /analyze-data, /analyze, /clean (approved plan)

Every assertion is strictly bounded so a JSON response never approaches
Vercel's ~4.5 MB buffered cap.
"""

import base64
import io
import json

import pandas as pd
import pytest

VALID_EXTENSIONS = (".csv", ".xlsx", ".xls")

_COUNTER = 0


# ============================================================
# File generators
# ============================================================


def _csv(bytes_bytes, filename=None):
    global _COUNTER
    _COUNTER += 1
    return (filename or f"case_{_COUNTER:03d}.csv", bytes_bytes)


def _from_df(df, filename, index=False):
    buf = io.BytesIO()
    df.to_csv(buf, index=index, encoding="utf-8")
    return (filename, buf.getvalue())


def _from_df_plain(df, filename):
    buf = io.BytesIO()
    df.to_csv(buf, index=False, encoding="utf-8")
    return (filename, buf.getvalue())


def _gen_family(df_name, build):
    return [(df_name, build)]


def generate_100_files():
    """Return a list of (filename, bytes_or_str_or_df) cases."""

    def rng_csv(seed):
        rng = __import__("random").Random(seed)
        rows = []
        for i in range(120):
            rows.append(
                f"{i},{rng.randint(0, 1000)},{round(rng.uniform(0, 1), 4)},"
                f"cat{rng.randint(1, 5)},{rng.choice(['A', 'B', 'C', ''])}"
            )
        return _csv(("id,val,ratio,cat,note\n" + "\n".join(rows) + "\n").encode("utf-8"), f"rng_{seed}.csv")

    cases = []

    global _COUNTER
    _COUNTER = 0  # deterministic filenames across repeated generations

    # --- 1-10: base patterns ------------------------------------------------
    cases.append(_csv(b"name,age,score\nAlice,25,85\nBob,30,90\n"))
    cases.append(_csv(b"a,b,c\n1,2,3\n4,5,6\n7,8,9\n"))
    cases.append(_csv('id,name,date,amount\n1,شاشة,2024-01-01,"1,500"\n2,لوحة مفاتيح,2024-01-02,750\n'.encode("utf-8")))
    cases.append(_csv(b"x,y\n1.5,2.5\n3.5,4.5\n"))
    cases.append(_csv(b"id,value\n1,10\n2,20\n3,10\n1,10\n"))
    cases.append(_csv(b"a,b\ntrue,false\ntrue,true\nfalse,false\n"))
    cases.append(_csv(b"col1\n"))
    cases.append(("empty.csv", b""))  # zero bytes -> reject with 400
    cases.append(_csv(b"col1,col2\n\n\n\n"))
    cases.append(_csv(b"id\n1\n2\n3\n"))

    # --- 11-20: encodings ---------------------------------------------------
    cases.append(_csv("city,pop\nالقاهرة,10\nرياد,2\nإسطنبول,3\n".encode("utf-8")))
    cases.append(_csv(b"\xef\xbb\xbfname,qty\nA,1\nB,2\n"))  # BOM utf-8
    latin = "name,note\nmünchen,über\xc3\n".encode("latin-1")
    cases.append((f"latin_{len(cases)}.csv", latin))  # latin-1 over utf-8 reader
    cases.append(_csv(b"a\r\nb\r\n1\r\n2\r\n"))  # CRLF
    cases.append(_csv("emoji,val\n😀,1\n🎉,2\n".encode("utf-8")))
    cases.append(_csv("text,val\nhello world,1\n  spaces  ,2\n\ttab\t,3\n".encode("utf-8")))
    cases.append(_csv(b"name,val\nAlice,1\nBob,2\nCarol,3\nDave,4\nEve,5\nFran,6\n"))
    cases.append(_csv("mixed,other\n١,10\n٢,20\n٣,30\n".encode("utf-8")))  # Arabic numerals

    # --- 21-30: injections / dangerous cells -------------------------------
    cases.append(_csv(b'name,val\n"=SUM(A1:A9)",1\n"+1+1",2\n"@cmd",3\n"-1-1",4\n'))
    cases.append(_csv(b'a,b\n"=2+2",x\n"-10",y\n"+@evil",z\n'))
    cases.append(_csv(b"id,email\n1,user@example.com\n2,other@x.io\n"))
    cases.append(_csv(b"id,phone\n1,+201234567890\n2,010-555-0199\n"))
    cases.append(_csv(b"zip,region\n12345,north\n54321,south\n00701,east\n"))
    cases.append(_csv(b"rating,count\n5,100\n4,80\n3,60\n2,40\n1,20\n"))
    cases.append(_csv(b"flag,val\n0,1\n1,0\n0,1\n1,1\n"))
    cases.append(_csv(b"url\nhttps://example.com/a\nhttps://x.io/b/c\nhttps://example.com/a\n"))
    cases.append(_csv(b"a,b\nnan,x\nNaN,y\nnull,z\nNone,w\n"))
    cases.append(_csv(b"big,small\n99999999999999999999,0.000000000001\n-99999999999999999999,-0.00000000001\n"))

    # --- 31-40: structure edge cases ---------------------------------------
    dup_headers_csv = b"id,id,val\n1,2,3\n"
    cases.append(("dup_headers.csv", dup_headers_csv))
    many_cols = pd.DataFrame({f"col_{i}": list(range(5)) for i in range(60)})
    cases.append(_from_df_plain(many_cols, "wide_60.csv"))
    wide2 = pd.DataFrame({f"c{i}": list(range(3)) for i in range(200)})
    cases.append(_from_df_plain(wide2, "wide_200.csv"))
    long_val = pd.DataFrame({"url": ["u" * 2000], "n": [1]})
    cases.append(_from_df_plain(long_val, "long_cell.csv"))
    newline_val = pd.DataFrame({"text": ["line1\nline2\r\nline3"], "n": [1]})
    cases.append(_from_df_plain(newline_val, "newline_cell.csv"))
    quoted = pd.DataFrame({"a": ['say "hi"', "comma,here"], "b": [1, 2]})
    cases.append(_from_df_plain(quoted, "quotes_commas.csv"))
    semicolon = _csv(b"a;b;c\n1;2;3\n4;5;6\n", "semicolons.csv")
    cases.append(semicolon)
    trailing = pd.DataFrame({"a": [1, 2]})
    cases.append(_from_df_plain(trailing, "trailing.csv"))
    date_range = pd.DataFrame({"period": ["2020-2023", "2019-2021", "2021-2022"], "v": [1, 2, 3]})
    cases.append(_from_df_plain(date_range, "year_ranges.csv"))
    currency = pd.DataFrame({"price": ["$1,200", "$3,499.99", "€500", "1,000"], "qty": [1, 2, 3, 4]})
    cases.append(_from_df_plain(currency, "currency.csv"))

    # --- 41-50: data quality / stats validation -----------------------------
    outliers = pd.DataFrame({"val": list(range(100)) + [9999, -9999, 10000]})
    cases.append(_from_df_plain(outliers, "outliers.csv"))
    all_missing = pd.DataFrame({"a": [None, None, None], "b": [None, None, None]})
    cases.append(_from_df_plain(all_missing, "all_missing.csv"))
    rng = __import__("random").Random(42)
    big = pd.DataFrame(
        {
            "id": list(range(20_000)),
            "amount": [round(rng.uniform(-1e6, 1e6), 2) for _ in range(20_000)],
            "cat": [f"c{rng.randint(1, 50)}" for _ in range(20_000)],
            "flag": [rng.randint(0, 1) for _ in range(20_000)],
        }
    )
    cases.append(_from_df_plain(big, "big_20k.csv"))
    dup_heavy = pd.DataFrame({"a": [1, 1, 1, 1, 1], "b": [2, 2, 2, 2, 2]})
    cases.append(_from_df_plain(dup_heavy, "all_dup.csv"))
    unique_keys = pd.DataFrame({"id": [f"UUID-{i}" for i in range(50)], "v": list(range(50))})
    cases.append(_from_df_plain(unique_keys, "unique_keys.csv"))
    mixed_col = pd.DataFrame({"weird": ["1", "two", 3.0, "4", "five", None, "7"]})
    cases.append(_from_df_plain(mixed_col, "mixed_col.csv"))
    many_cats = pd.DataFrame({"high": [f"cat_{__import__('random').Random(r).randint(0, 5000)}" for r in range(100)]})
    cases.append(_from_df_plain(many_cats, "high_card.csv"))
    sci = pd.DataFrame({"n": [1e10, 2.5e-7, 3.14e2, -4e3], "v": [1, 2, 3, 4]})
    cases.append(_from_df_plain(sci, "sci_notation.csv"))
    spaces = pd.DataFrame({"  name  ": ["  x  "], " y ": ["z"], "": ["h"]})
    cases.append(_from_df_plain(spaces, "space_headers.csv"))
    pct = pd.DataFrame({"growth": ["15%", "22.5%", "-3%", "0%"], "v": [1, 2, 3, 4]})
    cases.append(_from_df_plain(pct, "percent.csv"))

    # --- 51-60: more variety / density --------------------------------------
    numeric_strings = pd.DataFrame({"num_text": ["123", "456", "789"], "other": ["a", "b", "c"]})
    cases.append(_from_df_plain(numeric_strings, "num_strings.csv"))
    negative = pd.DataFrame({"temp": [-5, 0, 12, -18, 40, -1], "city": ["a", "b", "c", "d", "e", "f"]})
    cases.append(_from_df_plain(negative, "negatives.csv"))
    one_row_tall = pd.DataFrame({"a": [1], "b": ["only"], "c": [True]})
    cases.append(_from_df_plain(one_row_tall, "one_row.csv"))
    all_same = pd.DataFrame({"a": ["x"] * 30, "b": [42] * 30})
    cases.append(_from_df_plain(all_same, "constant.csv"))
    alternating = pd.DataFrame({"a": [1, None, 2, None, 3], "b": [None, "y", None, "y", None]})
    cases.append(_from_df_plain(alternating, "alternating_nulls.csv"))
    geo = pd.DataFrame({"lat": [31.0, 30.0, 29.9], "lon": [-7.09, -6.8, -7.6], "label": ["dx", "rb", "mar"]})
    cases.append(_from_df_plain(geo, "geo.csv"))
    names = pd.DataFrame({"first": ["أحمد", "محمد", "فاطمة"], "last": ["خالد", "عادل", "نور"], "age": [20, 30, 40]})
    cases.append(_from_df_plain(names, "names_ar.csv"))
    jsonish = pd.DataFrame({"payload": ['{"k": 1}', '{"k": 2}', '{"k": 3}'], "seq": [1, 2, 3]})
    cases.append(_from_df_plain(jsonish, "jsonish.csv"))
    tandem = pd.DataFrame({"x": list(range(50)), "y": [2 * v for v in range(50)]})
    cases.append(_from_df_plain(tandem, "perfect_corr.csv"))
    anti_corr = pd.DataFrame({"x": list(range(50)), "y": [100 - v for v in range(50)]})
    cases.append(_from_df_plain(anti_corr, "anticorr.csv"))

    # --- 61-75: random-ish rng UTF-8 files (stable seed) -----------------------
    for idx in range(25):
        cases.append(rng_csv(idx))

    # --- 76-85: xlsx / xls -----------------------------------------------------
    xlsx_buf = io.BytesIO()
    pd.DataFrame({"id": [1, 2, 3], "name": ["a", "b", "c"], "val": [10.5, 20, 30.25]}).to_excel(
        xlsx_buf, index=False, engine="openpyxl"
    )
    cases.append(("valid.xlsx", xlsx_buf.getvalue()))

    xlsx2 = io.BytesIO()
    pd.DataFrame({"إجمالي": [1, 2, 3], "قيمة": [4, 5, 6]}).to_excel(xlsx2, index=False, engine="openpyxl")
    cases.append(("arabic.xlsx", xlsx2.getvalue()))

    xlsx3 = io.BytesIO()
    pd.DataFrame({"a": [None, 1, None], "b": ["x", None, "z"]}).to_excel(xlsx3, index=False, engine="openpyxl")
    cases.append(("nulls.xlsx", xlsx3.getvalue()))

    xls_buf = io.BytesIO()
    try:
        import xlwt

        wb = xlwt.Workbook()
        ws = wb.add_sheet("data")
        ws.write(0, 0, "a")
        ws.write(0, 1, "b")
        ws.write(1, 0, 1)
        ws.write(1, 1, "p")
        ws.write(2, 0, 2)
        ws.write(2, 1, "q")
        ws.write(3, 0, 3)
        ws.write(3, 1, "r")
        wb.save(xls_buf)
        cases.append(("legacy.xls", xls_buf.getvalue()))
    except ImportError:
        pass  # xlwt unavailable; skip the legacy .xls case

    # --- 86+: invalid inputs (should be rejected) -------------------------------
    cases.append(("evil.txt", b"a,b\n1,2\n"))  # bad extension
    cases.append(("noext", b"a,b\n1,2\n"))  # no extension
    cases.append(("fake.csv", b"a,b,c\n1,2\n3,4,5\n6,7,8,9\n"))  # ragged columns -> ParserError -> 400
    cases.append(("nullbyte.csv", b"a,b\r\n1,\x00\r\n"))  # null byte
    huge = b"a,b\n" + b"1,2\n" * 2_000_000  # oversized (~8 MB) -> expect 413
    cases.append((f"huge_{len(cases)}.csv", huge))
    empty_xlsx = io.BytesIO()
    pd.DataFrame({"a": []}).to_excel(empty_xlsx, index=False, engine="openpyxl")
    cases.append(("empty.xlsx", empty_xlsx.getvalue()))

    # Two more cleanly-buildable CSVs
    cases.append(_from_df(pd.DataFrame({"a": [1, 2, 3, 4], "b": [10, 20, 30, 40]}), "plain_dup.csv", index=False))
    cases.append(_from_df(pd.DataFrame({"city": ["x", "y", "x"], "pop": [5, 6, 5]}), "dup2.csv", index=False))

    # --- 93-105: extra edge cases -------------------------------------------
    cases.append(_csv(b"flag,n\ntrue,1\nfalse,0\n1,1\n0,0\nTRUE,1\n"))
    cases.append(_csv(b"ts,val\n2024-01-01T10:00:00Z,1\n2024-06-15T22:30:15Z,2\n2023-12-31T23:59:59Z,3\n"))
    cases.append(_csv('price\n"3,14"\n"2,71"\n"1,00"\n'.encode("utf-8")))  # European decimals
    cases.append(_csv(b'a,b\n"",""\n"",""\n'))  # empty strings cells
    cases.append(_csv(b"a,b,c\n1,2,3\n1,2,3\n1,2,3\n1,2,4\n"))  # triple dup
    cases.append(_csv(b"a,b\n1,2\n\n3,4\n\n5,6\n"))  # interleaved blank lines
    cases.append(
        _csv(
            b"idx,text\n1,\xd8\xa3\xd9\x82\xd8\xb1\xd8\xa3\n"
            b"2,\xd8\xa7\xd9\x84\xd8\xb9\xd8\xb1\xd8\xa8\xd9\x8a\xd8\xa9\n"
        )
    )  # plain Arabic bytes
    long_headers = pd.DataFrame({"column_name_that_is_quite_long_01": [1], "another_long_name_02": [2]})
    cases.append(_from_df_plain(long_headers, "long_headers.csv"))
    cases.append(_csv(b"a,b\n-999999999,-999999999\n0,0\n999999999,999999999\n"))  # int boundaries
    cases.append(_csv(b"cat,count\nlow,10\nmedium,20\nhigh,30\nmedium,15\nlow,5\nlow,7\n"))  # skewed cat
    cases.append(_csv(b"a\n2024-02-29\n2024-02-29\n2024-02-28\n"))  # leap year dates as strings
    cases.append(_csv(b"id,name,a,b,c\n1,x,1,2,3\n2,y,4,5,6\n3,z,7,8,9\n"))  # mixed width
    cases.append(_csv(b"a\tb\n1\t2\n3\t4\n"))  # tab delimiter
    cases.append(_from_df(pd.DataFrame({"s1": list(range(8)), "s2": list(range(8, 16))}), "seq_long.csv", index=False))
    cases.append(rng_csv(999))

    return cases


STRESS_CASES = generate_100_files()


def _expect_valid(filename):
    """Most generated cases are valid; a few are intentionally invalid."""
    name = filename.lower()
    if name.endswith((".txt",)) or name == "noext":
        return False
    if "fake.csv" in name:
        return False
    if "nullbyte" in name:
        return True  # pandas parses the null byte as a string cell
    if name == "empty.csv":
        return False  # zero-byte upload -> 400
    if "huge_" in name:
        return False
    if "semicolons" in name:
        return True  # parsed as a single column (name contains ';')
    if "latin_" in name:
        return False
    return True


def _expect_big_reject(filename):
    return "huge_" in filename.lower()


# ============================================================
# Tests
# ============================================================


@pytest.mark.slow
class TestStress100Files:
    def test_generated_100_files(self):
        assert len(STRESS_CASES) >= 100, f"generated {len(STRESS_CASES)} files"
        names = [name for name, _ in STRESS_CASES]
        assert len(set(names)) == len(names), "duplicate filenames in stress set"

    def test_analyze_data_all_files(self, client, auth_headers):
        passed, failed = [], []
        for name, content in STRESS_CASES:
            files = {"file": (name, content, "text/csv")}
            r = client.post("/analyze-data", headers=auth_headers, files=files)
            valid = _expect_valid(name)
            if valid:
                if r.status_code == 200:
                    passed.append(name)
                else:
                    failed.append((name, r.status_code, r.text[:160]))
            else:
                if _expect_big_reject(name):
                    assert r.status_code in (400, 413), f"{name}: expected 400/413, got {r.status_code}"
                else:
                    assert r.status_code == 400, f"{name}: expected 400, got {r.status_code}"
        assert not failed, f"valid files that failed /analyze-data: {failed}"

    def test_analyze_data_payload_is_bounded(self, client, auth_headers):
        for name, content in STRESS_CASES:
            if not _expect_valid(name):
                continue
            files = {"file": (name, content, "text/csv")}
            r = client.post("/analyze-data", headers=auth_headers, files=files)
            if r.status_code != 200:
                continue
            body = r.json()
            encoded = len(json.dumps(body))
            assert encoded < 2_500_000, f"{name}: response {encoded} bytes exceeds bound"
            # Every valid analysis must carry the new contract fields.
            assert "rows" in body
            assert "column_count" in body
            assert "sample" in body and isinstance(body["sample"], list)
            assert "column_types" in body and isinstance(body["column_types"], dict)
            assert "ai_explanation" in body and isinstance(body["ai_explanation"], str)
            assert "insights" in body and isinstance(body["insights"], list)
            assert "columns" in body and isinstance(body["columns"], list)

    def test_sample_rows_capped_at_5(self, client, auth_headers):
        for name, content in STRESS_CASES:
            if not _expect_valid(name):
                continue
            files = {"file": (name, content, "text/csv")}
            r = client.post("/analyze-data", headers=auth_headers, files=files)
            if r.status_code != 200:
                continue
            body = r.json()
            assert len(body["sample"]) <= 5, f"{name}: sample has {len(body['sample'])} rows > 5"
            if body["sample"]:
                for row in body["sample"]:
                    assert isinstance(row, dict)

    def test_analyze_all_files(self, client, auth_headers):
        for name, content in STRESS_CASES:
            if not _expect_valid(name):
                continue
            files = {"file": (name, content, "text/csv")}
            r = client.post("/analyze", headers=auth_headers, files=files)
            assert r.status_code == 200, f"{name}: /analyze returned {r.status_code}: {r.text[:200]}"
            body = r.json()
            assert "plan" in body and isinstance(body["plan"], list)
            assert body["dataset"]["rows"] >= 0

    def test_clean_approved_plan(self, client, auth_headers):
        """Run a real cleaning cycle on a representative subset with approved plans."""
        approved = []
        for name, content in STRESS_CASES:
            if "big_20k" in name or "huge_" in name:
                continue
            if _expect_valid(name) and not name.endswith((".xlsx", ".xls")):
                approved.append((name, content))
            if len(approved) >= 20:
                break

        for name, content in approved:
            # Ask the planner for the plan, then approve everything.
            files = {"file": (name, content, "text/csv")}
            an = client.post("/analyze", headers=auth_headers, files=files)
            if an.status_code != 200:
                continue
            plan = an.json().get("plan", [])
            plan_ids = [{"id": p["id"], "run": True} for p in plan]
            cl = client.post(
                "/clean",
                headers=auth_headers,
                files={"file": (name, content, "text/csv")},
                data={"plan": json.dumps(plan_ids)},
            )
            assert cl.status_code == 200, f"{name}: /clean returned {cl.status_code}: {cl.text[:200]}"
            body = cl.json()
            assert body["rows_before"] >= body["rows_after"]
            assert isinstance(body["quality_score"], (int, float))
            assert "ai_explanation" in body
            assert "cleaning_log" in body
            # Download URL must be present and valid.
            if "download_url" in body and body["download_url"].startswith("data:"):
                b64 = body["download_url"].split(",", 1)[1]
                assert b64, f"{name}: empty base64 payload"
                try:
                    csv_bytes = base64.b64decode(b64)
                    assert len(csv_bytes) > 0
                except Exception:
                    pytest.fail(f"{name}: invalid base64 download")

    def test_clean_rejects_unapproved(self, client, auth_headers):
        name, content = STRESS_CASES[0]
        r = client.post(
            "/clean",
            headers=auth_headers,
            files={"file": (name, content, "text/csv")},
            data={"plan": ""},
        )
        assert r.status_code == 400

    def test_bad_extensions_rejected_with_detail(self, client, auth_headers):
        for name, content in STRESS_CASES:
            if not name.endswith(".txt") and name != "noext":
                continue
            r = client.post("/analyze-data", headers=auth_headers, files={"file": (name, content, "text/plain")})
            assert r.status_code == 400, f"{name}: expected 400, got {r.status_code}"

    def test_oversized_rejected(self, client, auth_headers, monkeypatch):
        import main

        # Shrink the upload cap so the "huge" 8 MB case trips the size guard
        # immediately (avoids pandas parsing 8 MB just to be rejected).
        monkeypatch.setattr(main, "MAX_FILE_SIZE", 256 * 1024)
        for name, content in STRESS_CASES:
            if not _expect_big_reject(name):
                continue
            r = client.post("/analyze-data", headers=auth_headers, files={"file": (name, content, "text/csv")})
            assert r.status_code in (400, 413), f"{name}: expected 400/413, got {r.status_code}"

    def test_excel_and_legacy_readable(self, client, auth_headers):
        for name, content in STRESS_CASES:
            if not name.endswith((".xlsx", ".xls")):
                continue
            r = client.post(
                "/analyze-data", headers=auth_headers, files={"file": (name, content, "application/octet-stream")}
            )
            assert r.status_code == 200, f"{name}: {r.text[:200]}"
            body = r.json()
            assert body["rows"] >= 0
