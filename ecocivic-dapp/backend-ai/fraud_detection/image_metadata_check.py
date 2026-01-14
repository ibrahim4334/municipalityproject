"""
Image Metadata Check
Fotoğraf metadata doğrulaması - real-time capture kontrolü
"""
import logging
from typing import Dict, Optional, Tuple
from datetime import datetime, timedelta
from io import BytesIO

try:
    from PIL import Image
    from PIL.ExifTags import TAGS, GPSTAGS
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

logger = logging.getLogger("image-metadata")


class ImageMetadataChecker:
    """
    Fotoğraf metadata doğrulama
    - EXIF verisi kontrolü
    - Timestamp doğrulama
    - GPS koordinat kontrolü
    - Düzenleme yazılımı tespiti
    """
    
    # Şüpheli yazılımlar
    EDITING_SOFTWARE = [
        "photoshop", "gimp", "lightroom", "snapseed", "pixlr",
        "afterlight", "vsco", "canva", "picsart", "adobe"
    ]
    
    # Max fotoğraf yaşı (dakika)
    MAX_PHOTO_AGE_MINUTES = 5
    
    def __init__(self):
        if not PIL_AVAILABLE:
            logger.warning("PIL/Pillow not available. Image metadata checking disabled.")
    
    def extract_exif(self, image_path_or_bytes) -> Dict:
        """
        EXIF verilerini çıkar
        
        Args:
            image_path_or_bytes: Dosya yolu veya bytes
            
        Returns:
            EXIF dictionary
        """
        if not PIL_AVAILABLE:
            return {}
        
        try:
            if isinstance(image_path_or_bytes, bytes):
                img = Image.open(BytesIO(image_path_or_bytes))
            else:
                img = Image.open(image_path_or_bytes)
            
            exif_data = img._getexif()
            if not exif_data:
                return {}
            
            exif = {}
            for tag_id, value in exif_data.items():
                tag = TAGS.get(tag_id, tag_id)
                exif[tag] = value
            
            return exif
            
        except Exception as e:
            logger.error(f"EXIF extraction failed: {e}")
            return {}
    
    def extract_gps_info(self, exif: Dict) -> Optional[Dict]:
        """
        GPS bilgilerini çıkar
        """
        gps_info = exif.get("GPSInfo", {})
        if not gps_info:
            return None
        
        try:
            gps = {}
            for key, val in gps_info.items():
                tag = GPSTAGS.get(key, key)
                gps[tag] = val
            
            # Koordinatları dereceye çevir
            lat = gps.get("GPSLatitude")
            lat_ref = gps.get("GPSLatitudeRef", "N")
            lon = gps.get("GPSLongitude")
            lon_ref = gps.get("GPSLongitudeRef", "E")
            
            if lat and lon:
                lat_deg = self._convert_to_degrees(lat)
                lon_deg = self._convert_to_degrees(lon)
                
                if lat_ref == "S":
                    lat_deg = -lat_deg
                if lon_ref == "W":
                    lon_deg = -lon_deg
                
                return {
                    "latitude": lat_deg,
                    "longitude": lon_deg,
                    "raw": gps
                }
            
            return None
            
        except Exception as e:
            logger.error(f"GPS extraction failed: {e}")
            return None
    
    def _convert_to_degrees(self, value) -> float:
        """DMS to degrees conversion"""
        d, m, s = value
        return float(d) + float(m) / 60 + float(s) / 3600
    
    def check_timestamp(self, exif: Dict) -> Tuple[bool, int, str]:
        """
        Timestamp kontrolü
        
        Returns:
            (is_recent, age_minutes, message)
        """
        datetime_original = exif.get("DateTimeOriginal") or exif.get("DateTime")
        
        if not datetime_original:
            return False, -1, "Timestamp bilgisi yok"
        
        try:
            # EXIF format: "2024:01:14 15:30:45"
            photo_time = datetime.strptime(str(datetime_original), "%Y:%m:%d %H:%M:%S")
            now = datetime.now()
            
            diff = now - photo_time
            age_minutes = int(diff.total_seconds() / 60)
            
            if age_minutes <= self.MAX_PHOTO_AGE_MINUTES:
                return True, age_minutes, f"Fotoğraf {age_minutes} dakika önce çekilmiş"
            else:
                return False, age_minutes, f"Fotoğraf {age_minutes} dakika önce çekilmiş (max: {self.MAX_PHOTO_AGE_MINUTES})"
                
        except Exception as e:
            logger.error(f"Timestamp parsing failed: {e}")
            return False, -1, f"Timestamp parse hatası: {str(e)}"
    
    def detect_editing_software(self, exif: Dict) -> Tuple[bool, Optional[str]]:
        """
        Düzenleme yazılımı tespiti
        
        Returns:
            (is_edited, software_name)
        """
        software = exif.get("Software", "")
        
        if software:
            software_lower = str(software).lower()
            for editor in self.EDITING_SOFTWARE:
                if editor in software_lower:
                    return True, software
        
        # ProcessingSoftware kontrolü
        processing = exif.get("ProcessingSoftware", "")
        if processing:
            processing_lower = str(processing).lower()
            for editor in self.EDITING_SOFTWARE:
                if editor in processing_lower:
                    return True, processing
        
        return False, None
    
    def validate_image(self, image_path_or_bytes) -> Dict:
        """
        Tam fotoğraf doğrulama
        
        Returns:
            {
                "valid": bool,
                "score": int (0-100, yüksek = güvenilir),
                "issues": list,
                "metadata": dict
            }
        """
        if not PIL_AVAILABLE:
            return {
                "valid": True,
                "score": 50,
                "issues": ["Metadata kontrolü devre dışı (PIL yok)"],
                "metadata": {}
            }
        
        issues = []
        score = 100
        
        # EXIF çıkar
        exif = self.extract_exif(image_path_or_bytes)
        
        if not exif:
            return {
                "valid": False,
                "score": 20,
                "issues": ["EXIF verisi yok - kamera ile çekilmemiş olabilir"],
                "metadata": {}
            }
        
        # 1. Timestamp kontrolü
        is_recent, age_minutes, msg = self.check_timestamp(exif)
        if not is_recent:
            if age_minutes == -1:
                score -= 30
                issues.append("Timestamp yok")
            else:
                score -= 40
                issues.append(msg)
        
        # 2. GPS kontrolü
        gps = self.extract_gps_info(exif)
        if not gps:
            score -= 15
            issues.append("GPS bilgisi yok")
        
        # 3. Düzenleme kontrolü
        is_edited, software = self.detect_editing_software(exif)
        if is_edited:
            score -= 35
            issues.append(f"Düzenleme yazılımı tespit edildi: {software}")
        
        # 4. Cihaz bilgisi kontrolü
        make = exif.get("Make", "")
        model = exif.get("Model", "")
        if not make and not model:
            score -= 10
            issues.append("Cihaz bilgisi yok")
        
        # Score'u 0-100 aralığına sınırla
        score = max(0, min(100, score))
        
        return {
            "valid": score >= 50,
            "score": score,
            "issues": issues,
            "metadata": {
                "has_exif": bool(exif),
                "timestamp": exif.get("DateTimeOriginal") or exif.get("DateTime"),
                "photo_age_minutes": age_minutes if age_minutes >= 0 else None,
                "has_gps": gps is not None,
                "gps": gps,
                "device_make": make,
                "device_model": model,
                "software": exif.get("Software"),
                "edited": is_edited
            }
        }


# Global instance
image_metadata_checker = ImageMetadataChecker()
