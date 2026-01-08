"""
QR Token Service
Geri dönüşüm QR kodları için token oluşturma ve doğrulama servisi
"""
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict
import os

QR_TOKEN_EXPIRY_HOURS = int(os.getenv("QR_TOKEN_EXPIRY_HOURS", 3))
QR_SECRET_KEY = os.getenv("QR_SECRET_KEY", secrets.token_hex(32))


def generate_qr_token(material_type: str, amount: float, wallet_address: str) -> Dict[str, any]:
    """
    QR token oluşturur
    
    Args:
        material_type: Malzeme tipi (glass, paper, metal)
        amount: Miktar (kg)
        wallet_address: Kullanıcı cüzdan adresi
    
    Returns:
        QR token dictionary
    """
    if not material_type or material_type not in ["glass", "paper", "metal"]:
        raise ValueError("Invalid material type")
    
    if not amount or amount <= 0 or amount > 1000:
        raise ValueError("Amount must be between 1 and 1000 kg")
    
    if not wallet_address or not wallet_address.startswith("0x"):
        raise ValueError("Invalid wallet address")
    
    # Generate unique token ID
    token_id = secrets.token_urlsafe(32)
    
    # Create expiry timestamp
    expires_at = datetime.utcnow() + timedelta(hours=QR_TOKEN_EXPIRY_HOURS)
    
    # Create hash for verification
    payload = f"{token_id}:{material_type}:{amount}:{wallet_address}:{expires_at.isoformat()}"
    token_hash = hashlib.sha256(f"{payload}:{QR_SECRET_KEY}".encode()).hexdigest()
    
    return {
        "token_id": token_id,
        "material_type": material_type,
        "amount": amount,
        "wallet_address": wallet_address,
        "expires_at": expires_at.isoformat(),
        "hash": token_hash,
        "created_at": datetime.utcnow().isoformat()
    }


def verify_qr_token(token_data: Dict[str, any]) -> tuple[bool, Optional[str]]:
    """
    QR token'ı doğrular
    
    Args:
        token_data: QR token dictionary
    
    Returns:
        (is_valid, error_message)
    """
    try:
        # Check required fields
        required_fields = ["token_id", "material_type", "amount", "wallet_address", "expires_at", "hash"]
        for field in required_fields:
            if field not in token_data:
                return False, f"Missing required field: {field}"
        
        # Check expiry
        expires_at = datetime.fromisoformat(token_data["expires_at"])
        if datetime.utcnow() > expires_at:
            return False, "QR token expired"
        
        # Verify hash
        payload = f"{token_data['token_id']}:{token_data['material_type']}:{token_data['amount']}:{token_data['wallet_address']}:{token_data['expires_at']}"
        expected_hash = hashlib.sha256(f"{payload}:{QR_SECRET_KEY}".encode()).hexdigest()
        
        if token_data["hash"] != expected_hash:
            return False, "Invalid token hash"
        
        # Validate material type
        if token_data["material_type"] not in ["glass", "paper", "metal"]:
            return False, "Invalid material type"
        
        # Validate amount
        amount = float(token_data["amount"])
        if amount <= 0 or amount > 1000:
            return False, "Invalid amount"
        
        return True, None
    
    except Exception as e:
        return False, f"Token verification failed: {str(e)}"
