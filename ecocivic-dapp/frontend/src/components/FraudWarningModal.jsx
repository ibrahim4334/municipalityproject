import { useEffect } from "react";

/**
 * FraudWarningModal Component
 * Fraud tespit edildiğinde gösterilen uyarı modal
 */
export default function FraudWarningModal({
    isOpen,
    onClose,
    fraudData,
    onAcknowledge
}) {
    // ESC tuşu ile kapatma
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === "Escape") onClose?.();
        };
        if (isOpen) {
            document.addEventListener("keydown", handleEsc);
        }
        return () => document.removeEventListener("keydown", handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const riskLevel = fraudData?.risk_level || "unknown";
    const fraudScore = fraudData?.fraud_score || 0;
    const anomalies = fraudData?.anomalies || [];
    const recommendation = fraudData?.recommendation || "";

    const getRiskColor = () => {
        switch (riskLevel) {
            case "critical": return "#9c27b0";
            case "high": return "#f44336";
            case "medium": return "#ff9800";
            default: return "#4caf50";
        }
    };

    const getRiskEmoji = () => {
        switch (riskLevel) {
            case "critical": return "🚨";
            case "high": return "⚠️";
            case "medium": return "⚡";
            default: return "ℹ️";
        }
    };

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div style={{ ...styles.header, backgroundColor: getRiskColor() }}>
                    <span style={styles.emoji}>{getRiskEmoji()}</span>
                    <h2 style={styles.title}>Fraud Uyarısı</h2>
                </div>

                {/* Body */}
                <div style={styles.body}>
                    {/* Score */}
                    <div style={styles.scoreSection}>
                        <div style={styles.scoreCircle}>
                            <span style={{ ...styles.scoreValue, color: getRiskColor() }}>
                                {fraudScore}
                            </span>
                            <span style={styles.scoreLabel}>Fraud Skoru</span>
                        </div>
                        <div style={{ ...styles.riskBadge, backgroundColor: getRiskColor() }}>
                            {riskLevel.toUpperCase()}
                        </div>
                    </div>

                    {/* Anomalies */}
                    {anomalies.length > 0 && (
                        <div style={styles.section}>
                            <h4 style={styles.sectionTitle}>Tespit Edilen Anormallikler</h4>
                            <ul style={styles.anomalyList}>
                                {anomalies.map((anomaly, idx) => (
                                    <li key={idx} style={styles.anomalyItem}>
                                        • {anomaly}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Recommendation */}
                    {recommendation && (
                        <div style={styles.section}>
                            <h4 style={styles.sectionTitle}>Öneri</h4>
                            <p style={styles.recommendation}>{recommendation}</p>
                        </div>
                    )}

                    {/* Warning for high risk */}
                    {(riskLevel === "critical" || riskLevel === "high") && (
                        <div style={styles.warningBox}>
                            <strong>⚠️ Dikkat:</strong> Bu işlem sonucunda fiziksel kontrol planlanabilir
                            ve depozitonuzdan kesinti uygulanabilir.
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={styles.footer}>
                    <button onClick={onClose} style={styles.cancelBtn}>
                        Kapat
                    </button>
                    <button onClick={onAcknowledge} style={styles.acknowledgeBtn}>
                        Anladım, Devam Et
                    </button>
                </div>
            </div>
        </div>
    );
}

const styles = {
    overlay: {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000
    },
    modal: {
        backgroundColor: "white",
        borderRadius: "16px",
        width: "100%",
        maxWidth: "450px",
        maxHeight: "90vh",
        overflow: "hidden",
        boxShadow: "0 4px 30px rgba(0,0,0,0.3)"
    },
    header: {
        padding: "20px",
        color: "white",
        display: "flex",
        alignItems: "center",
        gap: "15px"
    },
    emoji: {
        fontSize: "36px"
    },
    title: {
        margin: 0,
        fontSize: "24px"
    },
    body: {
        padding: "20px",
        overflowY: "auto"
    },
    scoreSection: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "20px"
    },
    scoreCircle: {
        textAlign: "center"
    },
    scoreValue: {
        fontSize: "48px",
        fontWeight: "bold",
        display: "block"
    },
    scoreLabel: {
        fontSize: "12px",
        color: "#666"
    },
    riskBadge: {
        padding: "8px 20px",
        color: "white",
        borderRadius: "20px",
        fontWeight: "bold",
        fontSize: "14px"
    },
    section: {
        marginBottom: "15px"
    },
    sectionTitle: {
        margin: "0 0 10px 0",
        fontSize: "14px",
        color: "#333"
    },
    anomalyList: {
        margin: 0,
        padding: 0,
        listStyle: "none"
    },
    anomalyItem: {
        padding: "8px 0",
        borderBottom: "1px solid #eee",
        fontSize: "14px",
        color: "#555"
    },
    recommendation: {
        margin: 0,
        padding: "12px",
        backgroundColor: "#e3f2fd",
        borderRadius: "8px",
        fontSize: "14px"
    },
    warningBox: {
        marginTop: "15px",
        padding: "12px",
        backgroundColor: "#fff3e0",
        borderRadius: "8px",
        fontSize: "13px",
        color: "#e65100"
    },
    footer: {
        padding: "15px 20px",
        borderTop: "1px solid #eee",
        display: "flex",
        gap: "10px"
    },
    cancelBtn: {
        flex: 1,
        padding: "12px",
        backgroundColor: "#9e9e9e",
        color: "white",
        border: "none",
        borderRadius: "8px",
        cursor: "pointer",
        fontSize: "14px"
    },
    acknowledgeBtn: {
        flex: 1,
        padding: "12px",
        backgroundColor: "#ff9800",
        color: "white",
        border: "none",
        borderRadius: "8px",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: "bold"
    }
};
