"""Cleaning flow + plan-approval logic tests (offline)."""

import json

import numpy as np
import pandas as pd
import pytest

from cleaner import analyze_dataset, clean_data, json_safe
from main import _parse_plan


def build_df():
    return pd.DataFrame(
        {
            "id": [1, 2, 2, 3, 4],
            "name": ["Alice", "Bob", "Bob", None, "Eve"],
            "age": [25, 30, 30, 35, "40"],
            "salary": [5000, 7000, 7000, 8000, 9000],
        }
    )


class TestAnalyzeDataset:
    def test_detects_duplicates_and_missing(self):
        analysis = analyze_dataset(build_df())
        assert analysis["rows"] == 5
        assert analysis["duplicates"] == 1
        assert analysis["nulls_total"] == 1
        ids = {c["id"] for c in analysis["candidates"]}
        assert "duplicate_removal" in ids
        assert "missing_values" in ids

    def test_candidate_fields_are_json_safe(self):
        analysis = analyze_dataset(build_df())
        dumped = json.dumps(json_safe(analysis))
        parsed = json.loads(dumped)
        for c in parsed["candidates"]:
            assert isinstance(c["rows_affected"], int)


class TestCleanDataApproval:
    def test_empty_plan_declines_everything(self):
        df = build_df()
        cleaned, report = clean_data(df, approved=set())
        assert cleaned is not None
        assert len(cleaned) == 5
        assert report["duplicates_removed"] == 0
        assert report["missing_values_filled"] == 0
        completed = [op for op in report.get("operations", []) if op.get("status", "completed") == "completed"]
        assert not completed
        declined_actions = {d.get("action") for d in report.get("declined", [])}
        assert "duplicate_removal" in declined_actions
        assert "missing_values" in declined_actions

    def test_subset_approval_runs_only_approved(self):
        df = build_df()
        cleaned, report = clean_data(df, approved={"duplicate_removal"})
        assert len(cleaned) == 4  # one duplicate row removed
        assert report["duplicates_removed"] == 1
        assert report["missing_values_filled"] == 0
        declined_actions = {d.get("action") for d in report.get("declined", [])}
        assert "duplicate_removal" not in declined_actions
        assert "missing_values" in declined_actions

    def test_full_approval_runs_everything(self):
        df = build_df()
        cleaned, report = clean_data(
            df, approved={"duplicate_removal", "missing_values", "numeric_conversion", "text_cleaning"}
        )
        assert report["duplicates_removed"] == 1
        assert report["missing_values_filled"] == 1
        declined_actions = {d.get("action") for d in report.get("declined", [])}
        assert "duplicate_removal" not in declined_actions
        assert "missing_values" not in declined_actions

    def test_unknown_ids_are_ignored(self):
        df = build_df()
        cleaned, report = clean_data(df, approved={"not_a_real_action", "drop_table"})
        assert report["duplicates_removed"] == 0
        declined_actions = {d.get("action") for d in report.get("declined", [])}
        assert "duplicate_removal" in declined_actions

    def test_declined_entries_carry_a_reason(self):
        df = build_df()
        _, report = clean_data(df, approved=set())
        for d in report.get("declined", []):
            assert d.get("reason")  # non-empty explanation for the user


class TestPlanParsing:
    def test_missing_or_empty_plan_raises(self):
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as e:
            _parse_plan("")
        assert e.value.status_code == 400
        with pytest.raises(HTTPException) as e2:
            _parse_plan("   ")
        assert e2.value.status_code == 400

    def test_invalid_plan_json_raises(self):
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as e:
            _parse_plan("not json at all")
        assert e.value.status_code == 400

    def test_plan_must_be_an_array(self):
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as e:
            _parse_plan('{"id": "x"}')
        assert e.value.status_code == 400

    def test_only_approved_run_true_whitelisted_ids_survive(self):
        plan = json.dumps(
            [
                {"id": "duplicate_removal", "run": True},
                {"id": "missing_values", "run": False},
                {"id": "not_in_whitelist", "run": True},
                {"id": "outlier_detection", "run": "yes"},  # non-bool run
                {"id": 42, "run": True},  # non-str id
            ]
        )
        approved = _parse_plan(plan)
        assert approved == {"duplicate_removal"}

    def test_oversized_plan_raises_413(self):
        from fastapi import HTTPException

        big = json.dumps([{"id": "x", "run": True}] * 500000)
        with pytest.raises(HTTPException) as e:
            _parse_plan(big)
        assert e.value.status_code == 413


class TestJsonSafe:
    def test_numpy_scalars_convert(self):
        assert json_safe(np.int64(7)) == 7
        assert json_safe(np.float64(2.5)) == 2.5
        assert json_safe(np.nan) is None
        assert json_safe(np.bool_(True)) is True
