import logging
import json
import os
from web3 import Web3
from web3.middleware import geth_poa_middleware
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
        self.w3.middleware_onion.inject(geth_poa_middleware, layer=0)
        
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
                "name": "submitReading",
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

            contract = self.w3.eth.contract(address=self.recycling_address, abi=self.recycling_abi)
            
            # Map material string to enum int (WasteType enum in contract)
            material_map = {
                "plastic": 0,     # WasteType.Plastic
                "glass": 1,       # WasteType.Glass
                "metal": 2,       # WasteType.Metal
                "paper": 3,       # WasteType.Paper
                "electronic": 4   # WasteType.Electronic
            }
            material_enum = material_map.get(material_type_str.lower())
            if material_enum is None:
                raise ValueError(f"Invalid material type: {material_type_str}. Valid: {list(material_map.keys())}")
                
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

            contract = self.w3.eth.contract(address=self.water_billing_address, abi=self.water_billing_abi)
            
            tx = contract.functions.submitReading(
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
    
    def penalize_user_deposit(self, user_address: str, penalty_percent: int, reason: str) -> str:
        """
        WaterBillingFraudManager üzerinden depozito cezası kes.
        
        Args:
            user_address: Kullanıcı cüzdan adresi
            penalty_percent: Ceza yüzdesi (0-100)
            reason: Ceza sebebi
            
        Returns:
            Transaction hash
        """
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
            
            tx = contract.functions.penalizeForAIFraud(
                user_address,
                reason
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

# Global instance
blockchain_service = BlockchainService()

