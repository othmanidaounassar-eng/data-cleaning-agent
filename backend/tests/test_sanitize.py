"""Formula-injection (CSV injection) protection tests."""

import pandas as pd

from cleaner import sanitize_dataframe_for_export, sanitize_export_value


class TestSanitizeExportValue:
    def test_equals_and_plus_are_neutralized(self):
        assert sanitize_export_value("=CMD()") == "'=CMD()"
        assert sanitize_export_value("+cmd") == "'+cmd"

    def test_minus_at_sign_tab_cr_are_neutralized(self):
        assert sanitize_export_value("-2+3") == "'-2+3"
        assert sanitize_export_value("@SUM(A1)") == "'@SUM(A1)"
        # A trigger hiding behind leading whitespace is still caught AFTER the
        # whitespace is stripped, and the ORIGINAL value is what gets prefixed.
        assert sanitize_export_value("   =DANGER()") == "'   =DANGER()"
        assert sanitize_export_value("\t=x") == "'\t=x"
        assert sanitize_export_value("\r=@cmd") == "'\r=@cmd"

    def test_leading_whitespace_alone_is_not_a_trigger(self):
        # lstrip removes leading tabs/CR so the value no longer begins with a
        # spreadsheet trigger and must be left untouched.
        assert sanitize_export_value("\tpayload") == "\tpayload"
        assert sanitize_export_value("\rpayload") == "\rpayload"

    def test_space_between_quote_and_trigger_is_not_trigger(self):
        # Only values that START with a trigger after lstrip are flagged.
        assert sanitize_export_value("= safer") == "'= safer"

    def test_safe_values_are_left_untouched(self):
        assert sanitize_export_value("hello") == "hello"
        assert sanitize_export_value("42") == "42"
        assert sanitize_export_value("123-456") == "123-456"
        assert sanitize_export_value("") == ""
        assert sanitize_export_value(None) is None
        assert sanitize_export_value(3.14) == 3.14


class TestSanitizeDataFrame:
    def test_cells_and_headers_are_export_safe(self):
        df = pd.DataFrame(
            {
                "=evil header": ["=1+1", "42"],
                "name": ["@SUM(A1)", None],
            }
        )
        out = sanitize_dataframe_for_export(df)
        assert "=evil header" not in out.columns
        assert "'=evil header" in out.columns
        assert out.iloc[0, 0] == "'=1+1"
        assert out.iloc[1, 0] == "42"
        assert out.iloc[0, 1] == "'@SUM(A1)"
        assert pd.isna(out.iloc[1, 1])

    def test_exported_csv_carries_the_apostrophe(self):
        df = pd.DataFrame({"a": ["=JNDI", "-9"]})
        csv_text = sanitize_dataframe_for_export(df).to_csv(index=False)
        assert "'=JNDI" in csv_text
        assert "'-9" in csv_text

    def test_object_dtype_with_missing_values_survives(self):
        df = pd.DataFrame({"c": pd.Series(["a", None, "=x"], dtype=object)})
        out = sanitize_dataframe_for_export(df)
        values = out["c"].tolist()
        assert values[0] == "a"
        assert values[2] == "'=x"
        # The missing cell must stay missing (NaN), not be stringified.
        assert pd.isna(values[1])
