import os
import re
from typing import Any, Dict, Optional

import pytesseract
from PIL import Image, UnidentifiedImageError


import json

STATE_FILE = "demo_state.json"

def read_water_meter(image_path: str) -> Dict[str, Any]:
    """
    DEMO OTOMATİK SENARYO:
    Her çağrıda sırasıyla 3 farklı durum döner:
    1. Normal Fatura (Başarılı)
    2. Düşük Tüketim (Uyarı)
    3. Anomali/Fraud (Hata)
    """
    import time
    time.sleep(1.0) # İşlem simülasyonu
    
    # State oku
    state = 0
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r") as f:
                data = json.load(f)
                state = data.get("state", 0)
        except:
            pass
            
    # Sonraki state'i kaydet (Döngüsel: 0 -> 1 -> 2 -> 0)
    next_state = (state + 1) % 3
    try:
        with open(STATE_FILE, "w") as f:
            json.dump({"state": next_state}, f)
    except:
        pass

    # SENARYO SEÇİMİ
    if state == 0:
        # SENARYO 1: NORMAL FATURA
        # WSM-2024-001 (Mevcut sayaç, mock data var)
        # Endeks 15000 -> Kesin ileri gitmiş (Normal)
        return {
            "meter_no": "WSM-2024-001", 
            "index": 15000, 
            "raw_text": "SCENARIO 1: NORMAL - TOKEN KAZAN",
            "error": None
        }
    elif state == 1:
        # SENARYO 2: DÜŞÜK TÜKETİM UYARISI
        # WSM-2024-002 (Mock data'da ortalaması 25m3 olarak tanımlı)
        # Endeks 2114 verirsek fark 1 olur. 1 < 25 -> Düşüş!
        return {
            "meter_no": "WSM-2024-002",
            "index": 2114, 
            "raw_text": "SCENARIO 2: LOW CONSUMPTION WARNING",
            "error": None
        }
    else:
        # SENARYO 3: ANOMALİ (GERİ GİTME)
        # WSM-2024-003 (Mock data'da son endeks 3120)
        # Endeks 3000 verirsek geri gitmiş olur.
        return {
            "meter_no": "WSM-2024-003",
            "index": 3000, 
            "raw_text": "SCENARIO 3: FRAUD - METER REVERSED",
            "error": None
        }
