FROM python:3.9-slim

# Install system dependencies
# tesseract-ocr: Required for pytesseract
# libgl1-mesa-glx: Often required for OpenCV if used (optional but safe to add)
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    libgl1-mesa-glx \
    && rm -rf /var/lib/apt/lists/*

# WARNING: OCR operations (Tesseract) are CPU intensive. 
# Ensure this container has sufficient CPU resources (at least 1 vCPU recommended).
# For high throughput, consider separating the OCR service or using a queue worker.

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "wsgi:app"]
