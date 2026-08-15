import os
import time
import base64
from io import StringIO


def df_to_csv_text(df):
    buffer = StringIO()
    df.to_csv(buffer, index=False)
    return "\ufeff" + buffer.getvalue()


def dataframe_to_base64(df) -> str:
    csv_text = df_to_csv_text(df)
    return base64.b64encode(csv_text.encode("utf-8")).decode("ascii")


def save_output(df, output_folder, original_filename=None):
    os.makedirs(output_folder, exist_ok=True)
    timestamp = int(time.time())
    filename = f"cleaned_{timestamp}.csv"
    file_path = os.path.join(output_folder, filename)
    df.to_csv(file_path, index=False, encoding="utf-8-sig")
    return file_path
