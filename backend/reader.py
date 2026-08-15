import pandas as pd
import os


def read_data(file_path):
    """
    قراءة الملفات المختلفة وإرجاع DataFrame
    """

    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    extension = os.path.splitext(file_path)[1].lower()

    if extension == ".csv":
        return pd.read_csv(file_path)

    elif extension in [".xlsx", ".xls"]:
        return pd.read_excel(file_path)

    else:
        raise ValueError(f"Unsupported file type: {extension}")
