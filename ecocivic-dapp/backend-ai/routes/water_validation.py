"""
Water Validation API Service
Su sayacı doğrulama ve fraud değerlendirme endpoint'leri
"""
import logging
from flask import Blueprint, request, jsonify
from services.fraud_detection import fraud_detection_service
from services.photo_validation import photo_validation_service
from services.inspection_service import inspection_service
from services.blockchain_service import blockchain_service
from fraud_detection.usage_anomaly import usage_anomaly_detector
from fraud_detection.image_metadata_check import image_metadata_checker
from fraud_detection.ml_fraud_detector import ml_fraud_detector
from database.db import get_db
from database.models import WaterMeterReading, UserDeposit
from auth.middleware import require_service_operator, require_inspector
from sqlalchemy import desc
from datetime import datetime

logger = logging.getLogger("water-validation")

water_bp = Blueprint("water", __name__, url_prefix="/api/water")


@water_bp.route("/fraud-evaluate", methods=["POST"])
@require_service_operator
def fraud_evaluate():
    """
    POST /api/water/fraud-evaluate
    
    AI fraud değerlendirmesi - geçmiş tüketim analizi ve skor hesaplama
    
    Body:
    {
        "wallet": "0x...",
        "image": <file>, 
        "historicalUsage": [100, 95, 105, 90, 85, 80],
        "currentReading": 12345,
        "aiScore": 82 (optional, pre-calculated)
    }
    
    Returns:
    {
        "fraud_score": 82,
        "risk_level": "critical",
        "requires_action": true,
        "action": "penalty_applied" | "under_review" | "confirmation_needed",
        "anomalies": [...],
        "recommendation": "..."
    }
    """
    try:
        data = request.get_json()
        wallet = data.get("wallet")
        historical_usage = data.get("historicalUsage", [])
        current_reading = data.get("currentReading", 0)
        pre_score = data.get("aiScore")
        
        if not wallet:
            return jsonify({"error": "wallet required"}), 400
        
        # Get metadata from image if provided
        metadata = {}
        if "image" in request.files:
            image_file = request.files["image"]
            image_bytes = image_file.read()
            validation_result = image_metadata_checker.validate_image(image_bytes)
            metadata = validation_result.get("metadata", {})
        
        # Calculate fraud score
        if pre_score is not None:
            fraud_score = pre_score
            anomalies = []
            risk_level = "critical" if fraud_score >= 70 else "high" if fraud_score >= 50 else "medium" if fraud_score >= 30 else "low"
        else:
            # Get historical data from DB if not provided
            if not historical_usage:
                with get_db() as db:
                    readings = db.query(WaterMeterReading).filter(
                        WaterMeterReading.wallet_address == wallet
                    ).order_by(desc(WaterMeterReading.created_at)).limit(6).all()
                    historical_usage = [r.consumption_m3 for r in readings if r.consumption_m3 > 0]
            
            # Calculate consumption from current reading
            if historical_usage and current_reading > 0:
                last_reading = historical_usage[0] if historical_usage else 0
                current_consumption = current_reading - last_reading if last_reading else current_reading
            else:
                current_consumption = 0
            
            # Use ML fraud detector
            fraud_result = usage_anomaly_detector.calculate_fraud_score(
                current_consumption,
                historical_usage,
                metadata
            )
            
            fraud_score = fraud_result.get("fraud_score", 0)
            risk_level = fraud_result.get("risk_level", "unknown")
            anomalies = fraud_result.get("anomalies", [])
        
        # Determine action
        requires_action = fraud_score >= 50
        action = None
        tx_hash = None
        
        if fraud_score >= 70:
            # Critical - apply penalty
            try:
                tx_hash = blockchain_service.submit_fraud_evidence(wallet, fraud_score)
                action = "penalty_applied"
            except Exception as e:
                logger.error(f"Blockchain penalty failed: {e}")
                action = "penalty_failed"
        elif fraud_score >= 50:
            # High - put under review
            action = "under_review"
        elif fraud_score >= 30:
            # Medium - request confirmation
            action = "confirmation_needed"
        else:
            action = "none"
        
        return jsonify({
            "fraud_score": fraud_score,
            "risk_level": risk_level,
            "requires_action": requires_action,
            "action": action,
            "anomalies": anomalies,
            "recommendation": fraud_result.get("recommendation", "") if not pre_score else "",
            "tx_hash": tx_hash,
            "metadata_score": metadata.get("score") if metadata else None
        })
        
    except Exception as e:
        logger.exception(f"Fraud evaluate failed: {e}")
        return jsonify({"error": str(e)}), 500


