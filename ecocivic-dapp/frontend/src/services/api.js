import axios from "axios";

/**
 * Backend API base URL
 * .env dosyasından gelir
 * Örn: VITE_API_BASE_URL=http://localhost:8000
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

if (!import.meta.env.VITE_API_BASE_URL) {
  // Deploy öncesi yanlış konfigürasyonu hızlı fark etmek için
  // eslint-disable-next-line no-console
  console.warn(
    "[EcoCivic] VITE_API_BASE_URL tanımlı değil. Default: http://localhost:8000 kullanılıyor."
  );
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Tüm axios hatalarını tek bir yerde normalize et
    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new Error('Request timeout. Please try again.'));
    }

    const status = error.response?.status;
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      "Beklenmeyen bir ağ hatası oluştu.";

    // Detaylı hata mesajları
    let customError;
    if (status === 400) {
      customError = `Invalid request: ${message}`;
    } else if (status === 401) {
      customError = 'Unauthorized. Please check your credentials.';
    } else if (status === 413) {
      customError = 'File too large. Please upload a smaller image.';
    } else if (status >= 500) {
      customError = 'Server error. Please try again later.';
    } else {
      customError = status ? `API error (${status}): ${message}` : `API error: ${message}`;
    }

    // eslint-disable-next-line no-console
    console.error("[EcoCivic API Error]", status, message);

    return Promise.reject(new Error(customError));
  }
);

/**
 * Validate image file before upload
 * @param {File} file 
 */
function validateImageFile(file) {
  if (!file) {
    throw new Error('No file provided');
  }

  // Check file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid file type. Please upload a JPEG, PNG, or WebP image.');
  }

  // Check file size (max 5MB to match backend)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    throw new Error('File too large. Maximum size is 5MB.');
  }

  if (file.size === 0) {
    throw new Error('File is empty.');
  }

  return true;
}

/**
 * Water Meter Photo Upload (AI Verification)
 * @param {File} imageFile
 * @param {string} walletAddress
 * @param {boolean} userConfirmed - Set to true if user confirmed low consumption warning
 */
export const uploadWaterMeterPhoto = async (imageFile, walletAddress, userConfirmed = false) => {
  validateImageFile(imageFile);

  if (walletAddress && !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    throw new Error('Invalid wallet address format');
  }

  const formData = new FormData();
  formData.append("image", imageFile);
  if (walletAddress) {
    formData.append("wallet_address", walletAddress);
  }
  // Include user confirmation flag for consumption drop warnings
  formData.append("user_confirmed", userConfirmed ? "true" : "false");

  const response = await api.post("/api/water/validate", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    timeout: 60000, // AI processing might take time
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
  const response = await api.post("/api/recycling/validate", { // Endpoint updated to match backend app.py
    material_type: materialType,
    qr_token: qrToken,
    wallet_address: walletAddress,
  });

  return response.data;
};

/**
 * Recycling reward verification (Optional / if needed)
 */
export const verifyRecyclingReward = async (qrToken) => {
  const response = await api.get(`/api/recycling/verify/${qrToken}`);
  return response.data;
};

// Backwards compatibility for code using validateWaterMeter
export const validateWaterMeter = uploadWaterMeterPhoto;

export default api;
