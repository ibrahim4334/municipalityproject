import logging
from flask import jsonify
from web3 import Web3

def error_response(message: str, status_code: int = 400, extra: dict | None = None):
    payload = {"error": message}
    if extra:
        payload.update(extra)
    return jsonify(payload), status_code

def validate_wallet_address(address: str) -> bool:
    """Validate Ethereum wallet address format using Web3"""
    if not address or not isinstance(address, str):
        return False
    return Web3.is_address(address)

def normalize_wallet_address(address: str) -> str | None:
    """
    Returns checksummed address.
    """
    if not validate_wallet_address(address):
        return None
    return Web3.to_checksum_address(address)
