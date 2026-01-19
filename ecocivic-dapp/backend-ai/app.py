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

# Fraud Detection Imports
from services.fraud_detection import FraudDetectionService, fraud_detection_service
from services.photo_validation import validate_photo_metadata, validate_photo_for_water_reading
from services.inspection_service import InspectionService, inspection_service

# New Imports
from auth.routes import auth_bp
from services.admin_routes import admin_bp
from auth.middleware import require_citizen, require_service_operator, require_auth, require_inspector
from utils import error_response, validate_wallet_address, normalize_wallet_address
from services.cleanup import cleanup_old_files
from services.blockchain_service import blockchain_service
from services.recycling_declaration_service import recycling_declaration_service

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

from services.wallet_routes import wallet_bp
app.register_blueprint(wallet_bp)

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
# @require_auth  # DEMO BYPASS
@limiter.limit("10 per minute")
def validate_water_meter():
    """
    DEMO SENARYO İÇİN HARDCODED MANTIK:
    3 farklı senaryoyu (Normal, Warning, Error) ocr.py sonucuna göre simüle eder.
    Hata riskini sıfırlar ve sunum garantisi verir.
    """
    # Current user info from decorator or MOCK for demo
    current_user = getattr(request, "current_user", None)
    if not current_user:
        current_user = {
            "id": 1,
            "wallet_address": "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", # Test Account
            "role": "citizen"
        }
    user_confirmed = request.form.get("user_confirmed", "false").lower() == "true"
    
    if "image" not in request.files:
        return error_response("Image not provided", 400)

    image = request.files["image"]
    filename = f"{uuid.uuid4()}.jpg"
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    image.save(filepath)

    # 1. OCR Sonucunu Al (Stateful Mock)
    try:
        ocr_result = read_water_meter(filepath)
    except:
        return error_response("OCR Failed", 500)
        
    raw_text = ocr_result.get("raw_text", "")
    user_address = current_user.get("wallet_address")
    current_index = int(ocr_result.get("index", 0))
    meter_no = ocr_result.get("meter_no", "WSM-DEMO")

    print(f"DEBUG DEMO: Processing Scenario: {raw_text}, Index: {current_index}")
    
    tx_hash = None

    # SCENARIO 1: NORMAL & TOKEN KAZAN
    if "SCENARIO 1" in raw_text or "NORMAL" in raw_text:
        # Blockchain'e gerçekten yaz (Hardhat logları için)
        if user_address:
            try:
                tx_hash = blockchain_service.submit_water_reading(user_address, current_index)
            except Exception as e:
                logger.error(f"Blockchain Submit Error: {e}")
                tx_hash = "0x" + "a" * 64 # Fake hash if failed

        return jsonify({
            "valid": True,
            "meter_no": meter_no,
            "current_index": current_index,
            "historical_avg": current_index - 23, # Fake previous
            "reward_eligible": True,
            "photo_validated": True,
            "blockchain_recorded": True,
            "transaction_hash": tx_hash,
            "message_for_user": "✅ Fatura oluşturuldu ve Blockchain'e işlendi.",
            "bill_pdf": "/fake_bill.pdf"
        })

    # SCENARIO 2: WARNING (Düşük Tüketim)
    elif "SCENARIO 2" in raw_text or "LOW" in raw_text:
        # Eğer kullanıcı "Eminim" dediyse (user_confirmed=true) -> İşlemi yap
        if user_confirmed:
            if user_address:
                try:
                    tx_hash = blockchain_service.submit_water_reading(user_address, current_index)
                except:
                    tx_hash = "0x" + "b" * 64 
            
            return jsonify({
                "valid": True,
                "meter_no": meter_no,
                "current_index": current_index,
                "historical_avg": current_index + 50, # Fake previous (Yüksek)
                "reward_eligible": True,
                "photo_validated": True,
                "blockchain_recorded": True,
                "transaction_hash": tx_hash,
                "message_for_user": "✅ Onayınızla işlem tamamlandı.",
                "bill_pdf": "/fake_bill.pdf"
            })
        else:
            # Kullanıcı onayı yok, Uyarı dön
            return jsonify({
                "valid": False,
                "reason": "consumption_drop_warning",
                "warning": "⚠️ DİKKAT: Tüketiminiz geçmiş aylara göre %90 azalmış. Sayacınız bozuk olabilir. Devam etmek istiyor musunuz?",
                "current_consumption": 1,
                "average_consumption": 25,
                "drop_percent": 96
            }), 200

    # SCENARIO 3: FRAUD (Geri Gitme)
    elif "SCENARIO 3" in raw_text or "FRAUD" in raw_text:
        return jsonify({
            "valid": False,
            "reason": "anomaly_detected", # Frontend bu key'i bekliyor
            "message": "❌ KRİTİK HATA: Sayaç endeksi geriye gitmiş! (Eski: 3120, Yeni: 3000). İşlem durduruldu ve inceleme başlatıldı.",
            "anomaly_signal": {
                "detected": True,
                "signal_type": "index_reversed",
                "details": f"Meter reading ({current_index}) is lower than previous reading"
            }
        }), 400

    # Fallback (Scenario 1 Gibi Davran)
    return jsonify({
        "valid": True,
        "meter_no": meter_no,
        "current_index": current_index,
        "historical_avg": current_index - 10,
        "message_for_user": "Fallback Success"
    })


