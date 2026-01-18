"""
Fraud Detection Service
AI tabanlı fraud tespit ve tüketim anomali kontrolü
"""
import logging
from datetime import datetime, timedelta
from typing import Optional, Tuple
from database.db import get_db
from database.models import WaterMeterReading, FraudRecord, UserDeposit
from sqlalchemy import desc, func

logger = logging.getLogger("fraud-detection")


class FraudDetectionService:
    """
    Su faturası fraud tespit servisi.
    - Tüketim düşüş kontrolü (%50+ uyarısı)
    - OCR anomali tespiti
    - Blockchain penalty tetikleme
    """
    
    CONSUMPTION_DROP_THRESHOLD = 0.50  # %50 düşüş eşiği
    ANOMALY_DEVIATION_THRESHOLD = 0.40  # %40 sapma eşiği
    HISTORY_MONTHS = 6  # Son 6 ay
    
    def __init__(self, blockchain_service=None):
        self.blockchain_service = blockchain_service
    
    def check_consumption_drop(
        self, 
        user_address: str, 
        current_reading: int
    ) -> dict:
        """
        Son 6 ayın ortalamasına göre %50'den fazla düşüş var mı kontrol et.
        
        Returns:
            {
                "warning": bool,
                "current_consumption": int,
                "average_consumption": float,
                "drop_percent": float,
                "message": str
            }
        """
        try:
            with get_db() as db:
                # Son 6 ayın okumalarını getir
                six_months_ago = datetime.utcnow() - timedelta(days=180)
                
                readings = db.query(WaterMeterReading).filter(
                    WaterMeterReading.wallet_address == user_address,
                    WaterMeterReading.created_at >= six_months_ago
                ).order_by(desc(WaterMeterReading.created_at)).limit(6).all()
                
                if not readings or len(readings) < 2:
                    # Yeterli geçmiş veri yok
                    return {
                        "warning": False,
                        "current_consumption": 0,
                        "average_consumption": 0,
                        "drop_percent": 0,
                        "message": "Yeterli geçmiş veri yok"
                    }
                
                # Son okumadan tüketimi hesapla
                last_reading = readings[0]
                previous_readings = readings[1:]
                
                current_consumption = current_reading - last_reading.reading_index if last_reading else current_reading
                
                # Ortalama tüketim
                consumptions = [r.consumption_m3 for r in previous_readings if r.consumption_m3 > 0]
                
                if not consumptions:
                    return {
                        "warning": False,
                        "current_consumption": current_consumption,
                        "average_consumption": 0,
                        "drop_percent": 0,
                        "message": "Geçmiş tüketim verisi bulunamadı"
                    }
                
                avg_consumption = sum(consumptions) / len(consumptions)
                
                # %50 düşüş kontrolü
                if avg_consumption > 0 and current_consumption < avg_consumption * (1 - self.CONSUMPTION_DROP_THRESHOLD):
                    drop_percent = ((avg_consumption - current_consumption) / avg_consumption) * 100
                    
                    return {
                        "warning": True,
                        "current_consumption": current_consumption,
                        "average_consumption": avg_consumption,
                        "drop_percent": round(drop_percent, 1),
                        "message": f"Tüketiminiz geçmiş aylara göre %{round(drop_percent, 1)} düştü"
                    }
                
                return {
                    "warning": False,
                    "current_consumption": current_consumption,
                    "average_consumption": avg_consumption,
                    "drop_percent": 0,
                    "message": "Normal tüketim aralığında"
                }
                
        except Exception as e:
            logger.exception(f"Consumption drop check failed: {e}")
            return {
                "warning": False,
                "current_consumption": 0,
                "average_consumption": 0,
                "drop_percent": 0,
                "message": f"Hata: {str(e)}"
            }
    
    def detect_ocr_anomalies(
        self, 
        ocr_result: dict, 
        image_path: str,
        user_address: str
    ) -> dict:
        """
        OCR sonuçlarında anormallik tespit et:
        - Sayaç numarası değişimi
        - Beklenmeyen format
        - Endeks azalması (imkansız)
        - Aşırı yüksek tüketim
        
        Returns:
            {
                "has_anomaly": bool,
                "anomaly_type": str | None,
                "confidence": float,
                "details": str
            }
        """
        anomalies = []
        
        meter_no = ocr_result.get("meter_no")
        current_index = ocr_result.get("index")
        
        if not meter_no or not current_index:
            return {
                "has_anomaly": True,
                "anomaly_type": "ocr_failure",
                "confidence": 1.0,
                "details": "OCR sayaç numarası veya endeksi okuyamadı"
            }
        
        try:
            with get_db() as db:
                # Son okumayı getir
                last_reading = db.query(WaterMeterReading).filter(
                    WaterMeterReading.wallet_address == user_address
                ).order_by(desc(WaterMeterReading.created_at)).first()
                
                if last_reading:
                    # Sayaç numarası değişimi kontrolü
                    if last_reading.meter_no and meter_no != last_reading.meter_no:
                        anomalies.append({
                            "type": "meter_number_changed",
                            "details": f"Sayaç numarası değişti: {last_reading.meter_no} -> {meter_no}"
                        })
                    
                    # Endeks azalması kontrolü (imkansız)
                    if current_index < last_reading.reading_index:
                        anomalies.append({
                            "type": "index_decreased",
                            "details": f"Endeks azalmış: {last_reading.reading_index} -> {current_index}"
                        })
                    
                    # Aşırı yüksek tüketim kontrolü (önceki ayın 5 katından fazla)
                    if last_reading.consumption_m3 > 0:
                        current_consumption = current_index - last_reading.reading_index
                        if current_consumption > last_reading.consumption_m3 * 5:
                            anomalies.append({
                                "type": "excessive_consumption",
                                "details": f"Aşırı tüketim: {current_consumption} m³ (önceki: {last_reading.consumption_m3} m³)"
                            })
                
        except Exception as e:
            logger.exception(f"Database check failed: {e}")
        
        if anomalies:
            # En ciddi anomaliyi döndür
            primary_anomaly = anomalies[0]
            return {
                "has_anomaly": True,
                "anomaly_type": primary_anomaly["type"],
                "confidence": 0.8,
                "details": primary_anomaly["details"],
                "all_anomalies": anomalies
            }
        
        return {
            "has_anomaly": False,
            "anomaly_type": None,
            "confidence": 0.0,
            "details": "Anomali tespit edilmedi"
        }
    
    def trigger_fraud_penalty(
        self, 
        user_address: str, 
        fraud_type: str, 
        reason: str,
        detected_by: str = "ai_system"
    ) -> Tuple[bool, Optional[str]]:
        """
        Blockchain'de fraud cezası tetikle.
        
        Returns:
            (success, transaction_hash)
        """
        try:
            if not self.blockchain_service:
                logger.warning("Blockchain service not configured")
                return False, None
            
            # Fraud kaydı oluştur
            with get_db() as db:
                # Kullanıcı depozitosu kontrol
                deposit = db.query(UserDeposit).filter(
                    UserDeposit.wallet_address == user_address
                ).first()
                
                if not deposit or deposit.deposit_amount <= 0:
                    logger.warning(f"User {user_address} has no deposit")
                    return False, None
                
                # Ceza miktarı hesapla (%50)
                penalty_amount = deposit.deposit_amount * 0.5
                
                # Blockchain'e gönder
                tx_hash = self.blockchain_service.penalize_user_deposit(
                    user_address,
                    50,  # %50
                    reason
                )
                
                # Fraud kaydı ekle
                fraud_record = FraudRecord(
                    wallet_address=user_address,
                    fraud_type=fraud_type,
                    detection_method="ai_ocr_anomaly" if fraud_type == "ai_detected" else fraud_type,
                    penalty_amount=penalty_amount,
                    transaction_hash=tx_hash,
                    detected_by=detected_by
                )
                db.add(fraud_record)
                db.commit()
                
                logger.info(f"Fraud penalty triggered for {user_address}: {tx_hash}")
                return True, tx_hash
                
        except Exception as e:
            logger.exception(f"Fraud penalty failed: {e}")
            return False, None
    
    def get_user_fraud_status(self, user_address: str) -> dict:
        """
        Kullanıcının fraud durumunu getir.
        """
        try:
            from database.models import User
            
            with get_db() as db:
                # Önce kullanıcıyı getir - fraud records olsun veya olmasın
                user = db.query(User).filter(User.wallet_address == user_address).first()
                
                fraud_records = db.query(FraudRecord).filter(
                    FraudRecord.wallet_address == user_address
                ).order_by(desc(FraudRecord.created_at)).all()
                
                total_penalties = sum(r.penalty_amount or 0 for r in fraud_records) if fraud_records else 0
                
                return {
                    "has_fraud": len(fraud_records) > 0 if fraud_records else False,
                    "total_penalties": total_penalties,
                    "recycling_warnings_remaining": user.recycling_fraud_warnings_remaining if user else 2,
                    "water_warnings_remaining": user.water_fraud_warnings_remaining if user else 2,
                    "is_recycling_blacklisted": user.is_recycling_blacklisted if user else False,
                    "is_water_blacklisted": user.is_water_blacklisted if user else False,
                    "pending_reward_balance": user.pending_reward_balance if user else 0,
                    "records": [
                        {
                            "fraud_type": r.fraud_type,
                            "penalty_amount": r.penalty_amount,
                            "detected_at": r.created_at.isoformat() if r.created_at else None,
                            "tx_hash": r.transaction_hash
                        }
                        for r in fraud_records
                    ] if fraud_records else []
                }
                
        except Exception as e:
            logger.exception(f"Get fraud status failed: {e}")
            return {
                "has_fraud": False, 
                "total_penalties": 0, 
                "records": [], 
                "recycling_warnings_remaining": 2,
                "water_warnings_remaining": 2,
                "is_recycling_blacklisted": False,
                "is_water_blacklisted": False,
                "pending_reward_balance": 0,
                "error": str(e)
            }


# Global instance
fraud_detection_service = FraudDetectionService()
