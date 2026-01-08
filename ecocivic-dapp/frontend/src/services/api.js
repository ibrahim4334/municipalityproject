import axios from "axios";

/**
 * Backend API base URL
 * .env dosyasından gelir
 *
 * Örn: VITE_API_BASE_URL=http://localhost:8000
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
  // Deploy öncesi yanlış konfigürasyonu hızlı fark etmek için
  // Konsola uyarı basıyoruz. Üretimde bu değişken mutlaka set edilmeli.
  // eslint-disable-next-line no-console
  console.warn(
    "[EcoCivic] VITE_API_BASE_URL tanımlı değil. API çağrıları başarısız olabilir."
  );
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Tüm axios hatalarını tek bir yerde normalize et
    const status = error.response?.status;
    const message =
      error.response?.data?.error ||
      error.message ||
      "Beklenmeyen bir ağ hatası oluştu.";

    // eslint-disable-next-line no-console
    console.error("[EcoCivic API Error]", status, message);

    return Promise.reject(
      new Error(
        status
          ? `API error (${status}): ${message}`
          : `API error: ${message}`
      )
    );
  }
);

/**
 * Water Meter Photo Upload (AI Verification)
 * @param {File} imageFile
 * @param {string} walletAddress
 */
export const uploadWaterMeterPhoto = async (imageFile, walletAddress) => {
  const formData = new FormData();
  formData.append("image", imageFile);
  if (walletAddress) {
    formData.append("wallet_address", walletAddress);
  }

  const response = await api.post("/api/water/validate", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
};

/**
 * Recycling declaration submit
 * @param {string} materialType  (glass | paper | metal)
 * @param {string} qrToken
 * @param {string} walletAddress
 */
export const submitRecyclingDeclaration = async (
  materialType,
  qrToken,
  walletAddress
) => {
  const response = await api.post("/api/recycling/submit", {
    material_type: materialType,
    qr_token: qrToken,
    wallet_address: walletAddress,
  });

  return response.data;
};

/**
 * Recycling reward verification
 * Backend → AI + DB kontrolü yapar
 */
export const verifyRecyclingReward = async (qrToken) => {
  const response = await api.get(`/api/recycling/verify/${qrToken}`);
  return response.data;
};

export default api;
