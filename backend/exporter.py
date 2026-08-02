import os
import pandas as pd
import tkinter as tk
from tkinter import filedialog


def save_cleaned_data(df):
    """
    Save cleaned dataset to a user-selected location.
    """

    if df is None or df.empty:
        print("No data available to save.")
        return None

    root = tk.Tk()
    root.withdraw()

    file_path = filedialog.asksaveasfilename(
        title="Save Cleaned Dataset",
        defaultextension=".csv",
        filetypes=[
            ("CSV File", "*.csv"),
            ("Excel File", "*.xlsx")
        ]
    )

    if not file_path:
        print("Save cancelled.")
        return None

    extension = os.path.splitext(file_path)[1].lower()

    try:
        if extension == ".csv":
            df.to_csv(file_path, index=False)

        elif extension == ".xlsx":
            df.to_excel(file_path, index=False)

        else:
            raise ValueError("Unsupported file format.")

        print(f"File saved successfully:\n{file_path}")

        return file_path

    except Exception as error:
        print(f"Save Error: {error}")
        return None




import os
from datetime import datetime


def save_output(df, output_folder):

    os.makedirs(output_folder, exist_ok=True)

    filename = (
        "cleaned_"
        + datetime.now().strftime("%Y%m%d_%H%M%S")
        + ".csv"
    )

    output_path = os.path.join(
        output_folder,
        filename
    )

    df.to_csv(
        output_path,
        index=False
    )

    return output_path