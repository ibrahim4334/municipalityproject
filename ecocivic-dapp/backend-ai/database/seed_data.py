# -*- coding: utf-8 -*-
"""
Seed Data Script - Test Verileri
Tum rolleri ve senaryolari test edebilmek icin ornek veriler olusturur.

Kullanim:
    python -c "from database.seed_data import seed_all; seed_all()"
    
    veya
    
    python database/seed_data.py
"""
import sys
import io
# Windows encoding fix
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from datetime import datetime, timedelta
from database.db import get_db, init_db
from database.models import (
    User, UserRole,
    WaterMeterReading,
    RecyclingSubmission,
    RecyclingDeclaration,
    UserDeposit,
    PenaltyRecord,
    FraudRecord,
    InspectionSchedule,
    FraudReport,
    MaterialMultiplier,
    DEFAULT_MATERIAL_MULTIPLIERS
)
import hashlib
import uuid


# ==============================
# TEST WALLET ADDRESSES
# ==============================
# Her rol icin benzersiz test wallet adresleri
WALLETS = {
    "citizen_1": "0xCitizen00100000000000000000000000000001",
    "citizen_2": "0xCitizen00200000000000000000000000000002",
    "citizen_fraud": "0xCitizenFraud0000000000000000000000003",
    "staff": "0xStaff00100000000000000000000000000000001",
    "operator": "0xOperator001000000000000000000000000001",
    "admin": "0xAdmin00100000000000000000000000000000001",
    "oracle": "0xOracle0010000000000000000000000000000001",
    "inspector": "0xInspector01000000000000000000000000001",
}


def clear_all_data(db):
    """Mevcut tum verileri sil"""
    print("[DELETE] Mevcut veriler temizleniyor...")
    db.query(FraudReport).delete()
    db.query(InspectionSchedule).delete()
    db.query(FraudRecord).delete()
    db.query(PenaltyRecord).delete()
    db.query(UserDeposit).delete()
    db.query(RecyclingDeclaration).delete()
    db.query(RecyclingSubmission).delete()
    db.query(WaterMeterReading).delete()
    db.query(MaterialMultiplier).delete()
    db.query(User).delete()
    db.commit()
    print("[OK] Veriler temizlendi")


def seed_users(db):
    """Test kullanicilarini olustur"""
    print("\n[USER] Kullanicilar olusturuluyor...")
    
    users = [
        # Normal vatandaslar
        User(
            wallet_address=WALLETS["citizen_1"],
            role=UserRole.CITIZEN,
            name="Ahmet Yilmaz",
            email="ahmet@test.com",
            is_active=True
        ),
        User(
            wallet_address=WALLETS["citizen_2"],
            role=UserRole.CITIZEN,
            name="Ayse Demir",
            email="ayse@test.com",
            is_active=True
        ),
        # Fraud suphelisi vatandas
        User(
            wallet_address=WALLETS["citizen_fraud"],
            role=UserRole.CITIZEN,
            name="Mehmet Supheli",
            email="mehmet@test.com",
            is_active=True
        ),
        # Belediye personeli (fiziksel kontrol)
        User(
            wallet_address=WALLETS["staff"],
            role=UserRole.MUNICIPALITY_STAFF,
            name="Fatma Kontrol",
            email="fatma@belediye.gov.tr",
            is_active=True
        ),
        # Service operator (AI dogrulama)
        User(
            wallet_address=WALLETS["operator"],
            role=UserRole.SERVICE_OPERATOR,
            name="AI Operator",
            email="operator@ecocivic.com",
            is_active=True
        ),
        # Admin
        User(
            wallet_address=WALLETS["admin"],
            role=UserRole.MUNICIPALITY_ADMIN,
            name="Yonetici Admin",
            email="admin@belediye.gov.tr",
            is_active=True
        ),
        # Oracle
        User(
            wallet_address=WALLETS["oracle"],
            role=UserRole.ORACLE,
            name="Data Oracle",
            email="oracle@ecocivic.com",
            is_active=True
        ),
        # Inspector (staff rolunde ama fiziksel kontrol icin)
        User(
            wallet_address=WALLETS["inspector"],
            role=UserRole.MUNICIPALITY_STAFF,
            name="Ali Mufettis",
            email="ali@belediye.gov.tr",
            is_active=True
        ),
    ]
    
    for user in users:
        db.add(user)
    
    db.commit()
    print(f"[OK] {len(users)} kullanici olusturuldu")
    
    for user in users:
        print(f"   - [{user.role.value}] {user.name}: {user.wallet_address}")


