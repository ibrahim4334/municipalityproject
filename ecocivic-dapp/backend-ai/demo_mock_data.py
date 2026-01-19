# -*- coding: utf-8 -*-
"""
Demo Mock Data for EcoCivic v1
Sunum ve test için hazır veri setleri

v1 Not: Bu dosya demo/sunum için mock veriler içerir.
Gerçek ortamda kullanılmamalıdır.
"""
from datetime import datetime, timedelta
import hashlib
import secrets

# ==============================
# DEMO ANOMALY SIGNALS
# ==============================
"""
Anomali sinyal örnekleri - personel incelemesi için
Her sinyal bir istatistiksel tespit temsil eder (ML/AI DEĞİL)
"""
DEMO_ANOMALY_SIGNALS = [
    {
        "id": 1,
        "wallet": "0x1234567890abcdef1234567890abcdef12345678",
        "wallet_display": "0x1234...5678",
        "signal_type": "consumption_drop",
        "signal_score": 65,
        "signal_level": "high",
        "details": "Tüketim %58 düştü (ortalama: 25m³, mevcut: 10.5m³)",
        "status": "pending_review",
        "detected_by": "statistical_analysis",
        "created_at": (datetime.utcnow() - timedelta(hours=2)).isoformat() + "Z",
        "recommendation": "Personel incelemesi önerilir"
    },
    {
        "id": 2,
        "wallet": "0xabcdef1234567890abcdef1234567890abcdef12",
        "wallet_display": "0xabcd...ef12",
        "signal_type": "index_decreased",
        "signal_score": 95,
        "signal_level": "critical",
        "details": "Sayaç endeksi geriye gitti: 1250 → 1189 (imkansız durum)",
        "status": "pending_review",
        "detected_by": "ocr_validation",
        "created_at": (datetime.utcnow() - timedelta(hours=5)).isoformat() + "Z",
        "recommendation": "Personel incelemesi gerekli"
    },
    {
        "id": 3,
        "wallet": "0x9876543210fedcba9876543210fedcba98765432",
        "wallet_display": "0x9876...5432",
        "signal_type": "photo_metadata_suspicious",
        "signal_score": 45,
        "signal_level": "medium",
        "details": "Fotoğraf 8 dakika önce çekilmiş, GPS verisi yok",
        "status": "reviewed_ok",
        "detected_by": "metadata_check",
        "reviewed_by": "0xstaff123...abc",
        "review_notes": "Kullanıcı telefon GPS'i kapalı olduğunu belirtti, kabul edildi",
        "created_at": (datetime.utcnow() - timedelta(hours=12)).isoformat() + "Z",
        "reviewed_at": (datetime.utcnow() - timedelta(hours=10)).isoformat() + "Z",
        "recommendation": "İzlemeye devam"
    },
    {
        "id": 4,
        "wallet": "0xfedcba9876543210fedcba9876543210fedcba98",
        "wallet_display": "0xfedc...ba98",
        "signal_type": "excessive_consumption",
        "signal_score": 72,
        "signal_level": "high",
        "details": "Aşırı tüketim: 180m³ (önceki ay ortalaması: 22m³ - 8 katı artış)",
        "status": "pending_review",
        "detected_by": "consumption_analysis",
        "created_at": (datetime.utcnow() - timedelta(hours=1)).isoformat() + "Z",
        "recommendation": "Personel incelemesi gerekli"
    }
]

# ==============================
# DEMO TX HASHES
# ==============================
"""
Örnek blockchain transaction hash'leri
Demo/sunum için kullanılır, gerçek işlemler DEĞİL
"""
DEMO_TX_HASHES = {
    "water_reading_success": "0xa1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
    "water_reading_pending": "0xpending123456789012345678901234567890abcdef1234567890abcdef12",
    "recycling_reward": "0xf6e5d4c3b2a19876543210987654321098765432fedbca987654321098765432",
    "fraud_penalty": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    "staff_decision_approve": "0xstaff_approve_7890abcdef1234567890abcdef1234567890abcdef123456",
    "staff_decision_fraud": "0xstaff_fraud_c3d4e5f6789012345678901234567890abcdef1234567890ab",
    "admin_appeal_approve": "0xadmin_approve_9876543210fedcba9876543210fedcba98765432fedcba98",
    "admin_appeal_reject": "0xadmin_reject_0fedcba9876543210fedcba98765432fedcba9876543210"
}

