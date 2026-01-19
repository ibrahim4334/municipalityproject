"""
Anomaly Signal Report Service
Kullanıcı anomali sinyal raporu - istatistiksel analiz

v1 Not: Bu servis ML/AI KULLANMAZ.
İstatistiksel analiz ile sinyal raporu üretir.
Sonular KARAR değil, sadece SINYAL'dir.
"""
import logging
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass

logger = logging.getLogger("anomaly-signal-report")


@dataclass
class SignalFactor:
    """Sinyal faktörü"""
    name: str
    weight: float
    score: float
    description: str


class AnomalySignalReport:
    """
    Kullanıcı Anomali Sinyal Raporu
    
    NOT: Bu servis ML/AI KULLANMAZ ve KARAR VERMEZ.
    Sadece istatistiksel sinyal üretir.
    
    Kategoriler:
    - Tüketim davranışı
    - Anomali geçmişi
    - Doğrulama kalitesi
    - Hesap yaşı ve aktivite
    """
    
    # Ağırlıklar (toplam = 1.0)
    WEIGHTS = {
        "consumption_behavior": 0.35,
        "fraud_history": 0.30,
        "verification_quality": 0.20,
        "account_standing": 0.15
    }
    
    def __init__(self):
        pass
    
    def calculate_consumption_score(
        self,
        consumption_history: List[float],
        warning_count: int = 0,
        confirmed_readings: int = 0
    ) -> Tuple[float, List[SignalFactor]]:
        """
        Tüketim davranış skoru (0-100, düşük = yüksek sinyal)
        """
        score = 100
        factors = []
        
        if not consumption_history:
            return 50, [SignalFactor("no_history", 1.0, 50, "Tüketim geçmişi yok")]
        
        # 1. Tutarlılık
        if len(consumption_history) >= 3:
            import statistics
            mean = statistics.mean(consumption_history)
            std = statistics.stdev(consumption_history) if len(consumption_history) > 1 else 0
            cv = std / mean if mean > 0 else 0
            
            if cv > 0.5:
                score -= 20
                factors.append(SignalFactor(
                    "high_variance", 0.2, cv * 100,
                    f"Yüksek tüketim varyansı (CV: {cv:.2f})"
                ))
            elif cv < 0.15:
                score += 5
                factors.append(SignalFactor(
                    "consistent", 0.05, 100 - cv * 100,
                    "Tutarlı tüketim"
                ))
        
        # 2. Uyarı sayısı
        if warning_count > 0:
            penalty = min(30, warning_count * 10)
            score -= penalty
            factors.append(SignalFactor(
                "warnings", warning_count * 0.1, penalty,
                f"{warning_count} kez tüketim uyarısı"
            ))
        
        # 3. Onaylı okuma oranı
        total_readings = len(consumption_history)
        if total_readings > 0 and confirmed_readings > 0:
            confirm_rate = confirmed_readings / total_readings
            if confirm_rate < 0.7:
                score -= 15
                factors.append(SignalFactor(
                    "low_confirm", 0.15, (1 - confirm_rate) * 100,
                    f"Düşük onay oranı: {confirm_rate:.0%}"
                ))
        
        return max(0, min(100, score)), factors
    
    def calculate_anomaly_history_score(
        self,
        system_anomaly_count: int = 0,
        inspection_anomaly_count: int = 0,
        total_penalties: float = 0,
        is_blacklisted: bool = False
    ) -> Tuple[float, List[SignalFactor]]:
        """
        Anomali geçmişi skoru (0-100, düşük = yüksek sinyal)
        """
        if is_blacklisted:
            return 0, [SignalFactor("blacklisted", 1.0, 0, "Kara listede")]
        
        score = 100
        factors = []
        
        # Sistem anomali tespiti
        if system_anomaly_count > 0:
            penalty = min(40, system_anomaly_count * 15)
            score -= penalty
            factors.append(SignalFactor(
                "system_anomaly", system_anomaly_count * 0.15, penalty,
                f"{system_anomaly_count} istatistiksel anomali tespiti"
            ))
        
        # Fiziksel kontrol anomali
        if inspection_anomaly_count > 0:
            penalty = min(50, inspection_anomaly_count * 25)
            score -= penalty
            factors.append(SignalFactor(
                "inspection_anomaly", inspection_anomaly_count * 0.25, penalty,
                f"{inspection_anomaly_count} fiziksel kontrol anomali"
            ))
        
        # Total penalties
        if total_penalties > 0:
            tier = min(3, int(total_penalties / 1000))
            penalty = tier * 10
            score -= penalty
            factors.append(SignalFactor(
                "penalties", tier * 0.1, penalty,
                f"Toplam ceza: {total_penalties:.0f} TL"
            ))
        
        return max(0, min(100, score)), factors
    
    def calculate_verification_score(
        self,
        avg_photo_age: float = 0,  # dakika
        gps_available_rate: float = 1.0,
        editing_detected: bool = False
    ) -> Tuple[float, List[SignalFactor]]:
        """
        Doğrulama kalitesi skoru (0-100)
        """
        score = 100
        factors = []
        
        # Photo age
        if avg_photo_age > 5:
            penalty = min(30, (avg_photo_age - 5) * 3)
            score -= penalty
            factors.append(SignalFactor(
                "photo_age", 0.3, penalty,
                f"Ort. fotoğraf yaşı: {avg_photo_age:.1f} dk"
            ))
        
        # GPS
        if gps_available_rate < 0.8:
            penalty = (1 - gps_available_rate) * 30
            score -= penalty
            factors.append(SignalFactor(
                "gps_missing", 0.3, penalty,
                f"GPS bulunma oranı: {gps_available_rate:.0%}"
            ))
        
        # Editing
        if editing_detected:
            score -= 40
            factors.append(SignalFactor(
                "editing", 0.4, 40,
                "Fotoğraf düzenleme tespiti"
            ))
        
        return max(0, min(100, score)), factors
    
    def calculate_account_score(
        self,
        account_age_days: int = 0,
        total_submissions: int = 0,
        payment_history_good: bool = True
    ) -> Tuple[float, List[SignalFactor]]:
        """
        Hesap durumu skoru (0-100)
        """
        score = 50  # Başlangıç
        factors = []
        
        # Account age
        if account_age_days > 365:
            score += 20
            factors.append(SignalFactor(
                "established", 0.2, 80,
                "1 yıldan eski hesap"
            ))
        elif account_age_days < 30:
            score -= 15
            factors.append(SignalFactor(
                "new_account", 0.15, 30,
                "Yeni hesap (< 30 gün)"
            ))
        
        # Activity
        if total_submissions > 12:
            score += 15
            factors.append(SignalFactor(
                "active", 0.15, 85,
                "Aktif kullanıcı"
            ))
        elif total_submissions < 3:
            score -= 10
            factors.append(SignalFactor(
                "inactive", 0.1, 40,
                "Düşük aktivite"
            ))
        
        # Payment history
        if not payment_history_good:
            score -= 25
            factors.append(SignalFactor(
                "payment_issues", 0.25, 25,
                "Ödeme geçmişi sorunlu"
            ))
        
        return max(0, min(100, score)), factors
    
    def generate_signal_report(
        self,
        user_data: Dict
    ) -> Dict:
        """
        Kapsamlı anomali sinyal raporu oluştur
        
        NOT: Bu rapor KARAR içermez, sadece sinyal üretir.
        Kararlar personel/admin tarafından verilir.
        
        Args:
            user_data: {
                consumption_history: List[float],
                warning_count: int,
                confirmed_readings: int,
                system_anomaly_count: int,
                inspection_anomaly_count: int,
                total_penalties: float,
                is_blacklisted: bool,
                avg_photo_age: float,
                gps_available_rate: float,
                editing_detected: bool,
                account_age_days: int,
                total_submissions: int,
                payment_history_good: bool
            }
            
        Returns:
            {
                "overall_score": int (0-100),
                "signal_level": str,
                "categories": {...},
                "top_signal_factors": [...],
                "recommendation": str
            }
        """
        categories = {}
        all_factors = []
        
        # 1. Consumption behavior
        cons_score, cons_factors = self.calculate_consumption_score(
            user_data.get("consumption_history", []),
            user_data.get("warning_count", 0),
            user_data.get("confirmed_readings", 0)
        )
        categories["consumption_behavior"] = {
            "score": cons_score,
            "weight": self.WEIGHTS["consumption_behavior"],
            "factors": [f.__dict__ for f in cons_factors]
        }
        all_factors.extend(cons_factors)
        
        # 2. Anomaly history
        anomaly_score, anomaly_factors = self.calculate_anomaly_history_score(
            user_data.get("system_anomaly_count", 0),
            user_data.get("inspection_anomaly_count", 0),
            user_data.get("total_penalties", 0),
            user_data.get("is_blacklisted", False)
        )
        categories["anomaly_history"] = {
            "score": anomaly_score,
            "weight": self.WEIGHTS["fraud_history"],
            "factors": [f.__dict__ for f in anomaly_factors]
        }
        all_factors.extend(anomaly_factors)
        
        # 3. Verification quality
        ver_score, ver_factors = self.calculate_verification_score(
            user_data.get("avg_photo_age", 0),
            user_data.get("gps_available_rate", 1.0),
            user_data.get("editing_detected", False)
        )
        categories["verification_quality"] = {
            "score": ver_score,
            "weight": self.WEIGHTS["verification_quality"],
            "factors": [f.__dict__ for f in ver_factors]
        }
        all_factors.extend(ver_factors)
        
        # 4. Account standing
        acc_score, acc_factors = self.calculate_account_score(
            user_data.get("account_age_days", 0),
            user_data.get("total_submissions", 0),
            user_data.get("payment_history_good", True)
        )
        categories["account_standing"] = {
            "score": acc_score,
            "weight": self.WEIGHTS["account_standing"],
            "factors": [f.__dict__ for f in acc_factors]
        }
        all_factors.extend(acc_factors)
        
        # Calculate overall score (weighted)
        overall_score = (
            cons_score * self.WEIGHTS["consumption_behavior"] +
            anomaly_score * self.WEIGHTS["fraud_history"] +
            ver_score * self.WEIGHTS["verification_quality"] +
            acc_score * self.WEIGHTS["account_standing"]
        )
        
        # Signal level (KARAR DEĞİL, sadece sinyal seviyesi)
        if overall_score >= 80:
            signal_level = "low"
            recommendation = "Güvenilir kullanıcı"
        elif overall_score >= 60:
            signal_level = "medium"
            recommendation = "İzlemeye devam"
        elif overall_score >= 40:
            signal_level = "high"
            recommendation = "Personel incelemesi önerilir"
        else:
            signal_level = "critical"
            recommendation = "Acil personel incelemesi gerekli"
        
        # Top signal factors (sorted by score)
        top_factors = sorted(all_factors, key=lambda f: f.score, reverse=True)[:5]
        
        return {
            "overall_score": int(overall_score),
            "signal_level": signal_level,
            "categories": categories,
            "top_signal_factors": [f.__dict__ for f in top_factors],
            "recommendation": recommendation,
            "generated_at": datetime.utcnow().isoformat(),
            "note": "Bu rapor KARAR içermez, sadece istatistiksel sinyal üretir."
        }


# Import for type hints
from typing import Tuple

# Global instance
anomaly_signal_report = AnomalySignalReport()

# Geriye uyumluluk için alias
risk_score_card = anomaly_signal_report
RiskScoreCard = AnomalySignalReport
RiskFactor = SignalFactor
