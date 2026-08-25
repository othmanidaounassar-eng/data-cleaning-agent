FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    tk \
    tk-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app/

# ✅ تم التعديل هنا: استخدام المنفذ الثابت 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]