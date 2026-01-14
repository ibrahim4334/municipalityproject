# EcoCivic Fraud Handling Workflow

Bu doküman, EcoCivic DApp'in tüm fraud tespit ve cezalandırma akışlarını kapsar.

---

## 1. Water Meter Fraud Detection

### 1.1 AI-based Anomaly Detection

```
Kullanıcı Fotoğraf Çeker
         │
         ▼
┌─────────────────────────────────────┐
│         BACKEND AI ANALİZ           │
│  • OCR ile sayaç okuma              │
│  • EXIF metadata kontrolü           │
│  • Geçmiş 6 ay karşılaştırma        │
│  • Z-score hesaplama                │
└─────────────────────────────────────┘
         │
         ▼
    Fraud Score 0-100
         │
    ┌────┴────┐────────┐
    │         │        │
 <30       30-69      ≥70
Normal    İzleme    Kritik
```

### 1.2 Fraud Scoring Kriterleri

| Kriter | Score Etkisi |
|--------|-------------|
| %50+ tüketim düşüşü | +40 |
| %200+ tüketim artışı | +20 |
| Z-score > 2.5 | +25 |
| GPS bilgisi yok | +5 |
| Fotoğraf düzenlenmiş | +20 |
| EXIF timestamp eski | +10 |
| Sayaç no değişti | +30 |
| Endeks azaldı | +50 |

### 1.3 %50 Consumption Drop Rule

```solidity
// Backend tespit eder
if (currentConsumption < avgConsumption * 50 / 100) {
    // Frontend "Emin misiniz?" sorar
    // Kullanıcı onaylarsa:
    anomalyConfirmedByUser[user] = true;
}
```

> **ÖNEMLİ:** Onay veren kullanıcı, fiziksel kontrolde fraud çıkarsa daha ağır ceza alır (bilerek onayladı).

---

## 2. Deposit Slashing Rules

### 2.1 İki Seviye Ceza Sistemi

| Seviye | Tetikleyici | Ceza | Kalıcı Flag |
|--------|------------|------|-------------|
| **Kısmi (Partial)** | AI fraud score ≥70 | %50 depozito | ❌ |
| **Tam (Full)** | Fiziksel kontrol fraud | %100 depozito | ✅ |

### 2.2 Smart Contract Fonksiyonları

```solidity
// AI tespit - kısmi kesinti
function slashDeposit(address user, uint256 amount) 
    external onlyRole(AI_VERIFIER_ROLE | FRAUD_DETECTOR_ROLE);

// Inspector onaylı - tam kesinti
function fullSlash(address user) 
    external onlyRole(INSPECTOR_ROLE);
```

### 2.3 On-Chain State

```solidity
mapping(address => uint256) public deposits;
mapping(address => bool) public permanentlyFlagged;
mapping(address => bool) public anomalyConfirmedByUser;
mapping(address => uint256) public pendingDebt;
```

---

## 3. Physical Inspection Process

### 3.1 6-Month Inspection Cycle

```
┌─────────────────────────────────────┐
│     6 AYLIK KONTROL SÜRESİ DOLDU    │
│     veya AI fraud score ≥70         │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│         KONTROL PLANLA              │
│  • Inspector atanır (whitelist)     │
│  • Tarih belirlenir                 │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│    FİZİKSEL SAYAÇ OKUMA             │
│  • Inspector gerçek okumayı girer   │
│  • Bildirilen ile karşılaştırılır   │
└─────────────────────────────────────┘
         │
    ┌────┴────┐
    │         │
 OK (≤%5)   FRAUD
    │         │
    ▼         ▼
  Active   CEZALAR:
  Status   • Deposit = 0
           • permanentlyFlagged = true
           • Geriye dönük borç + faiz
```

### 3.2 Retroactive Billing with Interest

