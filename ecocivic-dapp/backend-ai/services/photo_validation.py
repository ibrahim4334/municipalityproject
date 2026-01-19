"""
Photo Validation Service
Real-time fotoğraf doğrulama - EXIF metadata kontrolü
"""
import logging
from datetime import datetime, timedelta
from typing import Optional, Tuple
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS
import io

logger = logging.getLogger("photo-validation")


def validate_photo_metadata(image_file) -> dict:
    """
    Fotoğraf metadata'sını kontrol et:
    - EXIF timestamp (son 5 dakika içinde mi?)
    - GPS koordinatları (varsa)
    - Cihaz bilgisi
    - Galeri yükleme belirtileri
    
    Args:
        image_file: FileStorage veya file-like object
        
    Returns:
        {
            "is_realtime": True/False,
            "timestamp": datetime or None,
            "gps_coords": (lat, lon) or None,
            "device_info": str or None,
            "rejection_reason": str or None,
            "metadata": dict
        }
    """
    result = {
        "is_realtime": False,
        "timestamp": None,
        "gps_coords": None,
        "device_info": None,
        "rejection_reason": None,
        "metadata": {}
    }
    
    try:
        # Dosyayı oku
        image_data = image_file.read()
        image_file.seek(0)  # Reset file pointer
        
        image = Image.open(io.BytesIO(image_data))
        
        # EXIF verisi al
        exif_data = image._getexif()
        
        if not exif_data:
            # EXIF yok - desktop/webcam için izin ver ama uyarı ekle
            result["is_realtime"] = True  # Geçmesine izin ver
            result["metadata"]["warning"] = "EXIF metadata bulunamadı - düşük güven skoru"
            result["metadata"]["no_exif"] = True
            logger.warning("Photo has no EXIF data - allowing with low trust score")
            return result
        
        # EXIF tag'lerini parse et
        parsed_exif = {}
        for tag_id, value in exif_data.items():
            tag_name = TAGS.get(tag_id, tag_id)
            parsed_exif[tag_name] = value
        
        result["metadata"] = {k: str(v)[:100] for k, v in parsed_exif.items() if isinstance(v, (str, int, float))}
        
        # 1. Timestamp kontrolü
        date_taken = None
        for date_field in ["DateTimeOriginal", "DateTime", "DateTimeDigitized"]:
            if date_field in parsed_exif:
                try:
                    date_str = parsed_exif[date_field]
                    date_taken = datetime.strptime(date_str, "%Y:%m:%d %H:%M:%S")
                    break
                except (ValueError, TypeError):
                    continue
        
        if date_taken:
            result["timestamp"] = date_taken
            
            # Son 5 dakika içinde mi?
            now = datetime.now()
            time_diff = now - date_taken
            
            if time_diff > timedelta(minutes=5):
                result["rejection_reason"] = f"Fotoğraf {time_diff.total_seconds() / 60:.1f} dakika önce çekilmiş"
                return result
            
            if time_diff < timedelta(seconds=-60):  # Gelecekte çekilmiş (saat farkı?)
                result["rejection_reason"] = "Fotoğraf timestamp'i gelecekte"
                return result
        else:
            result["rejection_reason"] = "Fotoğraf çekim tarihi bulunamadı"
            return result
        
        # 2. GPS kontrolü (opsiyonel ama tercih edilen)
        gps_info = parsed_exif.get("GPSInfo")
        if gps_info:
            try:
                gps_data = _parse_gps_info(gps_info)
                if gps_data:
                    result["gps_coords"] = gps_data
            except Exception as e:
                logger.warning(f"GPS parsing failed: {e}")
        
        # 3. Cihaz bilgisi
        device_parts = []
        if "Make" in parsed_exif:
            device_parts.append(parsed_exif["Make"])
        if "Model" in parsed_exif:
            device_parts.append(parsed_exif["Model"])
        
        if device_parts:
            result["device_info"] = " ".join(str(p) for p in device_parts)
        
        # 4. Düzenleme kontrolü
        software = parsed_exif.get("Software", "")
        if isinstance(software, str):
            suspicious_software = ["photoshop", "gimp", "lightroom", "editor", "snapseed"]
            for sw in suspicious_software:
                if sw.lower() in software.lower():
                    result["rejection_reason"] = f"Fotoğraf düzenlenmiş olabilir: {software}"
                    return result
        
        # Tüm kontroller geçti
        result["is_realtime"] = True
        
    except Exception as e:
        logger.exception(f"Photo validation error: {e}")
        result["rejection_reason"] = f"Fotoğraf doğrulama hatası: {str(e)}"
    
    return result


def _parse_gps_info(gps_info: dict) -> Optional[Tuple[float, float]]:
    """
    EXIF GPS bilgisini lat/lon koordinatlarına çevir.
    """
    try:
        # GPS tag numaralarını isimlerle eşle
        gps_data = {}
        for key, value in gps_info.items():
            tag_name = GPSTAGS.get(key, key)
            gps_data[tag_name] = value
        
        # Latitude
        lat = gps_data.get("GPSLatitude")
        lat_ref = gps_data.get("GPSLatitudeRef", "N")
        
        # Longitude
        lon = gps_data.get("GPSLongitude")
        lon_ref = gps_data.get("GPSLongitudeRef", "E")
        
        if lat and lon:
            lat_decimal = _convert_to_degrees(lat)
            lon_decimal = _convert_to_degrees(lon)
            
            if lat_ref == "S":
                lat_decimal = -lat_decimal
            if lon_ref == "W":
                lon_decimal = -lon_decimal
            
            return (lat_decimal, lon_decimal)
            
    except Exception as e:
        logger.warning(f"GPS conversion failed: {e}")
    
    return None


def _convert_to_degrees(value) -> float:
    """
    GPS koordinatını derece cinsine çevir.
    """
    if isinstance(value, tuple) and len(value) == 3:
        d, m, s = value
        
        # IFDRational tipini handle et
        if hasattr(d, 'numerator'):
            d = float(d.numerator) / float(d.denominator) if d.denominator else 0
        if hasattr(m, 'numerator'):
            m = float(m.numerator) / float(m.denominator) if m.denominator else 0
        if hasattr(s, 'numerator'):
            s = float(s.numerator) / float(s.denominator) if s.denominator else 0
        
        return float(d) + float(m) / 60 + float(s) / 3600
    
    return 0.0


def validate_photo_for_water_reading(image_file) -> dict:
    """
    DEMO MOCK: demo sunumu için her görseli geçerli kabul eder.
    Hata riskini sıfırlar.
    """
    return {
        "valid": True,
        "validation_result": {
            "is_realtime": True,
            "timestamp": datetime.now(),
            "device_info": "Demo Camera",
            "metadata": {"demo": "enabled"}
        },
        "errors": []
    }
