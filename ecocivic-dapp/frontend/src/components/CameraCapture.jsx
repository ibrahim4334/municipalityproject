import { useState, useRef, useCallback } from "react";

/**
 * CameraCapture Component
 * Sadece kamera ile fotoğraf çekme - galeri yok
 */
export default function CameraCapture({ onCapture, disabled = false }) {
    const [preview, setPreview] = useState(null);
    const [error, setError] = useState(null);
    const inputRef = useRef(null);

    const handleCapture = useCallback((e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            // Validate file type
            const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
            if (!allowedTypes.includes(file.type)) {
                setError("Sadece JPEG veya PNG formatı kabul edilir");
                return;
            }

            // Validate file size (max 10MB)
            const maxSize = 10 * 1024 * 1024;
            if (file.size > maxSize) {
                setError("Dosya boyutu maksimum 10MB olmalıdır");
                return;
            }

            // Create preview
            const reader = new FileReader();
            reader.onload = (event) => {
                setPreview(event.target.result);
            };
            reader.readAsDataURL(file);

            setError(null);
            onCapture?.(file);
        } catch (err) {
            setError("Fotoğraf işlenirken hata oluştu");
        }
    }, [onCapture]);

    const handleRetake = () => {
        setPreview(null);
        setError(null);
        if (inputRef.current) {
            inputRef.current.value = "";
        }
    };

    return (
        <div style={styles.container}>
            {!preview ? (
                <div style={styles.captureArea}>
                    <label style={{
                        ...styles.captureButton,
                        opacity: disabled ? 0.5 : 1,
                        cursor: disabled ? "not-allowed" : "pointer"
                    }}>
                        <span style={styles.cameraIcon}>📷</span>
                        <span>Fotoğraf Çek</span>
                        <input
                            ref={inputRef}
                            type="file"
                            accept="image/jpeg,image/jpg,image/png"
                            capture="environment"
                            onChange={handleCapture}
                            disabled={disabled}
                            style={styles.hiddenInput}
                        />
                    </label>
                    <p style={styles.hint}>
                        ⚠️ Galeriden yükleme yapılamaz.<br />
                        Sayacınızın fotoğrafını şimdi çekmeniz gerekmektedir.
                    </p>
                </div>
            ) : (
                <div style={styles.previewArea}>
                    <img src={preview} alt="Sayaç fotoğrafı" style={styles.previewImage} />
                    <button onClick={handleRetake} style={styles.retakeButton}>
                        🔄 Yeniden Çek
                    </button>
                </div>
            )}

            {error && (
                <div style={styles.error}>
                    ❌ {error}
                </div>
            )}
        </div>
    );
}

const styles = {
    container: {
        marginBottom: "20px"
    },
    captureArea: {
        textAlign: "center",
        padding: "30px",
        border: "2px dashed #ccc",
        borderRadius: "12px",
        backgroundColor: "#fafafa"
    },
    captureButton: {
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "10px",
        padding: "20px 40px",
        backgroundColor: "#2196f3",
        color: "white",
        borderRadius: "12px",
        fontSize: "18px",
        fontWeight: "bold"
    },
    cameraIcon: {
        fontSize: "48px"
    },
    hiddenInput: {
        display: "none"
    },
    hint: {
        marginTop: "15px",
        fontSize: "13px",
        color: "#666",
        lineHeight: 1.6
    },
    previewArea: {
        textAlign: "center"
    },
    previewImage: {
        maxWidth: "100%",
        maxHeight: "300px",
        borderRadius: "8px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
    },
    retakeButton: {
        marginTop: "15px",
        padding: "10px 20px",
        backgroundColor: "#607d8b",
        color: "white",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
        fontSize: "14px"
    },
    error: {
        marginTop: "10px",
        padding: "10px",
        backgroundColor: "#ffebee",
        color: "#c62828",
        borderRadius: "6px",
        fontSize: "14px"
    }
};
