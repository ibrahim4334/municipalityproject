"""
Statistical Anomaly Signal System
Zaman serisi analizi ve istatistiksel yöntemlerle anomali sinyal tespiti

v1 Not: Bu sistem ML/AI modeli KULLANMAZ. 
İstatistiksel analiz (z-score, trend, standart sapma) ile çalışır.
"""
import logging
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
import statistics
import math

logger = logging.getLogger("anomaly-signal-system")


class AnomalySignalDetector:
    """
    İstatistiksel Anomali Sinyal Tespit Sistemi
    
    NOT: Bu sistem makine öğrenimi KULLANMAZ.
    Sadece istatistiksel yöntemler (z-score, trend analizi, standart sapma) ile çalışır.
    
    Özellikler:
    - Zaman serisi analizi
    - Trend tahmini  
    - Anomali sinyal puanlama
    - Mevsimsel düzeltme
    """
    
    def __init__(self):
        # Model parametreleri
        self.alpha = 0.3  # Exponential smoothing factor
        self.beta = 0.1   # Trend smoothing factor
        
    def exponential_smoothing(self, data: List[float]) -> List[float]:
        """
        Basit üstel düzleştirme (Simple Exponential Smoothing)
        """
        if not data:
            return []
        
        smoothed = [data[0]]
        for i in range(1, len(data)):
            smoothed.append(self.alpha * data[i] + (1 - self.alpha) * smoothed[i-1])
        
        return smoothed
    
    def holt_linear_trend(self, data: List[float]) -> Tuple[List[float], float]:
        """
        Holt's Linear Trend Method
        Trend ve tahmin hesaplama
        
        Returns:
            (smoothed_values, next_forecast)
        """
        if len(data) < 2:
            return data, data[-1] if data else 0
        
        # Initialize
        level = [data[0]]
        trend = [data[1] - data[0]]
        
        for i in range(1, len(data)):
            new_level = self.alpha * data[i] + (1 - self.alpha) * (level[i-1] + trend[i-1])
            new_trend = self.beta * (new_level - level[i-1]) + (1 - self.beta) * trend[i-1]
            level.append(new_level)
            trend.append(new_trend)
        
        # Forecast
        forecast = level[-1] + trend[-1]
        
        return level, forecast
    
    def detect_trend(self, data: List[float]) -> Dict:
        """
        Trend analizi
        
        Returns:
            {
                "trend": "increasing" | "decreasing" | "stable",
                "slope": float,
                "r_squared": float,
                "forecast_next": float
            }
        """
        if len(data) < 3:
            return {
                "trend": "unknown",
                "slope": 0,
                "r_squared": 0,
                "forecast_next": data[-1] if data else 0
            }
        
        # Simple linear regression
        n = len(data)
        x = list(range(n))
        
        x_mean = sum(x) / n
        y_mean = sum(data) / n
        
        numerator = sum((x[i] - x_mean) * (data[i] - y_mean) for i in range(n))
        denominator = sum((x[i] - x_mean) ** 2 for i in range(n))
        
        slope = numerator / denominator if denominator != 0 else 0
        intercept = y_mean - slope * x_mean
        
        # R-squared
        ss_tot = sum((data[i] - y_mean) ** 2 for i in range(n))
        ss_res = sum((data[i] - (slope * x[i] + intercept)) ** 2 for i in range(n))
        r_squared = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0
        
        # Forecast
        forecast = slope * n + intercept
        
        # Trend direction
        if slope > 0.5:
            trend = "increasing"
        elif slope < -0.5:
            trend = "decreasing"
        else:
            trend = "stable"
        
        return {
            "trend": trend,
            "slope": slope,
            "r_squared": abs(r_squared),
            "forecast_next": max(0, forecast)
        }
    
    def calculate_anomaly_score(
        self,
        current_value: float,
        historical_data: List[float],
        timestamp: Optional[datetime] = None
    ) -> Dict:
        """
        Kapsamlı anomali skoru hesapla
        
        Returns:
            {
                "anomaly_score": float (0-100),
                "is_anomaly": bool,
                "anomaly_type": str,
                "details": dict
            }
        """
        if len(historical_data) < 3:
            return {
                "anomaly_score": 0,
                "is_anomaly": False,
                "anomaly_type": "insufficient_data",
                "details": {}
            }
        
        score = 0
        anomaly_type = "none"
        details = {}
        
        # 1. Statistical analysis
        mean = statistics.mean(historical_data)
        std = statistics.stdev(historical_data)
        
        if std > 0:
            z_score = (current_value - mean) / std
            details["z_score"] = z_score
            
            if abs(z_score) > 3:
                score += 40
                anomaly_type = "extreme_outlier"
            elif abs(z_score) > 2:
                score += 25
                anomaly_type = "outlier"
            elif abs(z_score) > 1.5:
                score += 10
        
        # 2. Trend analysis
        trend = self.detect_trend(historical_data)
        details["trend"] = trend
        
        # Compare with forecast
        forecast_error = abs(current_value - trend["forecast_next"])
        if mean > 0:
            forecast_error_pct = (forecast_error / mean) * 100
            details["forecast_error_pct"] = forecast_error_pct
            
            if forecast_error_pct > 50:
                score += 20
        
        # 3. Sudden change detection
        if historical_data:
            last_value = historical_data[-1]
            if last_value > 0:
                change_pct = ((current_value - last_value) / last_value) * 100
                details["change_from_last"] = change_pct
                
                if change_pct < -50:
                    score += 25
                    anomaly_type = "sudden_drop"
                elif change_pct > 100:
                    score += 15
                    anomaly_type = "sudden_spike"
        
        # 4. Consistency check (coefficient of variation)
        if mean > 0:
            cv = std / mean
            details["coefficient_of_variation"] = cv
            
            if cv < 0.1 and abs(current_value - mean) / mean > 0.3:
                # Normalde çok tutarlı, şimdi farklı
                score += 15
        
        # Normalize score
        score = min(100, max(0, score))
        
        return {
            "anomaly_score": score,
            "is_anomaly": score >= 40,
            "anomaly_type": anomaly_type,
            "mean": mean,
            "std": std,
            "details": details
        }
    
    def calculate_anomaly_signal(
        self,
        user_history: List[Dict],
        current_reading: float,
        metadata: Optional[Dict] = None
    ) -> Dict:
        """
        Anomali sinyal gücü hesaplama (İstatistiksel analiz)
        
        NOT: Bu metod ML/AI KULLANMAZ. Sadece istatistiksel hesaplama yapar.
        
        Args:
            user_history: [{reading, consumption, timestamp}, ...]
            current_reading: Mevcut okuma
            metadata: Ek bilgiler (fotoğraf age, GPS, vb.)
            
        Returns:
            {
                "signal_strength": float (0-1),
                "signal_level": str,
                "signal_factors": list,
                "recommendation": str
            }
        """
        signal_factors = []
        signal_strength = 0.0
        
        if not user_history:
            return {
                "signal_strength": 0.0,
                "signal_level": "unknown",
                "signal_factors": ["Yetersiz geçmiş veri"],
                "recommendation": "Veri toplamaya devam"
            }
        
        # Extract consumption data
        consumptions = [h.get("consumption", 0) for h in user_history if h.get("consumption")]
        
        if consumptions:
            # Anomaly analysis (istatistiksel)
            last_consumption = current_reading - (user_history[-1].get("reading", current_reading) if user_history else current_reading)
            if last_consumption > 0:
                anomaly = self.calculate_anomaly_score(last_consumption, consumptions)
                
                if anomaly["is_anomaly"]:
                    signal_strength += 0.3
                    signal_factors.append(f"Anomali sinyal: {anomaly['anomaly_type']}")
                
                # Z-score contribution (istatistiksel)
                z = anomaly["details"].get("z_score", 0)
                if abs(z) > 2:
                    signal_strength += min(0.2, abs(z) * 0.05)
                    signal_factors.append(f"Z-score sapması: {z:.2f}")
            
            # Trend analysis (istatistiksel)
            trend = self.detect_trend(consumptions)
            if trend["trend"] == "decreasing" and trend["slope"] < -2:
                signal_strength += 0.15
                signal_factors.append("Sürekli düşüş trendi")
        
        # Metadata analysis
        if metadata:
            if metadata.get("photo_age_minutes", 0) > 5:
                signal_strength += 0.1
                signal_factors.append("Eski fotoğraf")
            
            if not metadata.get("has_gps", True):
                signal_strength += 0.05
                signal_factors.append("GPS yok")
            
            if metadata.get("edited", False):
                signal_strength += 0.2
                signal_factors.append("Fotoğraf düzenlenmiş")
        
        # Normalize
        signal_strength = min(1.0, max(0.0, signal_strength))
        
        # Signal level (sinyal seviyesi - karar DEĞİL)
        if signal_strength >= 0.7:
            signal_level = "critical"
            recommendation = "Personel incelemesi gerekli"
        elif signal_strength >= 0.5:
            signal_level = "high"
            recommendation = "Personel incelemesi önerilir"
        elif signal_strength >= 0.3:
            signal_level = "medium"
            recommendation = "İzlemeye devam"
        else:
            signal_level = "low"
            recommendation = "Normal işlem"
        
        return {
            "signal_strength": round(signal_strength, 3),
            "signal_level": signal_level,
            "signal_factors": signal_factors,
            "recommendation": recommendation
        }


# Global instance
anomaly_signal_detector = AnomalySignalDetector()

# Geriye uyumluluk için alias (eski import'ları kırmamak için)
ml_fraud_detector = anomaly_signal_detector
MLFraudDetector = AnomalySignalDetector