def seed_water_meter_readings(db):
    """Su sayaci okumalarini olustur - 5 aylik veriler"""
    print("\n[WATER] Su sayaci okumalari olusturuluyor (5 aylik)...")
    
    now = datetime.now()
    readings = []
    
    # ==============================
    # Citizen 1 - Normal tuketim gecmisi (5 ay)
    # Senaryo: Tutarli tuketim, odule hak kazanir
    # ==============================
    meter_no_1 = "WSM-2024-001"
    citizen1_consumptions = [15, 17, 16, 18, 19]  # Normal, tutarli
    prev_index = 1000
    for i, consumption in enumerate(citizen1_consumptions):
        new_index = prev_index + consumption
        photo_hash = hashlib.sha256(f"photo_citizen1_{i}".encode()).hexdigest()
        readings.append(WaterMeterReading(
            meter_no=meter_no_1,
            wallet_address=WALLETS["citizen_1"],
            reading_index=new_index,
            previous_index=prev_index,
            consumption_m3=float(consumption),
            bill_amount=float(consumption * 5.5),
            reward_amount=10 if consumption < 20 else 0,
            photo_hash=photo_hash,
            is_valid=True,
            anomaly_detected=False,
            user_confirmed_low_consumption=False,
            admin_approval_status="approved",
            validated_by=WALLETS["operator"],
            created_at=now - timedelta(days=30 * (5 - i))
        ))
        prev_index = new_index
    
    # ==============================
    # Citizen 2 - %50+ dusus senaryosu (5 ay)
    # Senaryo: 4. ayda ani dusus, AI uyarisi verildi
    # ==============================
    meter_no_2 = "WSM-2024-002"
    citizen2_consumptions = [20, 22, 21, 8, 9]  # 4. ayda %60 dusus!
    prev_index = 2000
    for i, consumption in enumerate(citizen2_consumptions):
        new_index = prev_index + consumption
        photo_hash = hashlib.sha256(f"photo_citizen2_{i}".encode()).hexdigest()
        
        # 4. ve 5. ay icin anomali ve onay gerektiren durumlar
        is_anomaly = i >= 3  # 4. ve 5. ay
        user_confirmed = i == 3  # Kullanici 4. ayda onayladi
        admin_status = "pending" if i == 4 else "approved"
        
        readings.append(WaterMeterReading(
            meter_no=meter_no_2,
            wallet_address=WALLETS["citizen_2"],
            reading_index=new_index,
            previous_index=prev_index,
            consumption_m3=float(consumption),
            bill_amount=float(consumption * 5.5),
            reward_amount=10 if not is_anomaly else 0,
            photo_hash=photo_hash,
            is_valid=True,
            anomaly_detected=is_anomaly,
            user_confirmed_low_consumption=user_confirmed,
            admin_approval_status=admin_status,
            validated_by=WALLETS["operator"] if not is_anomaly else None,
            created_at=now - timedelta(days=30 * (5 - i))
        ))
        prev_index = new_index
    
    # ==============================
    # Citizen Fraud - Fraud senaryosu (5 ay)
    # Senaryo: Surekli dusuk beyan, fiziksel kontrolde fraud tespiti
    # ==============================
    meter_no_fraud = "WSM-2024-003"
    fraud_consumptions = [25, 24, 5, 3, 2]  # 3. aydan itibaren kusku verici dusus
    prev_index = 3000
    for i, consumption in enumerate(fraud_consumptions):
        new_index = prev_index + consumption
        photo_hash = hashlib.sha256(f"photo_fraud_{i}".encode()).hexdigest()
        
        is_anomaly = i >= 2  # 3. aydan itibaren anomali
        is_fraud = i >= 3  # 4. aydan itibaren fraud
        admin_status = "fraud" if is_fraud else ("pending" if is_anomaly else "approved")
        
        readings.append(WaterMeterReading(
            meter_no=meter_no_fraud,
            wallet_address=WALLETS["citizen_fraud"],
            reading_index=new_index,
            previous_index=prev_index,
            consumption_m3=float(consumption),
            bill_amount=float(consumption * 5.5),
            reward_amount=0,
            photo_hash=photo_hash,
            is_valid=not is_fraud,
            anomaly_detected=is_anomaly,
            user_confirmed_low_consumption=is_anomaly,
            admin_approval_status=admin_status,
            admin_approved_by=WALLETS["admin"] if is_fraud else None,
            validated_by=WALLETS["operator"] if i < 2 else None,
            created_at=now - timedelta(days=30 * (5 - i))
        ))
        prev_index = new_index
    
    for reading in readings:
        db.add(reading)
    
    db.commit()
    print(f"[OK] {len(readings)} su sayaci okumasi olusturuldu")


