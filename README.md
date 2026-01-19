# 🏛️ EcoCivic DApp - Municipality Blockchain Project

> **Akademik Proje**: Belediye-vatandaş etkileşimini blockchain ile şeffaflaştıran bir DApp prototipi.

---

## 📋 Proje Hakkında

EcoCivic DApp, belediyelerin vatandaşlarla etkileşimini dijitalleştiren ve **kritik kararları blockchain'de değiştirilemez şekilde kaydeden** bir hibrit uygulama prototipidir.

### 🎯 Çözdüğü Problemler

| Problem | Çözüm | Blockchain Rolü |
|---------|-------|-----------------|
| Karar şeffaflığı eksikliği | Tüm kararlar zincirde kayıtlı | ✅ Immutable record |
| Ödül güvenilirliği | BELT token ile anında ödül | ✅ ERC-20 token |
| Delil bütünlüğü | Fotoğraf hash'i zincirde | ✅ SHA256 hash |
| Tekrar kullanım | QR hash kontrolü | ✅ On-chain validation |

### 🏗️ Mimari Yaklaşım

```
┌─────────────────────────────────────────────────────────────────┐
│   OFF-CHAIN (Backend)           │    ON-CHAIN (Blockchain)      │
├─────────────────────────────────┼───────────────────────────────┤
│ • Görüntü işleme (OCR)          │ • Token mint/transfer         │
│ • Anomali skorlama              │ • Personel karar kayıtları    │
│ • Kullanıcı verileri            │ • Hash saklama (delil)        │
│ • Bildirim sistemi              │ • Depozito bakiyeleri         │
└─────────────────────────────────┴───────────────────────────────┘
```

---

## 📁 Proje Yapısı

```
clean-repo/
└── ecocivic-dapp/
    ├── frontend/          # React 18 + Vite + MUI
    ├── backend-ai/        # Flask + SQLAlchemy + Web3.py
    ├── smart-contracts/   # Solidity 0.8.20 + Hardhat
    └── docs/              # Dokümantasyon
```

---

## ✨ Temel Özellikler

### 💧 Su Faturası Yönetimi
- Sayaç fotoğrafı yükleme + OCR okuma
- Tüketim anomali sinyali (%50+ düşüş uyarısı)
- Personel onay/fraud kararı → blockchain kaydı
- BELT token ödülü

### ♻️ Geri Dönüşüm Ödül Sistemi
- 5 atık türü (plastik, cam, metal, kağıt, elektronik)
- QR kod ile 3 saatlik beyan sistemi
- Personel onayı zorunlu
- 2 hak sistemi (fraud koruması)

### 🔒 Güvenlik
- OpenZeppelin AccessControl
- ReentrancyGuard
- Role-based authorization
- Hash replay protection

---

## 🚀 Hızlı Başlangıç

```bash
cd ecocivic-dapp

# Backend
cd backend-ai && pip install -r requirements.txt && python app.py

# Frontend (yeni terminal)
cd frontend && npm install && npm run dev

# Smart Contracts (opsiyonel)
cd smart-contracts && npm install && npx hardhat node
```

Detaylı kurulum için: [ecocivic-dapp/README.md](ecocivic-dapp/README.md)

---

## ⚠️ Önemli Notlar (Akademik Dürüstlük)

### Bu Proje Nedir?
- ✅ Blockchain tabanlı belediye prototipi
- ✅ Hibrit mimari (off-chain + on-chain)
- ✅ İstatistiksel anomali sinyal sistemi
- ✅ Personel karar mekanizması

### Bu Proje Ne DEĞİLDİR?
- ❌ Gerçek AI/ML modeli (istatistik bazlı, ML değil)
- ❌ Fully decentralized sistem (backend bağımlılığı var)
- ❌ Production-ready uygulama (prototip seviyesinde)
- ❌ DeFi yield sistemi (Aave entegrasyonu v2'de planlanıyor)

---

## 📚 Dokümantasyon

| Dosya | İçerik |
|-------|--------|
| [ecocivic-dapp/README.md](ecocivic-dapp/README.md) | Detaylı proje açıklaması |
| [ecocivic-dapp/LOCAL_SETUP.md](ecocivic-dapp/LOCAL_SETUP.md) | Kurulum rehberi |
| [ecocivic-dapp/ROLE_BASED_SYSTEM.md](ecocivic-dapp/ROLE_BASED_SYSTEM.md) | Rol sistemi detayları |
| [ecocivic-dapp/SECURITY.md](ecocivic-dapp/SECURITY.md) | Güvenlik özellikleri |

---

## 🛠️ Teknoloji Stack

| Katman | Teknoloji |
|--------|-----------|
| Frontend | React 18, Vite, Material-UI, ethers.js |
| Backend | Python 3.11, Flask, SQLAlchemy, Web3.py |
| Blockchain | Solidity 0.8.20, Hardhat, OpenZeppelin |
| Database | SQLite (dev) / PostgreSQL (prod) |

---

## 📄 Lisans

MIT License

---

<p align="center">
  <b>🏛️ v1.0 - Akademik Prototip 🏛️</b>
</p>
