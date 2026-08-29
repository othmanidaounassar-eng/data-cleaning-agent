from reader import read_data
from cleaner import clean_data
from analyzer import analyze_data
from report import generate_report
from tkinter import Tk, filedialog
import time

root = Tk()
root.withdraw()

file_path = filedialog.askopenfilename(
    title="Select CSV or Excel File",
    filetypes=[
        ("CSV Files", "*.csv"),
        ("Excel Files", "*.xlsx *.xls"),
        ("All Files", "*.*"),
    ],
)

if not file_path:
    print("لم يتم اختيار أي ملف.")
    exit()

print("Selected File:", file_path)

df = read_data(file_path)

print("تمت قراءة الملف")

print(df.dtypes.to_dict())

start_time = time.time()

analysis_before = analyze_data(df)

cleaned_df, cleaning_report = clean_data(df)

analysis_after = analyze_data(cleaned_df)

execution_time = round(time.time() - start_time, 2)

report = generate_report(analysis_before, analysis_after, cleaning_report, execution_time)

print(report)
