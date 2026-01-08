import { useState, useEffect } from "react";
import QRCode from "qrcode.react";
import { getContract, sendTransaction } from "../services/web3";
import { useWallet } from "../context/WalletContext";
import RecyclingRewardsABI from "../abi/RecyclingRewards.json";

const RECYCLING_CONTRACT_ADDRESS = import.meta.env.VITE_RECYCLING_REWARDS_ADDRESS || "";
const QR_EXPIRY_HOURS = 3;

export default function RecyclingQR() {
  const { account, signer } = useWallet();
  const [material, setMaterial] = useState("Glass");
  const [amount, setAmount] = useState(1);
  const [qrData, setQrData] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState(null);
  const [isExpired, setIsExpired] = useState(false);

  // Check QR expiry periodically
  useEffect(() => {
    if (!qrData || !expiresAt) return;

    const checkExpiry = () => {
      if (Date.now() > qrData.expiresAt) {
        setIsExpired(true);
        setStatus("⚠️ QR kodu süresi doldu. Lütfen yeni bir QR oluşturun.");
      }
    };

    const interval = setInterval(checkExpiry, 60000); // Check every minute
    checkExpiry(); // Initial check

    return () => clearInterval(interval);
  }, [qrData, expiresAt]);

  const generateQR = () => {
    // Validate inputs
    if (!material || !["Glass", "Paper", "Metal"].includes(material)) {
      setError("Geçerli bir malzeme tipi seçin");
      return;
    }

    if (!amount || amount < 1 || amount > 1000) {
      setError("Miktar 1-1000 kg arasında olmalıdır");
      return;
    }

    try {
      const uuid = crypto.randomUUID();
      const expiry = Date.now() + QR_EXPIRY_HOURS * 60 * 60 * 1000;

      const payload = {
        id: uuid,
        material,
        amount,
        expiresAt: expiry,
        timestamp: Date.now(),
      };

      setQrData(payload);
      setExpiresAt(new Date(expiry).toLocaleString());
      setIsExpired(false);
      setStatus("QR kodu oluşturuldu. Geri dönüşüm merkezine götürün.");
      setError(null);
    } catch (err) {
      setError("QR kodu oluşturulurken bir hata oluştu");
      console.error(err);
    }
  };

  /**
   * ⚠️ MVP için manuel tetik
   * Gerçekte bu çağrı backend tarafından yapılmalı
   */
  const simulateApproval = async () => {
    if (!account || !signer) {
      setError("Lütfen önce cüzdanınızı bağlayın");
      return;
    }

    if (!RECYCLING_CONTRACT_ADDRESS || RECYCLING_CONTRACT_ADDRESS === "0xYOUR_RECYCLING_CONTRACT") {
      setError("Recycling Rewards kontrat adresi yapılandırılmamış");
      return;
    }

    if (!qrData) {
      setError("Önce bir QR kodu oluşturun");
      return;
    }

    if (isExpired) {
      setError("QR kodu süresi dolmuş. Lütfen yeni bir QR oluşturun.");
      return;
    }

    if (Date.now() > qrData.expiresAt) {
      setError("QR kodu süresi dolmuş");
      setIsExpired(true);
      return;
    }

    setStatus("Geri dönüşüm onaylanıyor...");
    setError(null);

    try {
      const contract = getContract(
        RECYCLING_CONTRACT_ADDRESS,
        RecyclingRewardsABI.abi || RecyclingRewardsABI
      );

      const materialEnum = {
        Glass: 0,
        Paper: 1,
        Metal: 2,
      };

      const userAddress = await signer.getAddress();

      // Validate amount
      if (amount <= 0 || amount > 1000) {
        throw new Error("Geçersiz miktar");
      }

      // Send transaction safely
      const tx = await sendTransaction(
        contract.rewardRecycling,
        userAddress,
        materialEnum[material],
        amount,
        qrData.id
      );

      setStatus("Transaction gönderildi, onay bekleniyor...");

      const receipt = await tx.wait();

      if (receipt.status === 1) {
        setStatus("♻️ Geri dönüşüm onaylandı. BELT ödülü alındı!");
        // Reset QR after successful approval
        setQrData(null);
        setExpiresAt(null);
      } else {
        throw new Error("Transaction başarısız oldu");
      }
    } catch (err) {
      console.error("Recycling approval error:", err);
      
      let errorMessage = "Onay sırasında bir hata oluştu";
      
      if (err.message) {
        if (err.message.includes("rejected")) {
          errorMessage = "İşlem kullanıcı tarafından reddedildi";
        } else if (err.message.includes("insufficient funds") || err.message.includes("balance")) {
          errorMessage = "Yetersiz bakiye. Lütfen gas ücreti için yeterli ETH olduğundan emin olun";
        } else if (err.message.includes("onlyOwner") || err.message.includes("Ownable")) {
          errorMessage = "Bu işlem sadece kontrat sahibi tarafından yapılabilir";
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      setStatus("");
    }
  };

  return (
    <div style={{ padding: "20px", border: "1px solid #ddd", borderRadius: "8px" }}>
      <h3>Geri Dönüşüm QR Kodu</h3>

      {!account && (
        <div style={{ padding: "10px", backgroundColor: "#fff3cd", borderRadius: "4px", marginBottom: "10px" }}>
          ⚠️ Lütfen önce cüzdanınızı bağlayın
        </div>
      )}

      <div style={{ marginBottom: "15px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Malzeme Tipi</label>
        <select 
          value={material} 
          onChange={(e) => {
            setMaterial(e.target.value);
            setError(null);
          }}
          style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
        >
          <option value="Glass">Cam</option>
          <option value="Paper">Kağıt</option>
          <option value="Metal">Metal</option>
        </select>
      </div>

      <div style={{ marginBottom: "15px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Miktar (kg)</label>
        <input
          type="number"
          min="1"
          max="1000"
          value={amount}
          onChange={(e) => {
            const val = Number(e.target.value);
            if (val >= 1 && val <= 1000) {
              setAmount(val);
              setError(null);
            }
          }}
          style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
        />
      </div>

      <button 
        onClick={generateQR}
        style={{
          padding: "10px 20px",
          backgroundColor: "#4caf50",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          marginBottom: "15px"
        }}
      >
        QR Kodu Oluştur
      </button>

      {qrData && (
        <div style={{ marginTop: "20px", textAlign: "center" }}>
          <p style={{ color: isExpired ? "#f44336" : "#4caf50", fontWeight: "bold" }}>
            {isExpired ? "⚠️ Süresi Doldu" : `Geçerli: ${expiresAt}`}
          </p>
          <div style={{ display: "flex", justifyContent: "center", margin: "15px 0" }}>
            <QRCode value={JSON.stringify(qrData)} size={200} />
          </div>
          <button 
            onClick={simulateApproval}
            disabled={isExpired || !account}
            style={{
              padding: "10px 20px",
              backgroundColor: isExpired || !account ? "#ccc" : "#2196f3",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: isExpired || !account ? "not-allowed" : "pointer"
            }}
          >
            Geri Dönüşümü Onayla
          </button>
        </div>
      )}

      {status && (
        <p style={{ 
          marginTop: "15px", 
          color: status.includes("❌") || status.includes("⚠️") ? "#f44336" : "#4caf50",
          fontWeight: "bold"
        }}>
          {status}
        </p>
      )}

      {error && (
        <div style={{ 
          marginTop: "15px", 
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
