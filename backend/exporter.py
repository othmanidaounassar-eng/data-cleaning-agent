import os
import time
import re
import pandas as pd

def save_output(df: pd.DataFrame, output_folder: str, original_filename: str = None) -> str:
    """
    Save the cleaned DataFrame to a unique file in the specified output folder.
    Returns the full path of the saved file.
    """
    # Ensure the output directory exists
    os.makedirs(output_folder, exist_ok=True)

    # Log the output folder being used (for debugging)
    print(f"[SAVE] Using output folder: {output_folder}")

    # Generate a unique filename with timestamp
    timestamp = int(time.time())
    base_name = "cleaned_data"

    if original_filename:
        # Remove extension and special characters, replace spaces with underscores
        name_without_ext = os.path.splitext(original_filename)[0]
        clean_name = re.sub(r'[^\w\-]', '_', name_without_ext)   # Replace invalid chars
        clean_name = re.sub(r'_+', '_', clean_name)              # Collapse multiple underscores
        base_name = f"cleaned_{clean_name}"

    filename = f"{base_name}_{timestamp}.csv"
    file_path = os.path.join(output_folder, filename)

    # Save as CSV with UTF-8 BOM for Excel compatibility
    df.to_csv(file_path, index=False, encoding='utf-8-sig')

    print(f"[SAVE] File saved at: {file_path}")
    return file_path