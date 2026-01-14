import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useWallet } from "../context/WalletContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

/**
 * Inspection Form - Fiziksel Kontrol Sonuç Formu
 * Inspector tarafından kontrol tamamlama arayüzü
 */
export default function InspectionForm() {
    const { inspectionId } = useParams();
    const navigate = useNavigate();
    const { account } = useWallet();

    const [inspection, setInspection] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // Form state
    const [actualReading, setActualReading] = useState("");
    const [fraudFound, setFraudFound] = useState(false);
    const [notes, setNotes] = useState("");

    // Result
    const [result, setResult] = useState(null);

    useEffect(() => {
        loadInspection();
    }, [inspectionId]);

    const loadInspection = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_URL}/api/inspection/${inspectionId}`, {
                headers: { "X-Wallet-Address": account }
            });
            const data = await res.json();

            if (data.success) {
                setInspection(data.inspection);
            } else {
                setError(data.message || "Kontrol bulunamadı");
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!actualReading || isNaN(actualReading)) {
            setError("Lütfen geçerli bir sayaç okuması girin");
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const res = await fetch(`${API_URL}/api/inspection/complete`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Wallet-Address": account
                },
                body: JSON.stringify({
                    inspection_id: parseInt(inspectionId),
                    inspector_wallet: account,
                    actual_reading: parseInt(actualReading),
                    fraud_found: fraudFound,
                    notes: notes
                })
            });

            const data = await res.json();

            if (data.success) {
                setResult(data);
                setSuccess("Kontrol başarıyla tamamlandı!");
            } else {
                setError(data.message || "Kontrol tamamlanamadı");
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div style={styles.container}>
                <div style={styles.loading}>⏳ Yükleniyor...</div>
            </div>
        );
    }

    if (!inspection) {
        return (
            <div style={styles.container}>
                <div style={styles.error}>❌ Kontrol bulunamadı</div>
                <button onClick={() => navigate("/staff")} style={styles.backBtn}>
                    ← Geri Dön
                </button>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <h2>🔍 Fiziksel Kontrol #{inspectionId}</h2>

            <button onClick={() => navigate("/staff")} style={styles.backBtn}>
                ← Personel Paneline Dön
            </button>

            {/* Inspection Info */}
            <div style={styles.infoCard}>
                <h3>📋 Kontrol Bilgileri</h3>
                <div style={styles.infoGrid}>
                    <div>
                        <label>Sayaç No:</label>
                        <span>{inspection.meter_no}</span>
                    </div>
                    <div>
                        <label>Cüzdan:</label>
                        <span>{inspection.wallet_address?.slice(0, 15)}...</span>
                    </div>
                    <div>
                        <label>Planlanan Tarih:</label>
                        <span>{new Date(inspection.scheduled_date).toLocaleDateString("tr-TR")}</span>
                    </div>
                    <div>
                        <label>Durum:</label>
                        <span style={styles.status}>{inspection.status}</span>
                    </div>
                </div>
            </div>

            {/* Messages */}
            {error && <div style={styles.errorMsg}>❌ {error}</div>}
            {success && <div style={styles.successMsg}>✅ {success}</div>}

            {/* Result Display */}
            {result && (
                <div style={result.fraud_found ? styles.fraudResult : styles.normalResult}>
                    <h3>{result.fraud_found ? "🚨 FRAUD TESPİT EDİLDİ" : "✅ Kontrol Tamamlandı"}</h3>

                    <div style={styles.resultGrid}>
                        <div>
                            <label>Bildirilen Okuma:</label>
                            <span>{result.reported_reading} m³</span>
                        </div>
                        <div>
                            <label>Gerçek Okuma:</label>
                            <span>{result.actual_reading} m³</span>
                        </div>
                        <div>
                            <label>Fark:</label>
                            <span style={{ color: result.fraud_found ? "#f44336" : "#4caf50" }}>
                                {result.actual_reading - result.reported_reading} m³
                            </span>
                        </div>
                    </div>

                    {result.fraud_found && (
                        <div style={styles.penaltyInfo}>
                            <h4>💰 Ceza Bilgileri</h4>
                            <p><strong>Depozito Cezası:</strong> {result.penalty_amount} TL</p>
                            <p><strong>Eksik Ödeme:</strong> {result.underpayment} TL</p>
                            <p><strong>Faiz:</strong> {result.interest} TL</p>
                            <p><strong>Toplam:</strong> {result.underpayment + result.interest + result.penalty_amount} TL</p>
                            {result.transaction_hash && (
                                <p style={styles.txHash}>
                                    <strong>TX:</strong> {result.transaction_hash.slice(0, 20)}...
                                </p>
                            )}
                        </div>
                    )}

                    <button onClick={() => navigate("/staff")} style={styles.primaryBtn}>
                        Panele Dön
                    </button>
                </div>
            )}

            {/* Form - only show if not completed */}
            {!result && inspection.status === "pending" && (
                <form onSubmit={handleSubmit} style={styles.form}>
                    <h3>📝 Kontrol Sonucu Gir</h3>

                    {/* Actual Reading */}
                    <div style={styles.formGroup}>
                        <label htmlFor="actualReading">Gerçek Sayaç Okuması (m³) *</label>
                        <input
                            id="actualReading"
                            type="number"
                            value={actualReading}
                            onChange={(e) => setActualReading(e.target.value)}
                            placeholder="Örn: 12345"
                            required
                            style={styles.input}
                        />
                    </div>

                    {/* Fraud Found */}
                    <div style={styles.formGroup}>
                        <label style={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                checked={fraudFound}
                                onChange={(e) => setFraudFound(e.target.checked)}
                                style={styles.checkbox}
                            />
                            <span style={{ marginLeft: "10px" }}>🚨 Fraud Tespit Edildi</span>
                        </label>
                        {fraudFound && (
                            <p style={styles.fraudWarning}>
                                ⚠️ Fraud işaretlenirse kullanıcının depozitosunun %100'ü kesilecek ve eksik ödeme + faiz hesaplanacaktır.
                            </p>
                        )}
                    </div>

                    {/* Notes */}
                    <div style={styles.formGroup}>
                        <label htmlFor="notes">Notlar</label>
                        <textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Kontrol sırasında görülen notlar..."
                            rows={4}
                            style={styles.textarea}
                        />
                    </div>

                    {/* Submit Buttons */}
                    <div style={styles.buttonGroup}>
                        <button
                            type="button"
                            onClick={() => navigate("/staff")}
                            style={styles.cancelBtn}
                            disabled={submitting}
                        >
                            İptal
                        </button>
                        <button
                            type="submit"
                            style={fraudFound ? styles.fraudBtn : styles.submitBtn}
                            disabled={submitting}
                        >
                            {submitting ? "⏳ İşleniyor..." : (fraudFound ? "🚨 Fraud ile Tamamla" : "✅ Kontrolü Tamamla")}
                        </button>
                    </div>
                </form>
            )}

            {/* Already completed */}
            {inspection.status !== "pending" && !result && (
                <div style={styles.completedInfo}>
                    <p>Bu kontrol daha önce tamamlanmış.</p>
                    <p><strong>Durum:</strong> {inspection.status}</p>
                    {inspection.actual_reading && (
                        <p><strong>Gerçek Okuma:</strong> {inspection.actual_reading} m³</p>
                    )}
                </div>
            )}
        </div>
    );
}

const styles = {
    container: {
        padding: "20px",
        maxWidth: "600px",
        margin: "0 auto",
        fontFamily: "system-ui, sans-serif"
    },
    loading: {
        textAlign: "center",
        padding: "40px",
        color: "#666"
    },
    backBtn: {
        padding: "8px 16px",
        backgroundColor: "#607d8b",
        color: "white",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
        marginBottom: "20px"
    },
    infoCard: {
        backgroundColor: "#f5f5f5",
        padding: "20px",
        borderRadius: "8px",
        marginBottom: "20px"
    },
    infoGrid: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "15px"
    },
    status: {
        padding: "4px 8px",
        backgroundColor: "#fff3e0",
        borderRadius: "4px"
    },
    form: {
        backgroundColor: "white",
        padding: "20px",
        border: "1px solid #ddd",
        borderRadius: "8px"
    },
    formGroup: {
        marginBottom: "20px"
    },
    input: {
        width: "100%",
        padding: "12px",
        border: "1px solid #ddd",
        borderRadius: "6px",
        fontSize: "16px",
        marginTop: "8px"
    },
    textarea: {
        width: "100%",
        padding: "12px",
        border: "1px solid #ddd",
        borderRadius: "6px",
        fontSize: "14px",
        marginTop: "8px",
        resize: "vertical"
    },
    checkboxLabel: {
        display: "flex",
        alignItems: "center",
        cursor: "pointer",
        fontSize: "16px"
    },
    checkbox: {
        width: "20px",
        height: "20px",
        cursor: "pointer"
    },
    fraudWarning: {
        marginTop: "10px",
        padding: "10px",
        backgroundColor: "#ffebee",
        color: "#c62828",
        borderRadius: "6px",
        fontSize: "14px"
    },
    buttonGroup: {
        display: "flex",
        gap: "15px",
        marginTop: "20px"
    },
    cancelBtn: {
        flex: 1,
        padding: "14px",
        backgroundColor: "#9e9e9e",
        color: "white",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
        fontSize: "16px"
    },
    submitBtn: {
        flex: 2,
        padding: "14px",
        backgroundColor: "#4caf50",
        color: "white",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
        fontSize: "16px"
    },
    fraudBtn: {
        flex: 2,
        padding: "14px",
        backgroundColor: "#f44336",
        color: "white",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
        fontSize: "16px"
    },
    errorMsg: {
        padding: "12px",
        backgroundColor: "#ffebee",
        color: "#c62828",
        borderRadius: "6px",
        marginBottom: "15px"
    },
    successMsg: {
        padding: "12px",
        backgroundColor: "#e8f5e9",
        color: "#2e7d32",
        borderRadius: "6px",
        marginBottom: "15px"
    },
    error: {
        padding: "20px",
        backgroundColor: "#ffebee",
        color: "#c62828",
        borderRadius: "8px",
        textAlign: "center"
    },
    fraudResult: {
        backgroundColor: "#ffebee",
        border: "2px solid #f44336",
        borderRadius: "12px",
        padding: "20px",
        marginTop: "20px"
    },
    normalResult: {
        backgroundColor: "#e8f5e9",
        border: "2px solid #4caf50",
        borderRadius: "12px",
        padding: "20px",
        marginTop: "20px"
    },
    resultGrid: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: "15px",
        margin: "20px 0"
    },
    penaltyInfo: {
        backgroundColor: "#fff",
        padding: "15px",
        borderRadius: "8px",
        marginTop: "15px"
    },
    txHash: {
        fontSize: "12px",
        color: "#666",
        wordBreak: "break-all"
    },
    primaryBtn: {
        marginTop: "20px",
        padding: "14px 28px",
        backgroundColor: "#2196f3",
        color: "white",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
        fontSize: "16px"
    },
    completedInfo: {
        backgroundColor: "#e3f2fd",
        padding: "20px",
        borderRadius: "8px",
        marginTop: "20px"
    }
};
