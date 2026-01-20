import logging
import json
import os
from web3 import Web3

# Web3 6.x compatibility - POA middleware moved to different location
try:
    from web3.middleware import ExtraDataToPOAMiddleware
    POA_MIDDLEWARE = ExtraDataToPOAMiddleware
except ImportError:
    try:
        from web3.middleware import geth_poa_middleware
        POA_MIDDLEWARE = geth_poa_middleware
    except ImportError:
        POA_MIDDLEWARE = None

from config import (
    BLOCKCHAIN_RPC_URL, 
    BELT_TOKEN_ADDRESS, 
    RECYCLING_REWARDS_ADDRESS,
    BACKEND_WALLET_PRIVATE_KEY
)

logger = logging.getLogger("blockchain-service")

class BlockchainService:
    def __init__(self):
        self.w3 = Web3(Web3.HTTPProvider(BLOCKCHAIN_RPC_URL))
        # Polygon Mumbai vb. POA zincirleri için middleware gerekebilir
        if POA_MIDDLEWARE:
            try:
                self.w3.middleware_onion.inject(POA_MIDDLEWARE, layer=0)
            except Exception as e:
                logger.warning(f"Could not inject POA middleware: {e}")
        
        if not self.w3.is_connected():
            logger.error("Failed to connect to blockchain RPC")
        
        self.private_key = BACKEND_WALLET_PRIVATE_KEY
        if not self.private_key:
            logger.warning("Backend private key not set. Blockchain transactions will fail.")
        else:
            self.account = self.w3.eth.account.from_key(self.private_key)
            
        # Contract Addresses
        self.recycling_address = RECYCLING_REWARDS_ADDRESS
        
        # Basit ABI'lar (Gerçek projede JSON dosyasından okunmalı)
        self.recycling_abi = [
            {
                "inputs": [
                    {"internalType": "address", "name": "user", "type": "address"},
                    {"internalType": "enum RecyclingRewards.MaterialType", "name": "material", "type": "uint8"},
                    {"internalType": "uint256", "name": "baseAmount", "type": "uint256"},
                    {"internalType": "string", "name": "qrHash", "type": "string"}
                ],
                "name": "rewardRecycling",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            }
        ]
        
        # Water billing address - henüz env içinde olmayabilir, opsiyonel
        self.water_billing_address = os.getenv("WATER_BILLING_ADDRESS")
        self.water_billing_abi = [
            {
                "inputs": [
                    {"internalType": "address", "name": "user", "type": "address"},
                    {"internalType": "uint256", "name": "newReading", "type": "uint256"}
                ],
                "name": "submitReadingLegacy",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            }
        ]
        
    def reward_recycling(self, user_address: str, material_type_str: str, amount: float, qr_hash: str) -> str:
        """
        RecyclingRewards kontratını çağırır.
        5 atık türü: plastic, glass, metal, paper, electronic
        """
        try:
            if not self.private_key:
                raise ValueError("Wallet not configured")

            # User address'i checksum formatına çevir
            user_address = self.w3.to_checksum_address(user_address)
            
            contract = self.w3.eth.contract(address=self.recycling_address, abi=self.recycling_abi)
            
            # Map material string to enum int (WasteType enum in contract)
            material_map = {
                "plastic": 0,     # WasteType.Plastic
                "glass": 1,       # WasteType.Glass
                "metal": 2,       # WasteType.Metal
                "paper": 3,       # WasteType.Paper
                "electronic": 4,  # WasteType.Electronic
                "multi": 0,       # Mixed materials - default to plastic
                "mixed": 0        # Mixed materials - default to plastic
            }
            material_enum = material_map.get(material_type_str.lower(), 0)  # Default to plastic if unknown
                
            # Amount conversion (kg veya adet)
            amount_int = int(amount)
            
            # Build Transaction
            tx = contract.functions.rewardRecycling(
                user_address,
                material_enum,
                amount_int,
                qr_hash
            ).build_transaction({
                'from': self.account.address,
                'nonce': self.w3.eth.get_transaction_count(self.account.address),
                'gas': 2000000,
                'gasPrice': self.w3.eth.gas_price
            })
            
            # Sign and Send
            signed_tx = self.w3.eth.account.sign_transaction(tx, self.private_key)
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
            
            return self.w3.to_hex(tx_hash)
            
        except Exception as e:
            logger.error(f"Blockchain transaction failed: {e}")
            raise e

    def submit_water_reading(self, user_address: str, reading_index: int) -> str:
        """
        WaterBilling kontratını çağırır.
        """
        try:
            if not self.private_key or not self.water_billing_address:
                raise ValueError("WaterBilling configuration missing")

            # User address'i checksum formatına çevir
            user_address = self.w3.to_checksum_address(user_address)
            
            contract = self.w3.eth.contract(address=self.water_billing_address, abi=self.water_billing_abi)
            
            tx = contract.functions.submitReadingLegacy(
                user_address,
                reading_index
            ).build_transaction({
                'from': self.account.address,
                'nonce': self.w3.eth.get_transaction_count(self.account.address),
                'gas': 2000000,
                'gasPrice': self.w3.eth.gas_price
            })
            
            signed_tx = self.w3.eth.account.sign_transaction(tx, self.private_key)
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
            
            return self.w3.to_hex(tx_hash)
            
        except Exception as e:
            logger.error(f"Water billing transaction failed: {e}")
            raise e
    
    def penalize_user_deposit(
        self, 
        user_address: str, 
        penalty_percent: int, 
        reason: str,
        decision_id: str = None
    ) -> str:
        """
        WaterBillingFraudManager üzerinden depozito cezası kes.
        
        ⚠️ v1 ÖNEMLİ: Bu fonksiyon SADECE admin/personel kararı sonrası çağrılmalıdır!
        Otomatik ceza uygulaması v1'de DEVRE DIŞI'dır.
        
        Args:
            user_address: Kullanıcı cüzdan adresi
            penalty_percent: Ceza yüzdesi (0-100)
            reason: Ceza sebebi
            decision_id: Admin/personel karar ID'si (v1'de zorunlu!)
            
        Returns:
            Transaction hash
            
        Raises:
            ValueError: decision_id sağlanmadığında (v1 güvenlik kontrolü)
        """
        # v1 GUARD: Otomatik ceza engelle
        if not decision_id:
            logger.warning(f"penalize_user_deposit called WITHOUT decision_id for {user_address} - BLOCKED in v1")
            raise ValueError(
                "v1'de penalize_user_deposit sadece admin/personel kararı sonrası çağrılabilir. "
                "decision_id parametresi zorunludur. "
                "Otomatik ceza için create_anomaly_signal() kullanın."
            )
        
        try:
            if not self.private_key:
                raise ValueError("Wallet not configured")
            
            fraud_manager_address = os.getenv("WATER_BILLING_FRAUD_MANAGER_ADDRESS")
            if not fraud_manager_address:
                raise ValueError("Fraud manager address not configured")
            
            # Fraud Manager ABI (ceza fonksiyonu)
            fraud_manager_abi = [
                {
                    "inputs": [
                        {"internalType": "address", "name": "user", "type": "address"},
                        {"internalType": "string", "name": "reason", "type": "string"}
                    ],
                    "name": "penalizeForAIFraud",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function"
                }
            ]
            
            contract = self.w3.eth.contract(address=fraud_manager_address, abi=fraud_manager_abi)
            
            # Reason'a decision_id ekle (blockchain'de izlenebilirlik)
            full_reason = f"{reason} | decision_id: {decision_id}"
            
            tx = contract.functions.penalizeForAIFraud(
                user_address,
                full_reason
            ).build_transaction({
                'from': self.account.address,
                'nonce': self.w3.eth.get_transaction_count(self.account.address),
                'gas': 3000000,
                'gasPrice': self.w3.eth.gas_price
            })
            
            signed_tx = self.w3.eth.account.sign_transaction(tx, self.private_key)
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
            
            logger.info(f"Penalty applied for {user_address} with decision_id={decision_id}: {self.w3.to_hex(tx_hash)}")
            return self.w3.to_hex(tx_hash)
            
        except Exception as e:
            logger.error(f"Fraud penalty transaction failed: {e}")
            raise e
    
    def charge_underpayment_with_interest(
        self, 
        user_address: str, 
        underpayment_amount: int, 
        interest_amount: int,
        inspection_id: int
    ) -> str:
        """
        Eksik ödeme + faizi tahsil et (fiziksel kontrol sonrası).
        
        Args:
            user_address: Kullanıcı cüzdan adresi
            underpayment_amount: Eksik ödenen tutar
            interest_amount: Faiz tutarı
            inspection_id: Kontrol ID'si
            
        Returns:
            Transaction hash
        """
        try:
            if not self.private_key:
                raise ValueError("Wallet not configured")
            
            fraud_manager_address = os.getenv("WATER_BILLING_FRAUD_MANAGER_ADDRESS")
            if not fraud_manager_address:
                raise ValueError("Fraud manager address not configured")
            
            fraud_manager_abi = [
                {
                    "inputs": [
                        {"internalType": "address", "name": "user", "type": "address"},
                        {"internalType": "uint256", "name": "underpaidAmount", "type": "uint256"},
                        {"internalType": "uint256", "name": "monthsLate", "type": "uint256"}
                    ],
                    "name": "penalizeForInspectionFraud",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function"
                }
            ]
            
            contract = self.w3.eth.contract(address=fraud_manager_address, abi=fraud_manager_abi)
            
            # Kaç ay geç hesapla (interest / (underpayment * 0.05))
            months_late = interest_amount // (underpayment_amount * 5 // 100) if underpayment_amount > 0 else 1
            
            tx = contract.functions.penalizeForInspectionFraud(
                user_address,
                underpayment_amount,
                max(1, months_late)
            ).build_transaction({
                'from': self.account.address,
                'nonce': self.w3.eth.get_transaction_count(self.account.address),
                'gas': 3000000,
                'gasPrice': self.w3.eth.gas_price
            })
            
            signed_tx = self.w3.eth.account.sign_transaction(tx, self.private_key)
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
            
            return self.w3.to_hex(tx_hash)
            
        except Exception as e:
            logger.error(f"Underpayment charge transaction failed: {e}")
            raise e
    
    # ==============================
    # NEW AI/BACKEND INTEGRATION METHODS
    # ==============================
    
    def submit_fraud_evidence(self, user_address: str, score: int) -> str:
        """
        AI tarafından fraud kanıtı gönder - WaterBilling.submitFraudEvidence
        
        Args:
            user_address: Kullanıcı cüzdan adresi
            score: Fraud skoru (0-100)
            
        Returns:
            Transaction hash
        """
        try:
            if not self.private_key:
                raise ValueError("Wallet not configured")
            
            if not self.water_billing_address:
                raise ValueError("Water billing address not configured")
            
            abi = [
                {
                    "inputs": [
                        {"internalType": "address", "name": "user", "type": "address"},
                        {"internalType": "uint256", "name": "score", "type": "uint256"}
                    ],
                    "name": "submitFraudEvidence",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function"
                }
            ]
            
            # User address'i checksum formatına çevir
            user_address = self.w3.to_checksum_address(user_address)
            
            contract = self.w3.eth.contract(
                address=self.water_billing_address, 
                abi=abi
            )
            
            tx = contract.functions.submitFraudEvidence(
                user_address,
                score
            ).build_transaction({
                'from': self.account.address,
                'nonce': self.w3.eth.get_transaction_count(self.account.address),
                'gas': 500000,
                'gasPrice': self.w3.eth.gas_price
            })
            
            signed_tx = self.w3.eth.account.sign_transaction(tx, self.private_key)
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
            
            logger.info(f"Fraud evidence submitted for {user_address}: score={score}")
            return self.w3.to_hex(tx_hash)
            
        except Exception as e:
            logger.error(f"Submit fraud evidence failed: {e}")
            raise e
    
    def record_physical_inspection(self, user_address: str, is_fraud: bool) -> str:
        """
        Fiziksel kontrol sonucunu kaydet - WaterBilling.recordPhysicalInspection
        
        Args:
            user_address: Kullanıcı cüzdan adresi
            is_fraud: Fraud bulundu mu
            
        Returns:
            Transaction hash
        """
        try:
            if not self.private_key:
                raise ValueError("Wallet not configured")
            
            if not self.water_billing_address:
                raise ValueError("Water billing address not configured")
            
            abi = [
                {
                    "inputs": [
                        {"internalType": "address", "name": "user", "type": "address"},
                        {"internalType": "bool", "name": "isFraud", "type": "bool"}
                    ],
                    "name": "recordPhysicalInspection",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function"
                }
            ]
            
            contract = self.w3.eth.contract(
                address=self.water_billing_address, 
                abi=abi
            )
            
            tx = contract.functions.recordPhysicalInspection(
                user_address,
                is_fraud
            ).build_transaction({
                'from': self.account.address,
                'nonce': self.w3.eth.get_transaction_count(self.account.address),
                'gas': 500000,
                'gasPrice': self.w3.eth.gas_price
            })
            
            signed_tx = self.w3.eth.account.sign_transaction(tx, self.private_key)
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
            
            logger.info(f"Physical inspection recorded for {user_address}: fraud={is_fraud}")
            return self.w3.to_hex(tx_hash)
            
        except Exception as e:
            logger.error(f"Record physical inspection failed: {e}")
            raise e
    
    def apply_interest_penalty(self, user_address: str, correct_usage: int) -> str:
        """
        Faiz cezası uygula - WaterBilling.applyInterestPenalty
        
        Args:
            user_address: Kullanıcı cüzdan adresi  
            correct_usage: Doğru tüketim miktarı (m³)
            
        Returns:
            Transaction hash
        """
        try:
            if not self.private_key:
                raise ValueError("Wallet not configured")
            
            if not self.water_billing_address:
                raise ValueError("Water billing address not configured")
            
            abi = [
                {
                    "inputs": [
                        {"internalType": "address", "name": "user", "type": "address"},
                        {"internalType": "uint256", "name": "correctUsage", "type": "uint256"}
                    ],
                    "name": "applyInterestPenalty",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function"
                }
            ]
            
            contract = self.w3.eth.contract(
                address=self.water_billing_address, 
                abi=abi
            )
            
            tx = contract.functions.applyInterestPenalty(
                user_address,
                correct_usage
            ).build_transaction({
                'from': self.account.address,
                'nonce': self.w3.eth.get_transaction_count(self.account.address),
                'gas': 500000,
                'gasPrice': self.w3.eth.gas_price
            })
            
            signed_tx = self.w3.eth.account.sign_transaction(tx, self.private_key)
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
            
            logger.info(f"Interest penalty applied for {user_address}: usage={correct_usage}")
            return self.w3.to_hex(tx_hash)
            
        except Exception as e:
            logger.error(f"Apply interest penalty failed: {e}")
            raise e
    
    def confirm_user_reading(self, user_address: str, confirmed: bool) -> str:
        """
        Kullanıcı onayını kaydet - WaterBilling.confirmUserReading
        
        Args:
            user_address: Kullanıcı cüzdan adresi
            confirmed: Kullanıcı onayladı mı
            
        Returns:
            Transaction hash
        """
        try:
            if not self.private_key:
                raise ValueError("Wallet not configured")
            
            if not self.water_billing_address:
                raise ValueError("Water billing address not configured")
            
            abi = [
                {
                    "inputs": [
                        {"internalType": "address", "name": "user", "type": "address"},
                        {"internalType": "bool", "name": "confirmed", "type": "bool"}
                    ],
                    "name": "confirmUserReading",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function"
                }
            ]
            
            contract = self.w3.eth.contract(
                address=self.water_billing_address, 
                abi=abi
            )
            
            tx = contract.functions.confirmUserReading(
                user_address,
                confirmed
            ).build_transaction({
                'from': self.account.address,
                'nonce': self.w3.eth.get_transaction_count(self.account.address),
                'gas': 300000,
                'gasPrice': self.w3.eth.gas_price
            })
            
            signed_tx = self.w3.eth.account.sign_transaction(tx, self.private_key)
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
            
            logger.info(f"User reading confirmed for {user_address}: confirmed={confirmed}")
            return self.w3.to_hex(tx_hash)
            
        except Exception as e:
            logger.error(f"Confirm user reading failed: {e}")
            raise e

    def full_slash_user(self, user_address: str) -> str:
        """
        Kullanıcıyı tamamen blacklist'e al ve depozitosunu yak - WaterBillingFraudManager.fullSlash
        
        Args:
            user_address: Kullanıcı cüzdan adresi
            
        Returns:
            Transaction hash
        """
        try:
            if not self.private_key:
                raise ValueError("Wallet not configured")
            
            fraud_manager_address = os.getenv("WATER_BILLING_FRAUD_MANAGER_ADDRESS")
            if not fraud_manager_address:
                raise ValueError("Fraud manager address not configured")
            
            abi = [
                {
                    "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
                    "name": "fullSlash",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function"
                }
            ]
            
            contract = self.w3.eth.contract(address=fraud_manager_address, abi=abi)
            
            tx = contract.functions.fullSlash(
                user_address
            ).build_transaction({
                'from': self.account.address,
                'nonce': self.w3.eth.get_transaction_count(self.account.address),
                'gas': 3000000,
                'gasPrice': self.w3.eth.gas_price
            })
            
            signed_tx = self.w3.eth.account.sign_transaction(tx, self.private_key)
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
            
            logger.info(f"Full slash executed for {user_address}")
            return self.w3.to_hex(tx_hash)
            
        except Exception as e:
            logger.error(f"Full slash failed: {e}")
            raise e

# Global instance
blockchain_service = BlockchainService()

