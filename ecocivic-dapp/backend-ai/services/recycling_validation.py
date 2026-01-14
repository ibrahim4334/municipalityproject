"""
Recycling Validation Service
Geri dönüşüm doğrulama ve ödül hesaplama servisi
5 atık türü: Plastik, Cam, Metal, Kağıt, Elektronik
"""
from typing import Dict, Optional, Tuple
from services.qr_service import verify_qr_token
from enum import Enum


class WasteType(Enum):
    """Atık türleri - smart contract ile senkronize"""
    PLASTIC = "plastic"       # Plastik - 10 token/kg
    GLASS = "glass"           # Cam - 12 token/kg
    METAL = "metal"           # Metal - 15 token/kg
    PAPER = "paper"           # Kağıt/Karton - 8 token/kg
    ELECTRONIC = "electronic" # Elektronik - 25 token/adet


# Token rates per kg (elektronik için adet)
TOKEN_RATES: Dict[str, int] = {
    "plastic": 10,      # 10 token/kg
    "glass": 12,        # 12 token/kg
    "metal": 15,        # 15 token/kg
    "paper": 8,         # 8 token/kg
    "electronic": 25,   # 25 token/adet
}

# Alt kategoriler (doğru etiketleme kontrolü için)
SUBCATEGORIES: Dict[str, list] = {
    "plastic": ["PET", "HDPE", "PVC", "LDPE", "PP", "PS", "OTHER"],
    "glass": ["green", "white", "brown", "mixed"],          # Yeşil/Beyaz/Kahve cam
    "metal": ["aluminum", "steel", "tin", "copper"],        # Alüminyum/Çelik/Teneke
    "paper": ["cardboard", "newspaper", "office", "mixed"], # Karton/Gazete/Ofis
    "electronic": ["pcb", "battery", "cable", "phone", "small_appliance"],
}

# Geçerli atık türleri listesi
VALID_WASTE_TYPES = list(TOKEN_RATES.keys())


def validate_waste_type(waste_type: str) -> Tuple[bool, Optional[str]]:
    """
    Atık türünü doğrula
    
    Returns:
        (is_valid, error_message)
    """
    if not waste_type:
        return False, "Atık türü belirtilmedi"
    
    normalized = waste_type.lower().strip()
    if normalized not in VALID_WASTE_TYPES:
        return False, f"Geçersiz atık türü: {waste_type}. Geçerli türler: {', '.join(VALID_WASTE_TYPES)}"
    
    return True, None


def validate_subcategory(waste_type: str, subcategory: str) -> Tuple[bool, Optional[str]]:
    """
    Alt kategoriyi doğrula (opsiyonel ama önerilir)
    
    Returns:
        (is_valid, error_message)
    """
    if not subcategory:
        return True, None  # Alt kategori opsiyonel
    
    normalized_type = waste_type.lower().strip()
    normalized_sub = subcategory.lower().strip()
    
    valid_subs = SUBCATEGORIES.get(normalized_type, [])
    valid_subs_lower = [s.lower() for s in valid_subs]
    
    if normalized_sub not in valid_subs_lower:
        return False, f"Geçersiz alt kategori: {subcategory}. {waste_type} için geçerli alt kategoriler: {', '.join(valid_subs)}"
    
    return True, None


def calculate_token_reward(waste_type: str, amount: float) -> int:
    """
    Token ödülü hesapla
    
    Args:
        waste_type: Atık türü
        amount: Miktar (kg veya adet)
        
    Returns:
        Token miktarı
    """
    normalized = waste_type.lower().strip()
    rate = TOKEN_RATES.get(normalized, 0)
    
    if rate == 0 or amount <= 0:
        return 0
    
    return int(amount * rate)


def validate_recycling_submission(
    material_type: str,
    qr_token: Dict[str, any],
    wallet_address: str,
    subcategory: Optional[str] = None
) -> Dict[str, any]:
    """
    Geri dönüşüm gönderimini doğrular
    
    Args:
        material_type: Malzeme tipi (plastic, glass, metal, paper, electronic)
        qr_token: QR token data
        wallet_address: Kullanıcı cüzdan adresi
        subcategory: Alt kategori (PET, HDPE, yeşil cam, vb.)
    
    Returns:
        Validation result dictionary
    """
    # Validate waste type
    is_valid, error = validate_waste_type(material_type)
    if not is_valid:
        return {
            "valid": False,
            "error": error
        }
    
    # Validate subcategory (optional)
    if subcategory:
        is_valid, error = validate_subcategory(material_type, subcategory)
        if not is_valid:
            return {
                "valid": False,
                "error": error,
                "warning": True  # Just a warning, not blocking
            }
    
    # Validate wallet address
    if not wallet_address or not wallet_address.startswith("0x"):
        return {
            "valid": False,
            "error": "Geçersiz cüzdan adresi"
        }
    
    if len(wallet_address) != 42:
        return {
            "valid": False,
            "error": "Cüzdan adresi 42 karakter olmalı"
        }
    
    # Verify QR token
    is_valid, error_msg = verify_qr_token(qr_token)
    if not is_valid:
        return {
            "valid": False,
            "error": error_msg or "QR token doğrulama başarısız"
        }
    
    # Check wallet address matches
    if qr_token.get("wallet_address", "").lower() != wallet_address.lower():
        return {
            "valid": False,
            "error": "Cüzdan adresi eşleşmiyor"
        }
    
    # Check material type matches
    qr_material = qr_token.get("material_type", "").lower()
    if qr_material != material_type.lower():
        return {
            "valid": False,
            "error": f"Malzeme tipi eşleşmiyor. QR: {qr_material}, Gönderilen: {material_type}"
        }
    
    # Get amount
    base_amount = float(qr_token.get("amount", 0))
    if base_amount <= 0:
        return {
            "valid": False,
            "error": "Miktar 0'dan büyük olmalı"
        }
    
    # Max amount check
    max_amount = 1000  # kg veya adet
    if base_amount > max_amount:
        return {
            "valid": False,
            "error": f"Miktar maksimum değeri aşıyor ({max_amount})"
        }
    
    # Calculate reward
    reward_amount = calculate_token_reward(material_type, base_amount)
    token_rate = TOKEN_RATES.get(material_type.lower(), 0)
    
    return {
        "valid": True,
        "reward_amount": reward_amount,
        "material_type": material_type.lower(),
        "subcategory": subcategory,
        "base_amount": base_amount,
        "token_rate": token_rate,
        "unit": "adet" if material_type.lower() == "electronic" else "kg",
        "qr_hash": qr_token.get("hash"),
        "requires_staff_approval": True,  # Her zaman personel onayı gerekli
        "message": f"{base_amount} {material_type} için {reward_amount} BELT token kazanacaksınız (personel onayı sonrası)"
    }


def get_all_waste_types() -> Dict[str, dict]:
    """
    Tüm atık türlerini ve token oranlarını getir
    """
    result = {}
    for waste_type, rate in TOKEN_RATES.items():
        result[waste_type] = {
            "token_rate": rate,
            "unit": "adet" if waste_type == "electronic" else "kg",
            "subcategories": SUBCATEGORIES.get(waste_type, []),
            "label_tr": {
                "plastic": "Plastik",
                "glass": "Cam",
                "metal": "Metal",
                "paper": "Kağıt/Karton",
                "electronic": "Elektronik"
            }.get(waste_type, waste_type)
        }
    return result
