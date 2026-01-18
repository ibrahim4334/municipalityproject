from flask import Blueprint, jsonify, request
from database.db import get_db
from database.models import User
from services.blockchain_service import blockchain_service
from utils import error_response, validate_wallet_address, normalize_wallet_address
import logging

wallet_bp = Blueprint("wallet", __name__, url_prefix="/api/wallet")
logger = logging.getLogger(__name__)

@wallet_bp.route("/balance/<wallet_address>", methods=["GET"])
def get_balance(wallet_address):
    """
    Kullanıcının pending (birikmiş) ve blockchain üzerindeki bakiyelerini getirir.
    """
    try:
        normalized_wallet = normalize_wallet_address(wallet_address)
        
        with get_db() as db:
            user = db.query(User).filter(User.wallet_address == normalized_wallet).first()
            
            pending_balance = 0
            deposit_balance = 0
            
            if user:
                pending_balance = user.pending_reward_balance or 0
                # Burada deposit balance'ı DB'den veya Blockchain'den çekebiliriz
                # Şimdilik DB'de Users tablosunda deposit yok, ayrı bir tablo olabilir veya blockchain service'den okuyabiliriz
                # Basitlik için sadece pending balance dönüyoruz şimdilik.
            
            # TODO: Blockchain'den gerçek BELT bakiyesini ve Deposit miktarını çekmek için blockchain_service kullanılabilir.
            # Ancak performans için bunu frontend tarafında web3 ile yapmak daha mantıklı olabilir.
            # Backend tarafında sadece "Claim edilebilir" bakiyeyi (off-chain pending) yönetiyoruz.

            return jsonify({
                "success": True,
                "wallet_address": normalized_wallet,
                "pending_rewards": pending_balance, # Claim edilebilir miktar
                "currency": "BELT"
            }), 200

    except Exception as e:
        logger.error(f"Error getting balance for {wallet_address}: {e}")
        return error_response("Bakiye bilgisi alınamadı", 500, {"details": str(e)})

@wallet_bp.route("/claim", methods=["POST"])
def claim_rewards():
    """
    Birikmiş ödülleri (pending) cüzdana (blockchain) transfer et.
    """
    try:
        data = request.get_json()
        wallet_address = data.get("wallet_address")
        
        if not wallet_address:
            return error_response("Wallet address is required", 400)
            
        normalized_wallet = normalize_wallet_address(wallet_address)
        
        with get_db() as db:
            user = db.query(User).filter(User.wallet_address == normalized_wallet).first()
            
            if not user:
                return error_response("Kullanıcı bulunamadı", 404)
            
            amount_to_claim = user.pending_reward_balance
            
            if amount_to_claim <= 0:
                return error_response("Transfer edilecek birikmiş ödül yok", 400)
            
            # Blockchain transferi başlat
            try:
                tx_hash = blockchain_service.reward_recycling(
                    normalized_wallet,
                    "mixed", # Type can be generic for bulk claim
                    amount_to_claim,
                    f"bulk_claim_{amount_to_claim}"
                )
                
                if tx_hash:
                    # Başarılı transfer sonrası bakiyeyi sıfırla
                    user.pending_reward_balance = 0
                    db.commit()
                    
                    return jsonify({
                        "success": True,
                        "message": f"{amount_to_claim} BELT cüzdanınıza transfer edildi.",
                        "tx_hash": tx_hash,
                        "claimed_amount": amount_to_claim
                    }), 200
                else:
                     return error_response("Blockchain transferi başarısız oldu (hash yok)", 500)

            except Exception as bc_error:
                logger.error(f"Blockchain claim error: {bc_error}")
                return error_response("Blockchain transfer hatası", 500, {"details": str(bc_error)})
                
    except Exception as e:
        logger.error(f"Claim error: {e}")
        return error_response("Ödül talep işlemi başarısız", 500, {"details": str(e)})
