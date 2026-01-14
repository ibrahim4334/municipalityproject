import { useState } from "react";
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

  // Consumption drop warning state
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  const [consumptionWarning, setConsumptionWarning] = useState(null);
  const [pendingSubmission, setPendingSubmission] = useState(null);

  // Camera-only file input handler
  const handleCameraCapture = (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (!allowedTypes.includes(file.type)) {
          setError("Lütfen JPEG veya PNG formatında bir resim çekin.");
          setImage(null);
          return;
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
          setError("Dosya boyutu çok büyük. Maksimum 5MB olmalıdır.");
          setImage(null);
          return;
        }

        setImage(file);
        setError(null);
        setStatus("");
        setShowConfirmationDialog(false);
        setConsumptionWarning(null);
      } catch (err) {
        setError("Fotoğraf çekilirken bir hata oluştu.");
        setImage(null);
      }
    }
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
        setError(`📷 ${data.message}\n${(data.errors || []).join(", ")}`);
        setStatus("");
        setLoading(false);
        return;
      }

      // Check for fraud detection
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

  return (
    <div style={{ border: "1px solid #ccc", padding: "20px", borderRadius: "8px" }}>
      <h3>📸 Su Sayacı Fotoğrafı Çek</h3>

      {!account && (
        <div style={{ padding: "10px", backgroundColor: "#fff3cd", borderRadius: "4px", marginBottom: "10px" }}>
          ⚠️ Lütfen önce cüzdanınızı bağlayın
        </div>
      )}

      {/* Camera-only input - no gallery option */}
      <div style={{ marginBottom: "15px" }}>
        <label
          htmlFor="camera-input"
          style={{
            display: "inline-block",
            padding: "12px 24px",
            backgroundColor: "#2196f3",
            color: "white",
            borderRadius: "8px",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1
          }}
        >
          📷 Fotoğraf Çek
        </label>
        <input
          id="camera-input"
          type="file"
          accept="image/jpeg,image/jpg,image/png"
          capture="environment"  /* Forces camera on mobile */
          onChange={handleCameraCapture}
          disabled={loading}
          style={{ display: "none" }}
        />
        <p style={{ fontSize: "12px", color: "#666", marginTop: "8px" }}>
          ⚠️ Galeriden yükleme yapılamaz. Sayacınızın fotoğrafını şimdi çekmeniz gerekmektedir.
        </p>
      </div>

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
