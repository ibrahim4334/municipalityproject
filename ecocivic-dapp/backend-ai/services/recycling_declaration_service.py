# -*- coding: utf-8 -*-
"""
Recycling Declaration Service
Çoklu atık türü beyanı için servis - 3 saatlik QR oluşturma
"""
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import logging

from database.db import get_db
from database.models import RecyclingDeclaration, User
from config import QR_TOKEN_EXPIRY_HOURS

logger = logging.getLogger(__name__)

# Ödül oranları (BELT/birim)
REWARD_RATES = {
    "plastic": 10,   # BELT per kg
    "glass": 12,     # BELT per kg
    "metal": 15,     # BELT per kg
    "paper": 8,      # BELT per kg
    "electronic": 25 # BELT per adet
}


class RecyclingDeclarationService:
    """Çoklu atık türü beyanı servisi"""
    
    def __init__(self):
        self.qr_expiry_hours = QR_TOKEN_EXPIRY_HOURS if QR_TOKEN_EXPIRY_HOURS else 3
    
    def create_declaration(
        self, 
        wallet_address: str, 
        plastic_kg: float = 0,
        glass_kg: float = 0,
        metal_kg: float = 0,
        paper_kg: float = 0,
        electronic_count: int = 0
    ) -> Dict:
        """
        Yeni geri dönüşüm beyanı oluştur
        
        Returns:
            QR data ve beyan bilgileri
        """
        # Normalize wallet address
        wallet_address = wallet_address.lower() if wallet_address else wallet_address
        
        # Kullanıcı kontrolü (blacklist)
        with get_db() as db:
            user = db.query(User).filter(User.wallet_address == wallet_address).first()
            if user and user.recycling_fraud_warnings_remaining <= 0:
                raise ValueError("Beyan oluşturma hakkınız kalmadı. Lütfen belediye ile görüşün.")
                
        # En az bir tür beyan edilmeli
        if all([plastic_kg <= 0, glass_kg <= 0, metal_kg <= 0, paper_kg <= 0, electronic_count <= 0]):
            raise ValueError("En az bir atık türü için miktar girmelisiniz")
        
        # Miktar kontrolleri
        max_kg = 100  # Maksimum kg per tür
        max_electronic = 20  # Maksimum elektronik adet
        
        if any([
            plastic_kg > max_kg,
            glass_kg > max_kg,
            metal_kg > max_kg,
            paper_kg > max_kg,
            electronic_count > max_electronic
        ]):
            raise ValueError(f"Maksimum miktarlar: {max_kg} kg veya {max_electronic} adet")
        
        # Toplam ödülü hesapla
        total_reward = (
            plastic_kg * REWARD_RATES["plastic"] +
            glass_kg * REWARD_RATES["glass"] +
            metal_kg * REWARD_RATES["metal"] +
            paper_kg * REWARD_RATES["paper"] +
            electronic_count * REWARD_RATES["electronic"]
        )
        
        # QR token oluştur
        token_id = secrets.token_urlsafe(32)
        qr_hash = hashlib.sha256(f"{token_id}:{wallet_address}:{datetime.utcnow().isoformat()}".encode()).hexdigest()
        expires_at = datetime.utcnow() + timedelta(hours=self.qr_expiry_hours)
        
        # Veritabanına kaydet
        with get_db() as db:
            declaration = RecyclingDeclaration(
                wallet_address=wallet_address,
                plastic_kg=plastic_kg,
                glass_kg=glass_kg,
                metal_kg=metal_kg,
                paper_kg=paper_kg,
                electronic_count=electronic_count,
                qr_token_id=token_id,
                qr_hash=qr_hash,
                qr_expires_at=expires_at,
                is_qr_expired=False,
                is_qr_used=False,
                total_reward_amount=int(total_reward),
                admin_approval_status="pending"
            )
            db.add(declaration)
            db.commit()
            db.refresh(declaration)
            
            # Beyan edilen türleri listele
            declared_types = []
            if plastic_kg > 0:
                declared_types.append({"type": "plastic", "label": "Plastik", "amount": plastic_kg, "unit": "kg"})
            if glass_kg > 0:
                declared_types.append({"type": "glass", "label": "Cam", "amount": glass_kg, "unit": "kg"})
            if metal_kg > 0:
                declared_types.append({"type": "metal", "label": "Metal", "amount": metal_kg, "unit": "kg"})
            if paper_kg > 0:
                declared_types.append({"type": "paper", "label": "Kağıt", "amount": paper_kg, "unit": "kg"})
            if electronic_count > 0:
                declared_types.append({"type": "electronic", "label": "Elektronik", "amount": electronic_count, "unit": "adet"})
            
            return {
                "success": True,
                "declaration_id": declaration.id,
                "qr_data": {
                    "token_id": token_id,
                    "hash": qr_hash,
                    "wallet_address": wallet_address,
                    "declared_types": declared_types
                },
                "expires_at": expires_at.isoformat(),
                "total_reward": int(total_reward),
                "declared_types": declared_types,
                "message": f"Beyan oluşturuldu. {self.qr_expiry_hours} saat içinde geri dönüşüm merkezinde okutun."
            }
    
    def get_pending_declarations(self, wallet_address: Optional[str] = None) -> List[Dict]:
        """Bekleyen beyanları getir (admin için)"""
        with get_db() as db:
            query = db.query(RecyclingDeclaration).filter(
                RecyclingDeclaration.admin_approval_status == "pending",
                RecyclingDeclaration.is_qr_expired == False
            )
            
            if wallet_address:
                query = query.filter(RecyclingDeclaration.wallet_address == wallet_address)
            
            declarations = query.order_by(RecyclingDeclaration.created_at.desc()).all()
            
            return [{
                "id": d.id,
                "wallet_address": d.wallet_address,
                "plastic_kg": d.plastic_kg,
                "glass_kg": d.glass_kg,
                "metal_kg": d.metal_kg,
                "paper_kg": d.paper_kg,
                "electronic_count": d.electronic_count,
                "total_reward": d.total_reward_amount,
                "qr_expires_at": d.qr_expires_at.isoformat() if d.qr_expires_at else None,
                "created_at": d.created_at.isoformat() if d.created_at else None,
                "status": d.admin_approval_status
            } for d in declarations]
    
    def approve_declaration(self, declaration_id: int, admin_wallet: str) -> Dict:
        """Beyanı onayla"""
        with get_db() as db:
            declaration = db.query(RecyclingDeclaration).filter(
                RecyclingDeclaration.id == declaration_id
            ).first()
            
            if not declaration:
                return {"success": False, "message": "Beyan bulunamadı"}
            
            if declaration.admin_approval_status != "pending":
                return {"success": False, "message": "Bu beyan zaten işlenmiş"}
            
            declaration.admin_approval_status = "approved"
            declaration.admin_approved_by = admin_wallet
            declaration.is_qr_used = True
            declaration.processed_at = datetime.utcnow()
            
            # Accumulate rewards (PENDING BALANCE)
            user = db.query(User).filter(User.wallet_address == declaration.wallet_address).first()
            if user:
                current_balance = user.pending_reward_balance or 0
                user.pending_reward_balance = current_balance + declaration.total_reward_amount
                logger.info(f"Added {declaration.total_reward_amount} to pending balance for {declaration.wallet_address}. New total: {user.pending_reward_balance}")
            
            db.commit()
            
            logger.info(f"Declaration {declaration_id} approved by {admin_wallet}")
            
            return {
                "success": True,
                "message": "Beyan onaylandı ve ödül birikmiş bakiyeye eklendi",
                "reward_amount": declaration.total_reward_amount,
                "wallet_address": declaration.wallet_address,
                "new_pending_balance": user.pending_reward_balance if user else 0
            }
    
    def mark_fraud(self, declaration_id: int, admin_wallet: str, reason: str = "") -> Dict:
        """Beyanı fraud olarak işaretle ve yönetici onayına gönder"""
        with get_db() as db:
            declaration = db.query(RecyclingDeclaration).filter(
                RecyclingDeclaration.id == declaration_id
            ).first()
            
            if not declaration:
                return {"success": False, "message": "Beyan bulunamadı"}
            
            # Fraud olarak işaretle ama admin onayı bekle
            declaration.admin_approval_status = "fraud"
            declaration.admin_approved_by = admin_wallet
            declaration.is_fraud = True
            declaration.fraud_reason = reason or "Personel tarafından fraud olarak işaretlendi"
            declaration.processed_at = datetime.utcnow()
            
            # NOT: Kullanıcının fraud hakkı HENÜZ düşürülmez!
            # Admin onaylarsa (fraud kesinleşirse) o zaman düşürülür
            # Admin reddederse (vatandaş haklı) o zaman tokenlar verilir
            
            db.commit()
            
            logger.warning(f"Declaration {declaration_id} marked as fraud by {admin_wallet} - awaiting admin decision")
            
            return {
                "success": True,
                "message": "Beyan fraud olarak işaretlendi ve yönetici onayına gönderildi",
                "wallet_address": declaration.wallet_address
            }
    
    def expire_qr(self, qr_token_id: str) -> Dict:
        """Süresi dolan QR'ı iptal et"""
        with get_db() as db:
            declaration = db.query(RecyclingDeclaration).filter(
                RecyclingDeclaration.qr_token_id == qr_token_id
            ).first()
            
            if not declaration:
                return {"success": False, "message": "QR bulunamadı"}
            
            declaration.is_qr_expired = True
            declaration.admin_approval_status = "expired"
            db.commit()
            
            return {"success": True, "message": "QR süresi doldu"}
    
    def check_and_expire_old_qrs(self) -> int:
        """Süresi dolan QR'ları otomatik iptal et"""
        with get_db() as db:
            now = datetime.utcnow()
            expired_count = db.query(RecyclingDeclaration).filter(
                RecyclingDeclaration.qr_expires_at < now,
                RecyclingDeclaration.is_qr_expired == False,
                RecyclingDeclaration.is_qr_used == False
            ).update({
                "is_qr_expired": True,
                "admin_approval_status": "expired"
            })
            db.commit()
            
            if expired_count > 0:
                logger.info(f"Expired {expired_count} QR codes")
            
            return expired_count


# Singleton instance
recycling_declaration_service = RecyclingDeclarationService()