# ==============================
# DEMO QR DATA
# ==============================
"""
Örnek geri dönüşüm QR kodları
3 saatlik geçerlilik süresi ile
"""
def generate_demo_qr_data(wallet_address: str, plastic_kg: float = 2.5, glass_kg: float = 1.0):
    """Demo için QR data oluştur"""
    token_id = secrets.token_urlsafe(24)
    qr_hash = hashlib.sha256(
        f"{token_id}:{wallet_address}:{datetime.utcnow().isoformat()}".encode()
    ).hexdigest()
    
    return {
        "token_id": token_id,
        "hash": f"sha256:{qr_hash}",
        "wallet_address": wallet_address,
        "expires_at": (datetime.utcnow() + timedelta(hours=3)).isoformat() + "Z",
        "expires_in_seconds": 3 * 60 * 60,  # 10800 saniye
        "declared_types": [
            {"type": "plastic", "label": "Plastik", "amount": plastic_kg, "unit": "kg", "reward_rate": 10},
            {"type": "glass", "label": "Cam", "amount": glass_kg, "unit": "kg", "reward_rate": 12}
        ],
        "total_reward": int(plastic_kg * 10 + glass_kg * 12),
        "status": "pending_validation",
        "blockchain_hash_stored": True,
        "note": "Bu QR hash blockchain'de saklanır, tekrar kullanılamaz"
    }

# Pre-generated demo QR examples
DEMO_QR_DATA = [
    {
        "token_id": "xK9mN2pL8qR5tW3vY7zA_demo1",
        "hash": "sha256:a5b4c3d2e1f09876543210fedcba9876543210fedcba9876543210fedcba9876",
        "wallet_address": "0x1234567890abcdef1234567890abcdef12345678",
        "expires_at": (datetime.utcnow() + timedelta(hours=3)).isoformat() + "Z",
        "declared_types": [
            {"type": "plastic", "label": "Plastik", "amount": 2.5, "unit": "kg"},
            {"type": "glass", "label": "Cam", "amount": 1.0, "unit": "kg"}
        ],
        "total_reward": 37,  # 2.5*10 + 1.0*12
        "status": "pending_validation"
    },
    {
        "token_id": "yL0nO3qM9rS6uX4wZ8aB_demo2",
        "hash": "sha256:b6c5d4e3f21a9876543210fedcba9876543210fedcba9876543210fedcba9877",
        "wallet_address": "0xabcdef1234567890abcdef1234567890abcdef12",
        "expires_at": (datetime.utcnow() + timedelta(hours=2)).isoformat() + "Z",
        "declared_types": [
            {"type": "metal", "label": "Metal", "amount": 3.0, "unit": "kg"},
            {"type": "electronic", "label": "Elektronik", "amount": 2, "unit": "adet"}
        ],
        "total_reward": 95,  # 3.0*15 + 2*25
        "status": "pending_validation"
    },
    {
        "token_id": "zM1oP4rN0sT7vY5xA9bC_demo3",
        "hash": "sha256:c7d6e5f4g32b9876543210fedcba9876543210fedcba9876543210fedcba9878",
        "wallet_address": "0x9876543210fedcba9876543210fedcba98765432",
        "expires_at": (datetime.utcnow() - timedelta(hours=1)).isoformat() + "Z",  # Expired
        "declared_types": [
            {"type": "paper", "label": "Kağıt", "amount": 5.0, "unit": "kg"}
        ],
        "total_reward": 40,  # 5.0*8
        "status": "expired"
    }
]

