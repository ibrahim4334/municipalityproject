import { useState, useRef, useCallback } from "react";
import { validateWaterMeter } from "../services/api";
import { getContract, sendTransaction } from "../services/web3";
import { useWallet } from "../context/WalletContext";
import WaterBillingABI from "../abi/WaterBilling.json";

const WATER_BILLING_ADDRESS = import.meta.env.VITE_WATER_BILLING_ADDRESS || "";

export default function WaterMeterUpload() {
  const { account, signer } = useWallet();
  const [image, setImage] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Camera states
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  // Consumption drop warning state
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  const [consumptionWarning, setConsumptionWarning] = useState(null);
  const [pendingSubmission, setPendingSubmission] = useState(null);

  // Manuel giriş modu (OCR 3 kez başarısız olursa)
  const [ocrFailCount, setOcrFailCount] = useState(0);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualMeterNumber, setManualMeterNumber] = useState("");
  const [manualConsumption, setManualConsumption] = useState("");

  // Fatura sonucu
  const [billResult, setBillResult] = useState(null);

  // Yanlış sayaç uyarısı (sayaç numarası eşleşmedi)
  const [meterMismatch, setMeterMismatch] = useState(null);

  // Kamerayı başlat
  const startCamera = useCallback(async () => {
    setCameraError(null);
    setError(null);

    try {
      // Kamera izni iste
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // Arka kamera (mobil)
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      streamRef.current = stream;
      setShowCamera(true);

      // Video elementine stream'i bağla
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);

    } catch (err) {
      console.error("Camera error:", err);

      let errorMessage = "Kameraya erişilemedi. ";
      if (err.name === "NotAllowedError") {
        errorMessage += "Lütfen kamera iznini verin.";
      } else if (err.name === "NotFoundError") {
        errorMessage += "Kamera bulunamadı.";
      } else if (err.name === "NotReadableError") {
        errorMessage += "Kamera başka bir uygulama tarafından kullanılıyor olabilir.";
      } else {
        errorMessage += err.message;
      }

      setCameraError(errorMessage);
    }
  }, []);

  // Kamerayı kapat
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  }, []);

  // Fotoğraf çek
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    // Canvas'ı blob'a çevir
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `meter_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setImage(file);
        setStatus("");
        setError(null);
        stopCamera();
      }
    }, 'image/jpeg', 0.9);
  }, [stopCamera]);

  const handleSubmit = async (userConfirmed = false) => {
    if (!image) {
      setError("Lütfen sayacınızın fotoğrafını çekin");
      return;
    }

    if (!account || !signer) {
      setError("Lütfen önce cüzdanınızı bağlayın");
      return;
    }

    if (!WATER_BILLING_ADDRESS || WATER_BILLING_ADDRESS === "0xYOUR_WATER_BILLING_CONTRACT") {
      setError("Water Billing kontrat adresi yapılandırılmamış");
      return;
    }

    setLoading(true);
    setError(null);
    setStatus("📸 Fotoğraf doğrulanıyor ve analiz ediliyor...");

    try {
      // 1️⃣ AI Backend'e gönder (with confirmation flag)
      const data = await validateWaterMeter(image, account, userConfirmed);

      if (!data || typeof data !== 'object') {
        throw new Error("Geçersiz sunucu yanıtı");
      }

      // Check for photo validation failure
      if (data.reason === "photo_validation_failed") {
        const newFailCount = ocrFailCount + 1;
        setOcrFailCount(newFailCount);

        if (newFailCount >= 3) {
          setError(`📷 Fotoğraf 3 kez okunamadı. Manuel giriş moduna geçiliyor.`);
          setShowManualEntry(true);
        } else {
          setError(`📷 ${data.message} (Deneme ${newFailCount}/3)\n${(data.errors || []).join(", ")}`);
        }
        setStatus("");
        setLoading(false);
        return;
      }

      // Check for OCR read failure (sayaç okunamadı)
      if (data.reason === "ocr_failed" || data.reason === "meter_not_readable") {
        const newFailCount = ocrFailCount + 1;
        setOcrFailCount(newFailCount);

        if (newFailCount >= 3) {
          setError(`📷 Sayaç değeri 3 kez okunamadı. Manuel giriş moduna geçiliyor.`);
          setShowManualEntry(true);
        } else {
          setError(`📷 Sayaç okunamadı. Lütfen daha net bir fotoğraf çekin. (Deneme ${newFailCount}/3)`);
        }
        setStatus("");
        setLoading(false);
        return;
      }

      // Başarılı okuma - sayacı sıfırla
      setOcrFailCount(0);

      // Check for meter number mismatch (yanlış sayaç) - Bu deneme hakkını tüketmez!
      if (data.reason === "fraud_detected" && data.anomaly_type === "meter_number_changed") {
        setError(null);
        setStatus("");
        // Özel dialog göster
        setMeterMismatch({
          message: "⚠️ Bu sayaç size ait değil!",
          details: data.details || "Fotoğraftaki sayaç numarası, kayıtlı sayaç numaranızla eşleşmiyor.",
          suggestion: "Lütfen kendi su sayacınızın fotoğrafını çekin."
        });
        setLoading(false);
        return;
      }

      // Check for other fraud detection
      if (data.reason === "fraud_detected") {
        setError(`⚠️ Fraud Uyarısı: ${data.message}`);
        setStatus("❌ Sayaç okumasında anormallik tespit edildi. Fiziksel kontrol planlanacaktır.");
        setLoading(false);
        return;
      }

      // Check for consumption drop warning requiring confirmation
      if (data.requires_confirmation && !userConfirmed) {
        setConsumptionWarning({
          currentConsumption: data.current_consumption,
          averageConsumption: data.average_consumption,
          dropPercent: data.drop_percent,
          message: data.message,
          warning: data.warning
        });
        setPendingSubmission({ image, account });
        setShowConfirmationDialog(true);
        setStatus("");
        setLoading(false);
        return;
      }

      if (!data.valid) {
        setStatus("❌ Tüketim anomali tespit edildi. Manuel inceleme gerekli.");
        setLoading(false);
        return;
      }

      if (!data.current_index || typeof data.current_index !== 'number') {
        const newFailCount = ocrFailCount + 1;
        setOcrFailCount(newFailCount);

        if (newFailCount >= 3) {
          setError(`📷 Sayaç değeri 3 kez alınamadı. Manuel giriş moduna geçiliyor.`);
          setShowManualEntry(true);
          setLoading(false);
          return;
        }
        throw new Error("Geçersiz sayaç okuma değeri");
      }

      // Show consumption warning acknowledgment if present
      if (data.consumption_warning) {
        setStatus(`⚠️ Düşük tüketim kaydedildi (%${data.consumption_warning.drop_percent} düşüş onaylandı). AI onayı alındı...`);
      } else {
        setStatus("✅ AI onayı alındı. Blockchain üzerinde fatura ödeniyor...");
      }

      // 2️⃣ Blockchain – WaterBilling kontratı
      const waterBilling = getContract(
        WATER_BILLING_ADDRESS,
        WaterBillingABI.abi || WaterBillingABI
      );

      // Estimate gas and send transaction safely
      const tx = await sendTransaction(
        waterBilling.payBill,
        data.current_index
      );

      setStatus("Transaction gönderildi, onay bekleniyor...");

      const receipt = await tx.wait();

      if (receipt.status === 1) {
        setStatus("💧 Fatura başarıyla ödendi. BELT ödülü kazandınız!");
        setImage(null);
        setShowConfirmationDialog(false);
        setConsumptionWarning(null);

        // Fatura sonucunu göster
        setBillResult({
          meterNumber: data.meter_no,
          consumption: data.current_index - (data.historical_avg || 0), // Basit hesap
          pricePerTon: 10,
          totalAmount: ((data.current_index - (data.historical_avg || 0)) * 10).toFixed(2),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('tr-TR'),
          pdfUrl: data.bill_pdf
        });
      } else {
        throw new Error("Transaction başarısız oldu");
      }
    } catch (error) {
      console.error("Water meter upload error:", error);

      let errorMessage = "İşlem sırasında bir hata oluştu";

      if (error.message) {
        if (error.message.includes("rejected")) {
          errorMessage = "İşlem kullanıcı tarafından reddedildi";
        } else if (error.message.includes("insufficient funds") || error.message.includes("balance")) {
          errorMessage = "Yetersiz bakiye. Lütfen gas ücreti için yeterli ETH olduğundan emin olun";
        } else if (error.message.includes("timeout")) {
          errorMessage = "İstek zaman aşımına uğradı. Lütfen tekrar deneyin";
        } else {
          errorMessage = error.message;
        }
      }

      setError(errorMessage);
      setStatus("");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmLowConsumption = () => {
    setShowConfirmationDialog(false);
    handleSubmit(true); // Re-submit with confirmation
  };

  const handleCancelSubmission = () => {
    setShowConfirmationDialog(false);
    setConsumptionWarning(null);
    setPendingSubmission(null);
    setStatus("");
    setImage(null);
  };

  // Manuel giriş submit
  const handleManualSubmit = async () => {
    if (!manualMeterNumber || !manualConsumption) {
      setError("Lütfen sayaç numarası ve tüketim değerini girin.");
      return;
    }

    const consumption = parseFloat(manualConsumption);
    if (isNaN(consumption) || consumption < 0) {
      setError("Geçersiz tüketim değeri.");
      return;
    }

    if (!account || !signer) {
      setError("Lütfen önce cüzdanınızı bağlayın");
      return;
    }

    setLoading(true);
    setError(null);
    setStatus("📝 Manuel giriş doğrulanıyor...");

    try {
      // Backend'e manuel giriş gönder
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/water/manual-entry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Wallet-Address': account
        },
        body: JSON.stringify({
          wallet_address: account,
          meter_number: manualMeterNumber,
          current_index: consumption,
          manual_entry: true
        })
      });

      const data = await response.json();

      if (response.ok && data.valid) {
        setStatus("✅ Manuel giriş kabul edildi. Blockchain üzerinde kaydediliyor...");

        // Blockchain işlemi
        if (WATER_BILLING_ADDRESS) {
          const waterBilling = getContract(
            WATER_BILLING_ADDRESS,
            WaterBillingABI.abi || WaterBillingABI
          );

          const tx = await sendTransaction(
            waterBilling.payBill,
            consumption
          );

          await tx.wait();
        }

        setStatus("💧 Manuel giriş başarıyla kaydedildi! Fatura bilgileri aşağıda.");

        // Backend'den gelen fatura verilerini kullan
        setBillResult({
          meterNumber: data.meter_number || manualMeterNumber,
          consumption: data.consumption || 0,
          pricePerTon: 10,
          totalAmount: data.bill_amount || 0,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('tr-TR')
        });

        setShowManualEntry(false);
        setManualMeterNumber("");
        setManualConsumption("");
        setOcrFailCount(0);
        setImage(null);
      } else {
        setError(data.message || "Manuel giriş kabul edilmedi.");
      }
    } catch (err) {
      console.error("Manual entry error:", err);
      setError("Manuel giriş sırasında hata oluştu: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const cancelManualEntry = () => {
    setShowManualEntry(false);
    setOcrFailCount(0);
    setManualMeterNumber("");
    setManualConsumption("");
    setError(null);
  };

  return (
    <div style={{ border: "1px solid #ccc", padding: "20px", borderRadius: "8px" }}>
      <h3>📸 Su Sayacı Fotoğrafı Çek</h3>

      {/* Fatura Sonucu Gösterimi */}
      {billResult && (
        <div style={{
          padding: "20px",
          backgroundColor: "#e8f5e9",
          borderRadius: "8px",
          marginBottom: "20px",
          border: "2px solid #4caf50"
        }}>
          <h4 style={{ color: "#2e7d32", marginTop: 0 }}>
            💧 Fatura Bilgileri
          </h4>
          <div style={{ display: "grid", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Sayaç No:</span>
              <strong>{billResult.meterNumber}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Tüketim:</span>
              <strong>{parseInt(billResult.consumption)} m³</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Birim Fiyat:</span>
              <strong>{billResult.pricePerTon} TL/m³</strong>
            </div>
            <hr style={{ border: "none", borderTop: "1px solid #a5d6a7" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "18px" }}>
              <span>Toplam Tutar:</span>
              <strong style={{ color: "#1b5e20" }}>{billResult.totalAmount} TL</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#666" }}>
              <span>Son Ödeme Tarihi:</span>
              <span>{billResult.dueDate}</span>
            </div>

            {/* PDF İndirme Linki */}
            {billResult.pdfUrl && (
              <div style={{ marginTop: "10px", textAlign: "center" }}>
                <a
                  href={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${billResult.pdfUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-block",
                    padding: "8px 16px",
                    backgroundColor: "#1976d2",
                    color: "white",
                    textDecoration: "none",
                    borderRadius: "4px",
                    fontWeight: "bold"
                  }}
                >
                  📄 Faturayı İndir (PDF)
                </a>
              </div>
            )}
          </div>

          <h5 style={{ marginTop: "20px", marginBottom: "10px" }}>💳 Ödeme Kanalları</h5>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <a href="https://www.turkiye.gov.tr" target="_blank" rel="noopener noreferrer"
              style={{ color: "#1976d2", textDecoration: "none" }}>
              🌐 e-Devlet Kapısı
            </a>
            <a href="https://ebelediye.gov.tr" target="_blank" rel="noopener noreferrer"
              style={{ color: "#1976d2", textDecoration: "none" }}>
              🏛️ e-Belediye Portalı
            </a>
            <span style={{ color: "#666" }}>🏧 ATM ve Banka Şubeleri</span>
            <span style={{ color: "#666" }}>📱 Belediye Mobil Uygulaması</span>
          </div>

          <button
            onClick={() => setBillResult(null)}
            style={{
              marginTop: "15px",
              padding: "10px 20px",
              backgroundColor: "#4caf50",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer"
            }}
          >
            ✅ Tamam
          </button>
        </div>
      )}

      {/* Manuel Giriş Modu */}
      {showManualEntry && (
        <div style={{
          padding: "20px",
          backgroundColor: "#fff3e0",
          borderRadius: "8px",
          marginBottom: "15px",
          border: "2px solid #ff9800"
        }}>
          <h4 style={{ color: "#e65100", marginTop: 0 }}>
            📝 Manuel Sayaç Girişi
          </h4>
          <p style={{ fontSize: "14px", color: "#666", marginBottom: "15px" }}>
            Fotoğraftan sayaç okunamadı. Lütfen sayaç bilgilerini manuel olarak girin.
            <br />
            <strong style={{ color: "#e65100" }}>⚠️ Manuel girişler fiziksel kontrol için işaretlenir.</strong>
          </p>

          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>
              Sayaç Numarası:
            </label>
            <input
              type="text"
              value={manualMeterNumber}
              onChange={(e) => setManualMeterNumber(e.target.value)}
              placeholder="Örn: 12345678"
              style={{
                width: "100%",
                padding: "10px",
                fontSize: "16px",
                borderRadius: "4px",
                border: "1px solid #ccc"
              }}
            />
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>
              Güncel Tüketim Değeri (m³):
            </label>
            <input
              type="number"
              value={manualConsumption}
              onChange={(e) => setManualConsumption(e.target.value)}
              placeholder="Örn: 1234.56"
              step="0.01"
              min="0"
              style={{
                width: "100%",
                padding: "10px",
                fontSize: "16px",
                borderRadius: "4px",
                border: "1px solid #ccc"
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={handleManualSubmit}
              disabled={loading}
              style={{
                flex: 1,
                padding: "12px",
                backgroundColor: "#ff9800",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: "16px"
              }}
            >
              {loading ? "⏳ Gönderiliyor..." : "📤 Manuel Girişi Gönder"}
            </button>
            <button
              onClick={cancelManualEntry}
              disabled={loading}
              style={{
                padding: "12px 20px",
                backgroundColor: "#9e9e9e",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "16px"
              }}
            >
              ❌ İptal
            </button>
          </div>
        </div>
      )}

      {/* Yanlış Sayaç Uyarısı - OCR deneme hakkını tüketmez! */}
      {meterMismatch && (
        <div style={{
          padding: "20px",
          backgroundColor: "#ffebee",
          borderRadius: "8px",
          marginBottom: "15px",
          border: "2px solid #f44336"
        }}>
          <h4 style={{ color: "#c62828", marginTop: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            🚫 {meterMismatch.message}
          </h4>
          <p style={{ fontSize: "14px", color: "#666", marginBottom: "10px" }}>
            {meterMismatch.details}
          </p>
          <p style={{ fontSize: "14px", color: "#2196f3", fontWeight: "bold", marginBottom: "15px" }}>
            💡 {meterMismatch.suggestion}
          </p>
          <p style={{ fontSize: "12px", color: "#4caf50", marginBottom: "15px" }}>
            ✅ Bu hata deneme hakkınızı tüketmez. Doğru sayacın fotoğrafını çekebilirsiniz.
          </p>
          <button
            onClick={() => {
              setMeterMismatch(null);
              setImage(null);
            }}
            style={{
              padding: "10px 20px",
              backgroundColor: "#2196f3",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px"
            }}
          >
            📷 Tekrar Fotoğraf Çek
          </button>
        </div>
      )}

      {!account && (
        <div style={{ padding: "10px", backgroundColor: "#fff3cd", borderRadius: "4px", marginBottom: "10px" }}>
          ⚠️ Lütfen önce cüzdanınızı bağlayın
        </div>
      )}

      {/* Kamera Görüntüsü + Sayaç Çerçevesi */}
      {showCamera && (
        <div style={{ marginBottom: "15px", textAlign: "center" }}>
          {/* Kamera Container - Relative positioning for overlay */}
          <div style={{
            position: "relative",
            display: "inline-block",
            maxWidth: "400px",
            width: "100%"
          }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              style={{
                width: "100%",
                borderRadius: "8px",
                border: "3px solid #2196f3"
              }}
            />

            {/* Sayaç Hizalama Çerçevesi Overlay */}
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "80%",
              height: "35%",
              border: "3px dashed #4caf50",
              borderRadius: "8px",
              pointerEvents: "none",
              boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.3)"
            }}>
              {/* Çerçeve İçi Köşe İşaretleri */}
              <div style={{
                position: "absolute",
                top: "-2px",
                left: "-2px",
                width: "20px",
                height: "20px",
                borderTop: "4px solid #4caf50",
                borderLeft: "4px solid #4caf50",
                borderRadius: "4px 0 0 0"
              }} />
              <div style={{
                position: "absolute",
                top: "-2px",
                right: "-2px",
                width: "20px",
                height: "20px",
                borderTop: "4px solid #4caf50",
                borderRight: "4px solid #4caf50",
                borderRadius: "0 4px 0 0"
              }} />
              <div style={{
                position: "absolute",
                bottom: "-2px",
                left: "-2px",
                width: "20px",
                height: "20px",
                borderBottom: "4px solid #4caf50",
                borderLeft: "4px solid #4caf50",
                borderRadius: "0 0 0 4px"
              }} />
              <div style={{
                position: "absolute",
                bottom: "-2px",
                right: "-2px",
                width: "20px",
                height: "20px",
                borderBottom: "4px solid #4caf50",
                borderRight: "4px solid #4caf50",
                borderRadius: "0 0 4px 0"
              }} />
            </div>

            {/* Hizalama Yönergesi */}
            <div style={{
              position: "absolute",
              bottom: "10px",
              left: "50%",
              transform: "translateX(-50%)",
              backgroundColor: "rgba(0, 0, 0, 0.7)",
              color: "white",
              padding: "6px 12px",
              borderRadius: "16px",
              fontSize: "12px",
              fontWeight: "bold",
              pointerEvents: "none"
            }}>
              📏 Sayacı çerçeveye hizalayın
            </div>
          </div>

          <canvas ref={canvasRef} style={{ display: "none" }} />

          {/* Butonlar */}
          <div style={{ marginTop: "10px", display: "flex", gap: "10px", justifyContent: "center" }}>
            <button
              onClick={capturePhoto}
              style={{
                padding: "12px 24px",
                backgroundColor: "#4caf50",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "16px"
              }}
            >
              📷 Fotoğraf Çek
            </button>
            <button
              onClick={stopCamera}
              style={{
                padding: "12px 24px",
                backgroundColor: "#f44336",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "16px"
              }}
            >
              ❌ İptal
            </button>
          </div>
        </div>
      )}

      {/* Kamera Başlat Butonu */}
      {!showCamera && (
        <div style={{ marginBottom: "15px" }}>
          <button
            onClick={startCamera}
            disabled={loading}
            style={{
              padding: "12px 24px",
              backgroundColor: "#2196f3",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
              fontSize: "16px"
            }}
          >
            📷 Kamerayı Aç
          </button>

          {/* Manuel Giriş Butonu - hemen erişilebilir */}
          <button
            onClick={() => setShowManualEntry(true)}
            disabled={loading || showManualEntry}
            style={{
              marginLeft: "10px",
              padding: "12px 24px",
              backgroundColor: "#ff9800",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
              fontSize: "16px"
            }}
          >
            📝 Manuel Giriş
          </button>

          {/* Uyarı Mesajları */}
          <div style={{
            marginTop: "12px",
            padding: "12px",
            backgroundColor: "#fff3e0",
            borderRadius: "8px",
            border: "1px solid #ffcc80"
          }}>
            <p style={{ margin: "0 0 8px 0", color: "#e65100", fontWeight: "bold", fontSize: "14px" }}>
              ⚠️ Önemli Uyarılar:
            </p>
            <ul style={{ margin: 0, paddingLeft: "20px", color: "#666", fontSize: "13px" }}>
              <li>Fotoğraf yüklemesi tercih edilir (daha hızlı onay)</li>
              <li>Manuel giriş fiziksel kontrol için işaretlenir</li>
              <li>Sayaç numarası net görünür olmalıdır</li>
            </ul>
          </div>
        </div>
      )}

      {/* Kamera Hatası */}
      {cameraError && (
        <div style={{
          padding: "10px",
          backgroundColor: "#ffebee",
          color: "#c62828",
          borderRadius: "4px",
          marginBottom: "10px",
          border: "1px solid #ef5350"
        }}>
          ⚠️ {cameraError}
        </div>
      )}

      {image && (
        <div style={{ marginBottom: "10px", padding: "10px", backgroundColor: "#e8f5e9", borderRadius: "4px" }}>
          ✅ Fotoğraf hazır: {image.name} ({(image.size / 1024 / 1024).toFixed(2)} MB)
        </div>
      )}

      <button
        onClick={() => handleSubmit(false)}
        disabled={loading || !image || !account}
        style={{
          marginTop: "10px",
          padding: "12px 24px",
          backgroundColor: loading ? "#ccc" : "#4caf50",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: loading || !image || !account ? "not-allowed" : "pointer",
          fontSize: "16px"
        }}
      >
        {loading ? "⏳ İşleniyor..." : "🚀 Gönder ve Analiz Et"}
      </button>

      {/* Consumption Drop Confirmation Dialog */}
      {showConfirmationDialog && consumptionWarning && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: "white",
            padding: "24px",
            borderRadius: "12px",
            maxWidth: "400px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
          }}>
            <h3 style={{ color: "#ff9800", marginBottom: "16px" }}>
              ⚠️ Düşük Tüketim Uyarısı
            </h3>
            <p style={{ marginBottom: "12px" }}>
              {consumptionWarning.message}
            </p>
            <div style={{
              backgroundColor: "#fff3e0",
              padding: "12px",
              borderRadius: "8px",
              marginBottom: "16px"
            }}>
              <p style={{ margin: "4px 0" }}>
                📊 Mevcut tüketim: <strong>{consumptionWarning.currentConsumption} m³</strong>
              </p>
              <p style={{ margin: "4px 0" }}>
                📈 Ortalama tüketim: <strong>{consumptionWarning.averageConsumption?.toFixed(1)} m³</strong>
              </p>
              <p style={{ margin: "4px 0", color: "#e65100" }}>
                📉 Düşüş: <strong>%{consumptionWarning.dropPercent}</strong>
              </p>
            </div>
            <p style={{ marginBottom: "20px", color: "#666", fontSize: "14px" }}>
              Bu bilginin doğru olduğundan emin misiniz? Yanlış beyan durumunda cezai işlem uygulanabilir.
            </p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={handleCancelSubmission}
                style={{
                  flex: 1,
                  padding: "12px",
                  backgroundColor: "#9e9e9e",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer"
                }}
              >
                ❌ İptal Et
              </button>
              <button
                onClick={handleConfirmLowConsumption}
                style={{
                  flex: 1,
                  padding: "12px",
                  backgroundColor: "#ff9800",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer"
                }}
              >
                ✅ Evet, Onaylıyorum
              </button>
            </div>
          </div>
        </div>
      )}

      {status && (
        <p style={{
          marginTop: "10px",
          color: status.includes("❌") ? "#f44336" : status.includes("⚠️") ? "#ff9800" : "#4caf50"
        }}>
          {status}
        </p>
      )}

      {error && (
        <div style={{
          marginTop: "10px",
          padding: "10px",
          backgroundColor: "#ffebee",
          color: "#c62828",
          borderRadius: "4px",
          border: "1px solid #ef5350",
          whiteSpace: "pre-wrap"
        }}>
          ❌ {error}
        </div>
      )}
    </div>
  );
}
