FROM python:3.10-slim

WORKDIR /app

# تثبيت الاعتماديات النظامية (لتجنب مشكلة tkinter)
RUN apt-get update && apt-get install -y \
    tk \
    tk-dev \
    && rm -rf /var/lib/apt/lists/*

# نسخ ملف requirements.txt أولاً (للاستفادة من ذاكرة التخزين المؤقت)
COPY backend/requirements.txt /app/requirements.txt

# تثبيت الاعتماديات
RUN pip install --no-cache-dir -r requirements.txt

# نسخ باقي ملفات backend
COPY backend/ /app/

# تشغيل التطبيق باستخدام المنفذ الديناميكي
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port $PORT"]