"""
Anomaly Signal Service
İstatistiksel anomali sinyal sistemi - tüketim analizi

v1 Not: Bu sistem ML/AI modeli KULLANMAZ.
Sadece istatistiksel analiz (z-score, standart sapma, trend) kullanır.
Ceza kararları SADECE personel veya admin tarafından verilir.
"""
import logging
from datetime import datetime, timedelta
from typing import Optional, Tuple
from database.db import get_db
from database.models import WaterMeterReading, FraudRecord, UserDeposit, AnomalySignal
from sqlalchemy import desc, func

logger = logging.getLogger("anomaly-signal-service")


class AnomalySignalService:
    """
    Anomali Sinyal Servisi (İstatistiksel Analiz)
    
    NOT: Bu servis ML/AI KULLANMAZ ve CEZA UYGULAMAZ.
    Sadece sinyal üretir, karar personel/admin tarafından verilir.
    
    - Tüketim düşüş kontrolü (%50+ uyarısı)
    - OCR anomali sinyali
    - Sinyal kaydı oluşturma
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
    
    def create_anomaly_signal(
        self, 
        user_address: str, 
        signal_type: str, 
        details: str,
        confidence: float = 0.8,
        detected_by: str = "statistical_system"
    ) -> dict:
        """
        Anomali sinyali KAYDI oluştur.
        
        ÖNEMLİ: Bu metod CEZA UYGULAMAZ!
        Sadece sinyal kaydı oluşturur, personel/admin incelemesi bekler.
        
        Args:
            user_address: Kullanıcı cüzdan adresi
            signal_type: Sinyal türü (consumption_drop, index_decreased, vb.)
            details: Sinyal detayı
            confidence: Güven skoru (0-1)
            detected_by: Tespit eden sistem
            
        Returns:
            {"success": bool, "signal_id": int, "status": str}
        """
        try:
            with get_db() as db:
                # Sinyal kaydı oluştur
                signal = AnomalySignal(
                    wallet_address=user_address,
                    signal_type=signal_type,
                    details=details,
                    confidence=confidence,
                    status="pending_review",  # Henüz karar yok
                    detected_by=detected_by,
                    created_at=datetime.utcnow()
                )
                db.add(signal)
                db.commit()
                db.refresh(signal)
                
                logger.info(f"Anomaly signal created for {user_address}: {signal_type} (id={signal.id})")
                
                return {
                    "success": True,
                    "signal_id": signal.id,
                    "status": "pending_review",
                    "message": "Sinyal kaydedildi, personel incelemesi bekleniyor"
                }
                
        except Exception as e:
            logger.exception(f"Failed to create anomaly signal: {e}")
            return {
                "success": False,
                "signal_id": None,
                "status": "error",
                "message": str(e)
            }
    
    # DEPRECATED - v1'de kullanılmıyor, geriye uyumluluk için saklanıyor
    def trigger_fraud_penalty(
        self, 
        user_address: str, 
        fraud_type: str, 
        reason: str,
        detected_by: str = "statistical_system"
    ) -> Tuple[bool, Optional[str]]:
        """
        ⚠️ DEPRECATED - v1'de kullanılmıyor!
        
        Ceza kararları SADECE admin_routes.py üzerinden verilir.
        Bu metod geriye uyumluluk için saklanıyor ama çağrılmamalı.
        
        Bunun yerine create_anomaly_signal() kullanın.
        """
        logger.warning(f"trigger_fraud_penalty called but DISABLED in v1 for {user_address}")
        
        # v1'de otomatik ceza DEVRE DIŞI
        # Bunun yerine sinyal kaydı oluştur
        signal_result = self.create_anomaly_signal(
            user_address=user_address,
            signal_type=fraud_type,
            details=reason,
            detected_by=detected_by
        )
        
        if signal_result["success"]:
            return True, f"signal_id:{signal_result['signal_id']}"
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
anomaly_signal_service = AnomalySignalService()

# Geriye uyumluluk için alias (eski import'ları kırmamak için)
fraud_detection_service = anomaly_signal_service
FraudDetectionService = AnomalySignalService
