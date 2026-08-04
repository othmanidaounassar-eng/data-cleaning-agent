FROM python:3.10-slim

WORKDIR /app

# نسخ ملف المتطلبات وتثبيتها
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# نسخ بقية الكود
COPY . /app/

# تشغيل الخادم
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port $PORT"]