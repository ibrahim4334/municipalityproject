"""
Inspection Service
6 aylık fiziksel kontrol yönetimi
"""
import logging
from datetime import datetime, timedelta
from typing import List, Optional, Tuple
from database.db import get_db
from database.models import InspectionSchedule, WaterMeterReading, FraudRecord, UserDeposit
from sqlalchemy import desc, and_

logger = logging.getLogger("inspection-service")


class InspectionService:
    """
    6 aylık fiziksel sayaç kontrolü yönetimi.
    - Kontrol planlama
    - Kontrol sonucu işleme
    - Fraud tespit ve ceza
    """
    
    INSPECTION_INTERVAL_DAYS = 180  # 6 ay
    UNDERPAYMENT_INTEREST_RATE = 0.05  # %5 aylık faiz
    INSPECTION_FRAUD_PENALTY_PERCENT = 100  # %100 depozito cezası
    
    def __init__(self, blockchain_service=None):
        self.blockchain_service = blockchain_service
    
    def schedule_inspection(
        self, 
        user_address: str, 
        meter_no: str,
        inspector_wallet: Optional[str] = None,
        scheduled_date: Optional[datetime] = None
    ) -> dict:
        """
        6 aylık kontrol planla.
        
        Returns:
            {
                "success": bool,
                "inspection_id": int,
                "scheduled_date": datetime,
                "message": str
            }
        """
        try:
            with get_db() as db:
                # Bekleyen kontrol var mı kontrol et
                existing = db.query(InspectionSchedule).filter(
                    InspectionSchedule.wallet_address == user_address,
                    InspectionSchedule.status == "pending"
                ).first()
                
                if existing:
                    return {
                        "success": False,
                        "inspection_id": existing.id,
                        "scheduled_date": existing.scheduled_date,
                        "message": "Kullanıcının bekleyen bir kontrolü var"
                    }
                
                # Planlama tarihini belirle
                if not scheduled_date:
                    scheduled_date = datetime.utcnow() + timedelta(days=7)  # 1 hafta sonra
                
                # Kontrol kaydı oluştur
                inspection = InspectionSchedule(
                    wallet_address=user_address,
                    meter_no=meter_no,
                    scheduled_date=scheduled_date,
                    inspector_wallet=inspector_wallet,
                    status="pending"
                )
                
                db.add(inspection)
                db.commit()
                db.refresh(inspection)
                
                logger.info(f"Inspection scheduled for {user_address}: ID {inspection.id}")
                
                return {
                    "success": True,
                    "inspection_id": inspection.id,
                    "scheduled_date": scheduled_date,
                    "message": "Kontrol planlandı"
                }
                
        except Exception as e:
            logger.exception(f"Schedule inspection failed: {e}")
            return {
                "success": False,
                "inspection_id": None,
                "scheduled_date": None,
                "message": f"Hata: {str(e)}"
            }
    
    def complete_inspection(
        self,
        inspection_id: int,
        inspector_wallet: str,
        actual_reading: int,
        fraud_found: bool,
        notes: Optional[str] = None
    ) -> dict:
        """
        Kontrol sonuçlarını kaydet.
        Fraud varsa: blockchain'de ceza kes, eksik fatura faizi hesapla.
        
        Returns:
            {
                "success": bool,
                "fraud_found": bool,
                "penalty_amount": float,
                "underpayment": float,
                "interest": float,
                "transaction_hash": str or None,
                "message": str
            }
        """
        try:
            with get_db() as db:
                inspection = db.query(InspectionSchedule).filter(
                    InspectionSchedule.id == inspection_id
                ).first()
                
                if not inspection:
                    return {
                        "success": False,
                        "fraud_found": False,
                        "message": "Kontrol bulunamadı"
                    }
                
                if inspection.status == "completed":
                    return {
                        "success": False,
                        "fraud_found": False,
                        "message": "Kontrol zaten tamamlanmış"
                    }
                
                user_address = inspection.wallet_address
                
                # Son bildirilen okumayı al
                last_reading = db.query(WaterMeterReading).filter(
                    WaterMeterReading.wallet_address == user_address
                ).order_by(desc(WaterMeterReading.created_at)).first()
                
                reported_reading = last_reading.reading_index if last_reading else 0
                
                # Kontrol kaydını güncelle
                inspection.inspector_wallet = inspector_wallet
                inspection.actual_reading = actual_reading
                inspection.status = "fraud_found" if fraud_found else "completed"
                inspection.notes = notes
                inspection.completed_at = datetime.utcnow()
                
                result = {
                    "success": True,
                    "fraud_found": fraud_found,
                    "reported_reading": reported_reading,
                    "actual_reading": actual_reading,
                    "penalty_amount": 0,
                    "underpayment": 0,
                    "interest": 0,
                    "transaction_hash": None,
                    "message": "Kontrol tamamlandı"
                }
                
                if fraud_found:
                    # Eksik ödeme hesapla
                    if actual_reading > reported_reading:
                        underpaid_consumption = actual_reading - reported_reading
                        # Basit fatura hesabı (örnek: 1 m³ = 10 TL)
                        underpayment = underpaid_consumption * 10
                        
                        # Faiz hesapla (kaç ay gecikme)
                        if last_reading and last_reading.created_at:
                            months_late = max(1, (datetime.utcnow() - last_reading.created_at).days // 30)
                        else:
                            months_late = 1
                        
                        interest = self._calculate_interest(underpayment, months_late)
                        
                        result["underpayment"] = underpayment
                        result["interest"] = interest
                    
                    # Depozito cezası
                    deposit = db.query(UserDeposit).filter(
                        UserDeposit.wallet_address == user_address
                    ).first()
                    
                    if deposit and deposit.deposit_amount > 0:
                        # %100 ceza
                        penalty_amount = deposit.deposit_amount
                        result["penalty_amount"] = penalty_amount
                        
                        # Blockchain'e gönder
                        if self.blockchain_service:
                            try:
                                tx_hash = self.blockchain_service.penalize_user_deposit(
                                    user_address,
                                    100,  # %100
                                    f"Fiziksel kontrol fraud tespiti - Kontrol ID: {inspection_id}"
                                )
                                result["transaction_hash"] = tx_hash
                            except Exception as e:
                                logger.error(f"Blockchain penalty failed: {e}")
                    
                    # Fraud kaydı oluştur
                    fraud_record = FraudRecord(
                        wallet_address=user_address,
                        fraud_type="inspection_detected",
                        detection_method="physical_inspection",
                        penalty_amount=result["penalty_amount"],
                        original_reading=reported_reading,
                        actual_reading=actual_reading,
                        underpayment_amount=result["underpayment"],
                        interest_charged=result["interest"],
                        transaction_hash=result["transaction_hash"],
                        detected_by=inspector_wallet
                    )
                    db.add(fraud_record)
                    
                    result["message"] = f"Fraud tespit edildi. Ceza: {result['penalty_amount']}, Eksik ödeme + faiz: {result['underpayment'] + result['interest']}"
                
                db.commit()
                
                return result
                
        except Exception as e:
            logger.exception(f"Complete inspection failed: {e}")
            return {
                "success": False,
                "fraud_found": False,
                "message": f"Hata: {str(e)}"
            }
    
    def get_pending_inspections(
        self, 
        inspector_wallet: Optional[str] = None
    ) -> List[dict]:
        """
        Bekleyen kontrolleri listele.
        """
        try:
            with get_db() as db:
                query = db.query(InspectionSchedule).filter(
                    InspectionSchedule.status == "pending"
                )
                
                if inspector_wallet:
                    query = query.filter(
                        InspectionSchedule.inspector_wallet == inspector_wallet
                    )
                
                inspections = query.order_by(InspectionSchedule.scheduled_date).all()
                
                return [
                    {
                        "id": i.id,
                        "wallet_address": i.wallet_address,
                        "meter_no": i.meter_no,
                        "scheduled_date": i.scheduled_date.isoformat() if i.scheduled_date else None,
                        "inspector_wallet": i.inspector_wallet,
                        "status": i.status
                    }
                    for i in inspections
                ]
                
        except Exception as e:
            logger.exception(f"Get pending inspections failed: {e}")
            return []
    
    def get_users_due_for_inspection(self) -> List[dict]:
        """
        6 aylık kontrol süresi dolan kullanıcıları getir.
        """
        try:
            with get_db() as db:
                six_months_ago = datetime.utcnow() - timedelta(days=self.INSPECTION_INTERVAL_DAYS)
                
                # Son kontrolü 6 aydan eski olanları bul
                subquery = db.query(
                    InspectionSchedule.wallet_address,
                    InspectionSchedule.completed_at
                ).filter(
                    InspectionSchedule.status.in_(["completed", "fraud_found"])
                ).order_by(
                    InspectionSchedule.wallet_address,
                    desc(InspectionSchedule.completed_at)
                ).distinct(InspectionSchedule.wallet_address).subquery()
                
                # Aktif kullanıcıları al ve filtreleme yap
                readings = db.query(WaterMeterReading.wallet_address).distinct().all()
                
                users_due = []
                for (wallet,) in readings:
                    # Son kontrol tarihini bul
                    last_inspection = db.query(InspectionSchedule).filter(
                        InspectionSchedule.wallet_address == wallet,
                        InspectionSchedule.status.in_(["completed", "fraud_found"])
                    ).order_by(desc(InspectionSchedule.completed_at)).first()
                    
                    # Bekleyen kontrol var mı?
                    pending = db.query(InspectionSchedule).filter(
                        InspectionSchedule.wallet_address == wallet,
                        InspectionSchedule.status == "pending"
                    ).first()
                    
                    if pending:
                        continue  # Zaten bekleyen kontrol var
                    
                    if last_inspection:
                        if last_inspection.completed_at and last_inspection.completed_at < six_months_ago:
                            users_due.append({
                                "wallet_address": wallet,
                                "last_inspection": last_inspection.completed_at.isoformat(),
                                "days_overdue": (datetime.utcnow() - last_inspection.completed_at).days - self.INSPECTION_INTERVAL_DAYS
                            })
                    else:
                        # Hiç kontrol yapılmamış
                        first_reading = db.query(WaterMeterReading).filter(
                            WaterMeterReading.wallet_address == wallet
                        ).order_by(WaterMeterReading.created_at).first()
                        
                        if first_reading and first_reading.created_at < six_months_ago:
                            users_due.append({
                                "wallet_address": wallet,
                                "last_inspection": None,
                                "days_overdue": (datetime.utcnow() - first_reading.created_at).days - self.INSPECTION_INTERVAL_DAYS
                            })
                
                return users_due
                
        except Exception as e:
            logger.exception(f"Get users due for inspection failed: {e}")
            return []
    
    def _calculate_interest(self, amount: float, months_late: int) -> float:
        """
        Faiz hesapla (basit faiz).
        """
        if amount <= 0 or months_late <= 0:
            return 0
        
        return amount * self.UNDERPAYMENT_INTEREST_RATE * months_late


# Global instance
inspection_service = InspectionService()