# ==============================
# DEMO USER DATA
# ==============================
"""
Örnek kullanıcı verileri
Farklı durumlar için test senaryoları
"""
DEMO_USERS = [
    {
        "wallet_address": "0x1234567890abcdef1234567890abcdef12345678",
        "role": "citizen",
        "recycling_fraud_warnings_remaining": 2,
        "water_fraud_warnings_remaining": 2,
        "pending_reward_balance": 150,
        "is_blacklisted": False,
        "status_description": "Normal vatandaş - iyi durumda"
    },
    {
        "wallet_address": "0xabcdef1234567890abcdef1234567890abcdef12",
        "role": "citizen",
        "recycling_fraud_warnings_remaining": 1,
        "water_fraud_warnings_remaining": 2,
        "pending_reward_balance": 45,
        "is_blacklisted": False,
        "status_description": "Uyarı almış vatandaş - dikkatli"
    },
    {
        "wallet_address": "0x9876543210fedcba9876543210fedcba98765432",
        "role": "citizen",
        "recycling_fraud_warnings_remaining": 0,
        "water_fraud_warnings_remaining": 1,
        "pending_reward_balance": 0,
        "is_blacklisted": True,
        "status_description": "Kara listede vatandaş"
    },
    {
        "wallet_address": "0xstaff1234567890abcdef1234567890abcdef12",
        "role": "municipality_staff",
        "recycling_fraud_warnings_remaining": 2,
        "water_fraud_warnings_remaining": 2,
        "pending_reward_balance": 0,
        "is_blacklisted": False,
        "status_description": "Belediye personeli"
    },
    {
        "wallet_address": "0xadmin1234567890abcdef1234567890abcdef12",
        "role": "municipality_admin",
        "recycling_fraud_warnings_remaining": 2,
        "water_fraud_warnings_remaining": 2,
        "pending_reward_balance": 0,
        "is_blacklisted": False,
        "status_description": "Belediye yöneticisi"
    }
]

# ==============================
# DEMO WATER READINGS
# ==============================
"""
Örnek su sayacı okumaları
OCR + anomali tespiti test senaryoları
"""
DEMO_WATER_READINGS = [
    {
        "meter_no": "WSM-2024-001",
        "wallet_address": "0x1234567890abcdef1234567890abcdef12345678",
        "readings": [
            {"month": "2025-08", "index": 1000, "consumption": 22},
            {"month": "2025-09", "index": 1024, "consumption": 24},
            {"month": "2025-10", "index": 1045, "consumption": 21},
            {"month": "2025-11", "index": 1068, "consumption": 23},
            {"month": "2025-12", "index": 1090, "consumption": 22},
            {"month": "2026-01", "index": 1112, "consumption": 22}  # Normal
        ],
        "average_consumption": 22.3,
        "scenario": "Normal tüketim - anomali yok"
    },
    {
        "meter_no": "WSM-2024-002",
        "wallet_address": "0xabcdef1234567890abcdef1234567890abcdef12",
        "readings": [
            {"month": "2025-08", "index": 2000, "consumption": 25},
            {"month": "2025-09", "index": 2028, "consumption": 28},
            {"month": "2025-10", "index": 2052, "consumption": 24},
            {"month": "2025-11", "index": 2078, "consumption": 26},
            {"month": "2025-12", "index": 2103, "consumption": 25},
            {"month": "2026-01", "index": 2113, "consumption": 10}  # %60 düşüş!
        ],
        "average_consumption": 25.6,
        "scenario": "Consumption drop - %60 düşüş uyarısı"
    },
    {
        "meter_no": "WSM-2024-003",
        "wallet_address": "0x9876543210fedcba9876543210fedcba98765432",
        "readings": [
            {"month": "2025-12", "index": 3150, "consumption": 30},
            {"month": "2026-01", "index": 3120, "consumption": -30}  # Endeks azaldı!
        ],
        "average_consumption": 30,
        "scenario": "Index decreased - imkansız durum, fraud sinyali"
    }
]

# ==============================
# DEMO STATISTICS
# ==============================
"""
Admin dashboard için demo istatistikler
"""
DEMO_ADMIN_STATS = {
    "totalDeclarations": 156,
    "approved": 128,
    "pending": 18,
    "fraud": 10,
    "totalRewards": 4850,
    "pendingAppeals": 5,
    "activeUsers": 89,
    "monthlyGrowth": 12.5,  # %12.5 artış
    "topRecyclers": [
        {"wallet": "0x1234...5678", "total_kg": 45.5, "total_rewards": 520},
        {"wallet": "0xabcd...ef12", "total_kg": 38.2, "total_rewards": 445},
        {"wallet": "0x9876...5432", "total_kg": 32.8, "total_rewards": 390}
    ]
}

# ==============================
# HELPER FUNCTIONS
# ==============================

def get_demo_signal_by_type(signal_type: str):
    """Belirli tür sinyal getir"""
    for signal in DEMO_ANOMALY_SIGNALS:
        if signal["signal_type"] == signal_type:
            return signal
    return None