def seed_recycling_submissions(db):
    """Geri donusum kayitlarini olustur - 3 farkli zamanda"""
    print("\n[RECYCLE] Geri donusum kayitlari olusturuluyor (3 farkli zaman)...")
    
    now = datetime.now()
    submissions = []
    
    # ==============================
    # Citizen 1 - Normal beyanlari (3 farkli zaman)
    # Senaryo: Tutarli, onaylanmis beyanlar
    # ==============================
    citizen1_submissions = [
        {"material": "glass", "amount": 5.0, "days_ago": 60, "status": "approved"},
        {"material": "plastic", "amount": 3.0, "days_ago": 30, "status": "approved"},
        {"material": "metal", "amount": 2.0, "days_ago": 7, "status": "approved"},
    ]
    
    for i, sub in enumerate(citizen1_submissions):
        token_id = str(uuid.uuid4())
        qr_hash = hashlib.sha256(token_id.encode()).hexdigest()
        tx_hash = "0x" + hashlib.sha256(f"tx_c1_{i}_{token_id}".encode()).hexdigest()
        
        submissions.append(RecyclingSubmission(
            wallet_address=WALLETS["citizen_1"],
            material_type=sub["material"],
            amount_kg=sub["amount"],
            qr_token_id=token_id,
            qr_hash=qr_hash,
            reward_amount=int(sub["amount"] * 10),
            transaction_hash=tx_hash,
            is_processed=True,
            admin_approval_status=sub["status"],
            admin_approved_by=WALLETS["staff"],
            is_fraud=False,
            validated_by=WALLETS["operator"],
            created_at=now - timedelta(days=sub["days_ago"]),
            processed_at=now - timedelta(days=sub["days_ago"] - 1)
        ))
    
    # ==============================
    # Citizen 2 - Karisik beyanlar (1 onaylandi, 1 bekliyor, 1 suresi doldu)
    # ==============================
    citizen2_submissions = [
        {"material": "paper", "amount": 10.0, "days_ago": 45, "status": "approved"},
        {"material": "glass", "amount": 4.0, "hours_ago": 2, "status": "pending"},  # Bekleyen
        {"material": "electronic", "amount": 1, "hours_ago": 5, "status": "pending"},  # QR suresi yaklasik dolacak
    ]
    
    for i, sub in enumerate(citizen2_submissions):
        token_id = str(uuid.uuid4())
        qr_hash = hashlib.sha256(token_id.encode()).hexdigest()
        tx_hash = "0x" + hashlib.sha256(f"tx_c2_{i}_{token_id}".encode()).hexdigest() if sub["status"] == "approved" else None
        
        days_ago = sub.get("days_ago", 0)
        hours_ago = sub.get("hours_ago", 0)
        created = now - timedelta(days=days_ago, hours=hours_ago)
        
        submissions.append(RecyclingSubmission(
            wallet_address=WALLETS["citizen_2"],
            material_type=sub["material"],
            amount_kg=float(sub["amount"]),
            qr_token_id=token_id,
            qr_hash=qr_hash,
            reward_amount=int(sub["amount"] * 10) if sub["material"] != "electronic" else int(sub["amount"] * 25),
            transaction_hash=tx_hash,
            is_processed=(sub["status"] == "approved"),
            admin_approval_status=sub["status"],
            admin_approved_by=WALLETS["staff"] if sub["status"] == "approved" else None,
            is_fraud=False,
            validated_by=WALLETS["operator"] if sub["status"] == "approved" else None,
            created_at=created,
            processed_at=created + timedelta(hours=1) if sub["status"] == "approved" else None
        ))
    
    # ==============================
    # Citizen Fraud - Supheli beyanlar (fraud senaryosu)
    # Senaryo: Asiri yuksek miktar, fraud isaretlendi
    # ==============================
    fraud_submissions = [
        {"material": "glass", "amount": 50.0, "days_ago": 20, "status": "fraud", "reason": "Asiri yuksek miktar beyan"},
        {"material": "metal", "amount": 100.0, "days_ago": 10, "status": "fraud", "reason": "Tekrarlanan supheli beyan"},
        {"material": "plastic", "amount": 5.0, "hours_ago": 1, "status": "pending"},  # Yeni beyan, henuz kontrol edilmedi
    ]
    
    for i, sub in enumerate(fraud_submissions):
        token_id = str(uuid.uuid4())
        qr_hash = hashlib.sha256(token_id.encode()).hexdigest()
        
        days_ago = sub.get("days_ago", 0)
        hours_ago = sub.get("hours_ago", 0)
        created = now - timedelta(days=days_ago, hours=hours_ago)
        
        submissions.append(RecyclingSubmission(
            wallet_address=WALLETS["citizen_fraud"],
            material_type=sub["material"],
            amount_kg=float(sub["amount"]),
            qr_token_id=token_id,
            qr_hash=qr_hash,
            reward_amount=0,  # Fraud oldugu icin odul yok
            transaction_hash=None,
            is_processed=(sub["status"] == "fraud"),
            admin_approval_status=sub["status"],
            admin_approved_by=WALLETS["admin"] if sub["status"] == "fraud" else None,
            is_fraud=(sub["status"] == "fraud"),
            fraud_reason=sub.get("reason"),
            validated_by=None,
            created_at=created,
            processed_at=created + timedelta(hours=2) if sub["status"] == "fraud" else None
        ))
    
    for submission in submissions:
        db.add(submission)
    
    db.commit()
    print(f"[OK] {len(submissions)} geri donusum kaydi olusturuldu")