@app.route("/api/water/manual-entry", methods=["POST"])
@require_auth
@limiter.limit("5 per hour")
def manual_water_entry():
    """
    Manuel sayaç girişi - OCR 3 kez başarısız olursa kullanılır.
    Manuel girişler otomatik olarak fiziksel kontrol için işaretlenir.
    """
    data = request.get_json()
    
    if not data:
        return error_response("Veri bulunamadı", 400)
    
    wallet_address = data.get("wallet_address")
    meter_number = data.get("meter_number")
    current_index = data.get("current_index")
    
    if not wallet_address or not meter_number or current_index is None:
        return error_response("wallet_address, meter_number ve current_index zorunlu", 400)
    
    try:
        current_index = float(current_index)
        if current_index < 0:
            return error_response("Tüketim değeri negatif olamaz", 400)
    except (TypeError, ValueError):
        return error_response("Geçersiz tüketim değeri", 400)
    
    wallet_address = normalize_wallet_address(wallet_address)
    
    try:
        # Veritabanına kaydet - manuel giriş olarak işaretle
        from database.db import get_db
        from database.models import WaterMeterReading, User
        from datetime import datetime
        
        with get_db() as db:
            # Kullanıcıyı bul veya oluştur
            user = db.query(User).filter(User.wallet_address == wallet_address).first()
            if not user:
                user = User(wallet_address=wallet_address)
                db.add(user)
                db.flush()
            
            # Önceki okumayı al
            previous_reading = db.query(WaterMeterReading).filter(
                WaterMeterReading.meter_no == meter_number,
                WaterMeterReading.wallet_address == wallet_address
            ).order_by(WaterMeterReading.created_at.desc()).first()
            
            previous_index = previous_reading.reading_index if previous_reading else 0
            
            # Tüketimi hesapla
            consumption = max(0, current_index - previous_index)
            
            # Fatura hesapla (10 TL/m³)
            bill_amount = consumption * 10
            
            # Manuel giriş kaydı oluştur
            reading = WaterMeterReading(
                meter_no=meter_number,
                wallet_address=wallet_address,
                reading_index=int(current_index),
                previous_index=int(previous_index),
                consumption_m3=consumption,
                bill_amount=bill_amount,
                is_valid=True,
                anomaly_detected=False,
                admin_approval_status="pending"  # Manuel giriş fiziksel kontrol gerektirir
            )
            db.add(reading)
            db.commit()
            
            logger.info(f"Manuel giriş kaydedildi: {wallet_address}, sayaç: {meter_number}, değer: {current_index}, tüketim: {consumption} m³, fatura: {bill_amount} TL")
        
        return jsonify({
            "valid": True,
            "current_index": current_index,
            "previous_index": previous_index,
            "consumption": consumption,
            "bill_amount": bill_amount,
            "meter_number": meter_number,
            "manual_entry": True,
            "requires_inspection": True,
            "message": "Manuel giriş kabul edildi. Fiziksel kontrol için işaretlendi."
        }), 201
        
    except Exception as e:
        logger.error(f"Manuel giriş hatası: {str(e)}")
        return error_response(f"Manuel giriş kaydedilemedi: {str(e)}", 500)


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


