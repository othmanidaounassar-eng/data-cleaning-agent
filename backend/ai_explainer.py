import os
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def explain_cleaning_with_log(rows_before, rows_after, cleaning_log):
    """Generate AI explanation based on cleaning log."""
    if not cleaning_log:
        return "لم يتم تنفيذ أي عمليات تنظيف."

    log_text = ""
    for entry in cleaning_log:
        status_emoji = "✅" if entry.get("status") == "completed" else "⏭️"
        log_text += f"{status_emoji} {entry.get('description', '')} – {entry.get('details', '')}\n"

    prompt = f"""
    أنت خبير في تحليل البيانات. بناءً على السجل التالي، اشرح بالعربية الفصحى ما تم إجراؤه على البيانات.
    البيانات:
    - عدد الصفوف قبل التنظيف: {rows_before}
    - عدد الصفوف بعد التنظيف: {rows_after}
    - السجل التفصيلي:
    {log_text}
    قدم شرحاً موجزاً (4 جمل) يوضح العمليات التي تمت وأسبابها.
    """

    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "أنت مساعد متخصص في تحليل البيانات."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.5,
            max_tokens=250
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"AI explanation error: {e}")
        return "تم تنظيف البيانات. راجع السجل للتفاصيل."