import os
import time
import pandas as pd


def save_output(df: pd.DataFrame, output_folder: str, original_filename: str = None) -> str:
    """
    Save the cleaned DataFrame to a unique file in the output folder.
    Returns the full path of the saved file.
    """
    # Ensure output folder exists
    os.makedirs(output_folder, exist_ok=True)

    # Generate a unique filename with timestamp
    timestamp = int(time.time())
    base_name = "cleaned_data"
    if original_filename:
        # Extract base name without extension
        name_without_ext = os.path.splitext(original_filename)[0]
        base_name = f"cleaned_{name_without_ext}"

    filename = f"{base_name}_{timestamp}.csv"
    file_path = os.path.join(output_folder, filename)

    # Save as CSV (UTF-8 with BOM for Excel compatibility)
    df.to_csv(file_path, index=False, encoding='utf-8-sig')

    print(f"[SAVE] File saved at: {file_path}")  # Log the path for debugging
    return file_path
