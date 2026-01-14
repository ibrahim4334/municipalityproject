import { useState, useRef, useEffect } from "react";
import { Html5Qrcode } from "html5-qrcode";

/**
 * QR Tarama Bileşeni - Geri Dönüşüm için
 * Kamera ile QR kod okur ve sonucu parent'a iletir
 */
export default function QRScanner({ onScanSuccess, onScanError, onClose }) {
    const [isScanning, setIsScanning] = useState(false);
    const [error, setError] = useState(null);
    const [cameras, setCameras] = useState([]);
    const [selectedCamera, setSelectedCamera] = useState(null);
    const scannerRef = useRef(null);
    const html5QrCodeRef = useRef(null);

    useEffect(() => {
        // Kameraları listele
        Html5Qrcode.getCameras()
            .then((devices) => {
                if (devices && devices.length > 0) {
                    setCameras(devices);
                    // Arka kamerayı tercih et
                    const backCamera = devices.find(
                        (d) => d.label.toLowerCase().includes("back") ||
                            d.label.toLowerCase().includes("arka")
                    );
                    setSelectedCamera(backCamera || devices[0]);
                } else {
                    setError("Kamera bulunamadı");
                }
            })
            .catch((err) => {
                setError("Kamera erişimi reddedildi: " + err.message);
            });

        return () => {
            stopScanning();
        };
    }, []);

    const startScanning = async () => {
        if (!selectedCamera) {
            setError("Kamera seçilmedi");
            return;
        }

        try {
            setError(null);
            setIsScanning(true);

            html5QrCodeRef.current = new Html5Qrcode("qr-reader");

            await html5QrCodeRef.current.start(
                selectedCamera.id,
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                },
                (decodedText) => {
                    // QR başarıyla okundu
                    stopScanning();

                    try {
                        // JSON parse dene
                        const qrData = JSON.parse(decodedText);
                        onScanSuccess && onScanSuccess(qrData);
                    } catch {
                        // JSON değilse raw text olarak gönder
                        onScanSuccess && onScanSuccess({ raw: decodedText });
                    }
                },
                (errorMessage) => {
                    // Tarama hatası (sürekli çağrılır, ignore)
                }
            );
        } catch (err) {
            setIsScanning(false);
            setError("Tarama başlatılamadı: " + err.message);
            onScanError && onScanError(err);
        }
    };

    const stopScanning = async () => {
        if (html5QrCodeRef.current) {
            try {
                await html5QrCodeRef.current.stop();
                html5QrCodeRef.current.clear();
            } catch (err) {
                console.error("Scanner stop error:", err);
            }
        }
        setIsScanning(false);
    };

    const handleClose = () => {
        stopScanning();
        onClose && onClose();
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h3 style={styles.title}>📷 QR Kod Tara</h3>
                <button onClick={handleClose} style={styles.closeBtn}>
                    ✕
                </button>
            </div>

            {error && (
                <div style={styles.error}>
                    ❌ {error}
                </div>
            )}

            {cameras.length > 1 && (
                <div style={styles.cameraSelect}>
                    <label>Kamera: </label>
                    <select
                        value={selectedCamera?.id || ""}
                        onChange={(e) => {
                            const cam = cameras.find((c) => c.id === e.target.value);
                            setSelectedCamera(cam);
                        }}
                        disabled={isScanning}
                    >
                        {cameras.map((cam) => (
                            <option key={cam.id} value={cam.id}>
                                {cam.label || cam.id}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            <div id="qr-reader" ref={scannerRef} style={styles.scanner}></div>

            <div style={styles.actions}>
                {!isScanning ? (
                    <button onClick={startScanning} style={styles.startBtn}>
                        🎯 Taramayı Başlat
                    </button>
                ) : (
                    <button onClick={stopScanning} style={styles.stopBtn}>
                        ⏹️ Durdur
                    </button>
                )}
            </div>

            <p style={styles.hint}>
                Geri dönüşüm noktasındaki QR kodunu kameranıza gösterin
            </p>
        </div>
    );
}

const styles = {
    container: {
        border: "1px solid #ddd",
        borderRadius: "12px",
        padding: "20px",
        backgroundColor: "#fff",
        maxWidth: "400px",
        margin: "0 auto",
    },
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "15px",
    },
    title: {
        margin: 0,
        fontSize: "18px",
    },
    closeBtn: {
        background: "none",
        border: "none",
        fontSize: "20px",
        cursor: "pointer",
        color: "#666",
    },
    error: {
        backgroundColor: "#ffebee",
        color: "#c62828",
        padding: "10px",
        borderRadius: "6px",
        marginBottom: "15px",
    },
    cameraSelect: {
        marginBottom: "15px",
    },
    scanner: {
        width: "100%",
        minHeight: "300px",
        backgroundColor: "#000",
        borderRadius: "8px",
        overflow: "hidden",
    },
    actions: {
        marginTop: "15px",
        textAlign: "center",
    },
    startBtn: {
        backgroundColor: "#4caf50",
        color: "white",
        border: "none",
        padding: "12px 24px",
        borderRadius: "6px",
        fontSize: "16px",
        cursor: "pointer",
    },
    stopBtn: {
        backgroundColor: "#f44336",
        color: "white",
        border: "none",
        padding: "12px 24px",
        borderRadius: "6px",
        fontSize: "16px",
        cursor: "pointer",
    },
    hint: {
        textAlign: "center",
        color: "#666",
        fontSize: "14px",
        marginTop: "15px",
    },
};
