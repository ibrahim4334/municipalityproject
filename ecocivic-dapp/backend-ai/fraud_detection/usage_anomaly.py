"""
Usage Anomaly Signal Detection
Tüketim anomali sinyal sistemi - istatistiksel analiz

v1 Not: Bu sistem ML/AI modeli KULLANMAZ.
Sadece istatistiksel yöntemler (z-score, standart sapma, trend) kullanır.
"""
import logging
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
import statistics

logger = logging.getLogger("usage-anomaly-signal")


class UsageAnomalySignalDetector:
    """
    Su tüketimi anomali sinyal sistemi (İstatistiksel)
    
    NOT: Bu sistem ML/AI KULLANMAZ.
    
    - Geçmiş tüketim trendi analizi
    - Mevsimsel düzeltme
    - Z-score hesaplama
    """
    
    # Thresholds
    DROP_THRESHOLD_PERCENT = 50       # %50+ düşüş
    SPIKE_THRESHOLD_PERCENT = 200     # %200+ artış
    Z_SCORE_THRESHOLD = 2.5           # Standart sapma eşiği
    MIN_HISTORY_MONTHS = 3            # Minimum geçmiş veri
    
    def __init__(self):
        pass
    
    def calculate_signal_score(
        self,
        current_consumption: float,
        historical_data: List[float],
        metadata: Optional[Dict] = None
    ) -> Dict:
        """
        Anomali sinyal skoru hesapla (0-100) - İstatistiksel analiz
        
        NOT: Bu metod ML/AI KULLANMAZ. Sadece istatistiksel hesaplama yapar.
        
        Args:
            current_consumption: Mevcut ay tüketimi
            historical_data: Geçmiş tüketim listesi (son 6-12 ay)
            metadata: Ek bilgiler (fotoğraf metadata, GPS, vb.)
            
        Returns:
            {
                "signal_score": int (0-100),
                "signal_level": str (low/medium/high/critical),
                "anomalies": list,
                "recommendation": str
            }
        """
        score = 0
        anomalies = []
        
        if not historical_data or len(historical_data) < self.MIN_HISTORY_MONTHS:
            return {
                "signal_score": 0,
                "signal_level": "unknown",
                "anomalies": ["Yetersiz geçmiş veri"],
                "recommendation": "Daha fazla veri toplanana kadar izlemeye devam"
            }
        
        # 1. Ortalama ve standart sapma hesapla
        avg_consumption = statistics.mean(historical_data)
        std_dev = statistics.stdev(historical_data) if len(historical_data) > 1 else 0
        
        # 2. Yüzdesel değişim kontrolü
        if avg_consumption > 0:
            change_percent = ((current_consumption - avg_consumption) / avg_consumption) * 100
            
            # Büyük düşüş
            if change_percent <= -self.DROP_THRESHOLD_PERCENT:
                score += 40
                anomalies.append(f"Tüketim %{abs(change_percent):.1f} düştü")
            
            # Büyük artış (da şüpheli olabilir)
            if change_percent >= self.SPIKE_THRESHOLD_PERCENT:
                score += 20
                anomalies.append(f"Tüketim %{change_percent:.1f} arttı")
        
        # 3. Z-Score kontrolü
        if std_dev > 0:
            z_score = (current_consumption - avg_consumption) / std_dev
            
            if abs(z_score) > self.Z_SCORE_THRESHOLD:
                score += 25
                anomalies.append(f"Z-score: {z_score:.2f} (eşik: ±{self.Z_SCORE_THRESHOLD})")
        
        # 4. Trend analizi (son 3 ay sürekli düşüş?)
        if len(historical_data) >= 3:
            recent = historical_data[-3:]
            if all(recent[i] > recent[i+1] for i in range(len(recent)-1)):
                if current_consumption < recent[-1]:
                    score += 15
                    anomalies.append("Son 4 ayda sürekli düşüş trendi")
        
        # 5. Metadata kontrolleri
        if metadata:
            # Fotoğraf timestamp kontrolü
            if metadata.get("photo_age_minutes", 0) > 5:
                score += 10
                anomalies.append("Fotoğraf 5 dakikadan eski")
            
            # GPS yoksa
            if not metadata.get("has_gps", True):
                score += 5
                anomalies.append("GPS bilgisi yok")
            
            # Düzenleme yazılımı tespiti
            if metadata.get("edited", False):
                score += 20
                anomalies.append("Fotoğraf düzenleme tespiti")
        
        # Score'u 0-100 aralığına sınırla
        score = min(100, max(0, score))
        
        # Sinyal seviyesi (KARAR DEĞİL, sadece sinyal)
        if score >= 70:
            signal_level = "critical"
            recommendation = "Personel incelemesi gerekli"
        elif score >= 50:
            signal_level = "high"
            recommendation = "Personel incelemesi önerilir"
        elif score >= 30:
            signal_level = "medium"
            recommendation = "İzlemeye devam, bilgilendirme gönder"
        else:
            signal_level = "low"
            recommendation = "Normal işlem"
        
        return {
            "signal_score": score,
            "signal_level": signal_level,
            "anomalies": anomalies,
            "recommendation": recommendation,
            "details": {
                "current_consumption": current_consumption,
                "average_consumption": avg_consumption,
                "std_deviation": std_dev,
                "change_percent": ((current_consumption - avg_consumption) / avg_consumption * 100) if avg_consumption > 0 else 0
            }
        }
    
    def detect_seasonal_anomaly(
        self,
        current_consumption: float,
        current_month: int,
        yearly_data: Dict[int, List[float]]
    ) -> Tuple[bool, str]:
        """
        Mevsimsel anomali tespiti
        
        Args:
            current_consumption: Mevcut tüketim
            current_month: Mevcut ay (1-12)
            yearly_data: Yıllık geçmiş veri {month: [values]}
            
        Returns:
            (is_anomaly, reason)
        """
        if current_month not in yearly_data or not yearly_data[current_month]:
            return False, "Karşılaştırmalı veri yok"
        
        same_month_avg = statistics.mean(yearly_data[current_month])
        
        if same_month_avg > 0:
            deviation = abs(current_consumption - same_month_avg) / same_month_avg * 100
            
            if deviation > 50:
                return True, f"Aynı ay ortalamasından %{deviation:.1f} sapma"
        
        return False, "Normal"


# Global instance
usage_anomaly_signal_detector = UsageAnomalySignalDetector()

# Geriye uyumluluk için alias
usage_anomaly_detector = usage_anomaly_signal_detector
UsageAnomalyDetector = UsageAnomalySignalDetector
