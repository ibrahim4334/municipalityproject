import { useEffect } from "react";

/**
 * ConfirmAnomalyDialog Component
 * %50+ tüketim düşüşü onay dialogu
 */
export default function ConfirmAnomalyDialog({
    isOpen,
    onClose,
    onConfirm,
    onReject,
    data
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

    const currentConsumption = data?.currentConsumption || 0;
    const averageConsumption = data?.averageConsumption || 0;
    const dropPercent = data?.dropPercent || 0;

    return (
        <div style={styles.overlay}>
            <div style={styles.dialog}>
                {/* Header */}
                <div style={styles.header}>
                    <span style={styles.icon}>⚠️</span>
                    <h2 style={styles.title}>Düşük Tüketim Uyarısı</h2>
                </div>

                {/* Body */}
                <div style={styles.body}>
                    <p style={styles.message}>
                        Bildirdiğiniz tüketim, geçmiş aylara göre <strong>%{dropPercent.toFixed(1)}</strong> daha düşük.
                    </p>

                    {/* Comparison */}
                    <div style={styles.comparison}>
                        <div style={styles.comparisonItem}>
                            <div style={styles.comparisonLabel}>Mevcut Tüketim</div>
                            <div style={styles.comparisonValue}>
                                {currentConsumption} m³
                            </div>
                        </div>
                        <div style={styles.arrow}>→</div>
                        <div style={styles.comparisonItem}>
                            <div style={styles.comparisonLabel}>Ortalama Tüketim</div>
                            <div style={styles.comparisonValue}>
                                {averageConsumption.toFixed(1)} m³
                            </div>
                        </div>
                    </div>

                    {/* Drop indicator */}
                    <div style={styles.dropIndicator}>
                        <div style={styles.dropBar}>
                            <div
                                style={{
                                    ...styles.dropFill,
                                    width: `${Math.min(100, dropPercent)}%`
                                }}
                            />
                        </div>
                        <span style={styles.dropText}>📉 %{dropPercent.toFixed(1)} Düşüş</span>
                    </div>

                    {/* Warning */}
                    <div style={styles.warning}>
                        <strong>Emin misiniz?</strong>
                        <p style={styles.warningText}>
                            Bu bilginin doğru olduğunu onaylarsanız okuma kaydedilecektir.
                            Yanlış beyan durumunda <strong>cezai işlem</strong> uygulanabilir.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div style={styles.footer}>
                    <button onClick={onReject} style={styles.rejectBtn}>
                        ❌ Hayır, Düzelt
                    </button>
                    <button onClick={onConfirm} style={styles.confirmBtn}>
                        ✅ Evet, Doğru
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
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000
    },
    dialog: {
        backgroundColor: "white",
        borderRadius: "16px",
        width: "100%",
        maxWidth: "420px",
        boxShadow: "0 4px 30px rgba(0,0,0,0.3)"
    },
    header: {
        padding: "20px",
        backgroundColor: "#ff9800",
        color: "white",
        borderRadius: "16px 16px 0 0",
        display: "flex",
        alignItems: "center",
        gap: "12px"
    },
    icon: {
        fontSize: "32px"
    },
    title: {
        margin: 0,
        fontSize: "20px"
    },
    body: {
        padding: "20px"
    },
    message: {
        margin: "0 0 20px 0",
        fontSize: "15px",
        lineHeight: 1.6
    },
    comparison: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "15px",
        marginBottom: "20px"
    },
    comparisonItem: {
        textAlign: "center",
        padding: "15px",
        backgroundColor: "#f5f5f5",
        borderRadius: "12px",
        minWidth: "100px"
    },
    comparisonLabel: {
        fontSize: "11px",
        color: "#666",
        marginBottom: "5px"
    },
    comparisonValue: {
        fontSize: "24px",
        fontWeight: "bold",
        color: "#333"
    },
    arrow: {
        fontSize: "24px",
        color: "#999"
    },
    dropIndicator: {
        marginBottom: "20px"
    },
    dropBar: {
        height: "8px",
        backgroundColor: "#e0e0e0",
        borderRadius: "4px",
        overflow: "hidden",
        marginBottom: "8px"
    },
    dropFill: {
        height: "100%",
        backgroundColor: "#f44336",
        borderRadius: "4px",
        transition: "width 0.3s ease"
    },
    dropText: {
        fontSize: "14px",
        color: "#f44336",
        fontWeight: "bold"
    },
    warning: {
        padding: "15px",
        backgroundColor: "#fff3e0",
        borderRadius: "12px",
        border: "1px solid #ffcc80"
    },
    warningText: {
        margin: "10px 0 0 0",
        fontSize: "13px",
        color: "#666",
        lineHeight: 1.5
    },
    footer: {
        padding: "15px 20px",
        borderTop: "1px solid #eee",
        display: "flex",
        gap: "12px"
    },
    rejectBtn: {
        flex: 1,
        padding: "14px",
        backgroundColor: "#9e9e9e",
        color: "white",
        border: "none",
        borderRadius: "8px",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: "bold"
    },
    confirmBtn: {
        flex: 1,
        padding: "14px",
        backgroundColor: "#ff9800",
        color: "white",
        border: "none",
        borderRadius: "8px",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: "bold"
    }
};
