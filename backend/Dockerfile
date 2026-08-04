FROM python:3.10-slim

WORKDIR /app

# 👇 هذا هو المسار الجديد الذي يجب إضافته (قبل نسخ المتطلبات)
RUN apt-get update && apt-get install -y \
    tk \
    tk-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app/

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port $PORT"]