FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=3011 \
    HOME=/opt/amz-ocr \
    TMPDIR=/dev/shm \
    PADDLE_PDX_MODEL_SOURCE=BOS

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      tesseract-ocr \
      tesseract-ocr-por \
      fonts-dejavu-core \
      libgomp1 \
      libgl1 \
      libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py detector.py ocr_engine.py test_detector.py test_ocr_engine.py ./
RUN mkdir -p "$HOME" \
    && python -c "from ocr_engine import preload_paddle; preload_paddle()" \
    && chmod -R a+rX "$HOME"

USER nobody
EXPOSE 3011
CMD ["uvicorn", "app:app", "--host", "127.0.0.1", "--port", "3011", "--no-access-log"]
