FROM python:3.10-slim

WORKDIR /app

# تثبيت الاعتماديات النظامية (لتجنب أخطاء tkinter والمكتبات الرسومية)
RUN apt-get update && apt-get install -y \
    tk \
    tk-dev \
    && rm -rf /var/lib/apt/lists/*

# نسخ مجلد backend بأكمله إلى الحاوية
COPY backend/ /app/backend/

# الانتقال إلى مجلد backend وتثبيت المتطلبات
WORKDIR /app/backend
RUN pip install --no-cache-dir -r requirements.txt

# العودة إلى المجلد الرئيسي للتشغيل
WORKDIR /app

# تشغيل التطبيق باستخدام المنفذ الديناميكي
CMD ["sh", "-c", "cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT"]