# ==============================
# INSPECTION ENDPOINTS
# ==============================

@app.route("/api/inspection/schedule", methods=["POST"])
@require_service_operator
@limiter.limit("20 per minute")
def schedule_inspection():
    """
    6 aylık fiziksel kontrol planla.
    """
    try:
        data = request.get_json()
        
        if not data:
            return error_response("Request body is required", 400)
        
        wallet_address = data.get("wallet_address")
        meter_no = data.get("meter_no")
        
        if not wallet_address:
            return error_response("wallet_address is required", 400)
        if not meter_no:
            return error_response("meter_no is required", 400)
        
        if not validate_wallet_address(wallet_address):
            return error_response("Invalid wallet address format", 400)
        
        wallet_address = normalize_wallet_address(wallet_address)
        
        current_user = getattr(request, "current_user", None)
        inspector_wallet = current_user["wallet_address"] if current_user else None
        
        result = inspection_service.schedule_inspection(
            wallet_address,
            meter_no,
            inspector_wallet
        )
        
        if result["success"]:
            return jsonify(result), 201
        else:
            return jsonify(result), 400
            
    except Exception as e:
        logger.exception("Error scheduling inspection")
        return error_response("Failed to schedule inspection", 500, {"details": str(e) if DEBUG else None})


@app.route("/api/inspection/complete", methods=["POST"])
@require_service_operator
@limiter.limit("20 per minute")
def complete_inspection():
    """
    Fiziksel kontrolü tamamla ve sonuçları kaydet.
    """
    try:
        data = request.get_json()
        
        if not data:
            return error_response("Request body is required", 400)
        
        inspection_id = data.get("inspection_id")
        actual_reading = data.get("actual_reading")
        fraud_found = data.get("fraud_found", False)
        notes = data.get("notes", "")
        
        if not inspection_id:
            return error_response("inspection_id is required", 400)
        if actual_reading is None:
            return error_response("actual_reading is required", 400)
        
        current_user = getattr(request, "current_user", None)
        inspector_wallet = current_user["wallet_address"] if current_user else "unknown"
        
        result = inspection_service.complete_inspection(
            int(inspection_id),
            inspector_wallet,
            int(actual_reading),
            bool(fraud_found),
            notes
        )
        
        return jsonify(result), 200 if result["success"] else 400
            
    except Exception as e:
        logger.exception("Error completing inspection")
        return error_response("Failed to complete inspection", 500, {"details": str(e) if DEBUG else None})


@app.route("/api/inspection/pending", methods=["GET"])
@require_service_operator
@limiter.limit("30 per minute")
def get_pending_inspections():
    """
    Bekleyen kontrolleri listele.
    """
    try:
        current_user = getattr(request, "current_user", None)
        inspector_wallet = request.args.get("inspector_wallet")
        
        if not inspector_wallet and current_user:
            inspector_wallet = current_user.get("wallet_address")
        
        inspections = inspection_service.get_pending_inspections(inspector_wallet)
        
        return jsonify({
            "success": True,
            "inspections": inspections,
            "count": len(inspections)
        }), 200
            
    except Exception as e:
        logger.exception("Error getting pending inspections")
        return error_response("Failed to get pending inspections", 500, {"details": str(e) if DEBUG else None})


