import { useState, useEffect } from "react";
import { useWallet } from "../context/WalletContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

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

    // Modal state for rejection/fraud reason
    const [showReasonModal, setShowReasonModal] = useState(false);
    const [modalType, setModalType] = useState(null); // 'reject' or 'fraud'
    const [modalTargetId, setModalTargetId] = useState(null);
    const [reasonText, setReasonText] = useState("");

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
        const dueRes = await fetch(`${API_URL}/api/inspection/due`, {
            headers: { "X-Wallet-Address": account }
        });
        const dueData = await dueRes.json();
        setUsersDue(dueData.users || []);
    };

    const loadPendingRecycling = async () => {
        // Yeni çoklu beyan endpoint'i
        try {
            const res = await fetch(`${API_URL}/api/recycling/declarations/pending`, {
                headers: { "X-Wallet-Address": account }
            });
            const data = await res.json();
            setPendingRecycling(data.declarations || []);
        } catch (err) {
            // Fallback eski endpoint
            const res = await fetch(`${API_URL}/api/recycling/pending-approvals`, {
                headers: { "X-Wallet-Address": account }
            });
            const data = await res.json();
            setPendingRecycling(data.submissions || []);
        }
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
            // Yeni declarations endpoint'i dene
            let res = await fetch(`${API_URL}/api/recycling/declarations/${submissionId}/approve`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Wallet-Address": account
                }
            });

            // Hata durumunda eski endpoint'i dene
            if (!res.ok) {
                res = await fetch(`${API_URL}/api/recycling/approve/${submissionId}`, {
                    method: "POST",
                    headers: { "X-Wallet-Address": account }
                });
            }

            const data = await res.json();

            if (data.success) {
                setMessage({ type: "success", text: `✅ ${data.reward_amount || 0} BELT token ödülü verildi` });
                loadData();
            } else {
                setMessage({ type: "error", text: data.message });
            }
        } catch (err) {
            setMessage({ type: "error", text: err.message });
        }
    };

    const rejectRecycling = async (submissionId, reason, isFraud) => {
        const rejectReason = reason || prompt("Red/Fraud sebebi:");
        if (!rejectReason && isFraud) return;

        try {
            // Fraud için yeni endpoint
            if (isFraud) {
                const res = await fetch(`${API_URL}/api/recycling/declarations/${submissionId}/fraud`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Wallet-Address": account
                    },
                    body: JSON.stringify({ reason: rejectReason })
                });
                const data = await res.json();

                if (data.success) {
                    setMessage({ type: "success", text: `🚨 Fraud işaretlendi. Kalan hak: ${data.remaining_warnings ?? 'N/A'}` });
                    loadData();
                } else {
                    setMessage({ type: "error", text: data.message });
                }
            } else {
                // Normal reddetme için eski endpoint
                const res = await fetch(`${API_URL}/api/recycling/reject/${submissionId}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Wallet-Address": account
                    },
                    body: JSON.stringify({
                        reason: rejectReason,
                        is_fraud: false
                    })
                });
                const data = await res.json();

                if (data.success) {
                    setMessage({ type: "success", text: "❌ Başvuru reddedildi" });
                    loadData();
                } else {
                    setMessage({ type: "error", text: data.message });
                }
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
                        <div style={styles.tableContainer}>
                            <table style={styles.table}>
                                <thead>
                                    <tr style={styles.tableHeader}>
                                        <th style={styles.th}>ID</th>
                                        <th style={styles.th}>Cüzdan</th>
                                        <th style={styles.th}>Tarih</th>
                                        <th style={styles.th}>Plastik</th>
                                        <th style={styles.th}>Cam</th>
                                        <th style={styles.th}>Metal</th>
                                        <th style={styles.th}>Kağıt</th>
                                        <th style={styles.th}>Elektronik</th>
                                        <th style={styles.th}>Toplam Ödül</th>
                                        <th style={styles.th}>İşlem</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pendingRecycling.map((sub) => (
                                        <tr key={sub.id} style={styles.tableRow}>
                                            <td style={styles.td}>{sub.id}</td>
                                            <td style={styles.td} title={sub.wallet_address}>
                                                {sub.wallet_address?.slice(0, 8)}...
                                            </td>
                                            <td style={styles.td}>
                                                {sub.created_at ? new Date(sub.created_at).toLocaleString("tr-TR") : "-"}
                                            </td>
                                            <td style={styles.td}>
                                                {sub.plastic_kg > 0 ? `${sub.plastic_kg} kg` : "-"}
                                            </td>
                                            <td style={styles.td}>
                                                {sub.glass_kg > 0 ? `${sub.glass_kg} kg` : "-"}
                                            </td>
                                            <td style={styles.td}>
                                                {sub.metal_kg > 0 ? `${sub.metal_kg} kg` : "-"}
                                            </td>
                                            <td style={styles.td}>
                                                {sub.paper_kg > 0 ? `${sub.paper_kg} kg` : "-"}
                                            </td>
                                            <td style={styles.td}>
                                                {sub.electronic_count > 0 ? `${sub.electronic_count} adet` : "-"}
                                            </td>
                                            <td style={styles.tdReward}>{sub.total_reward} BELT</td>
                                            <td style={styles.tdActions}>
                                                <button
                                                    onClick={() => approveRecycling(sub.id)}
                                                    style={styles.approveBtn}
                                                    title="Beyanı onayla"
                                                >
                                                    ✅
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setModalType('reject');
                                                        setModalTargetId(sub.id);
                                                        setReasonText('');
                                                        setShowReasonModal(true);
                                                    }}
                                                    style={styles.rejectBtn}
                                                    title="Beyanı reddet"
                                                >
                                                    ❌
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setModalType('fraud');
                                                        setModalTargetId(sub.id);
                                                        setReasonText('');
                                                        setShowReasonModal(true);
                                                    }}
                                                    style={styles.fraudBtn}
                                                    title="Fraud olarak işaretle (Yöneticiye gider)"
                                                >
                                                    🚨
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Refresh */}
            <button onClick={loadData} style={styles.refreshBtn}>
                🔄 Yenile
            </button>

            {/* Reason Modal */}
            {showReasonModal && (
                <div style={styles.modalOverlay}>
                    <div style={styles.modal}>
                        <h3 style={styles.modalTitle}>
                            {modalType === 'fraud' ? '🚨 Fraud Sebebi' : '❌ Red Sebebi'}
                        </h3>
                        <p style={styles.modalDesc}>
                            {modalType === 'fraud'
                                ? 'Fraud işaretleme sebebini yazın. Bu beyan yönetici onayına gönderilecek.'
                                : 'Red sebebini yazın. Bu sebep vatandaşa bildirilecek.'}
                        </p>
                        <textarea
                            value={reasonText}
                            onChange={(e) => setReasonText(e.target.value)}
                            placeholder={modalType === 'fraud' ? 'Fraud sebebi...' : 'Red sebebi...'}
                            style={styles.modalTextarea}
                            rows={4}
                        />
                        <div style={styles.modalActions}>
                            <button
                                onClick={() => {
                                    setShowReasonModal(false);
                                    setReasonText('');
                                }}
                                style={styles.modalCancelBtn}
                            >
                                İptal
                            </button>
                            <button
                                onClick={() => {
                                    const reason = reasonText.trim() || (modalType === 'fraud' ? 'Fraud tespiti' : 'Beyan reddedildi');
                                    rejectRecycling(modalTargetId, reason, modalType === 'fraud');
                                    setShowReasonModal(false);
                                    setReasonText('');
                                }}
                                style={modalType === 'fraud' ? styles.modalFraudBtn : styles.modalConfirmBtn}
                            >
                                {modalType === 'fraud' ? '🚨 Fraud Olarak İşaretle' : '❌ Reddet'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
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
    },
    // Tablo stilleri
    tableContainer: {
        overflowX: "auto",
        marginTop: "10px"
    },
    table: {
        width: "100%",
        borderCollapse: "collapse",
        fontSize: "14px",
        backgroundColor: "#fff"
    },
    tableHeader: {
        backgroundColor: "#2196f3",
        color: "white"
    },
    th: {
        padding: "12px 8px",
        textAlign: "left",
        fontWeight: "600",
        whiteSpace: "nowrap",
        borderBottom: "2px solid #1976d2"
    },
    tableRow: {
        borderBottom: "1px solid #e0e0e0",
        backgroundColor: "#fafafa"
    },
    td: {
        padding: "10px 8px",
        color: "#333",
        verticalAlign: "middle"
    },
    tdReward: {
        padding: "10px 8px",
        color: "#4caf50",
        fontWeight: "bold",
        verticalAlign: "middle"
    },
    tdActions: {
        padding: "8px",
        display: "flex",
        gap: "4px",
        verticalAlign: "middle"
    },
    // Modal styles
    modalOverlay: {
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
    modal: {
        backgroundColor: "white",
        padding: "24px",
        borderRadius: "12px",
        width: "90%",
        maxWidth: "450px",
        boxShadow: "0 10px 40px rgba(0,0,0,0.3)"
    },
    modalTitle: {
        margin: "0 0 12px 0",
        fontSize: "18px"
    },
    modalDesc: {
        color: "#666",
        fontSize: "14px",
        marginBottom: "16px"
    },
    modalTextarea: {
        width: "100%",
        padding: "12px",
        border: "1px solid #ddd",
        borderRadius: "8px",
        fontSize: "14px",
        resize: "vertical",
        boxSizing: "border-box"
    },
    modalActions: {
        display: "flex",
        gap: "12px",
        marginTop: "16px",
        justifyContent: "flex-end"
    },
    modalCancelBtn: {
        padding: "10px 20px",
        border: "1px solid #ddd",
        background: "white",
        borderRadius: "6px",
        cursor: "pointer"
    },
    modalConfirmBtn: {
        padding: "10px 20px",
        backgroundColor: "#9e9e9e",
        color: "white",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer"
    },
    modalFraudBtn: {
        padding: "10px 20px",
        backgroundColor: "#f44336",
        color: "white",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer"
    }
};
