# Akıllı Belediye Blockchain Ekosistemi

Bu proje, blockchain ve AI teknolojilerini kullanarak belediye hizmetlerini şeffaf ve teşvik edici hale getirmeyi amaçlar.

## Özellikler
- **Su Yönetimi:** Vatandaş kendi sayacını AI kontrolü ile beyan eder, anında fatura oluşur.
- **Depozito Sistemi:** Hatalı beyanları önlemek için "Stake & Slash" mekanizması kullanılır.
- **Geri Dönüşüm:** 3 saat süreli QR kodlar ile atık takibi ve etiket basımı sağlanır.
- **Belediye Token (BTK):** Geri dönüşüm yapan vatandaşlara verilen ödül birimi.

## Dosya Yapısı
- `BelediyeToken.sol`: Ödül mekanizması.
- `SuYonetimi.sol`: Fatura ve depozito mantığı.
- `GeriDonusum.sol`: QR ve atık teslim işlemleri.
- `ai_verifier.py`: Sayaç doğrulama AI simülasyonu.