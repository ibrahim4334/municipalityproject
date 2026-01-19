---
description: EcoCivic v1 Güçlendirme - Akademik Sunum Hazırlığı
---

# 🎯 EcoCivic v1 Güçlendirme Yol Haritası

**Son Güncelleme**: 19 Ocak 2026, 01:17  
**Durum**: Devam Ediyor

---

## 📋 GENEL AMAÇ

Projeyi "akademik olarak sunulabilir v1 belediye DApp prototipi" haline getirmek.

**İlkeler:**
- ❌ DAO, oylama, oracle, fully-decentralized sistem YOK
- ❌ Gerçek AI/ML modeli eklemiyoruz
- ❌ Yeni büyük feature üretmiyoruz
- ✅ Mevcut sistemi sadeleştirme
- ✅ İddiaları gerçekçi hale getirme
- ✅ Blockchain rolünü netleştirme

---

## ✅ TAMAMLANAN ADIMLAR

### 1. README Güncellemesi (19 Ocak 2026)

| Dosya | Durum |
|-------|-------|
| `ecocivic-dapp/README.md` | ✅ Tamamlandı |
| `clean-repo/README.md` | ✅ Tamamlandı |

**Yapılan değişiklikler:**
- "AI Fraud Detection" → "Anomali Sinyal Sistemi" terminolojisi
- Blockchain'in gerçek rolü net açıklandı
- v1'de kapsam dışı bırakılanlar dürüstçe belirtildi
- Fraud iş akışı diyagramı eklendi
- Aave iddiası → "DeFi-ready v2 planı" olarak yeniden konumlandırıldı

---

## ⏳ BEKLEYEN ADIMLAR

### 2. Backend Terminoloji Değişiklikleri

**Amaç:** Kod içindeki "AI/ML" terminolojisini "Anomali Sinyal" ile değiştirmek.

| Dosya | Değişiklik |
|-------|------------|
| `backend-ai/fraud_detection/ml_fraud_detector.py` | Sınıf: `MLFraudDetector` → `AnomalySignalDetector` |
| `backend-ai/fraud_detection/usage_anomaly.py` | Yorum/docstring güncelleme |
| `backend-ai/fraud_detection/__init__.py` | Export isimlerini güncelle |
| `backend-ai/services/fraud_detection.py` | `FraudDetectionService` → `AnomalySignalService` |
| `backend-ai/app.py` | Endpoint yorumları ve response mesajları |

**Tahmini süre:** 1-1.5 saat

---

### 3. Frontend UI Metinleri Güncelleme

**Amaç:** Kullanıcıya gösterilen metinlerde terminoloji tutarlılığı.

| Dosya | Değişiklik |
|-------|------------|
| `frontend/src/components/AdminDashboard.jsx` | "AI Fraud" → "Anomali Sinyali" |
| `frontend/src/components/StaffDashboard.jsx` | "Fraud tespiti" → "Anomali incelemesi" |
| `frontend/src/components/WaterMeterUpload.jsx` | Uyarı mesajları |
| `frontend/src/pages/Dashboard.jsx` | Fraud uyarı kartı metni |

**Tahmini süre:** 1 saat

---

### 4. Smart Contract: `recordFraudVerdict` Fonksiyonu

**Amaç:** Personel kararının blockchain'e yazıldığı net bir fonksiyon.

**Dosya:** `smart-contracts/contracts/WaterBilling.sol`

**Eklenecek fonksiyon (pseudo):**
```solidity
function recordFraudVerdict(
    address user,
    bool isFraud,
    bytes32 evidenceHash,
    string calldata reason
) external onlyRole(MUNICIPALITY_STAFF_ROLE)
```

**Tahmini süre:** 1 saat (+ test)

---

### 5. Aave Yorum Güncellemeleri

**Amaç:** Aave entegrasyonu iddiasını yumuşatmak.

| Dosya | Değişiklik |
|-------|------------|
| `smart-contracts/contracts/EcoCivicDeposit.sol` | Üst yorum: "DeFi-ready, v2 planı" |
| `smart-contracts/contracts/interfaces/IAave.sol` | "Placeholder interface" notu |

**Tahmini süre:** 30 dakika

---

### 6. (Opsiyonel) Demo Happy Path Hazırlığı

**Amaç:** Demo'da gösterilecek senaryonun belirlenmesi.

- Geri dönüşüm beyanı → Staff onay → Token kazanımı akışı
- OCR riskini bypass eden "demo modu" butonu
- Token kullanım butonlarına tooltip ekleme

**Tahmini süre:** 1-2 saat

---

## 📊 ÖZET DURUM

| Adım | Durum | Süre |
|------|-------|------|
| 1. README | ✅ Tamamlandı | - |
| 2. Backend terminoloji | ⏳ Bekliyor | ~1.5 saat |
| 3. Frontend UI | ⏳ Bekliyor | ~1 saat |
| 4. Smart contract fonksiyon | ⏳ Bekliyor | ~1 saat |
| 5. Aave yorumları | ⏳ Bekliyor | ~30 dk |
| 6. Demo hazırlığı | ⏳ Opsiyonel | ~1-2 saat |

**Toplam kalan süre:** ~5-6 saat

---

## 🚀 YARIN BAŞLANGIÇ NOKTASI

1. Bu dosyayı aç: `/v1-guclandirme` workflow
2. Claude'a şunu söyle:
   ```
   v1 güçlendirme planına devam edelim. 
   Backend terminoloji değişiklikleriyle başla.
   ```
3. Sırayla adımları takip et

---

## 📝 NOTLAR

- README'ler artık akademik sunuma uygun
- Terminoloji: "AI" → "Anomali Sinyal Sistemi"
- Fraud akışı: Backend sinyal → Personel karar → Blockchain kayıt
- Aave: v1'de mock, v2'de gerçek entegrasyon planı
