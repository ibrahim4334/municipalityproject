"""
Authentication Routes
Wallet-based authentication endpoints
"""
from flask import Blueprint, request, jsonify
from database.db import get_db
from database.models import User, UserRole
from auth.jwt_utils import create_token
from datetime import datetime
from auth.middleware import require_auth, get_token_from_header, get_wallet_from_token
from auth.middleware import require_auth, get_token_from_header, get_wallet_from_token
from utils import error_response as _error_response, validate_wallet_address as _validate_wallet_address, normalize_wallet_address as _normalize_wallet_address

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.route("/login", methods=["POST"])
def login():
    """
    Wallet-based login
    Request body: { "wallet_address": "0x...", "signature": "0x..." }
    """
    try:
        data = request.get_json()
        if not data:
            return _error_response("Request body is required", 400)
        
        wallet_address = data.get("wallet_address")
        if not wallet_address:
            return _error_response("wallet_address is required", 400)
        
        if not _validate_wallet_address(wallet_address):
            return _error_response("Invalid wallet address format", 400)
        
        wallet_address = _normalize_wallet_address(wallet_address)
        
        # Kullanıcıyı bul veya oluştur (Citizen olarak)
        with get_db() as db:
            user = db.query(User).filter(User.wallet_address == wallet_address).first()
            
            if not user:
                # Yeni kullanıcı oluştur (varsayılan olarak Citizen)
                user = User(
                    wallet_address=wallet_address,
                    role=UserRole.CITIZEN,
                    is_active=True
                )
                db.add(user)
                db.commit()
                db.refresh(user)
            
            # Kullanıcı aktif değilse
            if not user.is_active:
                return _error_response("Account is disabled", 403)
            
            # Son giriş zamanını güncelle
            user.last_login = datetime.utcnow()
            db.commit()
            
            # JWT token oluştur
            token = create_token(user.wallet_address, user.role)
            
            return jsonify({
                "token": token,
                "user": {
                    "wallet_address": user.wallet_address,
                    "role": user.role.value,
                    "email": user.email,
                    "name": user.name
                }
            }), 200
            
    except Exception as e:
        return _error_response("Login failed", 500, {"details": str(e)})


@auth_bp.route("/me", methods=["GET"])
@require_auth
def get_current_user():
    """Mevcut kullanıcı bilgilerini getirir"""
    try:
        token = get_token_from_header()
        wallet_address = get_wallet_from_token(token)
        
        if not wallet_address:
            return _error_response("Invalid token", 401)
        
        with get_db() as db:
            user = db.query(User).filter(User.wallet_address == wallet_address).first()
            if not user:
                return _error_response("User not found", 404)
            
            return jsonify({
                "wallet_address": user.wallet_address,
                "role": user.role.value,
                "email": user.email,
                "name": user.name,
                "is_active": user.is_active
            }), 200
            
    except Exception as e:
        return _error_response("Failed to get user info", 500, {"details": str(e)})


@auth_bp.route("/update-profile", methods=["PUT"])
@require_auth
def update_profile():
    """Kullanıcı profil bilgilerini günceller"""
    try:
        token = get_token_from_header()
        wallet_address = get_wallet_from_token(token)
        
        if not wallet_address:
            return _error_response("Invalid token", 401)
        
        data = request.get_json()
        if not data:
            return _error_response("Request body is required", 400)
        
        with get_db() as db:
            user = db.query(User).filter(User.wallet_address == wallet_address).first()
            if not user:
                return _error_response("User not found", 404)
            
            # Email ve name güncellenebilir
            if "email" in data:
                user.email = data["email"]
            if "name" in data:
                user.name = data["name"]
            
            db.commit()
            
            return jsonify({
                "wallet_address": user.wallet_address,
                "role": user.role.value,
                "email": user.email,
                "name": user.name
            }), 200
            
    except Exception as e:
        return _error_response("Failed to update profile", 500, {"details": str(e)})
