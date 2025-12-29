# EcoCivic DApp – Technical Architecture

## 1. Proje Özeti

**EcoCivic**, blockchain, DeFi ve yapay zekâ (AI) bileşenlerini bir araya getiren, akıllı belediyecilik ve sürdürülebilirlik odaklı bir DApp (Decentralized Application) mimarisidir. Sistem; su tüketimi takibi, geri dönüşüm teşviki ve vatandaş depozitolarının DeFi protokolleri üzerinden değerlendirilmesini tek bir entegre platformda sunar.

Temel hedefler:
- Şeffaf ve güvenilir belediye hizmetleri
- Vatandaş davranışlarını teşvik eden token tabanlı ekonomi
- AI destekli otomatik doğrulama ve suistimal önleme

---

## 2. Yüksek Seviyeli Mimari (High-Level Architecture)

EcoCivic üç ana katmandan oluşur:

1. **Frontend (DApp UI)** – React
2. **Backend AI & API Katmanı** – Python / Flask
3. **Blockchain Katmanı** – Solidity Smart Contracts + DeFi

```
[ User Wallet ]
      │
      ▼
[ Frontend (React + Ethers.js) ]
      │
      ├───────────────┐
      ▼               ▼
[ Blockchain ]   [ AI Backend ]
(Smart Contracts) (OCR + Validation)
```

---

## 3. Blockchain Katmanı

### 3.1 Kullanılan Teknolojiler
- **Solidity (0.8+)** – Akıllı kontratlar
- **Polygon (MATIC)** – Düşük gas maliyeti
- **Aave** – DeFi lending (depozito nemalandırma)
- **OpenZeppelin** – Güvenli kontrat altyapısı

### 3.2 Smart Contract Mimarisi

| Kontrat | Sorumluluk |
|-------|-----------|
| `BELTToken.sol` | Belediye teşvik tokenı (ERC20) |
| `EcoCivicDeposit.sol` | Vatandaş depozitosu + Aave entegrasyonu |
| `WaterBilling.sol` | AI onaylı su faturalama |
| `RecyclingRewards.sol` | Geri dönüşüm ödülleri |
| `SlashingManager.sol` | Yanlış beyan cezaları |

### 3.3 Token Ekonomisi (Özet)

- **BELT Token** bir ödül tokenıdır
- Mint yetkisi sadece belediye kontratlarında
- Kullanım alanları:
  - Su faturası düşümü
  - Toplu taşıma
  - Belediye servisleri

---

## 4. Backend AI Katmanı

### 4.1 Amaç
Backend AI katmanı, zincir dışı (off-chain) hesaplama gerektiren işlemleri gerçekleştirir:

- Görüntü işleme (OCR)
- Anomali tespiti
- QR doğrulama
- İş kuralları

### 4.2 AI Modülleri

#### OCR (Su Sayacı Okuma)
- **pytesseract** kullanılır
- Sayaç numarası ve endeks değeri tespit edilir

#### Anomali Tespiti
- Güncel tüketim
- Son 3 aylık ortalama ile karşılaştırılır
- `%40 üzeri sapma → şüpheli`

#### QR Doğrulama
- `crypto.randomUUID()` ile üretilen ID
- 3 saatlik geçerlilik süresi
- Tek kullanımlık mantık

### 4.3 Backend–Blockchain Etkileşimi

Backend:
- QR veya sayaç verisini doğrular
- Sonuç **boolean / validated** olarak belirlenir
- Yetkili cüzdan ile smart contract fonksiyonları çağrılır

---

## 5. Frontend (DApp) Katmanı

### 5.1 Teknolojiler
- **React** – UI
- **Ethers.js** – Blockchain etkileşimi
- **Axios** – Backend API çağrıları

### 5.2 Temel Bileşenler

| Bileşen | Açıklama |
|------|--------|
| `WalletConnect` | MetaMask bağlantısı |
| `WaterMeterUpload` | Sayaç fotoğrafı yükleme |
| `RecyclingQR` | QR üretimi |
| `RewardsDashboard` | BELT bakiyesi |

---

## 6. Veri Akışları (Data Flow)

### 6.1 Su Tüketimi Akışı

```
Kullanıcı
  │
  │ Fotoğraf
  ▼
Frontend
  │
  │ API Request
  ▼
AI Backend
  │  ├ OCR
  │  ├ Anomali kontrolü
  ▼
Validation Result
  │
  ▼
Blockchain
  ├ Fatura kes
  └ BELT ödülü
```

### 6.2 Geri Dönüşüm Akışı

```
Kullanıcı
  │ QR üretir
  ▼
Geri Dönüşüm Merkezi
  │ QR okutur
  ▼
Backend
  │ Doğrular
  ▼
Blockchain
  └ BELT mint
```

---

## 7. Blockchain – AI Entegrasyon Mantığı

| İşlem | Nerede | Sebep |
|----|------|------|
| OCR | Off-chain | Yüksek maliyet |
| Anomali tespiti | Off-chain | ML gereksinimi |
| Ödül & ceza | On-chain | Şeffaflık |
| Token basımı | On-chain | Güven |

Bu hibrit yapı sayesinde:
- Gas maliyetleri düşürülür
- AI esnekliği korunur
- Blockchain güvenliği sağlanır

---

## 8. Güvenlik ve Yetkilendirme

- Smart contract’larda `onlyOwner`
- Backend cüzdanı = Belediye
- Frontend doğrudan mint yapamaz
- Slashing sadece yetkili kontratlarca

---

## 9. Ölçeklenebilirlik ve Gelecek Geliştirmeler

- Gerçek IoT sayaç entegrasyonu
- L2 / ZK-rollup geçişi
- DAO tabanlı belediye yönetişimi
- Karbon ayak izi hesaplama

---

## 10. Sonuç

EcoCivic mimarisi, gerçek dünya belediye süreçlerini blockchain ve AI ile birleştiren **hibrit, ölçeklenebilir ve güvenli** bir referans DApp mimarisidir. Bu yapı, hem pilot belediye projeleri hem de akademik / Ar-Ge çalışmaları için güçlü bir temel sunar.

