# 🌱 EcoCivic DApp

**Belediyeler için Blockchain Tabanlı Sürdürülebilir Şehir Yönetim Platformu**

EcoCivic, vatandaşların çevre dostu davranışlarını (geri dönüşüm, su tasarrufu) teşvik eden ve blockchain teknolojisi ile ödüllendiren merkezi olmayan bir uygulamadır. Yapay zeka destekli doğrulama sistemi ile güvenilir ve şeffaf bir ödül mekanizması sunar.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Solidity](https://img.shields.io/badge/Solidity-0.8.20-orange.svg)
![React](https://img.shields.io/badge/React-18.2.0-blue.svg)
![Python](https://img.shields.io/badge/Python-3.8+-green.svg)

---

## 📋 İçindekiler

- [Özellikler](#-özellikler)
- [Teknoloji Stack'i](#-teknoloji-stacki)
- [Proje Yapısı](#-proje-yapısı)
- [Kurulum](#-kurulum)
- [Kullanım](#-kullanım)
- [API Dokümantasyonu](#-api-dokümantasyonu)
- [Smart Contracts](#-smart-contracts)
- [Güvenlik](#-güvenlik)
- [Deployment](#-deployment)
- [Katkıda Bulunma](#-katkıda-bulunma)
- [Lisans](#-lisans)

---

## ✨ Özellikler

### 🔄 Geri Dönüşüm Sistemi
- **QR Kod Tabanlı Takip**: Her geri dönüşüm işlemi için benzersiz QR kod oluşturma
- **Malzeme Bazlı Ödüller**: Cam, kağıt ve metal için farklı ödül katsayıları
- **Otomatik Doğrulama**: Backend AI servisi ile geri dönüşüm doğrulama
- **Blockchain Ödüllendirme**: BELT token ile anında ödül dağıtımı

### 💧 Akıllı Su Yönetimi
- **OCR Destekli Sayaç Okuma**: Yapay zeka ile su sayacı fotoğrafından otomatik okuma
- **Anomali Tespiti**: Tüketim anormalliklerini otomatik tespit eden AI sistemi
- **Otomatik Fatura Ödeme**: Blockchain üzerinden güvenli fatura ödeme
- **Tasarruf Ödülleri**: Düzenli ödeme yapan kullanıcılara BELT token ödülü

### 💰 Depozito ve Ceza Sistemi
- **Güvenli Depozito**: Aave protokolü üzerinden faiz getiren depozito sistemi
- **Slashing Mekanizması**: Kural ihlallerinde depozito kesintisi
- **Şeffaf Ceza Yönetimi**: Tüm ceza işlemleri blockchain'de kayıtlı

### 🎯 BELT Token Ekonomisi
- **ERC-20 Token**: Standart token standardı ile uyumlu
- **Ödül Dağıtımı**: Otomatik ve şeffaf ödül sistemi
- **Token Yakma**: Slashing ve ceza durumlarında token yakma

---

## 🛠 Teknoloji Stack'i

### Frontend
- **React 18.2.0**: Modern UI framework
- **Material-UI (MUI)**: Component library
- **Ethers.js 6.8.1**: Ethereum blockchain etkileşimi
- **React Router**: Sayfa yönlendirme
- **Axios**: HTTP client
- **Vite**: Build tool ve dev server

### Backend
- **Flask**: Python web framework
- **SQLAlchemy**: ORM ve database yönetimi
- **PostgreSQL**: İlişkisel veritabanı
- **Tesseract OCR**: Görüntüden metin okuma
- **Pillow**: Görüntü işleme
- **Flask-CORS**: Cross-origin resource sharing

### Blockchain
- **Solidity 0.8.20**: Smart contract programlama dili
- **Hardhat**: Development environment
- **OpenZeppelin**: Güvenlik odaklı contract library
- **Polygon Mumbai**: Test network (production için Polygon Mainnet)

### AI/ML
- **OCR (Tesseract)**: Su sayacı okuma
- **Anomali Tespiti**: İstatistiksel analiz ile anomali tespiti
- **Gelecek**: GPT-4o-mini entegrasyonu için hazır altyapı

---

## 📁 Proje Yapısı

```
ecocivic-dapp/
├── frontend/                 # React frontend uygulaması
│   ├── src/
│   │   ├── components/       # React bileşenleri
│   │   ├── pages/           # Sayfa bileşenleri
│   │   ├── services/        # API ve Web3 servisleri
│   │   ├── context/         # React context'ler
│   │   └── abi/             # Smart contract ABI'ları
│   ├── package.json
│   └── vite.config.js
│
├── backend-ai/              # Flask backend servisi
│   ├── ai/                  # AI/ML modülleri
│   │   ├── ocr.py          # OCR işlemleri
│   │   └── anomaly_detection.py
│   ├── services/            # İş mantığı servisleri
│   │   ├── qr_service.py
│   │   ├── recycling_validation.py
│   │   └── water_validation.py
│   ├── database/            # Database modelleri
│   │   ├── db.py
│   │   └── models.py
│   ├── app.py              # Flask uygulaması
│   ├── config.py           # Konfigürasyon
│   └── requirements.txt
│
├── smart-contracts/         # Solidity smart contract'lar
│   ├── contracts/
│   │   ├── BELTToken.sol
│   │   ├── EcoCivicDeposit.sol
│   │   ├── RecyclingRewards.sol
│   │   ├── WaterBilling.sol
│   │   └── SlashingManager.sol
│   ├── scripts/
│   │   ├── deploy.js
│   │   └── seed.js
│   ├── test/               # Contract testleri
│   └── hardhat.config.js
│
├── docs/                    # Dokümantasyon
│   ├── architecture.md
│   ├── api-spec.md
│   └── tokenomics.md
│
├── SECURITY.md             # Güvenlik dokümantasyonu
└── README.md              # Bu dosya
```

---

## 🚀 Kurulum

### Gereksinimler

- **Node.js** 18+ ve npm
- **Python** 3.8+
- **PostgreSQL** 12+
- **MetaMask** browser extension
- **Git**

### 1. Repository'yi Klonlayın

```bash
git clone https://github.com/yourusername/ecocivic-dapp.git
cd ecocivic-dapp
```

### 2. Backend Kurulumu

```bash
cd backend-ai

# Virtual environment oluşturun (önerilir)
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Bağımlılıkları yükleyin
pip install -r requirements.txt

# Environment variables ayarlayın
cp .env.example .env
# .env dosyasını düzenleyin ve gerekli değerleri girin
```

**Önemli Environment Variables:**
```env
DATABASE_URL=postgresql://user:password@localhost:5432/ecocivic
AI_API_KEY=your_openai_api_key
BLOCKCHAIN_RPC_URL=https://rpc-mumbai.maticvigil.com
BELT_TOKEN_ADDRESS=0x...
BACKEND_WALLET_PRIVATE_KEY=your_private_key
JWT_SECRET_KEY=your_secret_key_min_32_chars
```

### 3. Database Kurulumu

```bash
# PostgreSQL'de veritabanı oluşturun
createdb ecocivic

# Python ile database tablolarını oluşturun
python -c "from database.db import init_db; init_db()"
```

### 4. Frontend Kurulumu

```bash
cd frontend

# Bağımlılıkları yükleyin
npm install

# Environment variables ayarlayın
cp .env.example .env
# .env dosyasını düzenleyin
```

**Frontend Environment Variables:**
```env
VITE_API_URL=http://localhost:8000
VITE_CHAIN_ID=80001
VITE_CONTRACT_ADDRESS_BELT=0x...
VITE_RECYCLING_REWARDS_ADDRESS=0x...
VITE_WATER_BILLING_ADDRESS=0x...
```

### 5. Smart Contracts Kurulumu

```bash
cd smart-contracts

# Bağımlılıkları yükleyin
npm install

# Hardhat config'i düzenleyin
# hardhat.config.js dosyasında network ayarlarını yapın

# Testleri çalıştırın
npm test

# Local network'te deploy edin (opsiyonel)
npm run deploy:local
```

---

## 💻 Kullanım

### Development Modunda Çalıştırma

#### Backend

```bash
cd backend-ai
python app.py
# veya
flask run --host=0.0.0.0 --port=8000
```

Backend `http://localhost:8000` adresinde çalışacaktır.

#### Frontend

```bash
cd frontend
npm run dev
```

Frontend `http://localhost:5173` adresinde çalışacaktır.

### Production Build

#### Frontend Build

```bash
cd frontend
npm run build
```

Build çıktısı `frontend/dist` klasöründe oluşacaktır.

#### Backend Deployment

```bash
# WSGI server ile (örnek: Gunicorn)
gunicorn -w 4 -b 0.0.0.0:8000 wsgi:app

# Docker ile
docker build -t ecocivic-backend .
docker run -p 8000:8000 ecocivic-backend
```

---

## 📡 API Dokümantasyonu

### Base URL
```
http://localhost:8000/api
```

### Endpoints

#### Health Check
```http
GET /api/health
```

**Response:**
```json
{
  "status": "ok"
}
```

#### Su Sayacı Doğrulama
```http
POST /api/water/validate
Content-Type: multipart/form-data

{
  "image": <file>
}
```

**Response:**
```json
{
  "valid": true,
  "meter_no": "12345",
  "current_index": 150,
  "historical_avg": 145.5,
  "reward_eligible": true
}
```

#### Geri Dönüşüm Doğrulama
```http
POST /api/recycling/validate
Content-Type: application/json

{
  "material_type": "glass",
  "qr_token": {...},
  "wallet_address": "0x..."
}
```

Detaylı API dokümantasyonu için `docs/api-spec.md` dosyasına bakın.

---

## 🔐 Smart Contracts

### BELTToken
ERC-20 token standardına uygun ödül token'ı.

**Özellikler:**
- Mint (sadece owner)
- Burn (kullanıcı ve owner)
- Pause mekanizması
- Max supply limiti

### RecyclingRewards
Geri dönüşüm ödül dağıtım kontratı.

**Fonksiyonlar:**
- `rewardRecycling()`: QR doğrulaması sonrası ödül verir
- `setRewardMultiplier()`: Ödül katsayılarını günceller
- `pause()` / `unpause()`: Acil durum kontrolü

### EcoCivicDeposit
Aave protokolü entegrasyonlu depozito sistemi.

**Fonksiyonlar:**
- `deposit()`: Kullanıcı depozito yatırır
- `withdraw()`: Owner fon çeker (slashing için)
- `getUserDeposit()`: Kullanıcı bakiyesini sorgular

### WaterBilling
Su faturası ödeme ve ödül sistemi.

**Fonksiyonlar:**
- `payBill()`: Fatura ödeme
- `getUserBills()`: Kullanıcı faturalarını listeler

### SlashingManager
Ceza ve slashing yönetimi.

**Fonksiyonlar:**
- `slashDeposit()`: Depozito kesintisi
- `recordPenalty()`: Ceza kaydı

Detaylı contract dokümantasyonu için `docs/` klasörüne bakın.

---

## 🔒 Güvenlik

### Backend Güvenlik Özellikleri
- ✅ Input validation ve sanitization
- ✅ SQL injection koruması (SQLAlchemy ORM)
- ✅ File upload güvenliği (tip ve boyut kontrolü)
- ✅ CORS yapılandırması
- ✅ Error handling ve logging
- ✅ Environment variable güvenliği

### Frontend Güvenlik Özellikleri
- ✅ Input validation
- ✅ XSS koruması (React built-in)
- ✅ Network kontrolü
- ✅ Contract adresi doğrulama
- ✅ Transaction gas estimation
- ✅ Error boundary'ler

### Smart Contract Güvenlik Özellikleri
- ✅ Reentrancy koruması (ReentrancyGuard)
- ✅ Access control (Ownable)
- ✅ Input validation
- ✅ Zero address kontrolü
- ✅ Overflow koruması (Solidity 0.8.20+)
- ✅ Pause mekanizması
- ✅ QR hash replay koruması

Detaylı güvenlik bilgileri için `SECURITY.md` dosyasına bakın.

---

## 🚢 Deployment

### Production Deployment Checklist

- [ ] Environment variables ayarlandı
- [ ] Database migration'ları çalıştırıldı
- [ ] Smart contract'lar deploy edildi ve doğrulandı
- [ ] Contract adresleri `.env` dosyalarına eklendi
- [ ] HTTPS sertifikaları yapılandırıldı
- [ ] CORS ayarları production için güncellendi
- [ ] Rate limiting aktif edildi
- [ ] Monitoring ve logging kuruldu
- [ ] Backup stratejisi hazırlandı
- [ ] Security audit tamamlandı

### Docker Deployment

```bash
# Backend
cd backend-ai
docker build -t ecocivic-backend .
docker run -d -p 8000:8000 --env-file .env ecocivic-backend

# Frontend (Nginx ile)
cd frontend
npm run build
docker build -t ecocivic-frontend .
docker run -d -p 80:80 ecocivic-frontend
```

### Cloud Deployment

**Backend için önerilenler:**
- AWS EC2 / ECS
- Google Cloud Run
- Heroku
- DigitalOcean App Platform

**Frontend için önerilenler:**
- Vercel
- Netlify
- AWS S3 + CloudFront
- GitHub Pages

**Database için önerilenler:**
- AWS RDS
- Google Cloud SQL
- Supabase
- Railway

---

## 🧪 Test

### Smart Contract Testleri

```bash
cd smart-contracts
npm test
```

### Backend Testleri

```bash
cd backend-ai
pytest tests/
```

### Frontend Testleri

```bash
cd frontend
npm test
```

---

## 📊 Mimari

EcoCivic DApp üç ana katmandan oluşur:

1. **Frontend Layer**: React tabanlı kullanıcı arayüzü
2. **Backend Layer**: Flask API servisi ve AI/ML işlemleri
3. **Blockchain Layer**: Smart contract'lar ve token ekonomisi

### 🏗️ Hibrit Mimari Yaklaşımı

EcoCivic, verimlilik ve güveni dengelemek için hibrit bir veritabanı yapısı kullanır:

| Katman | Teknoloji | Kullanım Alanı | Neden? |
|--------|-----------|----------------|--------|
| **Veri Yönetimi** | **MySQL (PostgreSQL)** | Kullanıcı Profilleri, Roller, Sayaç Geçmişi, QR Logları | Yüksek hacimli veri, hızlı sorgulama, kişisel veri gizliliği (KVKK/GDPR), maliyet etkinliği. |
| **Güven Katmanı** | **Blockchain (Polygon)** | Ödül Dağıtımı (BELT), Ceza Kayıtları, Şeffaflık | Değiştirilemez (immutable) kayıtlar, güven gerektirmeyen değer transferi, halka açık denetim. |

Bu yaklaşım sayesinde belediyeler ağır verileri (resimler, loglar) blockchain'e yükleyerek gas ücreti ödemez, ancak ödül ve ceza gibi kritik işlemlerin şeffaflığından ödün vermez.

Detaylı mimari dokümantasyon için `docs/architecture.md` dosyasına bakın.

---

## 🎯 Tokenomics

BELT token ekonomisi şu şekilde çalışır:

- **Ödül Dağıtımı**: Geri dönüşüm ve su tasarrufu için otomatik ödül
- **Token Yakma**: Slashing ve ceza durumlarında token yakma
- **Max Supply**: 1 milyar BELT token
- **Ödül Katsayıları**:
  - Cam: 1.0x
  - Kağıt: 1.5x
  - Metal: 2.0x

Detaylı tokenomics için `docs/tokenomics.md` dosyasına bakın.

---

## 🤝 Katkıda Bulunma

Katkılarınızı bekliyoruz! Lütfen şu adımları izleyin:

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/AmazingFeature`)
3. Değişikliklerinizi commit edin (`git commit -m 'Add some AmazingFeature'`)
4. Branch'inizi push edin (`git push origin feature/AmazingFeature`)
5. Pull Request açın

### Kod Standartları

- **Python**: PEP 8
- **JavaScript**: ESLint kuralları
- **Solidity**: Solidity Style Guide
- **Commit Messages**: Conventional Commits

---

## 📝 Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için `LICENSE` dosyasına bakın.

---

## 📞 İletişim

- **Email**: info@ecocivic.example.com
- **Website**: https://ecocivic.example.com
- **Twitter**: @EcoCivicDApp
- **Discord**: [Discord Server Link]

---

## 🙏 Teşekkürler

- [OpenZeppelin](https://openzeppelin.com/) - Güvenlik odaklı smart contract library
- [Hardhat](https://hardhat.org/) - Ethereum development environment
- [Material-UI](https://mui.com/) - React component library
- [Ethers.js](https://ethers.org/) - Ethereum JavaScript library

---

## 📈 Roadmap

### Q1 2024
- [x] Temel smart contract'lar
- [x] Frontend UI
- [x] Backend API
- [x] OCR entegrasyonu

### Q2 2024
- [ ] Mobile app (React Native)
- [ ] Advanced AI models
- [ ] Multi-chain support
- [ ] Governance token

### Q3 2024
- [ ] NFT rewards
- [ ] Staking mechanism
- [ ] DAO governance
- [ ] International expansion

---

## ⚠️ Önemli Notlar

1. **Test Network**: Şu anda Polygon Mumbai testnet üzerinde çalışmaktadır
2. **Private Keys**: Asla private key'leri kod içinde veya public repository'de saklamayın
3. **Security Audit**: Production'a geçmeden önce smart contract'ları audit ettirin
4. **Backup**: Düzenli database backup'ları alın
5. **Monitoring**: Production'da monitoring ve alerting sistemi kurun

---

**⭐ Bu projeyi beğendiyseniz yıldız vermeyi unutmayın!**

Made with ❤️ for sustainable cities
