import { useState, useEffect } from "react";
import { useWallet } from "../context/WalletContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

/**
 * Staff Dashboard - Personel Arayüzü
 * - Bekleyen kontroller
 * - Kontrol planlama
 * - Fraud onay/red
 * - Risk skorları
 */
export default function StaffDashboard() {
    const { account } = useWallet();
    const [activeTab, setActiveTab] = useState("inspections");
    const [pendingInspections, setPendingInspections] = useState([]);
    const [usersDue, setUsersDue] = useState([]);
    const [pendingRecycling, setPendingRecycling] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        if (account) {
            loadData();
        }
    }, [account, activeTab]);

    const loadData = async () => {
        setLoading(true);
        try {
            if (activeTab === "inspections") {
                await loadInspections();
            } else if (activeTab === "recycling") {
                await loadPendingRecycling();
            }
        } catch (err) {
            setMessage({ type: "error", text: err.message });
        }
        setLoading(false);
    };

    const loadInspections = async () => {
        // Bekleyen kontroller
        const pendingRes = await fetch(`${API_URL}/api/inspection/pending`, {
            headers: { "X-Wallet-Address": account }
        });
        const pendingData = await pendingRes.json();
        setPendingInspections(pendingData.inspections || []);

        // Kontrol süresi dolanlar
        const dueRes = await fetch(`${API_URL}/api/inspection/users-due`, {
            headers: { "X-Wallet-Address": account }
        });
        const dueData = await dueRes.json();
        setUsersDue(dueData.users || []);
    };

    const loadPendingRecycling = async () => {
        const res = await fetch(`${API_URL}/api/recycling/pending-approvals`, {
            headers: { "X-Wallet-Address": account }
        });
        const data = await res.json();
        setPendingRecycling(data.submissions || []);
    };

    const scheduleInspection = async (walletAddress) => {
        try {
            const res = await fetch(`${API_URL}/api/inspection/schedule`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Wallet-Address": account
                },
                body: JSON.stringify({
                    user_address: walletAddress,
                    inspector_wallet: account
                })
            });
            const data = await res.json();

            if (data.success) {
                setMessage({ type: "success", text: "Kontrol planlandı" });
                loadData();
            } else {
                setMessage({ type: "error", text: data.message });
            }
        } catch (err) {
            setMessage({ type: "error", text: err.message });
        }
    };

    const approveRecycling = async (submissionId) => {
        try {
            const res = await fetch(`${API_URL}/api/recycling/approve/${submissionId}`, {
                method: "POST",
                headers: { "X-Wallet-Address": account }
            });
            const data = await res.json();

            if (data.success) {
                setMessage({ type: "success", text: `${data.reward_amount} BELT token ödülü verildi` });
                loadData();
            } else {
                setMessage({ type: "error", text: data.message });
            }
        } catch (err) {
            setMessage({ type: "error", text: err.message });
        }
    };

    const rejectRecycling = async (submissionId, reason, isFraud) => {
        const rejectReason = reason || prompt("Red sebebi:");
        if (!rejectReason) return;

        try {
            const res = await fetch(`${API_URL}/api/recycling/reject/${submissionId}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Wallet-Address": account
                },
                body: JSON.stringify({
                    reason: rejectReason,
                    is_fraud: isFraud || false
                })
            });
            const data = await res.json();

            if (data.success) {
                setMessage({ type: "success", text: "Başvuru reddedildi" });
                loadData();
            } else {
                setMessage({ type: "error", text: data.message });
            }
        } catch (err) {
            setMessage({ type: "error", text: err.message });
        }
    };

    if (!account) {
        return (
            <div style={styles.container}>
                <h2>🏛️ Personel Paneli</h2>
                <div style={styles.warning}>⚠️ Lütfen cüzdanınızı bağlayın</div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <h2>🏛️ Personel Paneli</h2>

            {/* Tabs */}
            <div style={styles.tabs}>
                <button
                    style={activeTab === "inspections" ? styles.activeTab : styles.tab}
                    onClick={() => setActiveTab("inspections")}
                >
                    🔍 Fiziksel Kontroller
                </button>
                <button
                    style={activeTab === "recycling" ? styles.activeTab : styles.tab}
                    onClick={() => setActiveTab("recycling")}
                >
                    ♻️ Geri Dönüşüm Onay
                </button>
            </div>

            {/* Message */}
            {message && (
                <div style={message.type === "error" ? styles.error : styles.success}>
                    {message.text}
                    <button onClick={() => setMessage(null)} style={styles.closeBtn}>×</button>
                </div>
            )}

            {loading && <div style={styles.loading}>⏳ Yükleniyor...</div>}

            {/* Inspections Tab */}
            {activeTab === "inspections" && !loading && (
                <div>
                    {/* Pending Inspections */}
                    <h3>📋 Bekleyen Kontroller ({pendingInspections.length})</h3>
                    {pendingInspections.length === 0 ? (
                        <p style={styles.empty}>Bekleyen kontrol yok</p>
                    ) : (
                        <div style={styles.list}>
                            {pendingInspections.map((insp) => (
                                <div key={insp.id} style={styles.card}>
                                    <div style={styles.cardHeader}>
                                        <span>ID: {insp.id}</span>
                                        <span style={styles.badge}>{insp.status}</span>
                                    </div>
                                    <p><strong>Sayaç:</strong> {insp.meter_no}</p>
                                    <p><strong>Cüzdan:</strong> {insp.wallet_address?.slice(0, 10)}...</p>
                                    <p><strong>Tarih:</strong> {new Date(insp.scheduled_date).toLocaleDateString("tr-TR")}</p>
                                    <button
                                        onClick={() => window.location.href = `/inspection/${insp.id}`}
                                        style={styles.primaryBtn}
                                    >
                                        📝 Kontrol Yap
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Users Due for Inspection */}
                    <h3 style={{ marginTop: "30px" }}>⏰ Kontrol Süresi Dolanlar ({usersDue.length})</h3>
                    {usersDue.length === 0 ? (
                        <p style={styles.empty}>Kontrol süresi dolan kullanıcı yok</p>
                    ) : (
                        <div style={styles.list}>
                            {usersDue.map((user, idx) => (
                                <div key={idx} style={styles.card}>
                                    <p><strong>Cüzdan:</strong> {user.wallet_address?.slice(0, 10)}...</p>
                                    <p><strong>Son Kontrol:</strong> {user.last_inspection || "Hiç"}</p>
                                    <p style={{ color: "#f44336" }}>
                                        <strong>Gecikme:</strong> {user.days_overdue} gün
                                    </p>
                                    <button
                                        onClick={() => scheduleInspection(user.wallet_address)}
                                        style={styles.primaryBtn}
                                    >
                                        📅 Kontrol Planla
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Recycling Tab */}
            {activeTab === "recycling" && !loading && (
                <div>
                    <h3>♻️ Onay Bekleyen Geri Dönüşümler ({pendingRecycling.length})</h3>
                    {pendingRecycling.length === 0 ? (
                        <p style={styles.empty}>Onay bekleyen başvuru yok</p>
                    ) : (
                        <div style={styles.list}>
                            {pendingRecycling.map((sub) => (
                                <div key={sub.id} style={styles.card}>
                                    <div style={styles.cardHeader}>
                                        <span>ID: {sub.id}</span>
                                        <span style={styles.badge}>{sub.waste_type}</span>
                                    </div>
                                    <p><strong>Cüzdan:</strong> {sub.wallet_address?.slice(0, 10)}...</p>
                                    <p><strong>Miktar:</strong> {sub.amount} {sub.waste_type === "electronic" ? "adet" : "kg"}</p>
                                    <p><strong>Alt Kategori:</strong> {sub.subcategory || "-"}</p>
                                    <p><strong>Tarih:</strong> {new Date(sub.submitted_at).toLocaleString("tr-TR")}</p>
                                    <div style={styles.actions}>
                                        <button
                                            onClick={() => approveRecycling(sub.id)}
                                            style={styles.approveBtn}
                                        >
                                            ✅ Onayla
                                        </button>
                                        <button
                                            onClick={() => rejectRecycling(sub.id, null, false)}
                                            style={styles.rejectBtn}
                                        >
                                            ❌ Reddet
                                        </button>
                                        <button
                                            onClick={() => rejectRecycling(sub.id, "Fraud tespiti", true)}
                                            style={styles.fraudBtn}
                                        >
                                            🚨 Fraud
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Refresh */}
            <button onClick={loadData} style={styles.refreshBtn}>
                🔄 Yenile
            </button>
        </div>
    );
}

const styles = {
    container: {
        padding: "20px",
        maxWidth: "800px",
        margin: "0 auto",
        fontFamily: "system-ui, sans-serif"
    },
    warning: {
        padding: "20px",
        backgroundColor: "#fff3cd",
        borderRadius: "8px",
        textAlign: "center"
    },
    tabs: {
        display: "flex",
        gap: "10px",
        marginBottom: "20px"
    },
    tab: {
        padding: "12px 24px",
        border: "1px solid #ddd",
        background: "white",
        cursor: "pointer",
        borderRadius: "8px"
    },
    activeTab: {
        padding: "12px 24px",
        border: "2px solid #2196f3",
        background: "#e3f2fd",
        cursor: "pointer",
        borderRadius: "8px",
        fontWeight: "bold"
    },
    loading: {
        textAlign: "center",
        padding: "40px",
        color: "#666"
    },
    empty: {
        textAlign: "center",
        color: "#999",
        padding: "20px"
    },
    list: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "15px"
    },
    card: {
        border: "1px solid #ddd",
        borderRadius: "8px",
        padding: "15px",
        backgroundColor: "#fafafa"
    },
    cardHeader: {
        display: "flex",
        justifyContent: "space-between",
        marginBottom: "10px"
    },
    badge: {
        padding: "4px 8px",
        backgroundColor: "#e3f2fd",
        borderRadius: "4px",
        fontSize: "12px"
    },
    actions: {
        display: "flex",
        gap: "8px",
        marginTop: "10px"
    },
    primaryBtn: {
        width: "100%",
        padding: "10px",
        backgroundColor: "#2196f3",
        color: "white",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
        marginTop: "10px"
    },
    approveBtn: {
        flex: 1,
        padding: "8px",
        backgroundColor: "#4caf50",
        color: "white",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer"
    },
    rejectBtn: {
        flex: 1,
        padding: "8px",
        backgroundColor: "#9e9e9e",
        color: "white",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer"
    },
    fraudBtn: {
        flex: 1,
        padding: "8px",
        backgroundColor: "#f44336",
        color: "white",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer"
    },
    refreshBtn: {
        marginTop: "30px",
        padding: "12px 24px",
        backgroundColor: "#607d8b",
        color: "white",
        border: "none",
        borderRadius: "8px",
        cursor: "pointer"
    },
    error: {
        padding: "12px",
        backgroundColor: "#ffebee",
        color: "#c62828",
        borderRadius: "6px",
        marginBottom: "15px",
        display: "flex",
        justifyContent: "space-between"
    },
    success: {
        padding: "12px",
        backgroundColor: "#e8f5e9",
        color: "#2e7d32",
        borderRadius: "6px",
        marginBottom: "15px",
        display: "flex",
        justifyContent: "space-between"
    },
    closeBtn: {
        background: "none",
        border: "none",
        fontSize: "20px",
        cursor: "pointer"
    }
};