def get_demo_user_by_status(status: str):
    """Belirli durumda kullanıcı getir"""
    status_map = {
        "normal": DEMO_USERS[0],
        "warned": DEMO_USERS[1],
        "blacklisted": DEMO_USERS[2],
        "staff": DEMO_USERS[3],
        "admin": DEMO_USERS[4]
    }
    return status_map.get(status)

def get_demo_reading_scenario(scenario: str):
    """Belirli senaryo için okuma getir"""
    scenario_map = {
        "normal": DEMO_WATER_READINGS[0],
        "consumption_drop": DEMO_WATER_READINGS[1],
        "index_decreased": DEMO_WATER_READINGS[2]
    }
    return scenario_map.get(scenario)


# ==============================
# DEMO ENDPOINT RESPONSES
# ==============================
"""
Demo için hazır API response'ları
Frontend test ve sunum için kullanılır
"""

DEMO_API_RESPONSES = {
    "/api/water/validate_success": {
        "valid": True,
        "meter_no": "WSM-2024-001",
        "current_index": 1112,
        "historical_avg": 22.3,
        "reward_eligible": True,
        "transaction_hash": DEMO_TX_HASHES["water_reading_success"],
        "photo_validated": True,
        "blockchain_recorded": True,
        "anomaly_signal": {
            "detected": False,
            "signal_score": 0,
            "signal_type": None
        },
        "message_for_user": "OCR doğrulaması tamamlandı. Sayaç kaydı blockchain'e yazıldı."
    },
    
    "/api/water/validate_with_anomaly": {
        "valid": False,
        "requires_confirmation": True,
        "reason": "consumption_drop_warning",
        "current_consumption": 10,
        "average_consumption": 25.6,
        "drop_percent": 60.9,
        "message": "Tüketiminiz geçmiş aylara göre %60.9 düştü",
        "warning": "Tüketiminiz geçmiş aylara göre önemli ölçüde düştü. Devam etmek istediğinizden emin misiniz?",
        "anomaly_signal": {
            "detected": True,
            "signal_score": 65,
            "signal_type": "consumption_drop"
        }
    },
    
    "/api/recycling/declare_success": {
        "success": True,
        "declaration_id": 42,
        "qr_data": DEMO_QR_DATA[0],
        "expires_at": (datetime.utcnow() + timedelta(hours=3)).isoformat() + "Z",
        "total_reward": 37,
        "message": "Beyan oluşturuldu. 3 saat içinde geri dönüşüm merkezinde okutun."
    },
    
    "/api/fraud/status_normal": {
        "has_fraud": False,
        "total_penalties": 0,
        "recycling_warnings_remaining": 2,
        "water_warnings_remaining": 2,
        "is_recycling_blacklisted": False,
        "is_water_blacklisted": False,
        "pending_reward_balance": 150,
        "records": []
    },
    
    "/api/fraud/status_warned": {
        "has_fraud": True,
        "total_penalties": 50,
        "recycling_warnings_remaining": 1,
        "water_warnings_remaining": 2,
        "is_recycling_blacklisted": False,
        "is_water_blacklisted": False,
        "pending_reward_balance": 45,
        "records": [
            {
                "fraud_type": "recycling_mismatch",
                "penalty_amount": 50,
                "detected_at": (datetime.utcnow() - timedelta(days=15)).isoformat(),
                "tx_hash": DEMO_TX_HASHES["fraud_penalty"]
            }
        ]
    }
}


if __name__ == "__main__":
    # Demo data test
    print("=== EcoCivic v1 Demo Data ===\n")
    
    print("📊 Anomaly Signals:")
    for signal in DEMO_ANOMALY_SIGNALS[:2]:
        print(f"  - [{signal['signal_level'].upper()}] {signal['signal_type']}: {signal['details'][:50]}...")
    
    print("\n🔗 TX Hashes:")
    for key, value in list(DEMO_TX_HASHES.items())[:3]:
        print(f"  - {key}: {value[:20]}...")
    
    print("\n📱 QR Data Example:")
    qr = generate_demo_qr_data("0xtest123...", 3.0, 2.0)
    print(f"  - Token: {qr['token_id'][:16]}...")
    print(f"  - Reward: {qr['total_reward']} BELT")
    print(f"  - Expires: {qr['expires_at']}")
    
    print("\n✅ Demo data ready for presentation!")
