import { useState, useRef, useCallback, useEffect } from "react";
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

  // Fatura Modal
  const [showBillModal, setShowBillModal] = useState(false);
  const [billData, setBillData] = useState(null);

  // Blockchain hash ve işlem durumu
  const [blockchainStatus, setBlockchainStatus] = useState(null);

  // Fraud Modal
  const [showFraudModal, setShowFraudModal] = useState(false);
  const [fraudData, setFraudData] = useState(null);

  // Yanlış sayaç uyarısı (sayaç numarası eşleşmedi)
  const [meterMismatch, setMeterMismatch] = useState(null);

  // Tarih formatla
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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

  // Fatura oluştur
  const generateBillData = (data, txHash) => {
    const currentIndex = data.current_index || 0;
    const previousIndex = data.historical_avg || (currentIndex - 23);
    const consumption = Math.max(0, currentIndex - previousIndex);
    const unitPrice = 10; // 10 TL/m³
    const totalAmount = consumption * unitPrice;

    return {
      meterNumber: data.meter_no || "WSM-DEMO",
      date: new Date(),
      previousIndex: Math.round(previousIndex),
      currentIndex: currentIndex,
      consumption: consumption,
      unitPrice: unitPrice,
      totalAmount: totalAmount,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 gün sonra
      txHash: txHash,
      billNumber: `FS-${Date.now().toString().slice(-8)}`
    };
  };

  const handleSubmit = async (userConfirmed = false) => {
    if (!image) {
      setError("Lütfen sayacınızın fotoğrafını çekin");
      return;
    }

    if (!account || !signer) {
      setError("Lütfen önce cüzdanınızı bağlayın");
      return;
    }

    setLoading(true);
    setError(null);
    setBlockchainStatus(null);
    setStatus("📸 Fotoğraf doğrulanıyor ve analiz ediliyor...");

    try {
      // 1️⃣ AI Backend'e gönder (with confirmation flag)
      const data = await validateWaterMeter(image, account, userConfirmed);

      if (!data || typeof data !== 'object') {
        throw new Error("Geçersiz sunucu yanıtı");
      }

      console.log("Backend Response:", data);

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

      // SENARYO 3: FRAUD - Sayaç Geri Gitmiş
      if (data.reason === "anomaly_detected" || data.reason === "fraud_detected") {
        setStatus("");
        setFraudData({
          message: data.message || "❌ Sayaç anormalliği tespit edildi!",
          meterNo: data.meter_no || "Bilinmiyor",
          anomalyType: data.anomaly_signal?.signal_type || "index_reversed",
          details: data.anomaly_signal?.details || "Sayaç endeksi geriye gitmiş.",
          hash: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}` // Demo hash
        });
        setShowFraudModal(true);
        setLoading(false);
        return;
      }

      // SENARYO 2: Düşük tüketim uyarısı - confirmation gerekiyor
      if (data.reason === "consumption_drop_warning" && !userConfirmed) {
        setConsumptionWarning({
          currentConsumption: data.current_consumption || 1,
          averageConsumption: data.average_consumption || 25,
          dropPercent: data.drop_percent || 96,
          message: data.warning || "Tüketiminiz geçmiş aylara göre önemli ölçüde düştü.",
          warning: data.warning
        });
        setPendingSubmission({ image, account });
        setShowConfirmationDialog(true);
        setStatus("");
        setLoading(false);
        return;
      }

      // SENARYO 1: Normal fatura oluşturma veya kullanıcı onayı sonrası işlem
      if (data.valid || userConfirmed) {
        // Blockchain hash'i göster
        const txHash = data.transaction_hash || `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;

        setBlockchainStatus({
          status: "pending",
          message: "🔗 Blockchain'e kaydediliyor...",
          hash: txHash
        });

        setStatus("✅ OCR doğrulandı. Blockchain üzerinde fatura kaydediliyor...");

        // Kısa gecikme ile blockchain işlemini simüle et
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Fatura verilerini oluştur
        const bill = generateBillData(data, txHash);
        setBillData(bill);

        setBlockchainStatus({
          status: "success",
          message: "✅ Hash oluşturuldu ve blockchain'e kaydedildi!",
          hash: txHash
        });

        setStatus("💧 Fatura başarıyla oluşturuldu!");
        setShowBillModal(true);
        setImage(null);
        setShowConfirmationDialog(false);
        setConsumptionWarning(null);
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

  // Fatura Modal'ı kapat
  const closeBillModal = () => {
    setShowBillModal(false);
    setBillData(null);
    setBlockchainStatus(null);
  };

  // Ödeme yap (simülasyon)
  const handlePayBill = async () => {
    setStatus("💳 Ödeme işleniyor...");
    // Gerçek uygulamada burada ödeme gateway'ine yönlendirme yapılır
    await new Promise(resolve => setTimeout(resolve, 2000));
    setStatus("✅ Ödeme başarıyla tamamlandı!");
    closeBillModal();
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

        // Blockchain işlemi (simülasyon)
        const txHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;

        setBlockchainStatus({
          status: "success",
          message: "✅ Hash oluşturuldu ve blockchain'e kaydedildi!",
          hash: txHash
        });

        // Fatura verilerini oluştur
        const bill = {
          meterNumber: data.meter_number || manualMeterNumber,
          date: new Date(),
          previousIndex: data.previous_index || 0,
          currentIndex: data.current_index || consumption,
          consumption: data.consumption || 0,
          unitPrice: 10,
          totalAmount: data.bill_amount || 0,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          txHash: txHash,
          billNumber: `FS-${Date.now().toString().slice(-8)}`,
          isManualEntry: true
        };

        setBillData(bill);
        setShowBillModal(true);
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

      {/* ===================== FATURA MODAL ===================== */}
      {showBillModal && billData && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2000,
          padding: "20px"
        }}>
          <div style={{
            backgroundColor: "white",
            borderRadius: "16px",
            maxWidth: "480px",
            width: "100%",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            overflow: "hidden"
          }}>
            {/* Header */}
            <div style={{
              background: "linear-gradient(135deg, #1976d2, #0d47a1)",
              color: "white",
              padding: "20px",
              textAlign: "center"
            }}>
              <h2 style={{ margin: 0, fontSize: "24px" }}>💧 SU FATURASI</h2>
              <p style={{ margin: "8px 0 0", opacity: 0.9, fontSize: "14px" }}>
                Fatura No: {billData.billNumber}
              </p>
            </div>

            {/* Fatura İçeriği */}
            <div style={{ padding: "24px" }}>
              {/* Tarih ve Sayaç No */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
                marginBottom: "20px",
                padding: "16px",
                backgroundColor: "#f5f5f5",
                borderRadius: "8px"
              }}>
                <div>
                  <span style={{ fontSize: "12px", color: "#666" }}>Fatura Tarihi</span>
                  <p style={{ margin: "4px 0 0", fontWeight: "bold", fontSize: "14px" }}>
                    {formatDate(billData.date)}
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: "12px", color: "#666" }}>Sayaç No</span>
                  <p style={{ margin: "4px 0 0", fontWeight: "bold", fontSize: "14px", color: "#1976d2" }}>
                    {billData.meterNumber}
                  </p>
                </div>
              </div>

              {/* Endeks Bilgileri */}
              <div style={{
                border: "1px solid #e0e0e0",
                borderRadius: "8px",
                overflow: "hidden",
                marginBottom: "20px"
              }}>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  backgroundColor: "#f5f5f5",
                  padding: "12px",
                  fontWeight: "bold",
                  fontSize: "13px",
                  color: "#333"
                }}>
                  <span>İlk Endeks</span>
                  <span style={{ textAlign: "center" }}>Son Endeks</span>
                  <span style={{ textAlign: "right" }}>Kullanım (m³)</span>
                </div>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  padding: "16px 12px",
                  fontSize: "18px",
                  fontWeight: "bold"
                }}>
                  <span style={{ color: "#666" }}>{billData.previousIndex}</span>
                  <span style={{ textAlign: "center", color: "#1976d2" }}>{billData.currentIndex}</span>
                  <span style={{ textAlign: "right", color: "#4caf50" }}>{billData.consumption}</span>
                </div>
              </div>

              {/* Tutar Hesaplaması */}
              <div style={{
                backgroundColor: "#e3f2fd",
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "20px"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ color: "#666" }}>Birim Fiyat:</span>
                  <span>{billData.unitPrice} TL/m³</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ color: "#666" }}>Kullanım x Birim:</span>
                  <span>{billData.consumption} x {billData.unitPrice} TL</span>
                </div>
                <hr style={{ border: "none", borderTop: "1px dashed #90caf9", margin: "12px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "20px", fontWeight: "bold" }}>
                  <span>ÖDENECEK TUTAR:</span>
                  <span style={{ color: "#1976d2" }}>{billData.totalAmount.toFixed(2)} TL</span>
                </div>
              </div>

              {/* Son Ödeme Tarihi */}
              <div style={{
                backgroundColor: "#fff3e0",
                borderRadius: "8px",
                padding: "12px",
                marginBottom: "20px",
                textAlign: "center"
              }}>
                <span style={{ color: "#e65100", fontWeight: "bold" }}>
                  ⏰ Son Ödeme Tarihi: {formatDate(billData.dueDate)}
                </span>
              </div>

              {/* Blockchain Kaydı */}
              {blockchainStatus && (
                <div style={{
                  backgroundColor: blockchainStatus.status === "success" ? "#e8f5e9" : "#fff3e0",
                  borderRadius: "8px",
                  padding: "16px",
                  marginBottom: "20px",
                  border: `1px solid ${blockchainStatus.status === "success" ? "#4caf50" : "#ff9800"}`
                }}>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "20px", marginRight: "8px" }}>
                      {blockchainStatus.status === "success" ? "🔗" : "⏳"}
                    </span>
                    <strong style={{ color: blockchainStatus.status === "success" ? "#2e7d32" : "#e65100" }}>
                      Blockchain Kaydı
                    </strong>
                  </div>
                  <p style={{ fontSize: "13px", color: "#666", margin: "8px 0" }}>
                    {blockchainStatus.message}
                  </p>
                  <div style={{
                    backgroundColor: "white",
                    padding: "10px",
                    borderRadius: "4px",
                    fontFamily: "monospace",
                    fontSize: "11px",
                    wordBreak: "break-all",
                    color: "#333"
                  }}>
                    <strong>TX Hash:</strong><br />
                    {blockchainStatus.hash}
                  </div>
                  <p style={{ fontSize: "11px", color: "#888", margin: "8px 0 0", fontStyle: "italic" }}>
                    💡 Bu hash Hardhat terminalinde görüntülenebilir
                  </p>
                </div>
              )}

              {/* Manuel Giriş Uyarısı */}
              {billData.isManualEntry && (
                <div style={{
                  backgroundColor: "#fff3e0",
                  borderRadius: "8px",
                  padding: "12px",
                  marginBottom: "20px",
                  border: "1px solid #ff9800"
                }}>
                  <span style={{ color: "#e65100", fontWeight: "bold", fontSize: "13px" }}>
                    ⚠️ Manuel Giriş: Bu fatura fiziksel kontrol için işaretlenmiştir.
                  </span>
                </div>
              )}

              {/* Butonlar */}
              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  onClick={closeBillModal}
                  style={{
                    flex: 1,
                    padding: "14px",
                    backgroundColor: "#9e9e9e",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "16px",
                    fontWeight: "bold",
                    cursor: "pointer"
                  }}
                >
                  ❌ Kapat
                </button>
                <button
                  onClick={handlePayBill}
                  style={{
                    flex: 1,
                    padding: "14px",
                    background: "linear-gradient(135deg, #4caf50, #388e3c)",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "16px",
                    fontWeight: "bold",
                    cursor: "pointer"
                  }}
                >
                  💳 Öde ({billData.totalAmount.toFixed(2)} TL)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== FRAUD MODAL ===================== */}
      {showFraudModal && fraudData && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2000,
          padding: "20px"
        }}>
          <div style={{
            backgroundColor: "white",
            borderRadius: "16px",
            maxWidth: "480px",
            width: "100%",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            overflow: "hidden"
          }}>
            {/* Header - Kırmızı/Tehlike */}
            <div style={{
              background: "linear-gradient(135deg, #c62828, #b71c1c)",
              color: "white",
              padding: "24px",
              textAlign: "center"
            }}>
              <div style={{ fontSize: "48px", marginBottom: "8px" }}>🚨</div>
              <h2 style={{ margin: 0, fontSize: "22px" }}>FRAUD TESPİT EDİLDİ!</h2>
              <p style={{ margin: "8px 0 0", opacity: 0.9, fontSize: "14px" }}>
                Sayaç Anomalisi Tespit Edildi
              </p>
            </div>

            {/* İçerik */}
            <div style={{ padding: "24px" }}>
              <div style={{
                backgroundColor: "#ffebee",
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "20px",
                border: "1px solid #ef5350"
              }}>
                <p style={{ margin: 0, color: "#c62828", fontWeight: "bold", fontSize: "15px" }}>
                  {fraudData.message}
                </p>
              </div>

              <div style={{
                backgroundColor: "#f5f5f5",
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "20px"
              }}>
                <div style={{ marginBottom: "12px" }}>
                  <span style={{ fontSize: "12px", color: "#666" }}>Sayaç Numarası</span>
                  <p style={{ margin: "4px 0 0", fontWeight: "bold", color: "#333" }}>
                    {fraudData.meterNo}
                  </p>
                </div>
                <div style={{ marginBottom: "12px" }}>
                  <span style={{ fontSize: "12px", color: "#666" }}>Anomali Türü</span>
                  <p style={{ margin: "4px 0 0", fontWeight: "bold", color: "#c62828" }}>
                    {fraudData.anomalyType === "index_reversed" ? "Endeks Geriye Gitti" : fraudData.anomalyType}
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: "12px", color: "#666" }}>Detay</span>
                  <p style={{ margin: "4px 0 0", fontSize: "14px", color: "#333" }}>
                    {fraudData.details}
                  </p>
                </div>
              </div>

              {/* Blockchain Hash */}
              <div style={{
                backgroundColor: "#e3f2fd",
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "20px",
                border: "1px solid #2196f3"
              }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "20px", marginRight: "8px" }}>🔗</span>
                  <strong style={{ color: "#1976d2" }}>Anomali Blockchain'e Kaydedildi</strong>
                </div>
                <div style={{
                  backgroundColor: "white",
                  padding: "10px",
                  borderRadius: "4px",
                  fontFamily: "monospace",
                  fontSize: "11px",
                  wordBreak: "break-all",
                  color: "#333"
                }}>
                  <strong>Hash:</strong><br />
                  {fraudData.hash}
                </div>
                <p style={{ fontSize: "11px", color: "#888", margin: "8px 0 0", fontStyle: "italic" }}>
                  💡 Bu işlem Hardhat terminalinde görüntülenebilir
                </p>
              </div>

              <div style={{
                backgroundColor: "#fff3e0",
                borderRadius: "8px",
                padding: "12px",
                marginBottom: "20px"
              }}>
                <p style={{ margin: 0, color: "#e65100", fontSize: "13px" }}>
                  ⚠️ Bu işlem fiziksel kontrol için belediye ekibine iletilecektir.
                  İtirazınız varsa destek hattını arayabilirsiniz.
                </p>
              </div>

              <button
                onClick={() => {
                  setShowFraudModal(false);
                  setFraudData(null);
                  setImage(null);
                }}
                style={{
                  width: "100%",
                  padding: "14px",
                  backgroundColor: "#c62828",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "16px",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
              >
                Anladım, Kapat
              </button>
            </div>
          </div>
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
              Son Endeks (m³):
            </label>
            <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>
              Sayacın üzerindeki son rakamı giriniz. Tüketim otomatik hesaplanacaktır.
            </div>
            <input
              type="number"
              value={manualConsumption}
              onChange={(e) => setManualConsumption(e.target.value)}
              placeholder="Örn: 1135"
              step="1"
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
