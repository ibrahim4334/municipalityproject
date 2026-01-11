"""
JWT Token Utilities
JWT token oluşturma ve doğrulama fonksiyonları
"""
import jwt
from datetime import datetime, timedelta
from typing import Dict, Optional
from config import JWT_SECRET_KEY, JWT_EXPIRE_MINUTES
from database.models import UserRole


def create_token(wallet_address: str, role: UserRole) -> str:
    """
    JWT token oluşturur
    
    Args:
        wallet_address: Kullanıcı wallet adresi
        role: Kullanıcı rolü
    
    Returns:
        JWT token string
    """
    payload = {
        "wallet_address": wallet_address.lower(),
        "role": role.value,
        "exp": datetime.utcnow() + timedelta(minutes=JWT_EXPIRE_MINUTES),
        "iat": datetime.utcnow()
    }
    
    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm="HS256")
    return token


def verify_token(token: str) -> Optional[Dict]:
    """
    JWT token'ı doğrular
    
    Args:
        token: JWT token string
    
    Returns:
        Token payload dict veya None (geçersizse)
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def get_role_from_token(token: str) -> Optional[UserRole]:
    """
    Token'dan rol bilgisini alır
    
    Args:
        token: JWT token string
    
    Returns:
        UserRole enum veya None
    """
    payload = verify_token(token)
    if payload and "role" in payload:
        try:
            return UserRole(payload["role"])
        except ValueError:
            return None
    return None


def get_wallet_from_token(token: str) -> Optional[str]:
    """
    Token'dan wallet adresini alır
    
    Args:
        token: JWT token string
    
    Returns:
        Wallet address veya None
    """
    payload = verify_token(token)
    if payload and "wallet_address" in payload:
        return payload["wallet_address"]
    return None