def seed_recycling_declarations(db):
    """Coklu atik turu beyanlari olustur - yeni model"""
    print("\n[DECLARATION] Coklu atik turu beyanlari olusturuluyor...")
    
    now = datetime.now()
    declarations = []
    
    # ==============================
    # Citizen 1 - Tam beyan (tum turler)
    # ==============================
    token_id_1 = str(uuid.uuid4())
    declarations.append(RecyclingDeclaration(
        wallet_address=WALLETS["citizen_1"],
        plastic_kg=2.5,
        glass_kg=3.0,
        metal_kg=1.5,
        paper_kg=4.0,
        electronic_count=0,
        qr_token_id=token_id_1,
        qr_hash=hashlib.sha256(token_id_1.encode()).hexdigest(),
        qr_expires_at=now - timedelta(days=5),  # Kullanilmis
        is_qr_expired=True,
        is_qr_used=True,
        total_reward_amount=110,
        admin_approval_status="approved",
        admin_approved_by=WALLETS["staff"],
        is_fraud=False,
        transaction_hash="0x" + hashlib.sha256(f"decl_{token_id_1}".encode()).hexdigest(),
        created_at=now - timedelta(days=5),
        processed_at=now - timedelta(days=5, hours=-1)
    ))
    
    # ==============================
    # Citizen 2 - Aktif QR (3 saat icinde kullanilmali)
    # ==============================
    token_id_2 = str(uuid.uuid4())
    declarations.append(RecyclingDeclaration(
        wallet_address=WALLETS["citizen_2"],
        plastic_kg=0,
        glass_kg=5.0,
        metal_kg=2.0,
        paper_kg=0,
        electronic_count=1,
        qr_token_id=token_id_2,
        qr_hash=hashlib.sha256(token_id_2.encode()).hexdigest(),
        qr_expires_at=now + timedelta(hours=2),  # 2 saat kaldi
        is_qr_expired=False,
        is_qr_used=False,
        total_reward_amount=95,
        admin_approval_status="pending",
        is_fraud=False,
        created_at=now - timedelta(hours=1)
    ))
    
    # ==============================
    # Citizen Fraud - Fraud beyan
    # ==============================
    token_id_3 = str(uuid.uuid4())
    declarations.append(RecyclingDeclaration(
        wallet_address=WALLETS["citizen_fraud"],
        plastic_kg=50.0,  # Asiri yuksek
        glass_kg=100.0,   # Asiri yuksek
        metal_kg=30.0,
        paper_kg=0,
        electronic_count=10,  # Supheli
        qr_token_id=token_id_3,
        qr_hash=hashlib.sha256(token_id_3.encode()).hexdigest(),
        qr_expires_at=now - timedelta(days=3),
        is_qr_expired=True,
        is_qr_used=False,
        total_reward_amount=0,
        admin_approval_status="fraud",
        admin_approved_by=WALLETS["admin"],
        is_fraud=True,
        fraud_reason="Gercekci olmayan yuksek miktarlar beyan edildi",
        created_at=now - timedelta(days=3),
        processed_at=now - timedelta(days=3, hours=-2)
    ))
    
    for declaration in declarations:
        db.add(declaration)
    
    db.commit()
    print(f"[OK] {len(declarations)} coklu atik beyani olusturuldu")


