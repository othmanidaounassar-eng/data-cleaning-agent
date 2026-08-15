import os
import pandas as pd

SUPPORTED_EXTENSIONS = [".csv", ".xlsx", ".xls"]


def validate_file(file_path):
    """
    Check if uploaded file is valid before cleaning.
    Returns a dictionary with validation results.
    """
    result = {
        "valid": False,
        "message": "",
        "file_type": None,
        "rows": 0,
        "columns": 0,
    }

    # 1. Check file exists
    if not os.path.exists(file_path):
        result["message"] = "File does not exist"
        return result

    # 2. Check extension
    extension = os.path.splitext(file_path)[1].lower()
    if extension not in SUPPORTED_EXTENSIONS:
        result["message"] = "Unsupported file type"
        return result

    result["file_type"] = extension

    try:
        # 3. Read file
        if extension == ".csv":
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)

        # 4. Check empty file
        if df.empty:
            result["message"] = "File is empty"
            return result

        # 5. Check empty column names
        empty_columns = [col for col in df.columns if str(col).strip() == ""]
        if empty_columns:
            result["message"] = "File contains empty column names"
            return result

        # 6. Success
        result["valid"] = True
        result["message"] = "File is valid"
        result["rows"] = len(df)
        result["columns"] = len(df.columns)

        return result

    except UnicodeDecodeError:
        result["message"] = "Encoding problem (try UTF-8 or Latin-1)"
        return result
    except Exception as error:
        result["message"] = str(error)
        return result