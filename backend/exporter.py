import os
import time
import re
import pandas as pd

def save_output(df: pd.DataFrame, output_folder: str, original_filename: str = None) -> str:
    os.makedirs(output_folder, exist_ok=True)
    print(f"[SAVE] Using output folder: {output_folder}")

    timestamp = int(time.time())
    base_name = "cleaned_data"
    if original_filename:
        name_without_ext = os.path.splitext(original_filename)[0]
        clean_name = re.sub(r'[^\w\-]', '_', name_without_ext)
        clean_name = re.sub(r'_+', '_', clean_name)
        base_name = f"cleaned_{clean_name}"

    filename = f"{base_name}_{timestamp}.csv"
    file_path = os.path.join(output_folder, filename)
    df.to_csv(file_path, index=False, encoding='utf-8-sig')
    print(f"[SAVE] File saved at: {file_path}")
    return file_path


import io

def save_output_to_bytes(df: pd.DataFrame) -> bytes:
    """Convert DataFrame to CSV bytes without saving to disk."""
    buffer = io.BytesIO()
    df.to_csv(buffer, index=False, encoding='utf-8-sig')
    buffer.seek(0)
    return buffer.getvalue()