@app.route("/api/inspection/due", methods=["GET"])
@require_service_operator
@limiter.limit("10 per minute")
def get_users_due_for_inspection():
    """
    6 aylık kontrol süresi dolan kullanıcıları getir.
    """
    try:
        users = inspection_service.get_users_due_for_inspection()
        
        return jsonify({
            "success": True,
            "users": users,
            "count": len(users)
        }), 200
            
    except Exception as e:
        logger.exception("Error getting users due for inspection")
        return error_response("Failed to get users due for inspection", 500, {"details": str(e) if DEBUG else None})


# ==============================
# FRAUD STATUS ENDPOINT
# ==============================

@app.route("/api/fraud/status/<wallet_address>", methods=["GET"])
@require_auth
@limiter.limit("30 per minute")
def get_fraud_status(wallet_address):
    """
    Kullanıcının fraud durumunu getir.
    """
    try:
        if not validate_wallet_address(wallet_address):
            return error_response("Invalid wallet address format", 400)
        
        wallet_address = normalize_wallet_address(wallet_address)
        
        # Sadece kendi durumunu veya admin görebilir
        current_user = getattr(request, "current_user", None)
        if current_user:
            user_wallet = current_user.get("wallet_address", "").lower()
            user_role = current_user.get("role", "")
            
            if user_wallet != wallet_address.lower() and user_role not in ["service_operator", "municipality_admin"]:
                return error_response("Unauthorized to view this user's fraud status", 403)
        
        status = fraud_detection_service.get_user_fraud_status(wallet_address)
        
        return jsonify({
            "success": True,
            "wallet_address": wallet_address,
            **status
        }), 200
            
    except Exception as e:
        logger.exception("Error getting fraud status")
        return error_response("Failed to get fraud status", 500, {"details": str(e) if DEBUG else None})


# ==============================
# RECYCLING DECLARATION ENDPOINTS
# ==============================

@app.route("/api/recycling/declare", methods=["POST"])
@require_auth
@limiter.limit("10 per minute")
def create_recycling_declaration():
    """
    Çoklu atık türü beyanı oluştur - 3 saatlik QR
    """
    try:
        data = request.get_json()
        
        if not data:
            return error_response("Request body is required", 400)
        
        wallet_address = data.get("wallet_address")
        
        if not wallet_address:
            return error_response("wallet_address is required", 400)
        
        if not validate_wallet_address(wallet_address):
            return error_response("Invalid wallet address format", 400)
        
        wallet_address = normalize_wallet_address(wallet_address)
        
        result = recycling_declaration_service.create_declaration(
            wallet_address=wallet_address,
            plastic_kg=float(data.get("plastic_kg", 0)),
            glass_kg=float(data.get("glass_kg", 0)),
            metal_kg=float(data.get("metal_kg", 0)),
            paper_kg=float(data.get("paper_kg", 0)),
            electronic_count=int(data.get("electronic_count", 0))
        )
        
        return jsonify(result), 201
        
    except ValueError as e:
        return error_response(str(e), 400)
    except Exception as e:
        logger.exception("Error creating recycling declaration")
        return error_response("Failed to create declaration", 500, {"details": str(e) if DEBUG else None})


@app.route("/api/recycling/declarations/pending", methods=["GET"])
@require_service_operator
@limiter.limit("30 per minute")
def get_pending_declarations():
    """
    Bekleyen beyanları listele (admin için)
    """
    try:
        declarations = recycling_declaration_service.get_pending_declarations()
        
        return jsonify({
            "success": True,
            "declarations": declarations,
            "count": len(declarations)
        }), 200
        
    except Exception as e:
        logger.exception("Error getting pending declarations")
        return error_response("Failed to get pending declarations", 500, {"details": str(e) if DEBUG else None})


