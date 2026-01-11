# 🛠️ Yerel Geliştirme Ortamı Kurulum Rehberi

Bu dokümantasyon, EcoCivic DApp'i yerel bilgisayarınızda çalıştırmak için gerekli tüm araçları ve kurulum adımlarını içerir.

---

## 📦 Gerekli Yazılımlar

### 1. **Node.js ve npm** ⭐ ZORUNLU
- **Ne için:** Frontend (React) ve Smart Contracts (Hardhat) için gerekli
- **İndirme:** https://nodejs.org/ (LTS versiyonu önerilir - v18+)
- **Kurulum Kontrolü:**
  ```bash
  node --version  # v18.0.0 veya üzeri olmalı
  npm --version   # v9.0.0 veya üzeri olmalı
  ```

### 2. **Python** ⭐ ZORUNLU
- **Ne için:** Backend (Flask) için gerekli
- **İndirme:** https://www.python.org/downloads/ (Python 3.8+)
- **Kurulum Kontrolü:**
  ```bash
  python --version  # Python 3.8.0 veya üzeri olmalı
  ```
- **Önemli:** Kurulum sırasında "Add Python to PATH" seçeneğini işaretleyin!

### 3. **MySQL Server** ⭐ ZORUNLU
- **Ne için:** Veritabanı (Backend data storage)
- **İndirme Seçenekleri:**
  
  **Seçenek A: MySQL Community Server (Önerilen)**
  - İndirme: https://dev.mysql.com/downloads/mysql/
  - Windows Installer (.msi) indirin
  - Kurulum sırasında root şifresini not edin!
  
  **Seçenek B: XAMPP (Kolay Kurulum)**
  - İndirme: https://www.apachefriends.org/
  - MySQL + phpMyAdmin birlikte gelir
  - Kurulum sonrası XAMPP Control Panel'den MySQL'i başlatın
  
  **Seçenek C: WAMP (Windows)**
  - İndirme: https://www.wampserver.com/
  - MySQL + Apache + PHP birlikte gelir

- **Kurulum Kontrolü:**
  ```bash
  mysql --version
  ```
  veya MySQL Workbench'te bağlantı test edin

### 4. **MySQL Workbench** ✅ VAR (Sahip Olduğunuz)
- **Ne için:** Veritabanı yönetimi ve görsel arayüz
- **Durum:** Zaten kurulu ✅
- **Kullanım:** Veritabanı oluşturma, tablo görüntüleme, SQL sorguları için

### 5. **Git** ⭐ ZORUNLU
- **Ne için:** Kod versiyon kontrolü (genelde zaten kurulu)
- **İndirme:** https://git-scm.com/downloads
- **Kurulum Kontrolü:**
  ```bash
  git --version
  ```

### 6. **MetaMask Browser Extension** ⭐ ZORUNLU
- **Ne için:** Blockchain wallet bağlantısı (Frontend test için)
- **İndirme:** 
  - Chrome: https://chrome.google.com/webstore/detail/metamask
  - Firefox: https://addons.mozilla.org/firefox/addon/ether-metamask
  - Edge: https://microsoftedge.microsoft.com/addons/detail/metamask
- **Kurulum:** Browser extension olarak kurun
- **İlk Kurulum:** Wallet oluşturun veya import edin
- **Testnet Faucet:** Mumbai testnet için MATIC almak:
  - https://faucet.polygon.technology/
  - https://mumbaifaucet.com/

### 7. **Tesseract OCR** ⭐ ZORUNLU (Backend için)
- **Ne için:** Su sayacı fotoğraflarından OCR (Optical Character Recognition)
- **Windows Kurulum:**

  **Seçenek A: Chocolatey ile (Önerilen)**
  ```powershell
  # Önce Chocolatey'yi kurun: https://chocolatey.org/install
  choco install tesseract
  ```
  
  **Seçenek B: Manuel Kurulum**
  1. İndir: https://github.com/UB-Mannheim/tesseract/wiki
  2. "tesseract-ocr-w64-setup-5.x.x.exe" dosyasını indirin
  3. Kurulum yapın (varsayılan ayarlarla)
  4. Kurulum yolunu not edin (genelde: `C:\Program Files\Tesseract-OCR`)

- **Kurulum Kontrolü:**
  ```bash
  tesseract --version
  ```
  
- **PATH Kontrolü:** Eğer komut çalışmıyorsa, Tesseract yolunu PATH'e ekleyin:
  ```powershell
  # PowerShell'de (Admin olarak)
  [Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\Program Files\Tesseract-OCR", "Machine")
  ```

### 8. **Code Editor (Opsiyonel ama Önerilen)** 💡
- **VS Code:** https://code.visualstudio.com/
- **Önerilen Extensions:**
  - Python
  - ESLint
  - Prettier
  - Solidity
  - GitLens

---

## 🔧 Kurulum Sonrası Yapılandırma

### MySQL Veritabanı Oluşturma

#### Yöntem 1: MySQL Workbench ile (Önerilen - Sizde Zaten Var)

