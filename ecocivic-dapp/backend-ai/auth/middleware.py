"""
Authentication Middleware
Role-based authorization decorators
"""
from functools import wraps
from flask import request, jsonify
from auth.jwt_utils import verify_token, get_role_from_token, get_wallet_from_token
from database.models import UserRole


def get_token_from_header():
    """Authorization header'dan token'ı alır"""
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header.split(" ")[1]
    return None


def require_auth(f):
    """Token doğrulama decorator'ı"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = get_token_from_header()
        if not token:
            return jsonify({"error": "Authentication required"}), 401
        
        payload = verify_token(token)
        if not payload:
            return jsonify({"error": "Invalid or expired token"}), 401
        
        # Request context'e user bilgilerini ekle
        request.current_user = {
            "wallet_address": payload.get("wallet_address"),
            "role": payload.get("role")
        }
        
        return f(*args, **kwargs)
    return decorated_function


def require_role(*allowed_roles: UserRole):
    """Role-based authorization decorator'ı"""
    def decorator(f):
        @wraps(f)
        @require_auth
        def decorated_function(*args, **kwargs):
            token = get_token_from_header()
            user_role = get_role_from_token(token)
            
            if not user_role or user_role not in allowed_roles:
                return jsonify({
                    "error": f"Access denied. Required roles: {[r.value for r in allowed_roles]}"
                }), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator


# Kısa kullanım için decorator'lar
def require_citizen(f):
    """Citizen rolü gerektirir"""
    return require_role(UserRole.CITIZEN)(f)


def require_service_operator(f):
    """Service Operator rolü gerektirir"""
    return require_role(UserRole.SERVICE_OPERATOR)(f)


def require_municipality_admin(f):
    """Municipality Admin rolü gerektirir"""
    return require_role(UserRole.MUNICIPALITY_ADMIN)(f)


def require_service_operator_or_admin(f):
    """Service Operator veya Municipality Admin rolü gerektirir"""
    return require_role(UserRole.SERVICE_OPERATOR, UserRole.MUNICIPALITY_ADMIN)(f)


def require_inspector(f):
    """
    Inspector rolü gerektirir (fiziksel kontroller için).
    Municipality Staff veya Service Operator olabilir.
    """
    return require_role(UserRole.MUNICIPALITY_STAFF, UserRole.SERVICE_OPERATOR, UserRole.MUNICIPALITY_ADMIN)(f)


def require_municipality_staff(f):
    """
    Municipality Staff rolü gerektirir.
    6 aylık kontrol, atık kontrolü, fraud doğrulama için.
    """
    return require_role(UserRole.MUNICIPALITY_STAFF, UserRole.MUNICIPALITY_ADMIN)(f)


def require_oracle(f):
    """
    Oracle rolü gerektirir.
    Dış veri sağlayıcılar (GPS, realtime değerler) için.
    """
    return require_role(UserRole.ORACLE)(f)


def require_any_staff(f):
    """
    Herhangi bir personel rolü gerektirir.
    """
    return require_role(
        UserRole.SERVICE_OPERATOR, 
        UserRole.MUNICIPALITY_STAFF, 
        UserRole.MUNICIPALITY_ADMIN
    )(f)