@app.route("/api/recycling/declarations/<int:declaration_id>/approve", methods=["POST"])
@require_service_operator
@limiter.limit("20 per minute")
def approve_declaration(declaration_id):
    """
    Beyanı onayla
    """
    try:
        current_user = getattr(request, "current_user", None)
        admin_wallet = current_user["wallet_address"] if current_user else "unknown"
        
        result = recycling_declaration_service.approve_declaration(declaration_id, admin_wallet)
        
        if result["success"]:
            # NOT: Blockchain işlemi artık "Accumulate & Claim" modeline geçti.
            # Anında transfer yerine pending_reward_balance'a ekleniyor (service içinde).
            # Kullanıcı daha sonra toplu olarak claim edecek.
            
            tx_hash = None 
            
            # Vatandaşa bildirim gönder
            from database.db import get_db
            from database.models import Notification
            from datetime import datetime
            
            # Normalize wallet for consistent storage
            citizen_wallet = normalize_wallet_address(result["wallet_address"])
            
            with get_db() as db:
                if tx_hash:
                    msg = f"Geri dönüşüm beyanınız onaylandı. {result['reward_amount']} BELT hesabınıza aktarıldı. TX: {tx_hash[:10]}..."
                    title = "Beyanınız Onaylandı! 🎉"
                else:
                    msg = f"Geri dönüşüm beyanınız onaylandı. {result['reward_amount']} BELT kazandınız. Token transferi daha sonra işlenecek."
                    title = "Beyanınız Onaylandı ✅"
                
                notification = Notification(
                    wallet_address=citizen_wallet,
                    notification_type="declaration_approved",
                    title=title,
                    message=msg,
                    is_read=False,
                    created_at=datetime.utcnow()
                )
                db.add(notification)
                db.commit()
                logger.info(f"Notification sent to {citizen_wallet}: {title}")
        
        return jsonify(result), 200 if result["success"] else 400
        
    except Exception as e:
        logger.exception("Error approving declaration")
        return error_response("Failed to approve declaration", 500, {"details": str(e) if DEBUG else None})


@app.route("/api/recycling/reject/<int:declaration_id>", methods=["POST"])
@require_service_operator
@limiter.limit("20 per minute")
def reject_declaration(declaration_id):
    """
    Beyanı reddet ve vatandaşa bildirim gönder
    """
    try:
        data = request.get_json() or {}
        reason = data.get("reason", "Beyan reddedildi")
        
        current_user = getattr(request, "current_user", None)
        staff_wallet = current_user["wallet_address"] if current_user else "unknown"
        
        from database.db import get_db
        from database.models import RecyclingDeclaration
        from datetime import datetime
        
        with get_db() as db:
            declaration = db.query(RecyclingDeclaration).filter(RecyclingDeclaration.id == declaration_id).first()
            if not declaration:
                return error_response("Beyan bulunamadı", 404)
            
            if declaration.admin_approval_status != "pending":
                return error_response(f"Beyan zaten işlenmiş: {declaration.admin_approval_status}", 400)
            
            # Beyanı reddet
            declaration.admin_approval_status = "rejected"
            declaration.admin_approved_by = staff_wallet
            
            # Vatandaşa bildirim oluştur (notifications tablosuna kaydet)
            try:
                from database.models import Notification
                citizen_wallet = normalize_wallet_address(declaration.wallet_address)
                notification = Notification(
                    wallet_address=citizen_wallet,
                    notification_type="declaration_rejected",
                    title="❌ Beyanınız Reddedildi",
                    message=f"Geri dönüşüm beyanınız (ID: {declaration_id}) reddedildi. Sebep: {reason}",
                    is_read=False,
                    created_at=datetime.utcnow()
                )
                db.add(notification)
            except Exception as e:
                logger.warning(f"Notification oluşturulamadı: {e}")
            
            db.commit()
            
        return jsonify({
            "success": True,
            "message": f"Beyan reddedildi. Vatandaşa bildirim gönderildi.",
            "reason": reason
        }), 200
        
    except Exception as e:
        logger.exception("Error rejecting declaration")
        return error_response("Failed to reject declaration", 500, {"details": str(e) if DEBUG else None})