1. MySQL Workbench'i açın
2. Local MySQL server'a bağlanın (root kullanıcısı ile)
3. Yeni bir query oluşturun ve şunu çalıştırın:

```sql
-- Veritabanı oluştur
CREATE DATABASE IF NOT EXISTS ecocivic CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Kullanıcı oluştur (opsiyonel - root kullanabilirsiniz)
CREATE USER IF NOT EXISTS 'ecocivic'@'localhost' IDENTIFIED BY 'your_password_here';

-- Yetkileri ver
GRANT ALL PRIVILEGES ON ecocivic.* TO 'ecocivic'@'localhost';

-- Yetkileri uygula
FLUSH PRIVILEGES;
```

#### Yöntem 2: Komut Satırı ile

```bash
# MySQL'e bağlan
mysql -u root -p

# Yukarıdaki SQL komutlarını çalıştırın
```

### Python Virtual Environment Kurulumu

```powershell
# Backend klasörüne gidin
cd backend-ai

# Virtual environment oluşturun
python -m venv venv

# Aktif edin (Windows PowerShell)
.\venv\Scripts\activate

# Aktif edin (Windows CMD)
venv\Scripts\activate.bat

# Bağımlılıkları yükleyin
pip install -r requirements.txt
```

---

## 📋 Hızlı Kontrol Listesi

Kurulum öncesi kontrol edin:

- [ ] Node.js kurulu (v18+)
- [ ] Python kurulu (3.8+)
- [ ] MySQL Server kurulu ve çalışıyor
- [ ] MySQL Workbench kurulu ✅ (Zaten var)
- [ ] Git kurulu
- [ ] MetaMask browser extension kurulu
- [ ] Tesseract OCR kurulu
- [ ] VS Code kurulu (opsiyonel)

Kurulum sonrası kontrol edin:

- [ ] MySQL'de `ecocivic` veritabanı oluşturuldu
- [ ] Backend virtual environment oluşturuldu
- [ ] Backend bağımlılıkları yüklendi (`pip install -r requirements.txt`)
- [ ] Frontend bağımlılıkları yüklendi (`npm install`)
- [ ] Smart contracts bağımlılıkları yüklendi (`npm install`)
- [ ] Environment variables ayarlandı (.env dosyaları)

---

## 🚀 İlk Çalıştırma

### 1. Backend'i Başlatın

```powershell
cd backend-ai
.\venv\Scripts\activate  # Virtual environment'ı aktif edin
python app.py
```

Backend `http://localhost:8000` adresinde çalışmalı.

### 2. Frontend'i Başlatın

Yeni bir terminal açın:

```powershell
cd frontend
npm run dev
```

Frontend `http://localhost:3000` adresinde çalışmalı.

### 3. Tarayıcıda Test Edin

1. `http://localhost:3000` adresini açın
2. MetaMask'ı bağlayın
3. Polygon Mumbai network'üne geçin
4. Test edin!

---

## ⚠️ Yaygın Sorunlar ve Çözümleri

### MySQL Bağlantı Hatası

**Hata:**
```
Can't connect to MySQL server on 'localhost'
```

**Çözüm:**
- MySQL servisinin çalıştığından emin olun
- XAMPP/WAMP kullanıyorsanız Control Panel'den MySQL'i başlatın
- MySQL Workbench'te bağlantıyı test edin

### Tesseract Bulunamadı

**Hata:**
```
pytesseract.pytesseract.TesseractNotFoundError
```

**Çözüm:**
- Tesseract'ın kurulu olduğundan emin olun
- PATH'e eklendiğinden emin olun
- Veya backend-ai klasöründe `tesseract_config.py` oluşturun:

```python
import pytesseract
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
```

### Python PATH Hatası

**Hata:**
```
'python' is not recognized as an internal or external command
```

**Çözüm:**
- Python kurulumunda "Add Python to PATH" seçeneğini işaretlediğinizden emin olun
- Veya PATH'e manuel ekleyin:
  - Control Panel > System > Advanced > Environment Variables
  - Path'e Python yolunu ekleyin (örn: `C:\Python3x\`)

### Port Zaten Kullanılıyor

**Hata:**
```
Address already in use
```

**Çözüm:**
- Port'u değiştirin (.env dosyasında)
- Veya kullanan process'i durdurun:
  ```powershell
  # Port 8000'i kullanan process'i bul
  netstat -ano | findstr :8000
  # Process ID'yi kullanarak durdur
  taskkill /PID <process_id> /F
  ```

---

## 📚 Ek Kaynaklar

- **MySQL Dokümantasyon:** https://dev.mysql.com/doc/
- **Python Dokümantasyon:** https://docs.python.org/
- **Node.js Dokümantasyon:** https://nodejs.org/docs/
- **React Dokümantasyon:** https://react.dev/
- **Tesseract OCR:** https://github.com/tesseract-ocr/tesseract

---

**Son Güncelleme:** 2026-01-11
