import { useState, useEffect } from "react";
import { useAccount } from "wagmi";

/**
 * Risk Score Dashboard
 * Kullanıcı fraud risk skor kartı görüntüleme
 */
export default function RiskScoreDashboard({ walletAddress }) {
    const { address } = useAccount();
    const [riskData, setRiskData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const userAddress = walletAddress || address;

    useEffect(() => {
        if (userAddress) {
            fetchRiskScore();
        }
    }, [userAddress]);

    const fetchRiskScore = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch(
                `${import.meta.env.VITE_API_URL}/api/risk-score/${userAddress}`
            );

            if (!response.ok) {
                throw new Error("Risk skoru alınamadı");
            }

            const data = await response.json();
            setRiskData(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getRiskLevelColor = (level) => {
        const colors = {
            low: "#4caf50",
            medium: "#ff9800",
            high: "#f44336",
            critical: "#9c27b0",
            unknown: "#9e9e9e",
        };
        return colors[level] || colors.unknown;
    };

    const getRiskLevelEmoji = (level) => {
        const emojis = {
            low: "✅",
            medium: "⚠️",
            high: "🔴",
            critical: "🚨",
            unknown: "❓",
        };
        return emojis[level] || emojis.unknown;
    };

    if (loading) {
        return (
            <div style={styles.container}>
                <div style={styles.loading}>
                    <div style={styles.spinner}></div>
                    <p>Risk skoru yükleniyor...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={styles.container}>
                <div style={styles.error}>
                    <p>❌ {error}</p>
                    <button onClick={fetchRiskScore} style={styles.retryBtn}>
                        Tekrar Dene
                    </button>
                </div>
            </div>
        );
    }

    if (!riskData) {
        return (
            <div style={styles.container}>
                <p>Risk verisi bulunamadı</p>
            </div>
        );
    }

    const riskLevel = riskData.risk_level || "unknown";
    const riskColor = getRiskLevelColor(riskLevel);

    return (
        <div style={styles.container}>
            <h2 style={styles.title}>🎯 Risk Skor Kartı</h2>

            {/* Overall Score */}
            <div style={{ ...styles.scoreCard, borderColor: riskColor }}>
                <div style={styles.scoreCircle}>
                    <div
                        style={{
                            ...styles.scoreValue,
                            color: riskColor,
                        }}
                    >
                        {riskData.overall_score || 0}
                    </div>
                    <div style={styles.scoreLabel}>/ 100</div>
                </div>
                <div style={styles.riskLevel}>
                    <span style={styles.emoji}>{getRiskLevelEmoji(riskLevel)}</span>
                    <span style={{ color: riskColor, fontWeight: "bold" }}>
                        {riskLevel.toUpperCase()}
                    </span>
                </div>
                <p style={styles.recommendation}>{riskData.recommendation}</p>
            </div>

            {/* Category Breakdown */}
            <div style={styles.categories}>
                <h3 style={styles.sectionTitle}>Kategori Detayları</h3>

                {riskData.categories && Object.entries(riskData.categories).map(([key, cat]) => (
                    <div key={key} style={styles.categoryRow}>
                        <div style={styles.categoryInfo}>
                            <span style={styles.categoryName}>
                                {getCategoryLabel(key)}
                            </span>
                            <span style={styles.categoryWeight}>
                                (Ağırlık: {(cat.weight * 100).toFixed(0)}%)
                            </span>
                        </div>
                        <div style={styles.progressContainer}>
                            <div
                                style={{
                                    ...styles.progressBar,
                                    width: `${cat.score}%`,
                                    backgroundColor: getScoreColor(cat.score),
                                }}
                            />
                        </div>
                        <span style={styles.categoryScore}>{cat.score}</span>
                    </div>
                ))}
            </div>

            {/* Top Risk Factors */}
            {riskData.top_risk_factors && riskData.top_risk_factors.length > 0 && (
                <div style={styles.riskFactors}>
                    <h3 style={styles.sectionTitle}>⚠️ Risk Faktörleri</h3>
                    {riskData.top_risk_factors.slice(0, 5).map((factor, index) => (
                        <div key={index} style={styles.factorRow}>
                            <span style={styles.factorBullet}>•</span>
                            <span style={styles.factorText}>{factor.description}</span>
                            <span style={styles.factorScore}>+{factor.score}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Refresh Button */}
            <button onClick={fetchRiskScore} style={styles.refreshBtn}>
                🔄 Yenile
            </button>

            {/* Last Updated */}
            {riskData.generated_at && (
                <p style={styles.timestamp}>
                    Son güncelleme: {new Date(riskData.generated_at).toLocaleString("tr-TR")}
                </p>
            )}
        </div>
    );
}

// Helper functions
const getCategoryLabel = (key) => {
    const labels = {
        consumption_behavior: "📊 Tüketim Davranışı",
        fraud_history: "🚨 Fraud Geçmişi",
        verification_quality: "✅ Doğrulama Kalitesi",
        account_standing: "👤 Hesap Durumu",
    };
    return labels[key] || key;
};

const getScoreColor = (score) => {
    if (score >= 80) return "#4caf50";
    if (score >= 60) return "#8bc34a";
    if (score >= 40) return "#ff9800";
    if (score >= 20) return "#ff5722";
    return "#f44336";
};

// Styles
const styles = {
    container: {
        padding: "20px",
        maxWidth: "500px",
        margin: "0 auto",
        fontFamily: "system-ui, -apple-system, sans-serif",
    },
    title: {
        textAlign: "center",
        marginBottom: "20px",
        fontSize: "24px",
    },
    loading: {
        textAlign: "center",
        padding: "40px",
    },
    spinner: {
        width: "40px",
        height: "40px",
        border: "4px solid #f3f3f3",
        borderTop: "4px solid #3498db",
        borderRadius: "50%",
        animation: "spin 1s linear infinite",
        margin: "0 auto 15px",
    },
    error: {
        textAlign: "center",
        padding: "20px",
        backgroundColor: "#ffebee",
        borderRadius: "8px",
    },
    retryBtn: {
        marginTop: "10px",
        padding: "8px 16px",
        backgroundColor: "#2196f3",
        color: "white",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
    },
    scoreCard: {
        textAlign: "center",
        padding: "30px",
        borderRadius: "16px",
        border: "3px solid",
        backgroundColor: "#f9f9f9",
        marginBottom: "20px",
    },
    scoreCircle: {
        display: "inline-block",
        marginBottom: "15px",
    },
    scoreValue: {
        fontSize: "64px",
        fontWeight: "bold",
        lineHeight: 1,
    },
    scoreLabel: {
        fontSize: "18px",
        color: "#666",
    },
    riskLevel: {
        fontSize: "18px",
        marginBottom: "10px",
    },
    emoji: {
        fontSize: "24px",
        marginRight: "8px",
    },
    recommendation: {
        color: "#666",
        fontSize: "14px",
        margin: 0,
    },
    categories: {
        marginBottom: "20px",
    },
    sectionTitle: {
        fontSize: "16px",
        marginBottom: "15px",
        color: "#333",
    },
    categoryRow: {
        display: "flex",
        alignItems: "center",
        marginBottom: "12px",
        gap: "10px",
    },
    categoryInfo: {
        width: "140px",
        flexShrink: 0,
    },
    categoryName: {
        fontSize: "13px",
        display: "block",
    },
    categoryWeight: {
        fontSize: "11px",
        color: "#999",
    },
    progressContainer: {
        flex: 1,
        height: "8px",
        backgroundColor: "#e0e0e0",
        borderRadius: "4px",
        overflow: "hidden",
    },
    progressBar: {
        height: "100%",
        borderRadius: "4px",
        transition: "width 0.3s ease",
    },
    categoryScore: {
        width: "30px",
        textAlign: "right",
        fontWeight: "bold",
        fontSize: "14px",
    },
    riskFactors: {
        backgroundColor: "#fff3e0",
        padding: "15px",
        borderRadius: "8px",
        marginBottom: "20px",
    },
    factorRow: {
        display: "flex",
        alignItems: "center",
        marginBottom: "8px",
        fontSize: "13px",
    },
    factorBullet: {
        marginRight: "8px",
        color: "#ff9800",
    },
    factorText: {
        flex: 1,
    },
    factorScore: {
        color: "#f44336",
        fontWeight: "bold",
    },
    refreshBtn: {
        width: "100%",
        padding: "12px",
        backgroundColor: "#2196f3",
        color: "white",
        border: "none",
        borderRadius: "8px",
        fontSize: "16px",
        cursor: "pointer",
        marginBottom: "10px",
    },
    timestamp: {
        textAlign: "center",
        fontSize: "12px",
        color: "#999",
        margin: 0,
    },
};
