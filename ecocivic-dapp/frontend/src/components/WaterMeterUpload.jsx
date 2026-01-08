import { useState } from "react";
import { validateWaterMeter } from "../services/apiService";
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

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
          setError("Lütfen JPEG, PNG veya WebP formatında bir resim yükleyin.");
          setImage(null);
          return;
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
          setError("Dosya boyutu çok büyük. Maksimum 10MB olmalıdır.");
          setImage(null);
          return;
        }

        setImage(file);
        setError(null);
        setStatus("");
      } catch (err) {
        setError("Dosya seçilirken bir hata oluştu.");
        setImage(null);
      }
    }
  };

  const handleSubmit = async () => {
    if (!image) {
      setError("Lütfen bir resim seçin");
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
    setStatus("Resim yükleniyor ve analiz ediliyor...");

    try {
      // 1️⃣ AI Backend'e gönder
      const data = await validateWaterMeter(image, account);

      if (!data || typeof data !== 'object') {
        throw new Error("Geçersiz sunucu yanıtı");
      }

      if (!data.valid) {
        setStatus("❌ Tüketim anomali tespit edildi. Manuel inceleme gerekli.");
        setLoading(false);
        return;
      }

      if (!data.current_index || typeof data.current_index !== 'number') {
        throw new Error("Geçersiz sayaç okuma değeri");
      }

      setStatus("✅ AI onayı alındı. Blockchain üzerinde fatura ödeniyor...");

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
        setImage(null); // Reset form
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

  return (
    <div style={{ border: "1px solid #ccc", padding: "20px", borderRadius: "8px" }}>
      <h3>Su Sayacı Fotoğrafı Yükle</h3>

      {!account && (
        <div style={{ padding: "10px", backgroundColor: "#fff3cd", borderRadius: "4px", marginBottom: "10px" }}>
          ⚠️ Lütfen önce cüzdanınızı bağlayın
        </div>
      )}

      <input 
        type="file" 
        accept="image/jpeg,image/jpg,image/png,image/webp" 
        onChange={handleImageChange}
        disabled={loading}
        style={{ marginBottom: "10px" }}
      />

      {image && (
        <div style={{ marginBottom: "10px", fontSize: "14px", color: "#666" }}>
          Seçilen dosya: {image.name} ({(image.size / 1024 / 1024).toFixed(2)} MB)
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading || !image || !account}
        style={{ 
          marginTop: "10px",
          padding: "10px 20px",
          backgroundColor: loading ? "#ccc" : "#4caf50",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: loading || !image || !account ? "not-allowed" : "pointer"
        }}
      >
        {loading ? "İşleniyor..." : "Gönder ve Analiz Et"}
      </button>

      {status && (
        <p style={{ marginTop: "10px", color: status.includes("❌") ? "#f44336" : "#4caf50" }}>
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
          border: "1px solid #ef5350"
        }}>
          ❌ {error}
        </div>
      )}
    </div>
  );
}
