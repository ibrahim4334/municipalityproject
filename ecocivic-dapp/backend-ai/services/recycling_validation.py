"""
Recycling Validation Service
Geri dönüşüm doğrulama ve ödül hesaplama servisi
"""
from typing import Dict, Optional
from services.qr_service import verify_qr_token


def validate_recycling_submission(
    material_type: str,
    qr_token: Dict[str, any],
    wallet_address: str
) -> Dict[str, any]:
    """
    Geri dönüşüm gönderimini doğrular
    
    Args:
        material_type: Malzeme tipi
        qr_token: QR token data
        wallet_address: Kullanıcı cüzdan adresi
    
    Returns:
        Validation result dictionary
    """
    # Validate inputs
    if not material_type or material_type not in ["glass", "paper", "metal"]:
        return {
            "valid": False,
            "error": "Invalid material type"
        }
    
    if not wallet_address or not wallet_address.startswith("0x"):
        return {
            "valid": False,
            "error": "Invalid wallet address"
        }
    
    # Verify QR token
    is_valid, error_msg = verify_qr_token(qr_token)
    if not is_valid:
        return {
            "valid": False,
            "error": error_msg or "QR token verification failed"
        }
    
    # Check wallet address matches
    if qr_token.get("wallet_address", "").lower() != wallet_address.lower():
        return {
            "valid": False,
            "error": "Wallet address mismatch"
        }
    
    # Check material type matches
    if qr_token.get("material_type", "").lower() != material_type.lower():
        return {
            "valid": False,
            "error": "Material type mismatch"
        }
    
    # Calculate reward (base amount * multiplier)
    multipliers = {
        "glass": 1.0,
        "paper": 1.5,
        "metal": 2.0
    }
    
    base_amount = float(qr_token.get("amount", 0))
    multiplier = multipliers.get(material_type.lower(), 1.0)
    reward_amount = int(base_amount * multiplier)
    
    return {
        "valid": True,
        "reward_amount": reward_amount,
        "material_type": material_type,
        "base_amount": base_amount,
        "multiplier": multiplier,
        "qr_hash": qr_token.get("hash")
    }