def seed_deposits(db):
    """Kullanici depozitolari olustur"""
    print("\n[DEPOSIT] Depozitolar olusturuluyor...")
    
    deposits = [
        UserDeposit(
            wallet_address=WALLETS["citizen_1"],
            deposit_amount=100.0,
            deposit_token="0x" + "0" * 40,
            transaction_hash=f"0x{'b' * 64}"
        ),
        UserDeposit(
            wallet_address=WALLETS["citizen_2"],
            deposit_amount=150.0,
            deposit_token="0x" + "0" * 40,
            transaction_hash=f"0x{'c' * 64}"
        ),
        UserDeposit(
            wallet_address=WALLETS["citizen_fraud"],
            deposit_amount=200.0,  # Slashing icin depozit mevcut
            deposit_token="0x" + "0" * 40,
            transaction_hash=f"0x{'d' * 64}"
        ),
    ]
    
    for deposit in deposits:
        db.add(deposit)
    
    db.commit()
    print(f"[OK] {len(deposits)} depozito olusturuldu")


def seed_fraud_records(db):
    """Fraud kayitlari olustur"""
    print("\n[FRAUD] Fraud kayitlari olusturuluyor...")
    
    now = datetime.now()
    
    fraud_records = [
        # AI tarafindan tespit edilen fraud
        FraudRecord(
            wallet_address=WALLETS["citizen_fraud"],
            fraud_type="ai_detected",
            detection_method="consumption_drop",
            penalty_amount=100.0,
            original_reading=3055,
            actual_reading=None,  # Henuz fiziksel kontrol yapilmadi
            underpayment_amount=110.0,
            interest_charged=5.5,
            detected_by=WALLETS["operator"],
            notes="Tuketimde %80 ani dusus tespit edildi. Fiziksel kontrol gerekli.",
            created_at=now - timedelta(days=2)
        ),
    ]
    
    for record in fraud_records:
        db.add(record)
    
    db.commit()
    print(f"[OK] {len(fraud_records)} fraud kaydi olusturuldu")


def seed_fraud_reports(db):
    """AI fraud raporlari olustur"""
    print("\n[REPORT] Fraud raporlari olusturuluyor...")
    
    now = datetime.now()
    
    reports = [
        # Yuksek riskli rapor - onay bekliyor
        FraudReport(
            wallet_address=WALLETS["citizen_fraud"],
            ai_score=85,
            risk_level="critical",
            anomalies='["consumption_drop_80%", "no_photo_metadata"]',
            is_confirmed=False,
            current_reading=3055,
            current_consumption=5.0,
            average_consumption=25.0,
            drop_percent=80.0,
            action_taken="confirmation_needed",
            has_gps=False,
            was_edited=True,
            created_at=now - timedelta(days=1)
        ),
        # Dusuk riskli - otomatik gecti
        FraudReport(
            wallet_address=WALLETS["citizen_1"],
            ai_score=15,
            risk_level="low",
            anomalies='[]',
            is_confirmed=True,
            confirmed_at=now - timedelta(days=5),
            current_reading=1085,
            current_consumption=17.0,
            average_consumption=16.0,
            drop_percent=0.0,
            action_taken=None,
            has_gps=True,
            was_edited=False,
            created_at=now - timedelta(days=5)
        ),
    ]
    
    for report in reports:
        db.add(report)
    
    db.commit()
    print(f"[OK] {len(reports)} fraud raporu olusturuldu")


