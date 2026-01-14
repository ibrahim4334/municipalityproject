"""
Database Models
SQLAlchemy ORM modelleri
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, Index, Enum as SQLEnum
from sqlalchemy.sql import func
from database.db import Base
import enum


class UserRole(enum.Enum):
    """
    Kullanıcı rolleri
    
    - CITIZEN: Vatandaş - fotoğraf çeker, fatura beyanı, geri dönüşüm bildirimi
    - MUNICIPALITY_STAFF: Personel - 6 aylık kontrol, atık kontrolü, fraud doğrulama
    - SERVICE_OPERATOR: Backend AI - OCR, anomaly detection, tutarsızlık tespiti
    - MUNICIPALITY_ADMIN: Admin - governance, parametre güncelleme
    - ORACLE: Oracle - realtime dış veri akışı (GPS, enerji/su değerleri)
    """
    CITIZEN = "citizen"                      # Vatandaş
    MUNICIPALITY_STAFF = "municipality_staff"  # Belediye Personeli (6 aylık kontrol)
    SERVICE_OPERATOR = "service_operator"    # AI Backend / Hizmet Operatörü
    MUNICIPALITY_ADMIN = "municipality_admin"  # Belediye Yöneticisi / Admin
    ORACLE = "oracle"                        # Oracle - dış veri sağlayıcı


class User(Base):
    """Kullanıcı modeli - Wallet-based authentication"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    wallet_address = Column(String(42), nullable=False, unique=True, index=True)
    role = Column(SQLEnum(UserRole), nullable=False, default=UserRole.CITIZEN, index=True)
    email = Column(String(255), nullable=True)
    name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)
    
    __table_args__ = (
        Index('idx_wallet_role', 'wallet_address', 'role'),
    )


class WaterMeterReading(Base):
    """Su sayacı okuma kayıtları"""
    __tablename__ = "water_meter_readings"
    
    id = Column(Integer, primary_key=True, index=True)
    meter_no = Column(String(50), nullable=False, index=True)
    wallet_address = Column(String(42), nullable=False, index=True)
    reading_index = Column(Integer, nullable=False)
    previous_index = Column(Integer, nullable=True)
    consumption_m3 = Column(Float, nullable=False)
    bill_amount = Column(Float, nullable=False)
    reward_amount = Column(Integer, nullable=False, default=0)
    image_path = Column(String(255), nullable=True)
    is_valid = Column(Boolean, default=True)
    anomaly_detected = Column(Boolean, default=False)
    validated_by = Column(String(42), nullable=True)  # Service operator wallet address
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    __table_args__ = (
        Index('idx_meter_wallet', 'meter_no', 'wallet_address'),
        Index('idx_created_at', 'created_at'),
    )


class RecyclingSubmission(Base):
    """Geri dönüşüm gönderim kayıtları"""
    __tablename__ = "recycling_submissions"
    
    id = Column(Integer, primary_key=True, index=True)
    wallet_address = Column(String(42), nullable=False, index=True)
    material_type = Column(String(20), nullable=False)  # glass, paper, metal
    amount_kg = Column(Float, nullable=False)
    qr_token_id = Column(String(100), nullable=False, unique=True, index=True)
    qr_hash = Column(String(64), nullable=False, unique=True, index=True)
    reward_amount = Column(Integer, nullable=False)
    transaction_hash = Column(String(66), nullable=True, unique=True, index=True)
    is_processed = Column(Boolean, default=False)
    validated_by = Column(String(42), nullable=True)  # Service operator wallet address
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_at = Column(DateTime(timezone=True), nullable=True)
    
    __table_args__ = (
        Index('idx_wallet_created', 'wallet_address', 'created_at'),
    )


class UserDeposit(Base):
    """Kullanıcı depozito kayıtları"""
    __tablename__ = "user_deposits"
    
    id = Column(Integer, primary_key=True, index=True)
    wallet_address = Column(String(42), nullable=False, unique=True, index=True)
    deposit_amount = Column(Float, nullable=False)
    deposit_token = Column(String(42), nullable=False)  # Token contract address
    transaction_hash = Column(String(66), nullable=True, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class PenaltyRecord(Base):
    """Ceza kayıtları"""
    __tablename__ = "penalty_records"
    
    id = Column(Integer, primary_key=True, index=True)
    wallet_address = Column(String(42), nullable=False, index=True)
    penalty_type = Column(String(50), nullable=False)  # late_payment, violation, etc.
    penalty_amount = Column(Float, nullable=False)
    description = Column(Text, nullable=True)
    transaction_hash = Column(String(66), nullable=True, unique=True, index=True)
    is_paid = Column(Boolean, default=False)
    created_by = Column(String(42), nullable=True)  # Municipality admin wallet address
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    paid_at = Column(DateTime(timezone=True), nullable=True)


class FraudRecord(Base):
    """Fraud kayıtları - AI ve fiziksel kontrol fraud tespitleri"""
    __tablename__ = "fraud_records"
    
    id = Column(Integer, primary_key=True, index=True)
    wallet_address = Column(String(42), nullable=False, index=True)
    fraud_type = Column(String(50), nullable=False)  # ai_detected, inspection_detected
    detection_method = Column(String(50), nullable=True)  # ocr_anomaly, consumption_drop, physical_inspection
    penalty_amount = Column(Float, nullable=True)
    original_reading = Column(Integer, nullable=True)  # Bildirilen okuma
    actual_reading = Column(Integer, nullable=True)  # Gerçek okuma (fiziksel kontrol)
    underpayment_amount = Column(Float, nullable=True)  # Eksik ödenen tutar
    interest_charged = Column(Float, nullable=True)  # Faiz tutarı
    transaction_hash = Column(String(66), nullable=True, index=True)
    detected_by = Column(String(42), nullable=True)  # AI system or inspector wallet
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        Index('idx_fraud_wallet_type', 'wallet_address', 'fraud_type'),
        Index('idx_fraud_created', 'created_at'),
    )


