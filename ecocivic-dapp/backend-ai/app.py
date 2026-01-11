import logging
import os
import uuid

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.exceptions import RequestEntityTooLarge, HTTPException

from ai.ocr import read_water_meter
from ai.anomaly_detection import check_anomaly, get_mock_historical_data
from config import DEBUG, API_CORS_ORIGINS
from services.qr_service import generate_qr_token
from services.recycling_validation import validate_recycling_submission


app = Flask(__name__)

# ==============================
# GENERAL APP CONFIG
# ==============================

# Limit maximum upload size to 5 MB to avoid abuse
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024
app.config["DEBUG"] = DEBUG

# CORS Configuration
cors_origins = API_CORS_ORIGINS.split(",") if API_CORS_ORIGINS else ["*"]
CORS(app, resources={r"/api/*": {"origins": cors_origins}})

# Rate Limiting
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ecocivic-backend")

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def _error_response(message: str, status_code: int = 400, extra: dict | None = None):
    payload = {"error": message}
    if extra:
        payload.update(extra)
    return jsonify(payload), status_code


def _validate_wallet_address(address: str) -> bool:
    """Validate Ethereum wallet address format"""
    if not address or not isinstance(address, str):
        return False
    if not address.startswith("0x"):
        return False
    if len(address) != 42:
        return False
    try:
        int(address[2:], 16)
        return True
    except ValueError:
        return False


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
    Basit healthcheck endpoint'i – deploy öncesi temel kontrol için.
    """
    return jsonify({"status": "ok"}), 200


@app.route("/api/water/validate", methods=["POST"])
@limiter.limit("10 per minute")
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

    # Content-type kontrolü
    if image.mimetype not in {"image/jpeg", "image/png", "image/jpg"}:
        return _error_response("Unsupported image type. Only JPG/PNG allowed.", 400)

    filename = f"{uuid.uuid4()}.jpg"
    filepath = os.path.join(UPLOAD_FOLDER, filename)

    try:
        image.save(filepath)
    except Exception as e:
        logger.exception("Failed to save uploaded image")
        return _error_response("Image could not be saved.", 500, {"details": str(e) if DEBUG else None})

    # OCR
    try:
        ocr_result = read_water_meter(filepath)
    except Exception as e:
        logger.exception("OCR processing failed")
        # Cleanup uploaded file on error
        try:
            os.remove(filepath)
        except:
            pass
        return _error_response("OCR processing failed.", 500, {"details": str(e) if DEBUG else None})

    if not ocr_result.get("index"):
        # Cleanup uploaded file on error
        try:
            os.remove(filepath)
        except:
            pass
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
        # Cleanup uploaded file on error
        try:
            os.remove(filepath)
        except:
            pass
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


@app.route("/api/recycling/generate-qr", methods=["POST"])
@limiter.limit("20 per minute")
def generate_qr():
    """
    QR token oluşturur (geri dönüşüm için)
    
    Request body:
    {
        "material_type": "glass|paper|metal",
        "amount": 10.5,
        "wallet_address": "0x..."
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return _error_response("Request body is required", 400)
        
        material_type = data.get("material_type")
        amount = data.get("amount")
        wallet_address = data.get("wallet_address")
        
        # Validation
        if not material_type:
            return _error_response("material_type is required", 400)
        if amount is None:
            return _error_response("amount is required", 400)
        if not wallet_address:
            return _error_response("wallet_address is required", 400)
        
        # Validate wallet address
        if not _validate_wallet_address(wallet_address):
            return _error_response("Invalid wallet address format", 400)
        
        # Generate QR token
        try:
            qr_token = generate_qr_token(material_type, float(amount), wallet_address)
            return jsonify(qr_token), 200
        except ValueError as e:
            return _error_response(str(e), 400)
            
    except Exception as e:
        logger.exception("Error generating QR token")
        return _error_response("Failed to generate QR token", 500, {"details": str(e) if DEBUG else None})


@app.route("/api/recycling/validate", methods=["POST"])
@limiter.limit("20 per minute")
def validate_recycling():
    """
    Geri dönüşüm gönderimini doğrular
    
    Request body:
    {
        "material_type": "glass|paper|metal",
        "qr_token": {...},
        "wallet_address": "0x..."
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return _error_response("Request body is required", 400)
        
        material_type = data.get("material_type")
        qr_token = data.get("qr_token")
        wallet_address = data.get("wallet_address")
        
        # Validation
        if not material_type:
            return _error_response("material_type is required", 400)
        if not qr_token:
            return _error_response("qr_token is required", 400)
        if not wallet_address:
            return _error_response("wallet_address is required", 400)
        
        # Validate wallet address
        if not _validate_wallet_address(wallet_address):
            return _error_response("Invalid wallet address format", 400)
        
        # Validate recycling submission
        result = validate_recycling_submission(material_type, qr_token, wallet_address)
        
        if not result.get("valid"):
            return _error_response(result.get("error", "Validation failed"), 400)
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.exception("Error validating recycling submission")
        return _error_response("Failed to validate recycling submission", 500, {"details": str(e) if DEBUG else None})


if __name__ == "__main__":
    from config import API_HOST, API_PORT
    app.run(host=API_HOST, port=API_PORT, debug=DEBUG)