def seed_inspections(db):
    """Fiziksel kontrol planlamalari olustur"""
    print("\n[INSPECT] Kontrol planlamalari olusturuluyor...")
    
    now = datetime.now()
    
    inspections = [
        # Bekleyen kontrol
        InspectionSchedule(
            wallet_address=WALLETS["citizen_fraud"],
            meter_no="WSM-2024-003",
            scheduled_date=now + timedelta(days=3),
            inspector_wallet=WALLETS["inspector"],
            status="pending",
            notes="AI fraud tespiti sonrasi planlanan kontrol"
        ),
        # Tamamlanmis kontrol - fraud bulundu
        InspectionSchedule(
            wallet_address=WALLETS["citizen_2"],
            meter_no="WSM-2024-002",
            scheduled_date=now - timedelta(days=30),
            inspector_wallet=WALLETS["inspector"],
            status="completed",
            actual_reading=2061,
            notes="6 aylik rutin kontrol - sorun yok",
            completed_at=now - timedelta(days=30)
        ),
    ]
    
    for inspection in inspections:
        db.add(inspection)
    
    db.commit()
    print(f"[OK] {len(inspections)} kontrol planlamasi olusturuldu")


def seed_penalties(db):
    """Ceza kayitlari olustur"""
    print("\n[PENALTY] Ceza kayitlari olusturuluyor...")
    
    now = datetime.now()
    
    penalties = [
        PenaltyRecord(
            wallet_address=WALLETS["citizen_fraud"],
            penalty_type="fraud_detection",
            penalty_amount=50.0,
            description="AI tarafindan tespit edilen tuketim anomalisi - depozito kesintisi",
            is_paid=False,
            created_by=WALLETS["admin"],
            created_at=now - timedelta(days=1)
        ),
    ]
    
    for penalty in penalties:
        db.add(penalty)
    
    db.commit()
    print(f"[OK] {len(penalties)} ceza kaydi olusturuldu")


def seed_material_multipliers(db):
    """Materyal carpanlarini olustur"""
    print("\n[MATERIAL] Materyal carpanlari olusturuluyor...")
    
    for material, data in DEFAULT_MATERIAL_MULTIPLIERS.items():
        multiplier = MaterialMultiplier(
            material_type=material,
            multiplier=data["multiplier"],
            base_token_rate=data["base_rate"],
            description=data["description"],
            is_active=True
        )
        db.add(multiplier)
    
    db.commit()
    print(f"[OK] {len(DEFAULT_MATERIAL_MULTIPLIERS)} materyal carpani olusturuldu")


def seed_all():
    """Tum seed fonksiyonlarini calistir"""
    print("\n" + "=" * 50)
    print("[SEED] EcoCivic Seed Data - Baslatiliyor")
    print("=" * 50)
    
    # Once tablolari olustur
    print("\n[DB] Veritabani tablolari kontrol ediliyor...")
    init_db()
    print("[OK] Tablolar hazir")
    
    with get_db() as db:
        # Once mevcut verileri temizle
        clear_all_data(db)
        
        # Sirayla seed fonksiyonlarini calistir
        seed_users(db)
        seed_water_meter_readings(db)
        seed_recycling_submissions(db)
        seed_recycling_declarations(db)
        seed_deposits(db)
        seed_fraud_records(db)
        seed_fraud_reports(db)
        seed_inspections(db)
        seed_penalties(db)
        seed_material_multipliers(db)
    
    print("\n" + "=" * 50)
    print("[SUCCESS] Tum seed verileri basariyla olusturuldu!")
    print("=" * 50)
    
    print("\n[INFO] Test Kullanicilari:")
    print("-" * 50)
    for role, wallet in WALLETS.items():
        print(f"  {role.ljust(15)}: {wallet}")
    
    print("\n[RUN] Backend'i baslatmak icin: python app.py")
    print("[API] API test: curl http://localhost:8000/api/health")


if __name__ == "__main__":
    seed_all()
