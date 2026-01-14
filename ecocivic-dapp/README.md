# 🏛️ EcoCivic DApp

> **Belediye Dijital Dönüşüm Platformu** - Blockchain tabanlı su faturası yönetimi, geri dönüşüm ödül sistemi ve akıllı şehir çözümleri.

[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636?logo=solidity)](https://soliditylang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://reactjs.org/)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python)](https://python.org/)
[![Polygon](https://img.shields.io/badge/Polygon-Mumbai-8247E5?logo=polygon)](https://polygon.technology/)

---

## 📋 İçindekiler

- [🎯 Proje Özeti](#-proje-özeti)
- [✨ Özellikler](#-özellikler)
- [🏗️ Mimari](#️-mimari)
- [🚀 Kurulum](#-kurulum)
- [📦 Smart Contracts](#-smart-contracts)
- [🤖 Backend AI](#-backend-ai)
- [💻 Frontend](#-frontend)
- [🔐 Güvenlik](#-güvenlik)
- [📊 Tokenomics](#-tokenomics)

---

## 🎯 Proje Özeti

EcoCivic DApp, belediyelerin vatandaşlarla etkileşimini dijitalleştiren, şeffaf ve güvenilir bir blockchain platformudur. Sistem, su tüketimi takibi, geri dönüşüm ödülleri ve fraud tespiti gibi temel belediye hizmetlerini akıllı kontratlar üzerinde yönetir.

### Temel Hedefler

| Hedef | Açıklama |
|-------|----------|
| **Şeffaflık** | Tüm işlemler blockchain üzerinde kayıtlı |
| **Fraud Önleme** | AI destekli anomali tespiti ve ceza sistemi |
| **Teşvik Sistemi** | BELT token ile vatandaş ödüllendirme |
| **Sürdürülebilirlik** | Geri dönüşüm ve düşük tüketim teşvikleri |

---

## ✨ Özellikler

### 💧 Su Faturası Sistemi

```
📸 Kamera ile Sayaç Fotoğrafı
      ↓
🤖 AI-OCR Okuma & Doğrulama
      ↓
📊 %50+ Düşüş Kontrolü → ⚠️ Onay Gerekir
      ↓
✅ Blockchain Kayıt → 🪙 BELT Ödül
```

- **Kamera-Only Capture**: Galeri yüklemesi devre dışı, gerçek zamanlı fotoğraf zorunlu
- **EXIF Metadata Doğrulama**: Timestamp, GPS, düzenleme yazılımı kontrolü
- **Tüketim Drop Uyarısı**: %50+ düşüşte kullanıcı onayı gerekir
- **AI Fraud Tespiti**: OCR anomali, sayaç değişikliği, trend analizi

### ♻️ Geri Dönüşüm Ödül Sistemi

| Atık Türü | Token/Birim | Alt Kategoriler |
|-----------|-------------|-----------------|
| 🥤 Plastik | 10 BELT/kg | PET, HDPE, PVC, PP |
| 🫙 Cam | 12 BELT/kg | Yeşil, Beyaz, Kahve |
| 🥫 Metal | 15 BELT/kg | Alüminyum, Çelik, Teneke |
| 📦 Kağıt | 8 BELT/kg | Karton, Gazete, Ofis |
| 📱 Elektronik | 25 BELT/adet | PCB, Pil, Telefon |

- **QR Kod Tarama**: Geri dönüşüm noktalarında hızlı bildirim
- **Personel Onayı Zorunlu**: Fraud önleme için staff approval
- **Blacklist Sistemi**: 3 fraud = kalıcı engelleme

### 🔍 Fraud Tespit & Ceza Sistemi

```
┌─────────────────────────────────────────────────────┐
│                    FRAUD TESPİT                     │
├─────────────────────────────────────────────────────┤
│  AI Tespit              │  Fiziksel Kontrol         │
│  ─────────              │  ─────────────────        │
│  • OCR Anomali          │  • 6 Aylık Periyodik      │
│  • %50+ Düşüş           │  • Inspector Whitelist    │
│  • Trend Analizi        │  • Gerçek Okuma Karşıl.   │
│                         │                           │
│  📉 %50 Ceza            │  💀 %100 Ceza + Faiz     │
└─────────────────────────────────────────────────────┘
```

**Ceza Oranları:**
- AI Tespit: Depozito'nun %50'si kesilir
- Fiziksel Kontrol Fraud: %100 depozito + %5/ay faiz
- Kullanıcı askıya alınır (Suspended)

### 📊 Risk Skor Kartı

Kullanıcı güvenilirlik puanı 4 kategoride hesaplanır:

| Kategori | Ağırlık | Değerlendirme |
|----------|---------|---------------|
| Tüketim Davranışı | 35% | Tutarlılık, uyarı sayısı |
| Fraud Geçmişi | 30% | AI/fiziksel fraud, cezalar |
| Doğrulama Kalitesi | 20% | Fotoğraf yaşı, GPS, düzenleme |
| Hesap Durumu | 15% | Hesap yaşı, aktivite |

### 🪙 Token Staking

Bonus faiz kazanmak için BELT token stake edin:

| Tier | Min BELT | Bonus APY | Lock Süresi |
|------|----------|-----------|-------------|
| 🥉 Bronze | 100 | +2% | 30 gün |
| 🥈 Silver | 500 | +5% | 90 gün |
| 🥇 Gold | 2,000 | +10% | 180 gün |
| 💎 Platinum | 10,000 | +15% | 365 gün |

---

## 🏗️ Mimari

```
┌──────────────────────────────────────────────────────────────┐
│                        FRONTEND                               │
│  React + Vite + wagmi + ethers.js                            │
│  ├── WaterMeterUpload (Camera Capture)                       │
│  ├── QRScanner (Recycling)                                   │
│  └── RiskScoreDashboard                                      │
└────────────────────────┬─────────────────────────────────────┘
                         │ REST API
┌────────────────────────▼─────────────────────────────────────┐
│                      BACKEND-AI                               │
│  Flask + SQLAlchemy + Web3.py                                │
│  ├── fraud_detection/                                        │
│  │   ├── usage_anomaly.py (Z-score, Trend)                  │
│  │   ├── image_metadata_check.py (EXIF)                     │
│  │   └── ml_fraud_detector.py (Holt's Linear)               │
│  ├── inspections/                                            │
│  │   └── periodic_physical_inspection.py                    │
│  ├── services/                                               │
│  │   ├── risk_score_service.py                              │
│  │   ├── pdf_report_service.py                              │
│  │   └── blockchain_service.py                              │
│  └── ai/ocr.py (OpenAI Vision)                              │
└────────────────────────┬─────────────────────────────────────┘
                         │ Web3 RPC
┌────────────────────────▼─────────────────────────────────────┐
│                   SMART CONTRACTS                             │
│  Solidity 0.8.20 + Hardhat + OpenZeppelin                    │
│  ├── BELTToken.sol (ERC20 + Mintable)                       │
│  ├── WaterBilling.sol (Readings + Penalties)                 │
│  ├── WaterBillingFraudManager.sol (Fraud + Inspections)     │
│  ├── RecyclingRewards.sol (5 Waste Types)                   │
│  ├── TokenStaking.sol (4 Tiers + Bonus)                     │
│  └── EcoCivicDeposit.sol (Aave Yield)                       │
└──────────────────────────────────────────────────────────────┘
```

---

## 🚀 Kurulum

### Gereksinimler

- Node.js 18+
- Python 3.11+
- PostgreSQL 14+
- MetaMask veya WalletConnect destekli cüzdan

### 1. Repository Klonla

```bash
git clone https://github.com/ibrahim4334/municipalityproject.git
cd municipalityproject/ecocivic-dapp
```

### 2. Smart Contracts

```bash
cd smart-contracts
npm install
cp .env.example .env
# .env dosyasını düzenle

# Local test
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost

# Polygon Mumbai
npx hardhat run scripts/deploy.js --network polygon_mumbai
```

### 3. Backend AI

```bash
cd backend-ai
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
pip install reportlab  # PDF export için

cp .env.example .env
# .env dosyasını düzenle

python app.py
```

### 4. Frontend

```bash
cd frontend
npm install
npm install html5-qrcode  # QR Scanner için

cp .env.example .env
# .env dosyasını düzenle

npm run dev
```

---

## 📦 Smart Contracts

### Kontrat Adresleri (Deploy sonrası güncellenecek)

| Kontrat | Adres |
|---------|-------|
| BELTToken | `0x...` |
| WaterBilling | `0x...` |
| WaterBillingFraudManager | `0x...` |
| RecyclingRewards | `0x...` |
| TokenStaking | `0x...` |
| EcoCivicDeposit | `0x...` |

### Roller

```solidity
DEFAULT_ADMIN_ROLE      // Governance, parametre güncelleme
SERVICE_OPERATOR_ROLE   // AI Backend, OCR işlemleri
MUNICIPALITY_STAFF_ROLE // 6 aylık kontrol, fraud doğrulama
FRAUD_MANAGER_ROLE      // Ceza uygulama
INSPECTOR_ROLE          // Fiziksel kontrol
ORACLE_ROLE             // Dış veri (GPS, fiyatlar)
```

---

## 🤖 Backend AI

### API Endpoints

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/api/water/validate` | POST | Sayaç fotoğrafı doğrula |
| `/api/recycling/submit` | POST | Geri dönüşüm bildirimi |
| `/api/recycling/generate-qr` | POST | QR kod oluştur |
| `/api/fraud/status/<wallet>` | GET | Fraud durumu sorgula |
| `/api/risk-score/<wallet>` | GET | Risk skor kartı |
| `/api/inspection/schedule` | POST | Kontrol planla |
| `/api/inspection/complete` | POST | Kontrol tamamla |
| `/api/inspection/pending` | GET | Bekleyen kontroller |
| `/api/reports/inspection/<id>` | GET | PDF rapor |

### Fraud Detection Modülleri

```
fraud_detection/
├── usage_anomaly.py      # Z-score, trend analizi
├── image_metadata_check.py # EXIF doğrulama
└── ml_fraud_detector.py  # Holt's Linear, tahmin
```

---

## 💻 Frontend

### Bileşenler

| Bileşen | Açıklama |
|---------|----------|
| `WaterMeterUpload.jsx` | Kamera capture, drop uyarısı |
| `QRScanner.jsx` | Geri dönüşüm QR tarama |
| `RiskScoreDashboard.jsx` | Risk skor göstergesi |
| `WalletConnect.jsx` | Cüzdan bağlantısı |

### Sayfalar

- `/` - Ana sayfa, dashboard
- `/water` - Su sayacı okuma
- `/recycling` - Geri dönüşüm
- `/staking` - Token staking

---

## 🔐 Güvenlik

### Smart Contract

- ✅ OpenZeppelin AccessControl
- ✅ ReentrancyGuard
- ✅ Pausable pattern
- ✅ Input validation

### Backend

- ✅ JWT Authentication
- ✅ Role-based middleware
- ✅ CORS configuration
- ✅ Input sanitization

### Fraud Prevention

- ✅ Real-time camera only
- ✅ EXIF metadata validation
- ✅ 5 dakika timestamp kontrolü
- ✅ GPS verification
- ✅ Editing software detection

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
│  Staking        │──────│  5-20% APY      │
└─────────────────┘      └─────────────────┘
         │
         ▼
┌─────────────────┐      ┌─────────────────┐
│  Fraud Ceza     │──────│  50-100% Burn   │
└─────────────────┘      └─────────────────┘
```

---

## 🧪 Test

```bash
# Smart Contract Tests
cd smart-contracts
npx hardhat test

# Specific tests
npx hardhat test test/testFraudPenalties.js
npx hardhat test test/testPhysicalInspection.js
npx hardhat test test/testRealTimePhoto.js
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
