# 🏛️ EcoCivic DApp

> **Belediye-Vatandaş Etkileşim Prototipi** — Blockchain tabanlı su faturası yönetimi, geri dönüşüm ödül sistemi ve şeffaf kayıt tutma platformu.

[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636?logo=solidity)](https://soliditylang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://reactjs.org/)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python)](https://python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0-000000?logo=flask)](https://flask.palletsprojects.com/)

**👤 Hazırlayan:** İbrahim Erol

---

## 📋 İçindekiler

- [🎯 Proje Amacı](#-proje-amacı)
- [⛓️ Blockchain'in Rolü](#️-blockchainin-rolü)
- [🏗️ Mimari Kararlar](#️-mimari-kararlar)
- [✨ Özellikler](#-özellikler)
- [🚨 Anomali Sinyal Sistemi](#-anomali-sinyal-sistemi)
- [🚀 Kurulum](#-kurulum)
- [👥 Kullanıcı Rolleri](#-kullanıcı-rolleri)
- [📦 Smart Contracts](#-smart-contracts)
- [🚫 v1'de Kapsam Dışı](#-v1de-kapsam-dışı)
- [🔮 v2 Yol Haritası](#-v2-yol-haritası)

---

## 🎯 Proje Amacı

EcoCivic DApp, **belediye-vatandaş etkileşimini dijitalleştiren** ve **kritik kararları blockchain'de şeffaf şekilde kaydeden** bir prototip uygulamadır.

### Temel Hedefler

| Hedef | Açıklama | Blockchain Rolü |
|-------|----------|-----------------|
| **Şeffaflık** | Karar ve işlem kayıtlarının değiştirilemez tutulması | ✅ On-chain |
| **Teşvik Sistemi** | Vatandaşların çevre dostu davranışlarını ödüllendirme | ✅ BELT Token |
| **Anomali Tespiti** | Tüketim verilerinde olağandışı durumların sinyallenmesi | ⚠️ Off-chain (Backend) |
| **Karar Mekanizması** | Personel tarafından inceleme ve nihai karar | ✅ Karar on-chain kaydedilir |

### Bu Proje Neyi Çözer?

1. **Güven Sorunu**: Belediye kararları blockchain'de kayıtlı → vatandaş denetleyebilir
2. **Şeffaflık**: Ödül ve ceza işlemleri halka açık, değiştirilemez
3. **Teşvik**: Geri dönüşüm ve düşük tüketim davranışları token ile ödüllendiriliyor
4. **Kayıt Bütünlüğü**: Fotoğraf hash'leri zincirde → delil manipülasyonu önleniyor

---

## ⛓️ Blockchain'in Rolü

### ✅ Blockchain Ne Yapıyor (Gerçekten)

| İşlem | Açıklama | Kontrat |
|-------|----------|---------|
| **Token Mint/Transfer** | Geri dönüşüm ve su tasarrufu ödülleri | `BELTToken.sol` |
| **Personel Kararı Kaydı** | Fraud/Onay kararları immutable olarak saklanır | `RecyclingRewards.sol`, `WaterBilling.sol` |
| **QR Hash Saklama** | Tekrar kullanımı önleyen hash kontrolü | `RecyclingRewards.sol` |
| **Fotoğraf Hash Saklama** | Delil bütünlüğü için SHA256 hash | `WaterBilling.sol` |
| **Depozito Yönetimi** | Kullanıcı depozitolarının takibi | `EcoCivicDeposit.sol` |

### ❌ Blockchain Ne YAPMIYOR

| İşlem | Neden Off-chain | Açıklama |
|-------|-----------------|----------|
| **Görüntü İşleme (OCR)** | Hesaplama maliyeti | Backend'de Tesseract OCR |
| **Anomali Analizi** | Karmaşık hesaplama | Backend'de istatistiksel analiz |
| **Otomatik Fraud Kararı** | İnsan denetimi gerekli | Sadece personel karar verir |
| **Fotoğraf Saklama** | Boyut/maliyet | Sadece hash zincirde |

### 🔗 Hibrit Mimari Yaklaşımı

```
┌─────────────────────────────────────────────────────────────────┐
│                     VERİ AKIŞI MİMARİSİ                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  OFF-CHAIN (Backend)              ON-CHAIN (Blockchain)         │
│  ─────────────────────           ──────────────────────         │
│  • Fotoğraf saklama              • Fotoğraf hash'i               │
│  • OCR işleme                    • Token transferleri            │
│  • Anomali skoru hesaplama       • Personel karar kaydı          │
│  • Kullanıcı profilleri          • QR hash kontrolü              │
│  • Bildirimler                   • Depozito bakiyeleri           │
│                                                                  │
│  📊 Ağır veri + hesaplama        🔒 Kritik kararlar + değer      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Bu Yaklaşımın Avantajları:**
- Gas maliyeti optimize edilir (sadece kritik veriler zincirde)
- Ölçeklenebilirlik (yüksek hacimli veri off-chain)
- Gizlilik (kişisel veriler KVKK uyumlu şekilde off-chain)
- Şeffaflık (kararlar ve transferler halka açık)

---

## 🏗️ Mimari Kararlar

### Neden "Anomali Sinyali" Terminolojisi?

> **v1'de "AI Fraud Detection" iddiası yapılmamaktadır.**

Bu projede kullanılan yöntem:
- **İstatistiksel analiz** (z-score, standart sapma)
- **Trend analizi** (exponential smoothing)
- **Kural tabanlı kontroller** (%50+ düşüş eşiği)

Bunlar klasik istatistik yöntemleridir, makine öğrenimi modeli değildir. Bu nedenle:

| ❌ Kullanılmayan Terim | ✅ Kullanılan Terim |
|------------------------|---------------------|
| AI Fraud Detection | Anomali Sinyal Sistemi |
| Machine Learning Model | İstatistiksel Analiz |
| Otomatik Fraud Kararı | Personel Onaylı Karar |

### Fraud İş Akışı (Net Tanım)

```
┌─────────────────────────────────────────────────────────────────┐
│                  FRAUD SİNYAL AKIŞI (v1)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. VATANDAŞ                                                     │
│     └─→ Sayaç fotoğrafı yükler / Geri dönüşüm beyanı verir      │
│                                                                  │
│  2. BACKEND (Anomali Sinyal Servisi)                            │
│     └─→ İstatistiksel analiz yapar                              │
│     └─→ Anomali skoru hesaplar (0-100)                          │
│     └─→ Skor ≥ 50 ise → "SİNYAL" üretir                         │
│     └─→ ⚠️ KARAR VERMEZ, sadece sinyal                          │
│                                                                  │
│  3. BELEDİYE PERSONELİ                                          │
│     └─→ Sinyalleri inceler                                      │
│     └─→ Fiziksel kontrol yapabilir                              │
│     └─→ "Onay" veya "Fraud" kararı verir                        │
│     └─→ ✅ TEK YETKİLİ KARAR MERCİİ                             │
│                                                                  │
│  4. BLOCKCHAIN                                                   │
│     └─→ Personel kararı zincire yazılır (immutable)             │
│     └─→ Fraud ise: uyarı hakkı düşer, depozito kesilebilir      │
│     └─→ Onay ise: BELT token ödülü mint edilir                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Depozito Sistemi Hakkında

> **v1'de Aave/DeFi entegrasyonu aktif DEĞİLDİR.**

- `EcoCivicDeposit.sol` kontratı DeFi-uyumlu interface'ler içerir
- v1'de basit depozito havuzu olarak çalışır
- v2 yol haritasında gerçek yield stratejisi planlanmaktadır

---

## ✨ Özellikler

### 💧 Su Faturası Sistemi

```
📸 Su Sayacı Fotoğrafı Yükle
      ↓
🔍 OCR Okuma (Backend - Tesseract)
      ↓
📊 %50+ Düşüş Kontrolü → ⚠️ Anomali Sinyali
      ↓
👷 Personel İncelemesi → Onay / Fraud Kararı
      ↓
⛓️ Blockchain Kayıt → 🪙 BELT Ödül (Onay durumunda)
```

**Özellikler:**
- **Fotoğraf Hash Saklama**: SHA256 hash blockchain'de, fotoğraf off-chain
- **Tüketim Geçmişi**: Son 6 ay verisi ile karşılaştırma
- **Anomali Sinyali**: %50+ düşüşlerde otomatik uyarı (karar DEĞİL)
- **Personel Onayı**: Nihai karar her zaman yetkili personelden

### ♻️ Geri Dönüşüm Ödül Sistemi

| Atık Türü | Token/Birim | Renk Kodu |
|-----------|-------------|-----------|
| 🧴 Plastik | 10 BELT/kg | 🔵 Mavi |
| 🥛 Cam | 12 BELT/kg | 🟢 Yeşil |
| 🔩 Metal | 15 BELT/kg | 🟠 Turuncu |
| 📄 Kağıt/Karton | 8 BELT/kg | 🟣 Mor |
| 📱 Elektronik | 25 BELT/adet | 🔴 Kırmızı |

**QR Kod Sistemi:**
- Çoklu atık türü desteği (tek formda tüm türler)
- **3 saatlik QR geçerliliği** (countdown timer)
- Personel onayı zorunlu (QR okutulduktan sonra)
- Hash tekrar kullanım koruması (blockchain'de)

### 🚨 2 Hak Sistemi

```
┌─────────────────────────────────────────────────────┐
│                  FRAUD HAK SİSTEMİ                   │
├─────────────────────────────────────────────────────┤
│  ♻️ Geri Dönüşüm: 2 Hak    │  💧 Su Sayacı: 2 Hak   │
│  ─────────────────────     │  ──────────────────    │
│  • Personel fraud kararı   │  • Personel fraud      │
│    → 1 hak düşer           │    kararı → 1 hak düşer│
│  • 0 hak = Kara liste      │  • 0 hak = Kara liste  │
└─────────────────────────────────────────────────────┘
```

---

## 🚨 Anomali Sinyal Sistemi

### Kullanılan Yöntemler

| Yöntem | Açıklama | Eşik |
|--------|----------|------|
| **Z-Score Analizi** | Standart sapmadan uzaklık | > 2.5 |
| **Yüzdesel Değişim** | Ortalamaya göre düşüş | > %50 |
| **Trend Analizi** | Son 3-4 ay sürekli düşüş | Linear regression |
| **Metadata Kontrolü** | Fotoğraf yaşı, GPS varlığı | > 5 dakika |

### Skor Hesaplama

```python
# Örnek skor bileşenleri (0-100 arası)
skor = 0
if yuzde_dusus > 50:     skor += 40  # Büyük düşüş
if z_score > 2.5:        skor += 25  # İstatistiksel anomali
if trend == "azalan":    skor += 15  # Sürekli düşüş trendi
if foto_yasi > 5_dk:     skor += 10  # Eski fotoğraf
if gps_yok:              skor += 5   # Konum yok
if foto_duzenlenmis:     skor += 20  # Düzenleme tespiti

# Sonuç
if skor >= 70:  risk = "critical"   # Personele acil uyarı
if skor >= 50:  risk = "high"       # İnceleme önerisi
if skor >= 30:  risk = "medium"     # İzlemeye devam
else:           risk = "low"        # Normal işlem
```

### ⚠️ Önemli Not

> **Bu sistem karar VERMEZ.**
> 
> Sadece personelin dikkatini çekecek sinyaller üretir.
> Nihai karar her zaman yetkili personel tarafından verilir ve blockchain'e kaydedilir.

---

## 🚀 Kurulum

### Gereksinimler

- Node.js 18+
- Python 3.11+
- SQLite (varsayılan) veya PostgreSQL
- MetaMask tarayıcı uzantısı

### Hızlı Başlangıç

```bash
# 1. Repository klonla
git clone https://github.com/ibrahim4334/municipalityproject.git
cd municipalityproject/ecocivic-dapp

# 2. Backend başlat
cd backend-ai
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
python app.py
# ✅ http://localhost:8000

# 3. Frontend başlat (yeni terminal)
cd frontend
npm install
npm run dev
# ✅ http://localhost:3000

# 4. (Opsiyonel) Smart Contracts - Local blockchain
cd smart-contracts
npm install
npx hardhat node          # Ayrı terminal
npx hardhat run scripts/deploy.js --network localhost
```

---

## 👥 Kullanıcı Rolleri

### 3 Rol Sistemi

| Rol | Erişim | Yetkiler |
|-----|--------|----------|
| 👤 **Vatandaş** | Ana Panel | Su sayacı yükle, geri dönüşüm beyanı ver, bakiye gör |
| 👷 **Personel** | Staff Panel | Beyanları incele, onay/fraud kararı ver, fiziksel kontrol |
| 🛡️ **Admin** | Admin Panel | İtirazları incele, parametreler, istatistikler |

### Demo Modu

Dashboard'da toggle buton ile roller arası geçiş yapılabilir. Bu, demo sırasında farklı kullanıcı deneyimlerinin gösterilmesini kolaylaştırır.

---

## 📦 Smart Contracts

### Kontrat Listesi

| Kontrat | Boyut | Açıklama |
|---------|-------|----------|
| `BELTToken.sol` | 3.6 KB | ERC-20 token, mint/burn/pause |
| `RecyclingRewards.sol` | 17.7 KB | 5 atık türü, personel onayı, 2 hak sistemi |
| `WaterBilling.sol` | 25.5 KB | Sayaç okuma, tüketim geçmişi, anomali kontrolü |
| `WaterBillingFraudManager.sol` | 27.7 KB | Fraud yönetimi, depozito cezaları |
| `EcoCivicDeposit.sol` | 4 KB | Depozito havuzu (DeFi-ready interface) |

### Blockchain'e Yazılan Veriler

```solidity
// Örnek: Personel kararı kaydı
event SubmissionApproved(
    uint256 indexed submissionId,
    address indexed user,
    uint256 rewardAmount,
    address approvedBy      // Karar veren personel
);

event FraudDetected(
    address indexed user,
    string reason           // Fraud sebebi
);

// QR Hash kontrolü (replay protection)
mapping(string => bool) public usedQrHashes;
```

---

## 🚫 v1'de Kapsam Dışı

Aşağıdaki özellikler **bilinçli olarak** v1 kapsamı dışında bırakılmıştır:

| Özellik | Neden Kapsam Dışı | v2 Planı |
|---------|-------------------|----------|
| **Gerçek ML Modeli** | Training data ve model eğitimi gerektirir | Etiketli veriyle model eğitimi |
| **Aave/DeFi Yield** | Testnet'te gerçek yield mümkün değil | Mainnet entegrasyonu |
| **Decentralized Oracle** | Karmaşıklık ve maliyet | Chainlink entegrasyonu |
| **DAO Governance** | Önce prototip doğrulanmalı | Token holder voting |
| **Mobile App** | Web öncelikli | React Native |
| **Multi-chain** | Tek zincir yeterli | Polygon, Arbitrum |

### Bu Kısıtlamalar Neden Var?

1. **Akademik Proje Scope**: Tüm özellikleri implement etmek yerine çekirdek değer önerisini doğrulamak
2. **Dürüst İddialar**: "Yapıyoruz" demek yerine "yapabiliriz" demek
3. **Ölçeklenebilir Mimari**: v2 için temel hazır, genişletilebilir yapı

---

## 🔮 v2 Yol Haritası

### Planlanmış Geliştirmeler

| Özellik | Açıklama | Öncelik |
|---------|----------|---------|
| 🤖 **ML Fraud Modeli** | Etiketli veriyle eğitilmiş gerçek model | Yüksek |
| 💰 **DeFi Entegrasyonu** | Aave/Compound üzerinden yield | Orta |
| 📱 **Mobile App** | React Native ile cross-platform | Orta |
| 🔗 **Oracle Entegrasyonu** | Chainlink ile dış veri akışı | Düşük |
| 🗳️ **DAO Governance** | Token holder oylama sistemi | Düşük |

---

## 🧪 Test

```bash
# Smart Contract testleri
cd smart-contracts
npx hardhat test

# API health check
curl http://localhost:8000/api/health
```

---

## 📄 Lisans

MIT License - Detaylar için [LICENSE](LICENSE) dosyasına bakın.

---

## 📞 İletişim

- **Proje**: EcoCivic DApp
- **Repository**: [github.com/ibrahim4334/municipalityproject](https://github.com/ibrahim4334/municipalityproject)

---

## 👤 Hazırlayan

| | |
|---|---|
| **İsim** | İbrahim Erol |
| **Proje** | EcoCivic DApp - Belediye Blockchain Prototipi |
| **Tür** | Akademik Prototip |
| **Versiyon** | v1.0 |

---

<p align="center">
  <b>🏛️ Şeffaf Belediyecilik için Blockchain Prototipi 🏛️</b>
  <br>
  <sub>v1.0 - Akademik Proje</sub>
  <br>
  <sub>Geliştiren: İbrahim Erol</sub>
</p>
