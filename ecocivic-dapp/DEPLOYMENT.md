# 🚀 EcoCivic DApp - Deployment Kılavuzu

Bu dokümantasyon, EcoCivic DApp uygulamasını yerel ortamda ve production'da deploy etmek için adım adım talimatlar içerir.

---

## 📋 İçindekiler

1. [Ön Gereksinimler](#ön-gereksinimler)
2. [Yerel Geliştirme Ortamı Kurulumu](#yerel-geliştirme-ortamı-kurulumu)
3. [Backend Kurulumu ve Çalıştırma](#backend-kurulumu-ve-çalıştırma)
4. [Frontend Kurulumu ve Çalıştırma](#frontend-kurulumu-ve-çalıştırma)
5. [Smart Contracts Deployment](#smart-contracts-deployment)
6. [Production Deployment](#production-deployment)
7. [Sorun Giderme](#sorun-giderme)

---

## 🔧 Ön Gereksinimler

### Gerekli Yazılımlar

- **Node.js** 18+ ve npm/yarn
- **Python** 3.8+
- **MySQL** 8.0+ (veya MySQL Workbench ile yönetim)
- **Git**
- **MetaMask** browser extension (test için)
- **Tesseract OCR** (backend için - sistem seviyesinde kurulum gerekebilir)

**Detaylı kurulum için:** `LOCAL_SETUP.md` dosyasına bakın.

### Windows için Tesseract Kurulumu

```powershell
# Chocolatey ile
choco install tesseract

# veya manuel olarak:
# https://github.com/UB-Mannheim/tesseract/wiki adresinden indirin
```

---

## 💻 Yerel Geliştirme Ortamı Kurulumu

### Adım 1: Repository'yi Klonlayın

```bash
git clone <repository-url>
cd clean-repo/ecocivic-dapp
```

### Adım 2: MySQL Veritabanı Kurulumu

1. MySQL Server'ı kurun ve başlatın (XAMPP/WAMP kullanıyorsanız Control Panel'den başlatın)
2. MySQL Workbench ile veya komut satırı ile veritabanı oluşturun:

**MySQL Workbench ile (Önerilen):**
```sql
CREATE DATABASE IF NOT EXISTS ecocivic CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'ecocivic'@'localhost' IDENTIFIED BY 'your_password_here';
GRANT ALL PRIVILEGES ON ecocivic.* TO 'ecocivic'@'localhost';
FLUSH PRIVILEGES;
```

**Veya root kullanıcısı ile:**
```sql
CREATE DATABASE IF NOT EXISTS ecocivic CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

**Not:** Detaylı kurulum için `LOCAL_SETUP.md` dosyasına bakın.

---

## 🔙 Backend Kurulumu ve Çalıştırma

### Adım 1: Backend Klasörüne Geçin

```bash
cd backend-ai
```

### Adım 2: Virtual Environment Oluşturun

```powershell
# Windows PowerShell
python -m venv venv
.\venv\Scripts\activate

# Windows CMD
python -m venv venv
venv\Scripts\activate.bat

# Linux/Mac
python -m venv venv
source venv/bin/activate
```

### Adım 3: Bağımlılıkları Yükleyin

```bash
pip install -r requirements.txt
```

**Not:** Tesseract OCR sistem seviyesinde kurulu olmalıdır. Kurulu değilse OCR işlevleri çalışmaz.

### Adım 4: Environment Variables Ayarlayın

`.env.example` dosyasını kopyalayın:

```bash
# Windows
copy .env.example .env

# Linux/Mac
cp .env.example .env
```

`.env` dosyasını düzenleyin ve gerekli değerleri girin:

```env
# APP CONFIG
DEBUG=true
API_HOST=0.0.0.0
API_PORT=8000

# DATABASE CONFIG
DATABASE_URL=mysql+pymysql://root:password@localhost:3306/ecocivic?charset=utf8mb4

# AI / ML CONFIG
AI_MODEL_PROVIDER=openai
AI_MODEL_NAME=gpt-4o-mini
AI_API_KEY=your_openai_api_key_here

# BLOCKCHAIN CONFIG
BLOCKCHAIN_RPC_URL=https://rpc-mumbai.maticvigil.com
BELT_TOKEN_ADDRESS=0x...
RECYCLING_REWARDS_ADDRESS=0x...
BACKEND_WALLET_PRIVATE_KEY=your_private_key_here

# QR TOKEN CONFIG
QR_TOKEN_EXPIRY_HOURS=3
QR_SECRET_KEY=your_secret_key_here

# SECURITY
JWT_SECRET_KEY=your_jwt_secret_key_min_32_chars_here
JWT_EXPIRE_MINUTES=60

# CORS Configuration
API_CORS_ORIGINS=*
```

### Adım 5: Veritabanı Tablolarını Oluşturun

```bash
python -c "from database.db import init_db; init_db()"
```

### Adım 6: Backend'i Başlatın

#### Development Modu

```bash
python app.py
```

veya

```bash
flask run --host=0.0.0.0 --port=8000
```

Backend `http://localhost:8000` adresinde çalışacaktır.

#### Production Modu (Gunicorn ile)

```bash
gunicorn -w 4 -b 0.0.0.0:8000 wsgi:app
```

### Adım 7: Backend'i Test Edin

Tarayıcıda veya terminalde:

```bash
curl http://localhost:8000/api/health
```

Response: `{"status": "ok"}`

---

## 🎨 Frontend Kurulumu ve Çalıştırma

### Adım 1: Frontend Klasörüne Geçin

```bash
cd ../frontend
```

### Adım 2: Bağımlılıkları Yükleyin

```bash
npm install
```

### Adım 3: Environment Variables Ayarlayın

`.env.example` dosyasını kopyalayın:

```bash
# Windows
copy .env.example .env

# Linux/Mac
cp .env.example .env
```

`.env` dosyasını düzenleyin:

```env
# API CONFIGURATION
VITE_API_URL=http://localhost:8000
VITE_API_BASE_URL=http://localhost:8000

# BLOCKCHAIN CONFIGURATION
VITE_CHAIN_ID=80001
VITE_NETWORK_NAME=Polygon Mumbai

# SMART CONTRACT ADDRESSES
VITE_CONTRACT_ADDRESS_BELT=0x...
VITE_RECYCLING_REWARDS_ADDRESS=0x...
VITE_WATER_BILLING_ADDRESS=0x...
VITE_ECOCIVIC_DEPOSIT_ADDRESS=0x...
```

**Önemli:** Smart contract adreslerini deploy sonrası buraya ekleyin.

### Adım 4: Development Server'ı Başlatın

```bash
npm run dev
```

Frontend `http://localhost:3000` adresinde çalışacaktır.

### Adım 5: Production Build Oluşturun

```bash
npm run build
```

Build çıktısı `dist/` klasöründe oluşacaktır.

---

## ⛓️ Smart Contracts Deployment

### Adım 1: Smart Contracts Klasörüne Geçin

```bash
cd ../smart-contracts
```

### Adım 2: Bağımlılıkları Yükleyin

```bash
npm install
```

### Adım 3: Environment Variables Ayarlayın

Root dizinde `.env` dosyası oluşturun:

```env
# Network RPC URLs
MUMBAI_RPC=https://rpc-mumbai.maticvigil.com
POLYGON_RPC=https://polygon-rpc.com

# Private Key (deploy için kullanılacak wallet)
PRIVATE_KEY=your_private_key_here

# Etherscan API Key (verification için)
POLYGONSCAN_API_KEY=your_polygonscan_api_key

# Contract Addresses (deposit için)
USDC_ADDRESS=0x...  # Mumbai testnet USDC (opsiyonel)
LENDING_POOL_ADDRESS=0x...  # Aave LendingPool (opsiyonel)
```

### Adım 4: Hardhat Config'i Kontrol Edin

`hardhat.config.js` dosyasını kontrol edin, network ayarlarının doğru olduğundan emin olun.

### Adım 5: Testleri Çalıştırın (Önerilir)

```bash
npm test
```

### Adım 6: Local Network'te Deploy Edin (Test için)

```bash
# Terminal 1: Hardhat node başlat
npx hardhat node

# Terminal 2: Deploy et
npm run deploy:local
```

### Adım 7: Mumbai Testnet'e Deploy Edin

```bash
npm run deploy:mumbai
```

Deploy sonrası çıkan contract adreslerini kaydedin ve:
- Backend `.env` dosyasına ekleyin
- Frontend `.env` dosyasına ekleyin

### Adım 8: Contract'ları Verify Edin (Opsiyonel)

```bash
npx hardhat verify --network mumbai <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

---

## 🌐 Production Deployment

### Backend Production Deployment

#### Seçenek 1: Docker ile

```bash
cd backend-ai
docker build -t ecocivic-backend .
docker run -d -p 8000:8000 --env-file .env ecocivic-backend
```

#### Seçenek 2: Gunicorn ile (VPS/Server)

```bash
# Systemd service oluşturun
sudo nano /etc/systemd/system/ecocivic-backend.service
```

Service dosyası:

```ini
[Unit]
Description=EcoCivic Backend
After=network.target

[Service]
User=your_user
WorkingDirectory=/path/to/ecocivic-dapp/backend-ai
Environment="PATH=/path/to/venv/bin"
ExecStart=/path/to/venv/bin/gunicorn -w 4 -b 0.0.0.0:8000 wsgi:app
Restart=always

[Install]
WantedBy=multi-user.target
```

Service'i başlatın:

```bash
sudo systemctl daemon-reload
sudo systemctl enable ecocivic-backend
sudo systemctl start ecocivic-backend
```

#### Seçenek 3: Cloud Platform'lar

- **Heroku**: `Procfile` oluşturun: `web: gunicorn -w 4 -b 0.0.0.0:$PORT wsgi:app`
- **Railway**: GitHub repo'yu bağlayın, environment variables'ı ayarlayın
- **DigitalOcean App Platform**: Buildpack: Python, Start Command: `gunicorn -w 4 -b 0.0.0.0:8080 wsgi:app`

### Frontend Production Deployment

#### Seçenek 1: Vercel

```bash
cd frontend
npm run build
# Vercel CLI ile
vercel --prod
```

#### Seçenek 2: Netlify

```bash
cd frontend
npm run build
# Netlify CLI ile
netlify deploy --prod --dir=dist
```

#### Seçenek 3: Nginx ile (VPS/Server)

```bash
# Build oluşturun
cd frontend
npm run build

# Nginx config
sudo nano /etc/nginx/sites-available/ecocivic
```

Nginx config:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    root /path/to/ecocivic-dapp/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/ecocivic /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Production Environment Variables

#### Backend (.env)

```env
DEBUG=false
API_CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
JWT_SECRET_KEY=<güçlü_32_karakter_secret>
DATABASE_URL=mysql+pymysql://user:password@db_host:3306/ecocivic?charset=utf8mb4
# ... diğer production değerleri
```

#### Frontend (.env)

```env
VITE_API_URL=https://api.yourdomain.com
VITE_CHAIN_ID=137  # Polygon Mainnet
VITE_NETWORK_NAME=Polygon Mainnet
# ... production contract adresleri
```

---

## 🔍 Sorun Giderme

### Backend Sorunları

#### Database Bağlantı Hatası

```
Error: could not connect to server
```

**Çözüm:**
- MySQL servisinin çalıştığından emin olun (XAMPP/WAMP Control Panel'den kontrol edin)
- `DATABASE_URL` environment variable'ının doğru olduğundan emin olun
- MySQL Workbench'te bağlantıyı test edin
- Firewall kurallarını kontrol edin

#### OCR Hatası

```
pytesseract.pytesseract.TesseractNotFoundError
```

**Çözüm:**
- Tesseract OCR'ın sistem seviyesinde kurulu olduğundan emin olun
- Windows'ta PATH'e ekleyin veya `pytesseract.pytesseract.tesseract_cmd` ayarlayın

#### Port Zaten Kullanılıyor

```
Address already in use
```

**Çözüm:**
- Port'u değiştirin: `API_PORT=8001`
- Veya kullanan process'i bulun ve durdurun

### Frontend Sorunları

#### Wallet Bağlantı Hatası

```
MetaMask not found
```

**Çözüm:**
- MetaMask extension'ının kurulu olduğundan emin olun
- Tarayıcıyı yenileyin

#### Network Switch Hatası

```
Wrong network detected
```

**Çözüm:**
- MetaMask'ta Polygon Mumbai network'ünü ekleyin
- Network switch butonuna tıklayın

#### Contract Adresi Hatası

```
Invalid contract address
```

**Çözüm:**
- `.env` dosyasındaki contract adreslerini kontrol edin
- Contract'ların deploy edildiğinden emin olun

### Smart Contract Sorunları

#### Deployment Hatası

```
Insufficient funds
```

**Çözüm:**
- Wallet'ta yeterli MATIC/ETH olduğundan emin olun
- Testnet için faucet kullanın

#### Gas Estimation Hatası

```
Gas estimation failed
```

**Çözüm:**
- Contract kodunu kontrol edin
- Network RPC URL'ini kontrol edin
- Gas limit'i manuel olarak artırın

---

## 📝 Deployment Checklist

### Pre-Deployment

- [ ] Tüm environment variables ayarlandı
- [ ] Database migration'ları çalıştırıldı
- [ ] Smart contract'lar deploy edildi ve verify edildi
- [ ] Contract adresleri `.env` dosyalarına eklendi
- [ ] Testler başarıyla geçti
- [ ] Code review yapıldı

### Backend Deployment

- [ ] Backend dependencies yüklendi
- [ ] Database bağlantısı test edildi
- [ ] Environment variables production için ayarlandı
- [ ] CORS ayarları production domain'leri için güncellendi
- [ ] Rate limiting aktif
- [ ] Logging yapılandırıldı
- [ ] Health check endpoint çalışıyor

### Frontend Deployment

- [ ] Frontend dependencies yüklendi
- [ ] Build başarıyla oluşturuldu
- [ ] Environment variables production için ayarlandı
- [ ] Contract adresleri doğru
- [ ] API URL doğru
- [ ] MetaMask network configuration doğru

### Post-Deployment

- [ ] Backend health check çalışıyor
- [ ] Frontend yükleniyor
- [ ] Wallet bağlantısı çalışıyor
- [ ] Network switching çalışıyor
- [ ] API endpoint'leri çalışıyor
- [ ] Smart contract interaction'ları çalışıyor
- [ ] Monitoring ve alerting kuruldu

---

## 📞 Destek

Sorun yaşarsanız:
1. Bu dokümantasyonu kontrol edin
2. GitHub Issues'da arama yapın
3. Yeni issue oluşturun

---

**Son Güncelleme:** 2026-01-11
