# 🔐 Role-Based Access Control (RBAC) Sistemi

Bu dokümantasyon, EcoCivic DApp için implement edilen role-based access control sistemini açıklar.

## 📋 Roller

### 👤 Citizen (Vatandaş)
- **Varsayılan Rol:** Yeni kayıt olan tüm kullanıcılar
- **Yetkiler:**
  - QR kod okutabilir
  - Su sayacı görseli yükleyebilir
  - Kendi ödül bakiyesini görebilir
  - Kendi işlem geçmişini görebilir

### ♻️ Service Operator (Hizmet Operatörü)
- **Atama:** Municipality Admin tarafından atanır
- **Yetkiler:**
  - QR token üretebilir
  - Sayaç doğrulama süreçlerini yönetebilir
  - Geri dönüşüm validasyonlarını onaylayabilir
  - Su sayacı okumalarını validate edebilir

### 🏛️ Municipality Admin (Belediye Yöneticisi)
- **Atama:** İlk deploy sonrası manuel olarak atanır (database'de)
- **Yetkiler:**
  - Sistem genelini izleyebilir
  - Anomali raporlarını görebilir
  - Ödül politikalarını güncelleyebilir
  - Service Operator'leri atayabilir
  - Kullanıcı rolleri yönetebilir
  - Tüm sistem metriklerini görebilir

## 🔧 Teknik Implementasyon

### Backend (Python/Flask)

#### 1. User Model
```python
class User(Base):
    wallet_address: String(42)  # Unique, primary identifier
    role: UserRole enum  # CITIZEN, SERVICE_OPERATOR, MUNICIPALITY_ADMIN
    email: String(255)  # Optional
    name: String(255)  # Optional
    is_active: Boolean
```

#### 2. JWT Token Yapısı
```json
{
  "wallet_address": "0x...",
  "role": "citizen|service_operator|municipality_admin",
  "exp": 1234567890,
  "iat": 1234567890
}
```

#### 3. Authentication Endpoints
- `POST /api/auth/login` - Wallet-based login
- `GET /api/auth/me` - Current user info
- `PUT /api/auth/update-profile` - Update profile

#### 4. Role-Based Authorization Decorators
```python
@require_citizen  # Sadece vatandaşlar
@require_service_operator  # Sadece operatörler
@require_municipality_admin  # Sadece adminler
@require_service_operator_or_admin  # Operatör veya admin
```

#### 5. Protected Endpoints

**Citizen Endpoints:**
- `POST /api/water/validate` - Su sayacı yükleme
- `POST /api/recycling/validate` - QR kod okutma
- `GET /api/citizen/rewards` - Ödül bakiyesi
- `GET /api/citizen/history` - İşlem geçmişi

**Service Operator Endpoints:**
- `POST /api/recycling/generate-qr` - QR token oluşturma
- `GET /api/operator/pending-validations` - Bekleyen validasyonlar
- `POST /api/operator/validate-water` - Su sayacı onaylama
- `POST /api/operator/validate-recycling` - Geri dönüşüm onaylama

**Municipality Admin Endpoints:**
- `GET /api/admin/dashboard` - Sistem dashboard
- `GET /api/admin/anomalies` - Anomali raporları
- `PUT /api/admin/reward-policy` - Ödül politikası güncelleme
- `POST /api/admin/users/{wallet}/role` - Kullanıcı rolü güncelleme
- `GET /api/admin/statistics` - Sistem istatistikleri

### Smart Contracts (Solidity)

#### AccessControl Implementation
OpenZeppelin AccessControl kullanarak role-based access:

```solidity
import "@openzeppelin/contracts/access/AccessControl.sol";

contract EcoCivicContract is AccessControl {
    bytes32 public constant SERVICE_OPERATOR_ROLE = keccak256("SERVICE_OPERATOR_ROLE");
    bytes32 public constant MUNICIPALITY_ADMIN_ROLE = keccak256("MUNICIPALITY_ADMIN_ROLE");
    
    modifier onlyOperatorOrAdmin() {
        require(
            hasRole(SERVICE_OPERATOR_ROLE, msg.sender) || 
            hasRole(MUNICIPALITY_ADMIN_ROLE, msg.sender),
            "Access denied"
        );
        _;
    }
}
```

### Frontend (React)

#### Role-Based Routing
```javascript
// Routes
/citizen/* - Citizen sayfaları
/operator/* - Service Operator sayfaları
/admin/* - Municipality Admin sayfaları
```

#### Role-Based Components
- CitizenDashboard
- OperatorDashboard
- AdminDashboard
- RoleGuard component (route protection)

#### Auth Context
```javascript
{
  user: {
    walletAddress: "0x...",
    role: "citizen|service_operator|municipality_admin",
    token: "jwt_token"
  },
  isCitizen: boolean,
  isOperator: boolean,
  isAdmin: boolean
}
```

## 🔄 İlk Kurulum

### 1. Database Migration
```python
from database.db import init_db
from database.models import User, UserRole

init_db()  # Tabloları oluştur
```

### 2. İlk Admin Kullanıcı Oluşturma
```python
# Script: create_admin.py
from database.db import get_db
from database.models import User, UserRole

with get_db() as db:
    admin = User(
        wallet_address="0xYOUR_ADMIN_WALLET",
        role=UserRole.MUNICIPALITY_ADMIN,
        is_active=True
    )
    db.add(admin)
    db.commit()
```

### 3. Service Operator Atama
Admin panel üzerinden veya API ile:
```bash
PUT /api/admin/users/{wallet_address}/role
{
  "role": "service_operator"
}
```

## 🔒 Güvenlik Notları

1. **Wallet-Based Authentication:** Kullanıcılar wallet adresleri ile authenticate olur
2. **JWT Tokens:** Tüm API isteklerinde Bearer token gerekli
3. **Role Validation:** Her endpoint'te role kontrolü yapılır
4. **Smart Contract Roles:** Blockchain seviyesinde de role kontrolü
5. **Audit Logging:** Tüm admin işlemleri loglanır

## 📝 API Kullanım Örnekleri

### Citizen Login
```bash
POST /api/auth/login
{
  "wallet_address": "0x..."
}

Response:
{
  "token": "eyJ...",
  "user": {
    "wallet_address": "0x...",
    "role": "citizen"
  }
}
```

### Protected Endpoint Call
```bash
GET /api/citizen/rewards
Headers:
  Authorization: Bearer eyJ...
```

### Admin - Role Update
```bash
PUT /api/admin/users/0x.../role
Headers:
  Authorization: Bearer eyJ...
Body:
{
  "role": "service_operator"
}
```

## ⚠️ Önemli Notlar

1. **İlk Admin:** Deploy sonrası manuel olarak database'de oluşturulmalı
2. **Role Changes:** Role değişiklikleri sadece Municipality Admin tarafından yapılabilir
3. **Backward Compatibility:** Mevcut wallet-based işlemler için Citizen rolü varsayılan
4. **Migration:** Mevcut kullanıcılar için migration script gerekebilir

---

**Son Güncelleme:** 2026-01-11