```solidity
function recordPhysicalInspectionFull(
    address user,
    bool fraudDetected,
    uint256 realUsage,
    uint256 reportedUsage
) external onlyInspector {
    if (fraudDetected && realUsage > reportedUsage) {
        uint256 underreported = realUsage - reportedUsage;
        uint256 baseDebt = underreported * 10; // 10 TL/m³
        uint256 interest = baseDebt * 5 * 3 / 100; // %5/ay, 3 ay
        pendingDebt[user] += baseDebt + interest;
    }
}
```

### 3.3 Inspector Authority

```solidity
bytes32 public constant INSPECTOR_ROLE = keccak256("INSPECTOR_ROLE");
mapping(address => bool) public inspectorWhitelist;
```

---

## 4. Recycling Fraud Handling

### 4.1 QR-based Declaration

```
Kullanıcı QR Tarar
         │
         ▼
┌─────────────────────────────────────┐
│      SUBMISSION OLUŞTUR             │
│  • Atık türü seç                    │
│  • Miktar gir                       │
│  • Personel onayı bekle             │
└─────────────────────────────────────┘
```

### 4.2 Manual Inspection

Personel yerinde kontrol yapar:
- ✅ Onay → Token ödülü verilir
- ❌ Red → İşlem iptal
- 🚨 Fraud → Kalıcı yasak

### 4.3 Permanent Recycling Ban

```solidity
mapping(address => bool) public recyclingBanned;

function confirmRecyclingFraud(address user, string reason) 
    external onlyRole(RECYCLING_INSPECTOR_ROLE) 
{
    recyclingBanned[user] = true;
}

// Reward fonksiyonunda:
require(!recyclingBanned[user], "User banned from recycling rewards");
```

---

## 5. On-chain vs Off-chain Responsibilities

| İş | Off-chain | On-chain |
|----|-----------|----------|
| OCR okuma | ✅ Backend AI | - |
| EXIF analizi | ✅ Backend AI | - |
| Fraud score hesaplama | ✅ Backend AI | - |
| Deposit kesintisi | - | ✅ slashDeposit() |
| Tam kesinti + flag | - | ✅ fullSlash() |
| Borç kaydı | - | ✅ pendingDebt |
| Kullanıcı onayı | ✅ Frontend | ✅ anomalyConfirmedByUser |
| Fiziksel kontrol sonucu | ✅ Backend DB | ✅ recordPhysicalInspectionFull() |
| Recycling ban | - | ✅ recyclingBanned |

---

## 6. Role Hierarchy

```
DEFAULT_ADMIN_ROLE
    │
    ├── AI_VERIFIER_ROLE        → submitFraudEvidence, slashDeposit
    │
    ├── FRAUD_DETECTOR_ROLE     → slashDeposit, recordAnomalyConfirmation
    │
    ├── INSPECTOR_ROLE          → fullSlash, recordPhysicalInspectionFull
    │
    └── RECYCLING_INSPECTOR_ROLE → confirmRecyclingFraud
```

---

## 7. Events for Off-chain Tracking

```solidity
event DepositSlashed(address user, uint256 amount, bool isPartial);
event FullSlashApplied(address user, uint256 amount, bool permanentFlag);
event PhysicalInspectionRecorded(address user, bool fraudDetected, ...);
event AnomalyConfirmed(address user, bool confirmed, uint256 billId);
event DebtRecorded(address user, uint256 debtAmount, uint256 interestAmount);
event RecyclingFraudConfirmed(address user, address confirmedBy, string reason);
```

---

## 8. Özet Checklist

| Özellik | Durum |
|---------|-------|
| `deposits` mapping | ✅ |
| `permanentlyFlagged` mapping | ✅ |
| `slashDeposit()` - partial | ✅ |
| `fullSlash()` - 100% | ✅ |
| `anomalyConfirmedByUser` | ✅ |
| `pendingDebt` on-chain | ✅ |
| `inspectionCount` | ✅ |
| `lastInspectionTimestamp` | ✅ |
| `recyclingBanned` | ✅ |
| `confirmRecyclingFraud()` | ✅ |