@water_bp.route("/confirm-anomaly", methods=["POST"])
@require_service_operator
def confirm_anomaly():
    """
    POST /api/water/confirm-anomaly
    
    Kullanıcı tüketim düşüşünü onayladığında çağrılır
    
    Body:
    {
        "wallet": "0x...",
        "confirmed": true,
        "current_reading": 12345,
        "current_consumption": 30,
        "average_consumption": 100
    }
    
    Returns:
    {
        "success": true,
        "status": "active" | "under_review",
        "message": "..."
    }
    """
    try:
        data = request.get_json()
        wallet = data.get("wallet")
        confirmed = data.get("confirmed", False)
        current_reading = data.get("current_reading", 0)
        current_consumption = data.get("current_consumption", 0)
        average_consumption = data.get("average_consumption", 0)
        
        if not wallet:
            return jsonify({"error": "wallet required"}), 400
        
        # Call blockchain to confirm
        try:
            tx_hash = blockchain_service.confirm_user_reading(wallet, confirmed)
        except Exception as e:
            logger.error(f"Blockchain confirm failed: {e}")
            tx_hash = None
        
        if confirmed:
            # User confirmed the low consumption
            status = "active"
            message = "Düşük tüketim onaylandı. Okuma kaydedilecek."
            
            # Log the confirmed anomaly
            logger.info(f"User {wallet} confirmed low consumption: {current_consumption} vs avg {average_consumption}")
        else:
            # User did not confirm - put under review
            status = "under_review"
            message = "Kullanıcı onaylamadı. Hesap incelemeye alındı."
        
        return jsonify({
            "success": True,
            "status": status,
            "message": message,
            "tx_hash": tx_hash
        })
        
    except Exception as e:
        logger.exception(f"Confirm anomaly failed: {e}")
        return jsonify({"error": str(e)}), 500


@water_bp.route("/physical-inspection", methods=["POST"])
@require_inspector
def physical_inspection():
    """
    POST /api/water/physical-inspection
    
    Fiziksel kontrol sonucunu kaydet ve blockchain'e gönder
    
    Body:
    {
        "wallet": "0x...",
        "inspection_id": 123,
        "actual_reading": 12500,
        "reported_reading": 12345,
        "fraud_found": true,
        "notes": "Sayaç değiştirilmiş"
    }
    
    Returns:
    {
        "success": true,
        "fraud_found": true,
        "penalty_amount": 2000,
        "underpayment": 1550,
        "interest": 232.5,
        "total_owed": 3782.5,
        "tx_hash": "0x..."
    }
    """
    try:
        data = request.get_json()
        wallet = data.get("wallet")
        inspection_id = data.get("inspection_id")
        actual_reading = data.get("actual_reading", 0)
        reported_reading = data.get("reported_reading", 0)
        fraud_found = data.get("fraud_found", False)
        notes = data.get("notes", "")
        
        inspector_wallet = request.headers.get("X-Wallet-Address", "")
        
        if not wallet:
            return jsonify({"error": "wallet required"}), 400
        
        if not actual_reading:
            return jsonify({"error": "actual_reading required"}), 400
        
        # Calculate difference
        reading_diff = actual_reading - reported_reading
        
        result = {
            "success": True,
            "fraud_found": fraud_found,
            "reading_difference": reading_diff,
            "penalty_amount": 0,
            "underpayment": 0,
            "interest": 0,
            "total_owed": 0,
            "tx_hash": None
        }
        
        if fraud_found:
            # Get user deposit
            with get_db() as db:
                deposit = db.query(UserDeposit).filter(
                    UserDeposit.wallet_address == wallet
                ).first()
                
                deposit_amount = deposit.deposit_amount if deposit else 0
                result["penalty_amount"] = deposit_amount  # 100% penalty
            
            # Calculate underpayment
            if reading_diff > 0:
                unit_price = 10  # TL/m³
                underpayment = reading_diff * unit_price
                
                # Interest (5% per month, assume 3 months late)
                months_late = 3
                interest = underpayment * 0.05 * months_late
                
                result["underpayment"] = underpayment
                result["interest"] = interest
                result["total_owed"] = deposit_amount + underpayment + interest
            
            # Send to blockchain
            try:
                tx_hash = blockchain_service.record_physical_inspection(wallet, True)
                result["tx_hash"] = tx_hash
                
                # Apply interest penalty
                if reading_diff > 0:
                    blockchain_service.apply_interest_penalty(wallet, reading_diff)
            except Exception as e:
                logger.error(f"Blockchain physical inspection failed: {e}")
        else:
            # No fraud - mark as complete
            try:
                tx_hash = blockchain_service.record_physical_inspection(wallet, False)
                result["tx_hash"] = tx_hash
            except Exception as e:
                logger.error(f"Blockchain physical inspection failed: {e}")
        
        # Update inspection record in DB
        if inspection_id:
            inspection_service.complete_inspection(
                inspection_id=inspection_id,
                inspector_wallet=inspector_wallet,
                actual_reading=actual_reading,
                fraud_found=fraud_found,
                notes=notes
            )
        
        return jsonify(result)
        
    except Exception as e:
        logger.exception(f"Physical inspection failed: {e}")
        return jsonify({"error": str(e)}), 500


@water_bp.route("/consumption-check", methods=["POST"])
@require_service_operator
def consumption_check():
    """
    POST /api/water/consumption-check
    
    %50 tüketim düşüşü kontrolü
    
    Body:
    {
        "wallet": "0x...",
        "current_reading": 12345
    }
    
    Returns:
    {
        "warning": true,
        "drop_percent": 65.5,
        "requires_confirmation": true,
        "current_consumption": 30,
        "average_consumption": 87.5,
        "message": "..."
    }
    """
    try:
        data = request.get_json()
        wallet = data.get("wallet")
        current_reading = data.get("current_reading", 0)
        
        if not wallet:
            return jsonify({"error": "wallet required"}), 400
        
        result = fraud_detection_service.check_consumption_drop(wallet, current_reading)
        result["requires_confirmation"] = result.get("warning", False)
        
        return jsonify(result)
        
    except Exception as e:
        logger.exception(f"Consumption check failed: {e}")
        return jsonify({"error": str(e)}), 500
