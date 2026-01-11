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
        """
        try:
            if not self.private_key:
                raise ValueError("Wallet not configured")

            contract = self.w3.eth.contract(address=self.recycling_address, abi=self.recycling_abi)
            
            # Map material string to enum int
            material_map = {"glass": 0, "paper": 1, "metal": 2}
            material_enum = material_map.get(material_type_str)
            if material_enum is None:
                raise ValueError("Invalid material type")
                
            # Amount conversion if needed (e.g. to int)
            amount_int = int(amount) # Varsayım: Kontrat 1kg = 1 unit bekliyor
            
            # Build Transaction
            tx = contract.functions.rewardRecycling(
                user_address,
                material_enum,
                amount_int,
                qr_hash
            ).build_transaction({
                'from': self.account.address,
                'nonce': self.w3.eth.get_transaction_count(self.account.address),
                'gas': 2000000, # Tahmini
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

# Global instance
blockchain_service = BlockchainService()
