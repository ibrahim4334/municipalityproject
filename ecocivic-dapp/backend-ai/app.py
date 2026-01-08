import logging
import os
import uuid

from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.exceptions import RequestEntityTooLarge, HTTPException

from ai.ocr import read_water_meter
from ai.anomaly_detection import check_anomaly, get_mock_historical_data
from config import DEBUG


app = Flask(__name__)

# ==============================
# GENERAL APP CONFIG
# ==============================

# Limit maximum upload size to 5 MB to avoid abuse
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024
app.config["DEBUG"] = DEBUG

# In production you SHOULD restrict this to your frontend origin
CORS(app, resources={r"/api/*": {"origins": "*"}})

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ecocivic-backend")

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def _error_response(message: str, status_code: int = 400, extra: dict | None = None):
    payload = {"error": message}
    if extra:
        payload.update(extra)
    return jsonify(payload), status_code


@app.errorhandler(RequestEntityTooLarge)
def handle_file_too_large(e):
    return _error_response("Yüklenen dosya çok büyük (maksimum 5MB).", 413)


@app.errorhandler(Exception)
def handle_unexpected_error(e):
    """
    Global hata yakalama – detayları logla, kullanıcıya genel mesaj dön.
    """
    if isinstance(e, HTTPException):
        # Flask/werkzeug HTTP hatalarını olduğu gibi geçir
        return e

    logger.exception("Unexpected server error")
    if app.config.get("DEBUG"):
        # Geliştirme ortamında hatayı görselim
        return _error_response(f"Internal server error: {str(e)}", 500)
    return _error_response("Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.", 500)


@app.route("/api/health", methods=["GET"])
def health_check():
    """
    Basit healthcheck endpoint’i – deploy öncesi temel kontrol için.
    """
    return jsonify({"status": "ok"}), 200


@app.route("/api/water/validate", methods=["POST"])
def validate_water_meter():
    """
    Sayaç fotoğrafını alır, OCR + anomali kontrolü yapar.
    Güvenlik / sağlamlık için:
    - Dosya var mı ve gerçekten bir dosya mı kontrol edilir
    - Maksimum boyut ve temel content-type kontrolleri vardır
    - OCR/AI çağrıları try/except ile sarılmıştır
    """
    if "image" not in request.files:
        return _error_response("Image not provided", 400)

    image = request.files["image"]

    if image.filename == "":
        return _error_response("Image file name is empty", 400)

    # Basit content-type kontrolü (gerçek üretimde daha sıkı kontrol tercih edilmeli)
    if image.mimetype not in {"image/jpeg", "image/png", "image/jpg"}:
        return _error_response("Unsupported image type. Only JPG/PNG allowed.", 400)

    filename = f"{uuid.uuid4()}.jpg"
    filepath = os.path.join(UPLOAD_FOLDER, filename)

    try:
        image.save(filepath)
    except Exception as e:  # I/O hatası vs.
        logger.exception("Failed to save uploaded image")
        return _error_response("Image could not be saved.", 500, {"details": str(e) if DEBUG else None})

    # OCR
    try:
        ocr_result = read_water_meter(filepath)
    except Exception as e:
        logger.exception("OCR processing failed")
        return _error_response("OCR processing failed.", 500, {"details": str(e) if DEBUG else None})

    if not ocr_result.get("index"):
        return jsonify(
            {
                "valid": False,
                "reason": "OCR failed",
                "data": ocr_result,
            }
        ), 400

    # Mock geçmiş veri (gerçek sistemde DB'den gelecektir)
    history = get_mock_historical_data(ocr_result.get("meter_no"))

    if not history:
        # Tarihçe olmadan sağlam analiz yapamayız
        return jsonify(
            {
                "valid": False,
                "reason": "No historical data available",
                "data": ocr_result,
            }
        ), 400

    # Anomali kontrolü
    is_valid = check_anomaly(current_index=ocr_result["index"], historical_indexes=history)

    return jsonify(
        {
            "valid": is_valid,
            "meter_no": ocr_result.get("meter_no"),
            "current_index": ocr_result.get("index"),
            "historical_avg": sum(history) / len(history),
            "reward_eligible": is_valid,
        }
    )
