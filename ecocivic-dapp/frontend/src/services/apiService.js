import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const API_TIMEOUT = 30000; // 30 seconds

// Create axios instance with default config
const apiClient = axios.create({
    baseURL: API_URL,
    timeout: API_TIMEOUT,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor for error handling
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.code === 'ECONNABORTED') {
            throw new Error('Request timeout. Please try again.');
        }
        if (error.response) {
            // Server responded with error status
            const status = error.response.status;
            const message = error.response.data?.error || error.response.data?.message || 'Unknown error';
            
            if (status === 400) {
                throw new Error(`Invalid request: ${message}`);
            } else if (status === 401) {
                throw new Error('Unauthorized. Please check your credentials.');
            } else if (status === 403) {
                throw new Error('Access forbidden.');
            } else if (status === 404) {
                throw new Error('Resource not found.');
            } else if (status === 413) {
                throw new Error('File too large. Please upload a smaller image.');
            } else if (status >= 500) {
                throw new Error('Server error. Please try again later.');
            }
            throw new Error(`API Error (${status}): ${message}`);
        } else if (error.request) {
            // Request made but no response
            throw new Error('No response from server. Please check your connection.');
        } else {
            throw new Error(`Request error: ${error.message}`);
        }
    }
);

/**
 * Validate image file before upload
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

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
        throw new Error('File too large. Maximum size is 10MB.');
    }

    if (file.size === 0) {
        throw new Error('File is empty.');
    }

    return true;
}

/**
 * Water meter photo validation with AI
 */
export const validateWaterMeter = async (imageFile, walletAddress) => {
    // Validate inputs
    validateImageFile(imageFile);

    if (walletAddress && !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
        throw new Error('Invalid wallet address format');
    }

    const formData = new FormData();
    formData.append('image', imageFile);
    
    if (walletAddress) {
        formData.append('wallet_address', walletAddress);
    }

    try {
        const response = await apiClient.post('/api/water/validate', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            timeout: 60000, // 60 seconds for AI processing
        });

        // Validate response structure
        if (!response.data || typeof response.data !== 'object') {
            throw new Error('Invalid response from server');
        }

        return response.data;
    } catch (error) {
        // Re-throw with better error message
        if (error.message) {
            throw error;
        }
        throw new Error(`Failed to validate water meter: ${error.message}`);
    }
};
