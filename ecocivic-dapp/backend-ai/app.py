import logging
import os
import uuid

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_apscheduler import APScheduler
from werkzeug.exceptions import RequestEntityTooLarge, HTTPException

from ai.ocr import read_water_meter
from ai.anomaly_detection import check_anomaly, get_historical_data as get_mock_historical_data
from config import DEBUG, API_CORS_ORIGINS
from services.qr_service import generate_qr_token
from services.recycling_validation import validate_recycling_submission

# New Imports
from auth.routes import auth_bp
from services.admin_routes import admin_bp
from auth.middleware import require_citizen, require_service_operator, require_auth
from utils import error_response, validate_wallet_address, normalize_wallet_address
from services.cleanup import cleanup_old_files
from services.blockchain_service import blockchain_service

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

# Scheduler Config
class SchedulerConfig:
    SCHEDULER_API_ENABLED = True

app.config.from_object(SchedulerConfig())

scheduler = APScheduler()
scheduler.init_app(app)
scheduler.start()

# Schedule Cleanup Job (Run daily at 03:00 AM)
@scheduler.task('cron', id='do_cleanup', hour=3, minute=0)
def scheduled_cleanup():
    logger.info("Running scheduled cleanup job...")
    cleanup_old_files(UPLOAD_FOLDER, max_age_days=180) # 6 months

# Register Blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(admin_bp)

@app.errorhandler(RequestEntityTooLarge)
def handle_file_too_large(e):
    return error_response("Yüklenen dosya çok büyük (maksimum 5MB).", 413)


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
        return error_response(f"Internal server error: {str(e)}", 500)
    return error_response("Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.", 500)


@app.route("/api/health", methods=["GET"])
def health_check():
    """
    Basit healthcheck endpoint'i – deploy öncesi temel kontrol için.
    """
    return jsonify({"status": "ok"}), 200


@app.route("/api/water/validate", methods=["POST"])
@require_auth  # En azından giriş yapmış olmalı
@limiter.limit("10 per minute")
def validate_water_meter():
    """
    Sayaç fotoğrafını alır, OCR + anomali kontrolü yapar.
    Sadece authenticate olmuş kullanıcılar (Citizen) kullanabilir.
    """
    # Current user info from decorator
    current_user = getattr(request, "current_user", None)
    
    if "image" not in request.files:
        return error_response("Image not provided", 400)

    image = request.files["image"]

    if image.filename == "":
        return error_response("Image file name is empty", 400)

    # Content-type kontrolü
    if image.mimetype not in {"image/jpeg", "image/png", "image/jpg"}:
        return error_response("Unsupported image type. Only JPG/PNG allowed.", 400)

    filename = f"{uuid.uuid4()}.jpg"
    filepath = os.path.join(UPLOAD_FOLDER, filename)

    try:
        image.save(filepath)
    except Exception as e:
        logger.exception("Failed to save uploaded image")
        return error_response("Image could not be saved.", 500, {"details": str(e) if DEBUG else None})

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
        return error_response("OCR processing failed.", 500, {"details": str(e) if DEBUG else None})

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
    
    tx_hash = None
    if is_valid and current_user:
        # Blockchain'e kaydet (Best effort - fail safe)
        try:
            tx_hash = blockchain_service.submit_water_reading(
                current_user["wallet_address"],
                int(ocr_result.get("index"))
            )
        except Exception as e:
            logger.error(f"Failed to submit reading to blockchain: {e}")
            # Opsiyonel: Kuyruğa atıp retry mekanizması eklenebilir

    return jsonify(
        {
            "valid": is_valid,
            "meter_no": ocr_result.get("meter_no"),
            "current_index": ocr_result.get("index"),
            "historical_avg": sum(history) / len(history),
            "reward_eligible": is_valid,
            "processed_by": current_user["wallet_address"] if current_user else "anonymous",
            "transaction_hash": tx_hash
        }
    )


@app.route("/api/recycling/generate-qr", methods=["POST"])
@require_service_operator # Sadece operatörler QR üretebilir
@limiter.limit("20 per minute")
def generate_qr():
    """
    QR token oluşturur (geri dönüşüm için)
    Sadece Service Operator yetkisiyle.
    """
    try:
        data = request.get_json()
        
        if not data:
            return error_response("Request body is required", 400)
        
        material_type = data.get("material_type")
        amount = data.get("amount")
        wallet_address = data.get("wallet_address")
        
        # Validation
        if not material_type:
            return error_response("material_type is required", 400)
        if amount is None:
            return error_response("amount is required", 400)
        if not wallet_address:
            return error_response("wallet_address is required", 400)
        
        # Validate wallet address
        if not validate_wallet_address(wallet_address):
            return error_response("Invalid wallet address format", 400)
            
        wallet_address = normalize_wallet_address(wallet_address)
        
        # Generate QR token
        try:
            qr_token = generate_qr_token(material_type, float(amount), wallet_address)
            return jsonify(qr_token), 200
        except ValueError as e:
            return error_response(str(e), 400)
            
    except Exception as e:
        logger.exception("Error generating QR token")
        return error_response("Failed to generate QR token", 500, {"details": str(e) if DEBUG else None})


@app.route("/api/recycling/validate", methods=["POST"])
@require_service_operator # Sadece operatörler veya belki otomat makinesi (API Key ile)
@limiter.limit("20 per minute")
def validate_recycling():
    """
    Geri dönüşüm gönderimini doğrular ve blockchain'de ödül verir.
    """
    try:
        data = request.get_json()
        
        if not data:
            return error_response("Request body is required", 400)
        
        material_type = data.get("material_type")
        qr_token = data.get("qr_token")
        wallet_address = data.get("wallet_address")
        
        # Validation
        if not material_type:
            return error_response("material_type is required", 400)
        if not qr_token:
            return error_response("qr_token is required", 400)
        if not wallet_address:
            return error_response("wallet_address is required", 400)
        
        # Validate wallet address
        if not validate_wallet_address(wallet_address):
            return error_response("Invalid wallet address format", 400)
            
        wallet_address = normalize_wallet_address(wallet_address)
        
        # Validate recycling submission (Backend Logic)
        result = validate_recycling_submission(material_type, qr_token, wallet_address)
        
        if not result.get("valid"):
            return error_response(result.get("error", "Validation failed"), 400)
            
        # Blockchain Interaction (Reward Distribution)
        tx_hash = None
        try:
             # qr_token['hash'] unique ID olarak kullanılabilir
            qr_hash = qr_token.get("hash")
            amount = float(qr_token.get("amount", 0))
            
            tx_hash = blockchain_service.reward_recycling(
                wallet_address,
                material_type,
                amount,
                qr_hash
            )
            result["transaction_hash"] = tx_hash
            result["status"] = "rewarded_on_chain"
            
        except Exception as e:
            logger.error(f"Blockchain Fail: {e}")
            result["status"] = "validation_success_blockchain_fail"
            result["blockchain_error"] = str(e)
            # Kritik hata değilse validasyon başarılı kabul edilip daha sonra retry edilebilir
            # Ancak kullanıcıya bildirmek önemli.
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.exception("Error validating recycling submission")
        return error_response("Failed to validate recycling submission", 500, {"details": str(e) if DEBUG else None})


if __name__ == "__main__":
    from config import API_HOST, API_PORT
    app.run(host=API_HOST, port=API_PORT, debug=DEBUG)
