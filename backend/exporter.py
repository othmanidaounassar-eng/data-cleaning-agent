import os
import pandas as pd

def save_output(df: pd.DataFrame, output_folder: str) -> str:
    """
    Save the cleaned DataFrame to the specified output folder.
    Supports .csv, .xlsx, and .xls formats based on file extension.
    Defaults to .csv if no extension is specified.
    """
    # إنشاء المجلد إذا لم يكن موجوداً
    os.makedirs(output_folder, exist_ok=True)

    # اسم الملف الافتراضي
    base_filename = "cleaned_data.csv"
    file_path = os.path.join(output_folder, base_filename)

    # إذا كان الملف موجوداً، أضف رقماً لتجنب الاستبدال
    counter = 1
    while os.path.exists(file_path):
        name, ext = os.path.splitext(base_filename)
        new_name = f"{name}_{counter}{ext}"
        file_path = os.path.join(output_folder, new_name)
        counter += 1

    # حفظ الملف حسب الامتداد
    if file_path.endswith('.csv'):
        df.to_csv(file_path, index=False, encoding='utf-8-sig')
    elif file_path.endswith('.xlsx'):
        df.to_excel(file_path, index=False, engine='openpyxl')
    elif file_path.endswith('.xls'):
        df.to_excel(file_path, index=False, engine='xlwt')
    else:
        # افتراضي: حفظ كـ CSV
        file_path = file_path + '.csv'
        df.to_csv(file_path, index=False, encoding='utf-8-sig')

    return file_path