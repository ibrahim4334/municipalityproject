from flask import Blueprint, jsonify, request
from sqlalchemy import func
from auth.middleware import require_municipality_admin
from database.db import get_db
from database.models import User, UserRole, WaterMeterReading, RecyclingSubmission, PenaltyRecord
from utils import error_response, validate_wallet_address

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")

@admin_bp.route("/dashboard", methods=["GET"])
@require_municipality_admin
def dashboard():
    """
    Admin Dashboard için özet veriler
    """
    try:
        with get_db() as db:
            total_users = db.query(User).count()
            total_citizens = db.query(User).filter(User.role == UserRole.CITIZEN).count()
            total_operators = db.query(User).filter(User.role == UserRole.SERVICE_OPERATOR).count()
            
            total_water_readings = db.query(WaterMeterReading).count()
            total_recycling = db.query(RecyclingSubmission).count()
            
            pending_recycling = db.query(RecyclingSubmission).filter(RecyclingSubmission.is_processed == False).count()
            
            return jsonify({
                "users": {
                    "total": total_users,
                    "citizens": total_citizens,
                    "operators": total_operators
                },
                "activities": {
                    "total_water_readings": total_water_readings,
                    "total_recycling_submissions": total_recycling,
                    "pending_validations": pending_recycling
                }
            }), 200
    except Exception as e:
        return error_response("Dashboard verileri alınamadı", 500, {"details": str(e)})

@admin_bp.route("/users/<wallet_address>/role", methods=["POST"])
@require_municipality_admin
def update_user_role(wallet_address):
    """
    Kullanıcı rolünü güncelleme
    Body: { "role": "service_operator" }
    """
    try:
        if not validate_wallet_address(wallet_address):
            return error_response("Geçersiz cüzdan adresi formatı", 400)
            
        data = request.get_json()
        if not data or "role" not in data:
            return error_response("Role bilgisi gereklidir", 400)
            
        new_role_str = data["role"]
        try:
            # Enum değerini bulmaya çalış (string -> enum)
            # UserRole("citizen") -> UserRole.CITIZEN
            new_role = UserRole(new_role_str)
        except ValueError:
            return error_response(f"Geçersiz rol. Beklenen: {[r.value for r in UserRole]}", 400)
            
        # Municipality Admin rolü verilemez (güvenlik)
        if new_role == UserRole.MUNICIPALITY_ADMIN:
            return error_response("Municipality Admin rolü API üzerinden atanamaz", 403)
            
        with get_db() as db:
            user = db.query(User).filter(User.wallet_address == wallet_address.lower()).first()
            
            if not user:
                return error_response("Kullanıcı bulunamadı", 404)
                
            user.role = new_role
            db.commit()
            
            return jsonify({
                "wallet_address": user.wallet_address,
                "new_role": user.role.value,
                "status": "updated"
            }), 200
            
    except Exception as e:
        return error_response("Rol güncelleme başarısız", 500, {"details": str(e)})

@admin_bp.route("/statistics", methods=["GET"])
@require_municipality_admin
def system_statistics():
    """
    Detaylı sistem istatistikleri
    """
    try:
        with get_db() as db:
            # En çok geri dönüşüm yapanlar (top 5)
            top_recyclers_query = db.query(
                RecyclingSubmission.wallet_address,
                func.sum(RecyclingSubmission.amount_kg).label('total_amount')
            ).group_by(RecyclingSubmission.wallet_address).order_by(func.sum(RecyclingSubmission.amount_kg).desc()).limit(5).all()
            
            top_recyclers = [
                {"wallet": r[0], "total_amount": r[1]} for r in top_recyclers_query
            ]
            
            return jsonify({
                "top_recyclers": top_recyclers,
                # Diğer istatistikler eklenebilir
            }), 200
    except Exception as e:
        return error_response("İstatistik alınamadı", 500, {"details": str(e)})

@admin_bp.route("/anomalies", methods=["GET"])
@require_municipality_admin
def get_anomalies():
    """
    Anomali tespiti yapılan su sayacı okumaları
    """
    try:
        with get_db() as db:
            anomalies = db.query(WaterMeterReading).filter(WaterMeterReading.anomaly_detected == True).order_by(WaterMeterReading.created_at.desc()).limit(50).all()
            
            return jsonify([{
                "id": r.id,
                "meter_no": r.meter_no,
                "wallet_address": r.wallet_address,
                "reading_index": r.reading_index,
                "consumption": r.consumption_m3,
                "date": r.created_at.isoformat() if r.created_at else None
            } for r in anomalies]), 200
    except Exception as e:
        return error_response("Anomali listesi alınamadı", 500, {"details": str(e)})


@admin_bp.route("/stats", methods=["GET"])
@require_municipality_admin
def admin_stats():
    """
    AdminDashboard için istatistikler
    """
    try:
        from database.models import RecyclingDeclaration
        
        with get_db() as db:
            total = db.query(RecyclingDeclaration).count()
            approved = db.query(RecyclingDeclaration).filter(RecyclingDeclaration.status == "approved").count()
            pending = db.query(RecyclingDeclaration).filter(RecyclingDeclaration.status == "pending").count()
            fraud = db.query(RecyclingDeclaration).filter(RecyclingDeclaration.status == "fraud").count()
            
            # Toplam ödül hesapla
            total_rewards_result = db.query(func.sum(RecyclingDeclaration.total_reward)).filter(
                RecyclingDeclaration.status == "approved"
            ).scalar()
            total_rewards = total_rewards_result or 0
            
            return jsonify({
                "totalDeclarations": total,
                "approved": approved,
                "pending": pending,
                "fraud": fraud,
                "totalRewards": int(total_rewards)
            }), 200
    except Exception as e:
        return error_response("Stats alınamadı", 500, {"details": str(e)})


