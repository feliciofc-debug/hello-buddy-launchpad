FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=3011 \
    HOME=/opt/amz-ocr \
    PADDLE_PDX_MODEL_SOURCE=BOS \
    PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True

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
RUN TMPDIR=/tmp pip install --no-cache-dir --retries 5 --timeout 120 -r requirements.txt
COPY app.py detector.py ocr_engine.py vehicle_detector.py test_detector.py test_ocr_engine.py ./
RUN pip install --no-cache-dir ultralytics==8.3.203 onnx onnxscript \
    && mkdir -p /app/models \
    && python -c "from ultralytics import YOLO; YOLO('yolov8n.pt').export(format='onnx', imgsz=640)" \
    && mv yolov8n.onnx /app/models/yolov8n.onnx \
    && python -c "from vehicle_detector import detect_vehicle; from PIL import Image; detect_vehicle(Image.new('RGB', (640, 480), 'white'))" \
    && pip uninstall -y ultralytics onnxscript onnx torch torchvision 2>/dev/null || true \
    && TMPDIR=/tmp mkdir -p "$HOME" \
    && python -c "from ocr_engine import preload_paddle; preload_paddle()" \
    && chmod -R a+rX "$HOME" \
    && chmod -R a+rX /app/models

USER nobody
RUN python -c "import socket; socket.socket.connect = lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError('network disabled during model check')); from ocr_engine import preload_paddle; preload_paddle()"

ENV TMPDIR=/dev/shm

EXPOSE 3011
CMD ["uvicorn", "app:app", "--host", "127.0.0.1", "--port", "3011", "--no-access-log"]
