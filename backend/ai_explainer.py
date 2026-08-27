import os
from dotenv import load_dotenv
from openai import OpenAI

# ✅ Load environment variables from .env
load_dotenv()

# ============================================
# DeepSeek Client
# ============================================
client = OpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url="https://api.deepseek.com/v1"
)

def explain_cleaning_with_log(rows_before, rows_after, cleaning_log):
    """
    Generate a summary explanation using DeepSeek.
    """
    if not cleaning_log:
        return "No cleaning operations were performed."

    log_text = ""
    for entry in cleaning_log:
        status = "✅" if entry.get("status") == "completed" else "⏭️"
        log_text += f"{status} {entry.get('description', '')}\n"

    prompt = f"""
    You are a data analysis expert. Based on the following cleaning log, explain in **Arabic** what was done to the data.
    Data:
    - Rows before: {rows_before}
    - Rows after: {rows_after}
    - Log:
    {log_text}
    Provide a brief explanation (4 sentences) in Arabic.
    """

    try:
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": "You are a helpful data assistant."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.5,
            max_tokens=250
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"AI explanation error: {e}")
        return "Data cleaning completed. Check the detailed log."