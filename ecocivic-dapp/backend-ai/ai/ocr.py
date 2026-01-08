import os
import re
from typing import Any, Dict, Optional

import pytesseract
from PIL import Image, UnidentifiedImageError


def read_water_meter(image_path: str) -> Dict[str, Any]:
    """
    Sayaç fotoğrafından sayaç numarası ve endeks okur.

    Daha güvenli / dayanıklı hale getirildi:
    - Dosya mevcut mu kontrol edilir
    - Geçersiz görseller yakalanır
    - Her durumda aynı shape'te dict döner
    """
    result: Dict[str, Optional[Any]] = {
        "meter_no": None,
        "index": None,
        "raw_text": "",
    }

    if not image_path or not os.path.exists(image_path):
        result["error"] = "Image file not found"
        return result

    try:
        image = Image.open(image_path)
    except (FileNotFoundError, UnidentifiedImageError) as e:
        result["error"] = f"Image could not be opened: {str(e)}"
        return result

    try:
        text = pytesseract.image_to_string(image)
    except Exception as e:
        # OCR kütüphanesi beklenmedik bir hata verirse bile backend çökmemeli
        result["error"] = f"OCR failed: {str(e)}"
        return result

    result["raw_text"] = text

    # Örnek regex'ler (projede sayaç tipine göre güncellenecek)
    meter_no_match = re.search(r"(?:Meter|No|ID)[:\s]*([0-9]{5,})", text)
    index_match = re.search(r"([0-9]{3,6})\s*m3", text)

    result["meter_no"] = meter_no_match.group(1) if meter_no_match else None

    try:
        result["index"] = int(index_match.group(1)) if index_match else None
    except (TypeError, ValueError):
        # Regex tutsa da integer'a cast edilemezse index'i None bırak
        result["index"] = None

    return result
