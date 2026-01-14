"""
Periodic Physical Inspection Module
6 aylık fiziksel kontrol yönetimi
"""
import logging
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from enum import Enum

logger = logging.getLogger("periodic-inspection")


class InspectionStatus(Enum):
    """Kontrol durumları"""
    PENDING = "pending"           # Bekliyor
    SCHEDULED = "scheduled"       # Planlandı
    IN_PROGRESS = "in_progress"   # Devam ediyor
    COMPLETED = "completed"       # Tamamlandı
    FRAUD_FOUND = "fraud_found"   # Fraud bulundu
    CANCELLED = "cancelled"       # İptal edildi


class InspectionResult:
    """Kontrol sonucu"""
    def __init__(
        self,
        inspection_id: int,
        user_address: str,
        inspector_wallet: str,
        reported_reading: int,
        actual_reading: int,
        fraud_found: bool,
        notes: str = ""
    ):
        self.inspection_id = inspection_id
        self.user_address = user_address
        self.inspector_wallet = inspector_wallet
        self.reported_reading = reported_reading
        self.actual_reading = actual_reading
        self.fraud_found = fraud_found
        self.notes = notes
        self.reading_difference = actual_reading - reported_reading
        self.completed_at = datetime.utcnow()
    
    def to_dict(self) -> Dict:
        return {
            "inspection_id": self.inspection_id,
            "user_address": self.user_address,
            "inspector_wallet": self.inspector_wallet,
            "reported_reading": self.reported_reading,
            "actual_reading": self.actual_reading,
            "reading_difference": self.reading_difference,
            "fraud_found": self.fraud_found,
            "notes": self.notes,
            "completed_at": self.completed_at.isoformat()
        }


class PeriodicInspectionManager:
    """
    6 aylık fiziksel kontrol yöneticisi
    
    İş kuralları:
    - Her kullanıcı 6 ayda bir kontrol edilmeli
    - Fraud uyarısı alan kullanıcılar öncelikli
    - Inspector whitelist kontrolü
    """
    
    INSPECTION_INTERVAL_DAYS = 180  # 6 ay
    PRIORITY_INTERVAL_DAYS = 30     # Fraud uyarısı alanlar için 1 ay
    
    def __init__(self):
        # Inspector whitelist (in-memory, production'da DB'den gelir)
        self.inspector_whitelist: set = set()
        
        # Pending inspections queue
        self.inspection_queue: List[Dict] = []
    
    def add_inspector_to_whitelist(self, wallet_address: str) -> bool:
        """
        Inspector'ı whitelist'e ekle
        """
        if not wallet_address or not wallet_address.startswith("0x"):
            return False
        
        self.inspector_whitelist.add(wallet_address.lower())
        logger.info(f"Inspector added to whitelist: {wallet_address}")
        return True
    
    def remove_inspector_from_whitelist(self, wallet_address: str) -> bool:
        """
        Inspector'ı whitelist'ten çıkar
        """
        normalized = wallet_address.lower()
        if normalized in self.inspector_whitelist:
            self.inspector_whitelist.remove(normalized)
            logger.info(f"Inspector removed from whitelist: {wallet_address}")
            return True
        return False
    
    def is_inspector_authorized(self, wallet_address: str) -> bool:
        """
        Inspector yetkili mi kontrol et
        """
        return wallet_address.lower() in self.inspector_whitelist
    
    def get_inspection_priority(
        self,
        user_address: str,
        last_inspection_date: Optional[datetime],
        fraud_warning_count: int = 0,
        fraud_score: int = 0
    ) -> Dict:
        """
        Kullanıcının kontrol önceliğini hesapla
        
        Returns:
            {
                "priority": int (1-5, 5 = en yüksek),
                "days_overdue": int,
                "reason": str
            }
        """
        now = datetime.utcnow()
        
        # Hiç kontrol yapılmamış
        if not last_inspection_date:
            return {
                "priority": 4,
                "days_overdue": 999,
                "reason": "Hiç kontrol yapılmamış"
            }
        
        days_since_inspection = (now - last_inspection_date).days
        
        # Fraud uyarısı varsa yüksek öncelik
        if fraud_warning_count > 0 or fraud_score >= 50:
            if days_since_inspection > self.PRIORITY_INTERVAL_DAYS:
                return {
                    "priority": 5,
                    "days_overdue": days_since_inspection - self.PRIORITY_INTERVAL_DAYS,
                    "reason": f"Fraud uyarısı var ({fraud_warning_count}), kontrol gecikmiş"
                }
            else:
                return {
                    "priority": 4,
                    "days_overdue": 0,
                    "reason": f"Fraud uyarısı var ({fraud_warning_count})"
                }
        
        # Normal 6 aylık kontrol
        if days_since_inspection > self.INSPECTION_INTERVAL_DAYS:
            overdue = days_since_inspection - self.INSPECTION_INTERVAL_DAYS
            
            if overdue > 60:
                priority = 4
            elif overdue > 30:
                priority = 3
            else:
                priority = 2
            
            return {
                "priority": priority,
                "days_overdue": overdue,
                "reason": f"6 aylık kontrol {overdue} gün gecikmiş"
            }
        
        # Henüz kontrol zamanı gelmemiş
        days_until = self.INSPECTION_INTERVAL_DAYS - days_since_inspection
        return {
            "priority": 1,
            "days_overdue": 0,
            "reason": f"Kontrol zamanına {days_until} gün var"
        }
    
    def validate_inspection_result(
        self,
        reported_reading: int,
        actual_reading: int,
        tolerance_percent: float = 5.0
    ) -> Dict:
        """
        Kontrol sonucunu değerlendir
        
        Args:
            reported_reading: Bildirilen okuma
            actual_reading: Gerçek okuma
            tolerance_percent: Tolerans yüzdesi
            
        Returns:
            {
                "fraud_detected": bool,
                "difference": int,
                "difference_percent": float,
                "severity": str (none/minor/major/critical)
            }
        """
        difference = actual_reading - reported_reading
        
        if reported_reading > 0:
            diff_percent = (difference / reported_reading) * 100
        else:
            diff_percent = 100 if difference > 0 else 0
        
        # Tolerans içinde
        if abs(diff_percent) <= tolerance_percent:
            return {
                "fraud_detected": False,
                "difference": difference,
                "difference_percent": diff_percent,
                "severity": "none"
            }
        
        # Ciddiyet belirleme
        if diff_percent > 50:
            severity = "critical"
        elif diff_percent > 20:
            severity = "major"
        elif diff_percent > tolerance_percent:
            severity = "minor"
        else:
            severity = "none"
        
        return {
            "fraud_detected": diff_percent > tolerance_percent,
            "difference": difference,
            "difference_percent": diff_percent,
            "severity": severity
        }
    
    def calculate_penalty(
        self,
        difference: int,
        months_late: int,
        unit_price: float = 10.0,
        interest_rate: float = 0.05
    ) -> Dict:
        """
        Ceza hesapla
        
        Args:
            difference: Tüketim farkı (m³)
            months_late: Gecikme ay sayısı
            unit_price: Birim fiyat
            interest_rate: Aylık faiz oranı
            
        Returns:
            {
                "base_amount": float,
                "interest": float,
                "total": float
            }
        """
        base_amount = difference * unit_price
        interest = base_amount * interest_rate * months_late
        
        return {
            "base_amount": base_amount,
            "interest": interest,
            "total": base_amount + interest
        }


# Global instance
periodic_inspection_manager = PeriodicInspectionManager()
