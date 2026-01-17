import { useState, useEffect, useCallback } from "react";
import { useWallet } from "../context/WalletContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

/**
 * NotificationBell - Bildirim zili componenti
 * Kullanıcının bildirimlerini gösterir
 */
export default function NotificationBell() {
    const { account } = useWallet();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const fetchNotifications = useCallback(async () => {
        if (!account) return;

        try {
            const res = await fetch(`${API_URL}/api/notifications/${account}`, {
                headers: { "X-Wallet-Address": account }
            });
            const data = await res.json();

            if (data.success) {
                setNotifications(data.notifications || []);
                setUnreadCount(data.unread_count || 0);
            }
        } catch (err) {
            console.error("Error fetching notifications:", err);
        }
    }, [account]);

    // İlk yüklemede ve her 30 saniyede bir güncelle
    useEffect(() => {
        if (account) {
            fetchNotifications();
            const interval = setInterval(fetchNotifications, 30000);
            return () => clearInterval(interval);
        }
    }, [account, fetchNotifications]);

    const markAsRead = async (notificationId) => {
        try {
            await fetch(`${API_URL}/api/notifications/${notificationId}/read`, {
                method: "POST",
                headers: { "X-Wallet-Address": account }
            });
            setNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error("Error marking notification as read:", err);
        }
    };

    const markAllAsRead = async () => {
        try {
            await fetch(`${API_URL}/api/notifications/${account}/read-all`, {
                method: "POST",
                headers: { "X-Wallet-Address": account }
            });
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error("Error marking all as read:", err);
        }
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case "declaration_rejected": return "❌";
            case "fraud_marked": return "🚨";
            case "fraud_appeal_approved": return "✅";
            case "fraud_appeal_rejected": return "⛔";
            case "declaration_approved": return "🎉";
            default: return "📬";
        }
    };

    const formatTime = (isoString) => {
        if (!isoString) return "";
        const date = new Date(isoString);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return "Az önce";
        if (diff < 3600000) return `${Math.floor(diff / 60000)} dk önce`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} saat önce`;
        return date.toLocaleDateString("tr-TR");
    };

    if (!account) return null;

    return (
        <div style={{ position: "relative", display: "inline-block" }}>
            {/* Zil Butonu */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    background: "none",
                    border: "none",
                    fontSize: "24px",
                    cursor: "pointer",
                    position: "relative",
                    padding: "8px"
                }}
                title="Bildirimler"
            >
                🔔
                {unreadCount > 0 && (
                    <span style={{
                        position: "absolute",
                        top: "0",
                        right: "0",
                        background: "#f44336",
                        color: "white",
                        borderRadius: "50%",
                        width: "18px",
                        height: "18px",
                        fontSize: "11px",
                        fontWeight: "bold",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                    }}>
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div style={{
                    position: "absolute",
                    top: "100%",
                    right: "0",
                    width: "320px",
                    maxHeight: "400px",
                    overflowY: "auto",
                    backgroundColor: "white",
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                    zIndex: 1000
                }}>
                    {/* Header */}
                    <div style={{
                        padding: "12px 16px",
                        borderBottom: "1px solid #eee",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                    }}>
                        <strong>Bildirimler</strong>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                style={{
                                    background: "none",
                                    border: "none",
                                    color: "#2196f3",
                                    cursor: "pointer",
                                    fontSize: "12px"
                                }}
                            >
                                Tümünü okundu işaretle
                            </button>
                        )}
                    </div>

                    {/* Bildirim Listesi */}
                    {notifications.length === 0 ? (
                        <div style={{
                            padding: "30px",
                            textAlign: "center",
                            color: "#999"
                        }}>
                            Bildirim yok
                        </div>
                    ) : (
                        notifications.map(n => (
                            <div
                                key={n.id}
                                onClick={() => !n.is_read && markAsRead(n.id)}
                                style={{
                                    padding: "12px 16px",
                                    borderBottom: "1px solid #f5f5f5",
                                    backgroundColor: n.is_read ? "white" : "#e3f2fd",
                                    cursor: n.is_read ? "default" : "pointer",
                                    transition: "background-color 0.2s"
                                }}
                            >
                                <div style={{ display: "flex", gap: "10px" }}>
                                    <span style={{ fontSize: "20px" }}>
                                        {getNotificationIcon(n.type)}
                                    </span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{
                                            fontWeight: n.is_read ? "normal" : "bold",
                                            fontSize: "14px",
                                            marginBottom: "4px"
                                        }}>
                                            {n.title}
                                        </div>
                                        <div style={{
                                            fontSize: "13px",
                                            color: "#666",
                                            lineHeight: "1.4"
                                        }}>
                                            {n.message}
                                        </div>
                                        <div style={{
                                            fontSize: "11px",
                                            color: "#999",
                                            marginTop: "6px"
                                        }}>
                                            {formatTime(n.created_at)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Overlay to close dropdown */}
            {isOpen && (
                <div
                    onClick={() => setIsOpen(false)}
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 999
                    }}
                />
            )}
        </div>
    );
}