class InspectionSchedule(Base):
    """Fiziksel kontrol planlaması - 6 aylık sayaç kontrolleri"""
    __tablename__ = "inspection_schedules"
    
    id = Column(Integer, primary_key=True, index=True)
    wallet_address = Column(String(42), nullable=False, index=True)
    meter_no = Column(String(50), nullable=False)
    scheduled_date = Column(DateTime(timezone=True), nullable=False)
    inspector_wallet = Column(String(42), nullable=True, index=True)
    status = Column(String(20), default="pending", index=True)  # pending, completed, fraud_found, cancelled
    actual_reading = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        Index('idx_inspection_wallet_status', 'wallet_address', 'status'),
        Index('idx_inspection_scheduled', 'scheduled_date'),
        Index('idx_inspection_inspector', 'inspector_wallet', 'status'),
    )


# ==============================
# EXTENDED ROLES
# ==============================

class ExtendedRole(enum.Enum):
    """
    Genişletilmiş roller - Smart Contract ile eşleşen
    
    - AI_VERIFIER: AI doğrulama sistemi (fraud kanıtı gönderebilir)
    - INSPECTOR: Fiziksel kontrol yapan personel
    - RECYCLING_AUDITOR: Geri dönüşüm onay personeli
    """
    AI_VERIFIER = "ai_verifier"           # AI fraud detection
    INSPECTOR = "inspector"               # Physical inspection
    RECYCLING_AUDITOR = "recycling_auditor"  # Recycling approval


class FraudReport(Base):
    """
    Fraud raporları - AI skorlaması ve kullanıcı onayı
    
    Workflow:
    1. AI fraud skoru hesaplar
    2. Skor >= 50 ise rapor oluşturulur
    3. Kullanıcıdan onay istenir (is_confirmed)
    4. Onay durumuna göre işlem yapılır
    """
    __tablename__ = "fraud_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    wallet_address = Column(String(42), nullable=False, index=True)
    
    # AI Scoring
    ai_score = Column(Integer, nullable=False)  # 0-100
    risk_level = Column(String(20), nullable=False)  # low, medium, high, critical
    anomalies = Column(Text, nullable=True)  # JSON list of anomalies
    
    # Confirmation
    is_confirmed = Column(Boolean, default=False)  # Kullanıcı onayladı mı
    confirmed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Reading data
    current_reading = Column(Integer, nullable=True)
    current_consumption = Column(Float, nullable=True)
    average_consumption = Column(Float, nullable=True)
    drop_percent = Column(Float, nullable=True)
    
    # Action taken
    action_taken = Column(String(50), nullable=True)  # penalty_applied, under_review, confirmation_needed
    penalty_amount = Column(Float, nullable=True)
    transaction_hash = Column(String(66), nullable=True)
    
    # Metadata
    image_path = Column(String(255), nullable=True)
    photo_timestamp = Column(DateTime(timezone=True), nullable=True)
    has_gps = Column(Boolean, default=True)
    was_edited = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    __table_args__ = (
        Index('idx_fraud_report_wallet', 'wallet_address'),
        Index('idx_fraud_report_score', 'ai_score'),
        Index('idx_fraud_report_confirmed', 'is_confirmed'),
        Index('idx_fraud_report_created', 'created_at'),
    )


class MaterialMultiplier(Base):
    """
    Geri dönüşüm materyal çarpanları
    Token katsayılarını yönetir
    """
    __tablename__ = "material_multipliers"
    
    id = Column(Integer, primary_key=True, index=True)
    material_type = Column(String(20), nullable=False, unique=True, index=True)
    multiplier = Column(Float, nullable=False)  # 1.0 = base rate
    base_token_rate = Column(Integer, nullable=False)  # tokens per kg/unit
    description = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# Default material multipliers
DEFAULT_MATERIAL_MULTIPLIERS = {
    "plastic": {"multiplier": 1.0, "base_rate": 10, "description": "Plastik - PET, HDPE, PVC, PP"},
    "glass": {"multiplier": 1.2, "base_rate": 12, "description": "Cam - Yeşil, Beyaz, Kahve"},
    "metal": {"multiplier": 1.5, "base_rate": 15, "description": "Metal - Alüminyum, Çelik, Teneke"},
    "paper": {"multiplier": 0.8, "base_rate": 8, "description": "Kağıt - Karton, Gazete, Ofis"},
    "electronic": {"multiplier": 2.0, "base_rate": 25, "description": "Elektronik - PCB, Pil, Telefon"},
}
