"""
Water Validation Service
Su sayacı doğrulama ve fatura hesaplama servisi
"""
from typing import Dict, Optional
from datetime import datetime


def calculate_water_bill(
    current_index: int,
    previous_index: Optional[int] = None,
    price_per_m3: float = 5.0  # Default price per m3
) -> Dict[str, any]:
    """
    Su faturası hesaplar
    
    Args:
        current_index: Mevcut sayaç okuma
        previous_index: Önceki sayaç okuma
        price_per_m3: m3 başına fiyat
    
    Returns:
        Bill calculation dictionary
    """
    if current_index < 0:
        return {
            "valid": False,
            "error": "Invalid current index"
        }
    
    if previous_index is not None:
        if previous_index < 0:
            return {
                "valid": False,
                "error": "Invalid previous index"
            }
        
        if current_index < previous_index:
            return {
                "valid": False,
                "error": "Current index cannot be less than previous index"
            }
        
        consumption = current_index - previous_index
    else:
        consumption = current_index  # First reading
    
    if consumption < 0:
        return {
            "valid": False,
            "error": "Negative consumption detected"
        }
    
    bill_amount = consumption * price_per_m3
    
    # Calculate reward (small reward for timely payment)
    reward_amount = int(consumption * 0.1)  # 0.1 BELT per m3
    
    return {
        "valid": True,
        "consumption_m3": consumption,
        "bill_amount": bill_amount,
        "reward_amount": reward_amount,
        "current_index": current_index,
        "previous_index": previous_index,
        "price_per_m3": price_per_m3
    }
