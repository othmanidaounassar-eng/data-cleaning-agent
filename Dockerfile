FROM python:3.10-slim

WORKDIR /app

# تثبيت الاعتماديات النظامية (تشمل tk)
RUN apt-get update && apt-get install -y \
    tk \
    tk-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements
COPY backend/ /app/

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port $PORT"]