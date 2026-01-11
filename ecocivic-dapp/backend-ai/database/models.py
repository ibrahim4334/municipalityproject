"""
Database Models
SQLAlchemy ORM modelleri
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, Index, Enum as SQLEnum
from sqlalchemy.sql import func
from database.db import Base
import enum


class UserRole(enum.Enum):
    """Kullanıcı rolleri"""
    CITIZEN = "citizen"  # Vatandaş
    SERVICE_OPERATOR = "service_operator"  # Hizmet Operatörü
    MUNICIPALITY_ADMIN = "municipality_admin"  # Belediye Yöneticisi


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