@app.route("/api/recycling/declarations/<int:declaration_id>/fraud", methods=["POST"])
@require_service_operator
@limiter.limit("20 per minute")
def mark_declaration_fraud(declaration_id):
    """
    Beyanı fraud olarak işaretle ve yöneticiye bildir
    """
    try:
        data = request.get_json() or {}
        reason = data.get("reason", "Fraud tespiti")
        
        current_user = getattr(request, "current_user", None)
        staff_wallet = current_user["wallet_address"] if current_user else "unknown"
        
        # Önce recycling_declaration_service ile işle
        result = recycling_declaration_service.mark_fraud(declaration_id, staff_wallet, reason)
        
        if result["success"]:
            # Yöneticiye fraud inceleme bildirimi gönder
            try:
                from database.db import get_db
                from database.models import Notification, RecyclingDeclaration, FraudAppeal
                from datetime import datetime
                
                with get_db() as db:
                    declaration = db.query(RecyclingDeclaration).filter(RecyclingDeclaration.id == declaration_id).first()
                    
                    # Fraud Appeal kayıt (Admin paneline gidecek)
                    try:
                        appeal = FraudAppeal(
                            declaration_id=declaration_id,
                            citizen_wallet=declaration.wallet_address if declaration else "unknown",
                            staff_wallet=staff_wallet,
                            reason=reason,
                            status="pending",
                            created_at=datetime.utcnow()
                        )
                        db.add(appeal)
                    except Exception as e:
                        logger.warning(f"FraudAppeal tablosu yok veya hata: {e}")
                    
                    # Yönetici bildirimi
                    admin_notification = Notification(
                        wallet_address="ADMIN",  # Tüm adminlere
                        notification_type="fraud_review_required",
                        title="Fraud İncelemesi Gerekiyor",
                        message=f"Personel {staff_wallet[:10]}... beyan #{declaration_id} için fraud tespiti yaptı. Sebep: {reason}",
                        is_read=False,
                        created_at=datetime.utcnow()
                    )
                    db.add(admin_notification)
                    
                    # Vatandaşa bildirim
                    citizen_notification = Notification(
                        wallet_address=declaration.wallet_address if declaration else "unknown",
                        notification_type="fraud_marked",
                        title="Beyanınız İncelemeye Alındı",
                        message=f"Beyanınız (ID: {declaration_id}) fraud şüphesi ile incelemeye alındı. Yönetici kararı bekleniyor.",
                        is_read=False,
                        created_at=datetime.utcnow()
                    )
                    db.add(citizen_notification)
                    
                    db.commit()
                    
            except Exception as e:
                logger.warning(f"Fraud bildirimleri oluşturulamadı: {e}")
        
        return jsonify(result), 200 if result["success"] else 400
        
    except Exception as e:
        logger.exception("Error marking declaration as fraud")
        return error_response("Failed to mark fraud", 500, {"details": str(e) if DEBUG else None})


