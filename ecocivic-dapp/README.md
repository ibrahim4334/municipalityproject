# 🏛️ EcoCivic DApp

> **Belediye Dijital Dönüşüm Platformu** - Blockchain tabanlı su faturası yönetimi, geri dönüşüm ödül sistemi ve akıllı şehir çözümleri.

[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636?logo=solidity)](https://soliditylang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://reactjs.org/)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python)](https://python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0-000000?logo=flask)](https://flask.palletsprojects.com/)
[![Material-UI](https://img.shields.io/badge/MUI-5.0-007FFF?logo=mui)](https://mui.com/)

---

## 📋 İçindekiler

- [🎯 Proje Özeti](#-proje-özeti)
- [✨ Özellikler](#-özellikler)
- [🏗️ Mimari](#️-mimari)
- [🚀 Kurulum ve Çalıştırma](#-kurulum-ve-çalıştırma)
- [👥 Kullanıcı Rolleri](#-kullanıcı-rolleri)
- [📦 Smart Contracts](#-smart-contracts)
- [🤖 Backend AI](#-backend-ai)
- [💻 Frontend](#-frontend)
- [🧪 Test Verileri](#-test-verileri)
- [🔐 Güvenlik](#-güvenlik)

---

## 🎯 Proje Özeti

EcoCivic DApp, belediyelerin vatandaşlarla etkileşimini dijitalleştiren, şeffaf ve güvenilir bir blockchain platformudur. Sistem, su tüketimi takibi, geri dönüşüm ödülleri ve fraud tespiti gibi temel belediye hizmetlerini akıllı kontratlar üzerinde yönetir.

### Temel Hedefler

| Hedef | Açıklama |
|-------|----------|
| **Şeffaflık** | Tüm işlemler blockchain üzerinde kayıtlı |
| **Fraud Önleme** | AI destekli anomali tespiti + 2 hak sistemi |
| **Teşvik Sistemi** | BELT token ile vatandaş ödüllendirme |
| **Sürdürülebilirlik** | Geri dönüşüm ve düşük tüketim teşvikleri |

---

## ✨ Özellikler

### 💧 Su Faturası Sistemi

```
📸 Su Sayacı Fotoğrafı Yükle
      ↓
🤖 AI-OCR Okuma & Doğrulama
      ↓
📊 %50+ Düşüş Kontrolü → ⚠️ Kullanıcı Onayı Gerekir
      ↓
🔍 Admin/Personel Fiziksel Kontrol
      ↓
✅ Blockchain Kayıt → 🪙 BELT Ödül
```

**Öne Çıkan Özellikler:**
- **Fotoğraf Hash Saklama**: Fotoğrafın kendisi değil, SHA256 hash'i blockchain'de saklanır
- **5 Aylık Veri Geçmişi**: Her vatandaş için son 5 ay su tüketim verisi tutulur
- **AI Anomali Tespiti**: %50+ düşüşlerde otomatik uyarı sistemi
- **Admin Onay/Fraud**: Personel fiziksel kontrol sonrası onay veya fraud işaretleme

### ♻️ Geri Dönüşüm Ödül Sistemi

| Atık Türü | Token/Birim | Renk Kodu |
|-----------|-------------|-----------|
| 🧴 Plastik | 10 BELT/kg | 🔵 Mavi |
| 🥛 Cam | 12 BELT/kg | 🟢 Yeşil |
| 🔩 Metal | 15 BELT/kg | 🟠 Turuncu |
| 📄 Kağıt/Karton | 8 BELT/kg | 🟣 Mor |
| 📱 Elektronik | 25 BELT/adet | 🔴 Kırmızı |

**QR Kod Sistemi:**
- **Çoklu Atık Türü Desteği**: Tek formda tüm türleri beyan edin
- **3 Saatlik QR Geçerliliği**: Countdown timer ile süre takibi
- **Süresi Dolan QR Otomatik İptal**: Yeni QR oluşturma butonu
- **Personel Onayı Zorunlu**: QR okutulduktan sonra staff approval

### 🚨 Fraud Tespit & 2 Hak Sistemi

```
┌─────────────────────────────────────────────────────┐
│                  FRAUD HAK SİSTEMİ                  │
├─────────────────────────────────────────────────────┤
│  ♻️ Geri Dönüşüm: 2 Hak    │  💧 Su Sayacı: 2 Hak  │
│  ─────────────────────     │  ──────────────────   │
│  • Her fraud = 1 hak düşer │  • AI uyarısı         │
│  • 0 hak = Kara liste      │  • Fiziksel kontrol   │
│  • Admin onay/red          │  • Admin onay/fraud   │
└─────────────────────────────────────────────────────┘
```

### 🎭 3 Kullanıcı Ekranı Geçişi (Demo Modu)

Dashboard'da toggle buton ile roller arası geçiş:

| Rol | Ekran | Yetkiler |
|-----|-------|----------|
| 👤 **Vatandaş** | Ana Panel | Su sayacı yükle, Geri dönüşüm beyanı ver |
| 🛡️ **Admin** | Yönetim Paneli | Onay/Red, Fraud işaretleme, Parametreler |
| 👷 **Personel** | Kontrol Paneli | Fiziksel kontrol, QR onayı, Fraud tespiti |

---

## 🏗️ Mimari

```
┌──────────────────────────────────────────────────────────────┐
│                        FRONTEND                               │
│  React 18 + Vite + Material-UI + ethers.js                   │
│  ├── Dashboard.jsx (Rol Switcher entegre)                    │
│  ├── RecyclingDeclarationForm.jsx (5 atık türü)              │
│  ├── RecyclingQRWithTimer.jsx (3 saat countdown)             │
│  ├── UserRoleSwitcher.jsx (Demo toggle)                      │
│  └── StaffDashboard.jsx (Onay/Fraud butonları)               │
│                                                               │
│  📍 http://localhost:3000                                    │
└────────────────────────┬─────────────────────────────────────┘
                         │ REST API
┌────────────────────────▼─────────────────────────────────────┐
│                      BACKEND-AI                               │
│  Flask 3.0 + SQLAlchemy + Web3.py                            │
│  ├── services/                                                │
│  │   ├── recycling_declaration_service.py                    │
│  │   ├── fraud_detection.py                                  │
│  │   ├── inspection_service.py                               │
│  │   └── blockchain_service.py                               │
│  ├── database/                                                │
│  │   ├── models.py (User, WaterMeterReading, RecyclingDecl.) │
│  │   └── seed_data.py (Test verileri)                        │
│  └── ai/ocr.py (OpenAI Vision)                               │
│                                                               │
│  📍 http://localhost:8000                                    │
└────────────────────────┬─────────────────────────────────────┘
                         │ Web3 RPC
┌────────────────────────▼─────────────────────────────────────┐
│                   SMART CONTRACTS                             │
│  Solidity 0.8.20 + Hardhat + OpenZeppelin                    │
│  ├── BELTToken.sol (ERC20 + Mintable)                        │
│  ├── WaterBillingFraudManager.sol (Photo Hash + Fraud)       │
│  ├── RecyclingRewards.sol (5 Waste Types + 2 Hak Sistemi)    │
│  ├── TokenStaking.sol (4 Tier Bonus)                         │
│  └── EcoCivicDeposit.sol (Depozito Yönetimi)                 │
│                                                               │
│  📍 Hardhat Local: http://localhost:8545                     │
└──────────────────────────────────────────────────────────────┘
```

---

## 🚀 Kurulum ve Çalıştırma

### Gereksinimler

- Node.js 18+
- Python 3.11+
- MySQL 8.0+ (veya PostgreSQL 14+)
- MetaMask tarayıcı uzantısı

### Adım 1: Repository Klonla

```bash
git clone https://github.com/ibrahim4334/municipalityproject.git
cd municipalityproject/ecocivic-dapp
```

### Adım 2: Smart Contracts (Opsiyonel - Local Blockchain)

```bash
cd smart-contracts
npm install

# Local Hardhat node başlat (ayrı terminal)
npx hardhat node

# Deploy et
npx hardhat run scripts/deploy.js --network localhost
```

### Adım 3: Backend API

```bash
cd backend-ai
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

pip install -r requirements.txt

# .env dosyasını düzenle
cp .env.example .env

# Veritabanı tablolarını oluştur ve test verilerini yükle
python -c "from database.db import engine, Base; from database.models import *; Base.metadata.drop_all(engine); Base.metadata.create_all(engine)"
python -c "from database.seed_data import seed_all; seed_all()"

# Backend'i başlat
python app.py
```

✅ Backend başarılı: `http://localhost:8000`

### Adım 4: Frontend

```bash
cd frontend
npm install

# .env dosyasını düzenle
cp .env.example .env

# Frontend'i başlat
npm run dev
```

✅ Frontend başarılı: `http://localhost:3000`

### Adım 5: MetaMask Bağlantısı

1. Chrome'da MetaMask uzantısını aç
2. Hardhat Local ağını ekle:
   - Ağ Adı: `Hardhat Local`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Symbol: `ETH`
3. `http://localhost:3000` adresine git
4. "Connect Wallet" butonuna tıkla

---

## 👥 Kullanıcı Rolleri

### Test Cüzdan Adresleri (Seed Data)

| Rol | İsim | Cüzdan Adresi |
|-----|------|---------------|
| 👤 Vatandaş 1 | Ahmet Yılmaz | `0xCitizen00100000000000000000000000000001` |
| 👤 Vatandaş 2 | Ayşe Demir | `0xCitizen00200000000000000000000000000002` |
| 🚨 Fraud Vatandaş | Mehmet Şüpheli | `0xCitizenFraud0000000000000000000000003` |
| 👷 Personel | Fatma Kontrol | `0xStaff00100000000000000000000000000000001` |
| 🤖 AI Operatör | AI Operator | `0xOperator001000000000000000000000000001` |
| 🛡️ Admin | Yönetici Admin | `0xAdmin00100000000000000000000000000000001` |

---

## 📦 Smart Contracts

### Kontrat Yapısı

| Kontrat | Açıklama |
|---------|----------|
| `BELTToken.sol` | ERC20 token, mint/burn |
| `WaterBillingFraudManager.sol` | Fraud tespiti, photo hash saklama |
| `RecyclingRewards.sol` | 5 atık türü, 2 hak sistemi |
| `TokenStaking.sol` | 4 tier staking bonus |
| `EcoCivicDeposit.sol` | Depozito ve ceza yönetimi |

### Roller (AccessControl)

```solidity
DEFAULT_ADMIN_ROLE      // Governance, parametre güncelleme
SERVICE_OPERATOR_ROLE   // AI Backend, OCR işlemleri
MUNICIPALITY_STAFF_ROLE // Fiziksel kontrol, fraud doğrulama
FRAUD_MANAGER_ROLE      // Ceza uygulama
INSPECTOR_ROLE          // Fiziksel kontrol
```

---

## 🤖 Backend AI

### API Endpoints

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/api/water/validate` | POST | Sayaç fotoğrafı doğrula |
| `/api/recycling/declare` | POST | Çoklu atık beyanı oluştur |
| `/api/recycling/declarations/pending` | GET | Bekleyen beyanları listele |
| `/api/recycling/declarations/{id}/approve` | POST | Beyanı onayla |
| `/api/recycling/declarations/{id}/fraud` | POST | Fraud işaretle |
| `/api/fraud/status/{wallet}` | GET | Fraud durumu sorgula |
| `/api/user/fraud-warnings/{wallet}` | GET | Kalan hak sayısı |
| `/api/inspection/pending` | GET | Bekleyen kontroller |
| `/api/health` | GET | API sağlık kontrolü |

---

## 💻 Frontend

### Sayfa Yapısı

| Sayfa | Route | Açıklama |
|-------|-------|----------|
| Ana Sayfa | `/` | Proje tanıtımı |
| Dashboard | `/dashboard` | Rol switcher, bakiye, işlemler |
| Geri Dönüşüm | `/recycling` | Beyan formu, QR oluşturma |
| Su Sayacı | `/water` | Fotoğraf yükleme |
| Admin | `/admin` | Personel paneli |

### Bileşenler

| Bileşen | Açıklama |
|---------|----------|
| `UserRoleSwitcher.jsx` | Demo rol toggle (Vatandaş/Admin/Personel) |
| `RecyclingDeclarationForm.jsx` | 5 atık türü formu |
| `RecyclingQRWithTimer.jsx` | 3 saat countdown QR |
| `StaffDashboard.jsx` | Onay/Fraud panel |
| `WaterMeterUpload.jsx` | Fotoğraf yükleme |
| `FraudWarningModal.jsx` | Fraud uyarı modalı |

---

## 🧪 Test Verileri

Seed data ile oluşturulan örnek veriler:

### Su Sayacı Okumaları (5 Aylık)

| Vatandaş | Tüketim Trendi | Durum |
|----------|----------------|-------|
| Citizen1 | 15→17→16→18→19 m³ | ✅ Normal |
| Citizen2 | 20→22→21→8→9 m³ | ⚠️ %60 düşüş |
| Fraud | 25→24→5→3→2 m³ | 🚨 Fraud tespiti |

### Geri Dönüşüm Beyanları (3 Farklı Zaman)

| Vatandaş | Beyan Sayısı | Durum |
|----------|--------------|-------|
| Citizen1 | 3 onaylı | ✅ Normal |
| Citizen2 | 1 onaylı, 2 bekliyor | ⏳ Beklemede |
| Fraud | 2 fraud, 1 bekliyor | 🚨 Fraud |

---

## 🔐 Güvenlik

### Smart Contract
- ✅ OpenZeppelin AccessControl
- ✅ ReentrancyGuard
- ✅ Pausable pattern
- ✅ Input validation

### Backend
- ✅ Role-based middleware
- ✅ CORS configuration
- ✅ Rate limiting
- ✅ Input sanitization

### Fraud Prevention
- ✅ Fotoğraf hash blockchain'de saklanır
- ✅ 2 hak sistemi (0 hak = kara liste)
- ✅ 3 saatlik QR geçerlilik süresi
- ✅ Admin onay zorunluluğu

---

## 📊 Tokenomics

### BELT Token

```
Toplam Arz: Sınırsız (Mint on demand)
Decimal: 18
Kullanım: Ödül, staking, governance
```

### Token Akışı

```
┌─────────────────┐      ┌─────────────────┐
│  Su Okuması     │──────│  1 m³ = 1 BELT  │
└─────────────────┘      └─────────────────┘
         │
         ▼
┌─────────────────┐      ┌─────────────────┐
│  Geri Dönüşüm   │──────│  8-25 BELT/kg   │
└─────────────────┘      └─────────────────┘
         │
         ▼
┌─────────────────┐      ┌─────────────────┐
│  Fraud Ceza     │──────│  Hak düşürme    │
└─────────────────┘      └─────────────────┘
```

---

## 🧪 Test Komutları

```bash
# Smart Contract Tests
cd smart-contracts
npx hardhat test

# Specific tests
npx hardhat test test/testFraudPenalties.js
npx hardhat test test/testRecyclingRewards.js

# Backend health check
curl http://localhost:8000/api/health
```

---

## 📄 Lisans

MIT License - Detaylar için [LICENSE](LICENSE) dosyasına bakın.

---

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit yapın (`git commit -m 'Add amazing feature'`)
4. Push edin (`git push origin feature/amazing-feature`)
5. Pull Request açın

---

## 📞 İletişim

- **Proje**: EcoCivic DApp
- **Repository**: [github.com/ibrahim4334/municipalityproject](https://github.com/ibrahim4334/municipalityproject)

---

<p align="center">
  <b>🌿 Akıllı Şehirler için Sürdürülebilir Çözümler 🌿</b>
</p>
