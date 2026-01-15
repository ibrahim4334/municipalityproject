# -*- coding: utf-8 -*-
"""
Gemini AI Service - Google Generative AI Integration
Su sayaci OCR dogrulama ve fraud analizi icin Gemini API kullanimi
"""
import os
import logging
import base64
from typing import Dict, Any, Optional

import google.generativeai as genai
from config import AI_API_KEY, AI_MODEL_NAME, AI_MODEL_PROVIDER

logger = logging.getLogger("gemini-service")


class GeminiService:
    """Gemini AI service for image analysis and fraud detection"""
    
    def __init__(self):
        self.enabled = False
        self.model = None
        
        if AI_MODEL_PROVIDER.lower() != "gemini":
            logger.info(f"AI provider is {AI_MODEL_PROVIDER}, Gemini service disabled")
            return
            
        if not AI_API_KEY:
            logger.warning("AI_API_KEY not set, Gemini service disabled")
            return
        
        try:
            genai.configure(api_key=AI_API_KEY)
            self.model = genai.GenerativeModel(AI_MODEL_NAME)
            self.enabled = True
            logger.info(f"Gemini service initialized with model: {AI_MODEL_NAME}")
        except Exception as e:
            logger.error(f"Failed to initialize Gemini: {e}")
    
    def analyze_water_meter_image(self, image_path: str) -> Dict[str, Any]:
        """
        Su sayaci fotografini analiz eder ve endeks degerini okur.
        
        Args:
            image_path: Gorsel dosya yolu
            
        Returns:
            Dict containing: meter_no, index, confidence, raw_response
        """
        result = {
            "meter_no": None,
            "index": None,
            "confidence": 0.0,
            "raw_response": "",
            "success": False
        }
        
        if not self.enabled:
            result["error"] = "Gemini service not enabled"
            return result
        
        if not os.path.exists(image_path):
            result["error"] = "Image file not found"
            return result
        
        try:
            # Read and encode image
            with open(image_path, "rb") as f:
                image_data = f.read()
            
            # Determine mime type
            ext = os.path.splitext(image_path)[1].lower()
            mime_map = {
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg", 
                ".png": "image/png",
                ".webp": "image/webp"
            }
            mime_type = mime_map.get(ext, "image/jpeg")
            
            # Create image part for Gemini
            image_part = {
                "mime_type": mime_type,
                "data": image_data
            }
            
            # Prompt for water meter reading
            prompt = """Bu bir su sayaci fotografidir. Lutfen asagidaki bilgileri cikar:

1. Sayac numarasi (varsa): Genellikle "No", "Meter", "ID" gibi etiketlerle belirtilir
2. Sayac endeksi (m3 degeri): Sayactaki guncel su tuketim degeri

Yaniti SADECE asagidaki JSON formatinda ver:
{
    "meter_no": "sayac numarasi veya null",
    "index": sayi olarak endeks degeri veya null,
    "confidence": 0.0 ile 1.0 arasi guven skoru
}

Sadece JSON dondur, baska aciklama ekleme."""
            
            # Call Gemini API
            response = self.model.generate_content([prompt, image_part])
            
            result["raw_response"] = response.text
            
            # Parse response
            import json
            import re
            
            # Extract JSON from response
            json_match = re.search(r'\{[^{}]*\}', response.text, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group())
                result["meter_no"] = parsed.get("meter_no")
                result["index"] = parsed.get("index")
                result["confidence"] = float(parsed.get("confidence", 0.0))
                result["success"] = True
            else:
                result["error"] = "Could not parse Gemini response"
                
        except Exception as e:
            logger.error(f"Gemini analysis failed: {e}")
            result["error"] = str(e)
        
        return result
    
    def detect_image_manipulation(self, image_path: str) -> Dict[str, Any]:
        """
        Fotografin manipule edilip edilmedigini kontrol eder.
        
        Returns:
            Dict with: is_manipulated, confidence, reasons
        """
        result = {
            "is_manipulated": False,
            "confidence": 0.0,
            "reasons": [],
            "success": False
        }
        
        if not self.enabled:
            result["error"] = "Gemini service not enabled"
            return result
        
        if not os.path.exists(image_path):
            result["error"] = "Image file not found"
            return result
        
        try:
            with open(image_path, "rb") as f:
                image_data = f.read()
            
            ext = os.path.splitext(image_path)[1].lower()
            mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
            mime_type = mime_map.get(ext, "image/jpeg")
            
            image_part = {"mime_type": mime_type, "data": image_data}
            
            prompt = """Bu fotografin dijital olarak manipule edilip edilmedigini analiz et.
            
Su sayaci fotograflarinda fraud tespiti icin asagidakileri kontrol et:
1. Photoshop veya duzenleme izleri
2. Piksel tutarsizliklari
3. Sayac rakamlarinda duzenleme belirtileri
4. Yapay ekleme veya silme izleri
5. Isik ve golge tutarsizliklari

Yaniti SADECE asagidaki JSON formatinda ver:
{
    "is_manipulated": true veya false,
    "confidence": 0.0 ile 1.0 arasi guven skoru,
    "reasons": ["sebep1", "sebep2"] veya bos liste
}

Sadece JSON dondur."""

            response = self.model.generate_content([prompt, image_part])
            
            import json
            import re
            
            json_match = re.search(r'\{[^{}]*\}', response.text, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group())
                result["is_manipulated"] = bool(parsed.get("is_manipulated", False))
                result["confidence"] = float(parsed.get("confidence", 0.0))
                result["reasons"] = parsed.get("reasons", [])
                result["success"] = True
            else:
                result["error"] = "Could not parse Gemini response"
                
        except Exception as e:
            logger.error(f"Manipulation detection failed: {e}")
            result["error"] = str(e)
        
        return result
    
    def calculate_fraud_risk_score(
        self,
        consumption_drop_percent: float,
        has_gps: bool,
        is_edited: bool,
        ocr_confidence: float
    ) -> Dict[str, Any]:
        """
        Fraud risk skoru hesaplar (0-100).
        
        Args:
            consumption_drop_percent: Tuketimdeki dusus yuzdesi
            has_gps: Fotograf GPS verisi iceriyor mu
            is_edited: Fotograf duzenlenmis mi
            ocr_confidence: OCR guven skoru
            
        Returns:
            Dict with: score, risk_level, factors
        """
        score = 0
        factors = []
        
        # Consumption drop factor (max 40 points)
        if consumption_drop_percent > 50:
            score += 40
            factors.append(f"Kritik tuketim dususu: %{consumption_drop_percent:.0f}")
        elif consumption_drop_percent > 30:
            score += 25
            factors.append(f"Yuksek tuketim dususu: %{consumption_drop_percent:.0f}")
        elif consumption_drop_percent > 15:
            score += 10
            factors.append(f"Orta tuketim dususu: %{consumption_drop_percent:.0f}")
        
        # GPS factor (20 points if missing)
        if not has_gps:
            score += 20
            factors.append("GPS verisi eksik")
        
        # Edit detection (30 points if edited)
        if is_edited:
            score += 30
            factors.append("Fotograf duzenlenmis")
        
        # OCR confidence (max 10 points for low confidence)
        if ocr_confidence < 0.5:
            score += 10
            factors.append(f"Dusuk OCR guveni: {ocr_confidence:.2f}")
        elif ocr_confidence < 0.7:
            score += 5
            factors.append(f"Orta OCR guveni: {ocr_confidence:.2f}")
        
        # Determine risk level
        if score >= 70:
            risk_level = "critical"
        elif score >= 50:
            risk_level = "high"
        elif score >= 30:
            risk_level = "medium"
        else:
            risk_level = "low"
        
        return {
            "score": min(score, 100),
            "risk_level": risk_level,
            "factors": factors,
            "requires_confirmation": score >= 50,
            "requires_inspection": score >= 70
        }


# Global instance
gemini_service = GeminiService()