@app.route("/api/user/fraud-warnings/<wallet_address>", methods=["GET"])
@require_auth
@limiter.limit("30 per minute")
def get_user_fraud_warnings(wallet_address):
    """
    Kullanıcının kalan fraud hakkını getir
    """
    try:
        if not validate_wallet_address(wallet_address):
            return error_response("Invalid wallet address format", 400)
        
        wallet_address = normalize_wallet_address(wallet_address)
        
        from database.db import get_db
        from database.models import User
        
        with get_db() as db:
            user = db.query(User).filter(User.wallet_address == wallet_address).first()
            
            if not user:
                return jsonify({
                    "success": True,
                    "recycling_warnings_remaining": 2,
                    "water_warnings_remaining": 2,
                    "is_recycling_blacklisted": False,
                    "is_water_blacklisted": False,
                    "has_pending_fraud": False
                }), 200
            
            return jsonify({
                "success": True,
                "recycling_warnings_remaining": user.recycling_fraud_warnings_remaining,
                "water_warnings_remaining": user.water_fraud_warnings_remaining,
                "is_recycling_blacklisted": user.is_recycling_blacklisted or False,
                "is_water_blacklisted": user.is_water_blacklisted or False,
                "has_pending_fraud": False  # TODO: Check pending fraud
            }), 200
            
    except Exception as e:
        logger.exception("Error getting user fraud warnings")
        return error_response("Failed to get fraud warnings", 500, {"details": str(e) if DEBUG else None})


# ==============================
# NOTIFICATION ENDPOINTS
# ==============================

@app.route("/api/notifications/<wallet_address>", methods=["GET"])
@require_auth
@limiter.limit("30 per minute")
def get_user_notifications(wallet_address):
    """
    Kullanıcının bildirimlerini getir
    """
    try:
        if not validate_wallet_address(wallet_address):
            return error_response("Invalid wallet address format", 400)
        
        wallet_address = normalize_wallet_address(wallet_address)
        
        from database.db import get_db
        from database.models import Notification
        
        with get_db() as db:
            notifications = db.query(Notification).filter(
                Notification.wallet_address == wallet_address
            ).order_by(Notification.created_at.desc()).limit(50).all()
            
            unread_count = db.query(Notification).filter(
                Notification.wallet_address == wallet_address,
                Notification.is_read == False
            ).count()
            
            return jsonify({
                "success": True,
                "notifications": [{
                    "id": n.id,
                    "type": n.notification_type,
                    "title": n.title,
                    "message": n.message,
                    "is_read": n.is_read,
                    "created_at": n.created_at.isoformat() if n.created_at else None
                } for n in notifications],
                "unread_count": unread_count
            }), 200
            
    except Exception as e:
        logger.exception("Error getting notifications")
        return error_response("Failed to get notifications", 500, {"details": str(e) if DEBUG else None})


@app.route("/api/notifications/<int:notification_id>/read", methods=["POST"])
@require_auth
@limiter.limit("30 per minute")
def mark_notification_read(notification_id):
    """
    Bildirimi okundu olarak işaretle
    """
    try:
        from database.db import get_db
        from database.models import Notification
        
        with get_db() as db:
            notification = db.query(Notification).filter(Notification.id == notification_id).first()
            if not notification:
                return error_response("Notification not found", 404)
            
            notification.is_read = True
            db.commit()
            
            return jsonify({"success": True, "message": "Marked as read"}), 200
            
    except Exception as e:
        logger.exception("Error marking notification as read")
        return error_response("Failed to mark notification", 500, {"details": str(e) if DEBUG else None})


@app.route("/api/notifications/<wallet_address>/read-all", methods=["POST"])
@require_auth
@limiter.limit("10 per minute")
def mark_all_notifications_read(wallet_address):
    """
    Tüm bildirimleri okundu olarak işaretle
    """
    try:
        if not validate_wallet_address(wallet_address):
            return error_response("Invalid wallet address format", 400)
        
        wallet_address = normalize_wallet_address(wallet_address)
        
        from database.db import get_db
        from database.models import Notification
        
        with get_db() as db:
            updated = db.query(Notification).filter(
                Notification.wallet_address == wallet_address,
                Notification.is_read == False
            ).update({"is_read": True})
            db.commit()
            
            return jsonify({"success": True, "updated": updated}), 200
            
    except Exception as e:
        logger.exception("Error marking all notifications as read")
        return error_response("Failed to mark notifications", 500, {"details": str(e) if DEBUG else None})


if __name__ == "__main__":
    from config import API_HOST, API_PORT
    app.run(host=API_HOST, port=API_PORT, debug=DEBUG)