@admin_bp.route("/appeals", methods=["GET"])
@require_municipality_admin
def get_fraud_appeals():
    """
    Bekleyen fraud itirazlarını listele
    """
    try:
        from database.models import FraudAppeal, RecyclingDeclaration
        
        with get_db() as db:
            appeals = db.query(FraudAppeal).filter(FraudAppeal.status == "pending").order_by(FraudAppeal.created_at.desc()).all()
            
            result = []
            for appeal in appeals:
                declaration = db.query(RecyclingDeclaration).filter(RecyclingDeclaration.id == appeal.declaration_id).first()
                result.append({
                    "id": appeal.id,
                    "wallet": appeal.citizen_wallet[:12] + "..." if appeal.citizen_wallet else "N/A",
                    "type": "recycling",
                    "reason": appeal.reason or "Fraud tespit edildi",
                    "appeal_reason": "Fraud incelemesi bekleniyor",  # Vatandaş itiraz ederse güncellenir
                    "created_at": appeal.created_at.isoformat() if appeal.created_at else None,
                    "status": appeal.status,
                    "staff_wallet": appeal.staff_wallet,
                    "declaration_id": appeal.declaration_id,
                    "total_reward": declaration.total_reward if declaration else 0
                })
            
            return jsonify({
                "success": True,
                "appeals": result,
                "count": len(result)
            }), 200
    except Exception as e:
        return error_response("Appeals alınamadı", 500, {"details": str(e)})


@admin_bp.route("/appeals/<int:appeal_id>/decide", methods=["POST"])
@require_municipality_admin
def decide_fraud_appeal(appeal_id):
    """
    Fraud itirazı için karar ver
    decision: 'approve' (itirazı kabul et, fraud kararını kaldır) veya 'reject' (itirazı reddet, fraud kesinleşir)
    """
    try:
        from database.models import FraudAppeal, RecyclingDeclaration, Notification, User
        from datetime import datetime
        
        data = request.get_json() or {}
        decision = data.get("decision")  # 'approve' or 'reject'
        
        if decision not in ["approve", "reject"]:
            return error_response("decision 'approve' veya 'reject' olmalı", 400)
        
        current_user = getattr(request, "current_user", None)
        admin_wallet = current_user["wallet_address"] if current_user else "unknown"
        
        with get_db() as db:
            appeal = db.query(FraudAppeal).filter(FraudAppeal.id == appeal_id).first()
            if not appeal:
                return error_response("Appeal bulunamadı", 404)
            
            if appeal.status != "pending":
                return error_response(f"Appeal zaten işlenmiş: {appeal.status}", 400)
            
            declaration = db.query(RecyclingDeclaration).filter(RecyclingDeclaration.id == appeal.declaration_id).first()
            
            if decision == "approve":
                # İtiraz kabul edildi - fraud kararı kaldırıldı
                appeal.status = "approved"
                appeal.admin_decision = "İtiraz kabul edildi, fraud kararı kaldırıldı"
                appeal.admin_wallet = admin_wallet
                appeal.resolved_at = datetime.utcnow()
                
                # Beyanı tekrar pending'e al veya approved yap
                if declaration:
                    declaration.status = "pending"  # Tekrar incelemeye alındı
                
                # Vatandaşın fraud hakkını geri ver
                user = db.query(User).filter(User.wallet_address == appeal.citizen_wallet).first()
                if user and user.recycling_fraud_warnings_remaining < 2:
                    user.recycling_fraud_warnings_remaining += 1
                
                # Vatandaşa bildirim
                notification = Notification(
                    wallet_address=appeal.citizen_wallet,
                    notification_type="fraud_appeal_approved",
                    title="İtirazınız Kabul Edildi",
                    message="Fraud itirazınız yönetici tarafından kabul edildi. Fraud kaydınız kaldırıldı.",
                    is_read=False,
                    created_at=datetime.utcnow()
                )
                db.add(notification)
                
            else:  # reject
                # İtiraz reddedildi - fraud kesinleşti
                appeal.status = "rejected"
                appeal.admin_decision = "İtiraz reddedildi, fraud kararı kesinleşti"
                appeal.admin_wallet = admin_wallet
                appeal.resolved_at = datetime.utcnow()
                
                # Vatandaşa bildirim
                notification = Notification(
                    wallet_address=appeal.citizen_wallet,
                    notification_type="fraud_appeal_rejected",
                    title="İtirazınız Reddedildi",
                    message="Fraud itirazınız yönetici tarafından reddedildi. Fraud kararı kesinleşti.",
                    is_read=False,
                    created_at=datetime.utcnow()
                )
                db.add(notification)
            
            db.commit()
            
            return jsonify({
                "success": True,
                "decision": decision,
                "message": "İtiraz kabul edildi" if decision == "approve" else "İtiraz reddedildi"
            }), 200
            
    except Exception as e:
        return error_response("Karar verilemedi", 500, {"details": str(e)})
