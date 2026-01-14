# EcoCivic DApp - API Spesifikasyonu

Bu dokümantasyon, EcoCivic DApp backend API'sinin tüm endpoint'lerini açıklar.

**Base URL:** `http://localhost:8000` (development)

---

## 🔐 Authentication

Tüm korumalı endpoint'ler JWT token gerektirir.

### Header Format
```
Authorization: Bearer <jwt_token>
```

---

## 📋 Endpoints

### Health Check

#### `GET /api/health`

Sistem durumu kontrolü.

**Response:**
```json
{
  "status": "ok"
}
```

---

### Authentication

#### `POST /api/auth/login`

Wallet-based login. Yeni kullanıcılar otomatik olarak oluşturulur.

**Request Body:**
```json
{
  "wallet_address": "0x1234567890abcdef1234567890abcdef12345678"
}
```

**Success Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "wallet_address": "0x1234...",
    "role": "citizen",
    "email": null,
    "name": null
  }
}
```

**Error Response (400):**
```json
{
  "error": "Invalid wallet address format"
}
```

---

#### `GET /api/auth/me`

Mevcut kullanıcı bilgilerini getirir.

**Headers:** `Authorization: Bearer <token>`

**Success Response (200):**
```json
{
  "wallet_address": "0x1234...",
  "role": "citizen",
  "email": "user@example.com",
  "name": "John Doe",
  "is_active": true
}
```

---

#### `PUT /api/auth/update-profile`

Kullanıcı profil bilgilerini günceller.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "email": "user@example.com",
  "name": "John Doe"
}
```

**Success Response (200):**
```json
{
  "wallet_address": "0x1234...",
  "role": "citizen",
  "email": "user@example.com",
  "name": "John Doe"
}
```

---

### Water Meter

#### `POST /api/water/validate`

Su sayacı fotoğrafını yükler ve OCR ile analiz eder.

**Headers:** 
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Request Body (Form Data):**
- `image`: Sayaç fotoğrafı (JPEG, PNG, max 5MB)

**Rate Limit:** 10 requests per minute

**Success Response (200):**
```json
{
  "valid": true,
  "meter_no": "12345678",
  "current_index": 1234,
  "historical_avg": 1200.5,
  "reward_eligible": true,
  "processed_by": "0x1234...",
  "transaction_hash": "0xabc..."
}
```

**Error Response - OCR Failed (400):**
```json
{
  "valid": false,
  "reason": "OCR failed",
  "data": {
    "meter_no": null,
    "index": null,
    "raw_text": "...",
    "error": "Image could not be opened"
  }
}
```

**Error Response - Anomaly Detected (400):**
```json
{
  "valid": false,
  "reason": "Anomaly detected - consumption deviation > 40%",
  "data": {
    "meter_no": "12345678",
    "index": 5000
  }
}
```

---

### Recycling

#### `POST /api/recycling/generate-qr`

**Yetki:** SERVICE_OPERATOR

QR token oluşturur.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "material_type": "glass",
  "amount": 10.5,
  "wallet_address": "0x1234..."
}
```

**Rate Limit:** 20 requests per minute

**Success Response (200):**
```json
{
  "token_id": "abc123...",
  "material_type": "glass",
  "amount": 10.5,
  "wallet_address": "0x1234...",
  "expires_at": "2026-01-11T15:00:00Z",
  "hash": "sha256...",
  "created_at": "2026-01-11T12:00:00Z"
}
```

**Error Response (400):**
```json
{
  "error": "Invalid material type"
}
```

**Valid Material Types:** `glass`, `paper`, `metal`

---

#### `POST /api/recycling/validate`

**Yetki:** SERVICE_OPERATOR

Geri dönüşüm gönderimini doğrular ve blockchain'de ödül verir.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "material_type": "glass",
  "qr_token": {
    "token_id": "abc123...",
    "material_type": "glass",
    "amount": 10.5,
    "wallet_address": "0x1234...",
    "expires_at": "2026-01-11T15:00:00Z",
    "hash": "sha256..."
  },
  "wallet_address": "0x1234..."
}
```

**Rate Limit:** 20 requests per minute

**Success Response (200):**
```json
{
  "valid": true,
  "reward_amount": 10,
  "material_type": "glass",
  "base_amount": 10.5,
  "multiplier": 1.0,
  "qr_hash": "sha256...",
  "transaction_hash": "0xdef...",
  "status": "rewarded_on_chain"
}
```

**Blockchain Fail Response (200):**
```json
{
  "valid": true,
  "reward_amount": 10,
  "status": "validation_success_blockchain_fail",
  "blockchain_error": "Connection timeout"
}
```

---

### Admin (Municipality)

#### `GET /api/admin/users`

**Yetki:** MUNICIPALITY_ADMIN

Tüm kullanıcıları listeler.

**Query Parameters:**
- `role` (optional): Filter by role (`citizen`, `service_operator`, `municipality_admin`)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50)

**Success Response (200):**
```json
{
  "users": [
    {
      "id": 1,
      "wallet_address": "0x1234...",
      "role": "citizen",
      "is_active": true,
      "created_at": "2026-01-01T00:00:00Z"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 50
}
```

---

#### `PUT /api/admin/users/<wallet_address>/role`

**Yetki:** MUNICIPALITY_ADMIN

Kullanıcı rolünü günceller.

**Request Body:**
```json
{
  "role": "service_operator"
}
```

**Success Response (200):**
```json
{
  "wallet_address": "0x1234...",
  "role": "service_operator",
  "updated_at": "2026-01-11T12:00:00Z"
}
```

---

## 🔒 Roller ve Yetkiler

| Endpoint | CITIZEN | SERVICE_OPERATOR | MUNICIPALITY_ADMIN |
|----------|---------|------------------|-------------------|
| `/api/auth/*` | ✅ | ✅ | ✅ |
| `/api/water/validate` | ✅ | ✅ | ✅ |
| `/api/recycling/generate-qr` | ❌ | ✅ | ✅ |
| `/api/recycling/validate` | ❌ | ✅ | ✅ |
| `/api/admin/*` | ❌ | ❌ | ✅ |

---

## 📊 Rate Limits

| Endpoint Group | Limit |
|----------------|-------|
| Default | 200/day, 50/hour |
| `/api/water/validate` | 10/minute |
| `/api/recycling/*` | 20/minute |

---

## ⚠️ Error Codes

| HTTP Code | Meaning |
|-----------|---------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - Insufficient permissions |
| 413 | Payload Too Large - File size limit exceeded |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

**Standard Error Response:**
```json
{
  "error": "Error message here",
  "details": { ... }  // Only in DEBUG mode
}
```

---

## 📝 Notes

1. Tüm tarihler ISO 8601 formatındadır (UTC)
2. Wallet adresleri checksum formatında (EIP-55) kabul edilir
3. File upload limiti 5MB'dir
4. Token süresi 60 dakikadır (yapılandırılabilir)