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
    """
    Token doğrulama decorator'ı.
    Demo modu için X-Wallet-Address header'ını da destekler.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Önce JWT token kontrolü
        token = get_token_from_header()
        if token:
            payload = verify_token(token)
            if payload:
                request.current_user = {
                    "wallet_address": payload.get("wallet_address"),
                    "role": payload.get("role")
                }
                return f(*args, **kwargs)
        
        # Fallback: X-Wallet-Address header (demo modu)
        wallet_address = request.headers.get("X-Wallet-Address")
        if wallet_address and len(wallet_address) >= 10:
            # Demo modunda basit wallet auth
            request.current_user = {
                "wallet_address": wallet_address,
                "role": "CITIZEN"  # Default role
            }
            return f(*args, **kwargs)
        
        return jsonify({"error": "Authentication required"}), 401
    return decorated_function


def require_role(*allowed_roles: UserRole):
    """
    Role-based authorization decorator'ı.
    Demo modu için X-Wallet-Address header'ı ile tüm rollere erişim sağlanır.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Önce JWT token kontrolü
            token = get_token_from_header()
            if token:
                payload = verify_token(token)
                if payload:
                    user_role = get_role_from_token(token)
                    if not user_role or user_role not in allowed_roles:
                        return jsonify({
                            "error": f"Access denied. Required roles: {[r.value for r in allowed_roles]}"
                        }), 403
                    
                    request.current_user = {
                        "wallet_address": payload.get("wallet_address"),
                        "role": payload.get("role")
                    }
                    return f(*args, **kwargs)
            
            # Demo modu: X-Wallet-Address header ile tüm rollere erişim
            wallet_address = request.headers.get("X-Wallet-Address")
            if wallet_address and len(wallet_address) >= 10:
                # Demo modunda rol kontrolü yapılmaz
                request.current_user = {
                    "wallet_address": wallet_address,
                    "role": "SERVICE_OPERATOR"  # Demo için işlem yapabilsin
                }
                return f(*args, **kwargs)
            
            return jsonify({"error": "Authentication required"}), 401
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


