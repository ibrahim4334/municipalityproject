import { useState, useEffect } from 'react';
import {
    Box, Typography, Paper, Grid, Card, CardContent,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Button, Chip, Alert, Divider, CircularProgress
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import GavelIcon from '@mui/icons-material/Gavel';
import BarChartIcon from '@mui/icons-material/BarChart';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import WarningIcon from '@mui/icons-material/Warning';
import { useWallet } from '../context/WalletContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * AdminDashboard - Yönetici Paneli
 * 
 * Rol 1: İtiraz Makamı - Fraud itirazlarında son karar
 * Rol 2: İstatistik Dashboard - Sistem genel durumu
 */
export default function AdminDashboard() {
    const { account } = useWallet();
    const [stats, setStats] = useState({
        totalDeclarations: 0,
        approved: 0,
        pending: 0,
        fraud: 0,
        totalRewards: 0
    });
    const [appeals, setAppeals] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        if (account) {
            loadStats();
            loadAppeals();
        }
    }, [account]);

    const loadStats = async () => {
        try {
            // Gerçek API yoksa mock data kullan
            const response = await fetch(`${API_URL}/api/admin/stats`, {
                headers: { 'X-Wallet-Address': account }
            });
            if (response.ok) {
                const data = await response.json();
                setStats(data);
            } else {
                // Mock data
                setStats({
                    totalDeclarations: 15,
                    approved: 9,
                    pending: 4,
                    fraud: 2,
                    totalRewards: 1250
                });
            }
        } catch (err) {
            // Mock data on error
            setStats({
                totalDeclarations: 15,
                approved: 9,
                pending: 4,
                fraud: 2,
                totalRewards: 1250
            });
        }
    };

    const loadAppeals = async () => {
        try {
            const response = await fetch(`${API_URL}/api/admin/appeals`, {
                headers: { 'X-Wallet-Address': account }
            });
            if (response.ok) {
                const data = await response.json();
                setAppeals(data.appeals || []);
            } else {
                // Mock data
                setAppeals([
                    {
                        id: 1,
                        wallet: '0xCitizen...001',
                        type: 'recycling',
                        reason: 'Beyan edilen miktar gerçek miktarla eşleşmiyor',
                        appeal_reason: 'Tartı hatalıydı, fotoğraf kanıtım var',
                        created_at: '2026-01-15T10:30:00',
                        status: 'pending'
                    },
                    {
                        id: 2,
                        wallet: '0xCitizen...002',
                        type: 'water',
                        reason: 'Sayaç okuma tutarsızlığı',
                        appeal_reason: 'Su kesintisi nedeniyle düşük tüketim',
                        created_at: '2026-01-14T14:20:00',
                        status: 'pending'
                    }
                ]);
            }
        } catch (err) {
            // Mock data
            setAppeals([]);
        }
    };

    const handleAppealDecision = async (appealId, decision) => {
        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/admin/appeals/${appealId}/decide`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Wallet-Address': account
                },
                body: JSON.stringify({ decision }) // 'approve' or 'reject'
            });

            if (response.ok) {
                // Hemen listeden kaldır (UI güncelleme)
                setAppeals(prev => prev.filter(a => a.id !== appealId));

                setMessage({
                    type: 'success',
                    text: decision === 'approve'
                        ? '✅ İtiraz kabul edildi, vatandaşa token verildi'
                        : '❌ İtiraz reddedildi, fraud kararı kesinleşti'
                });

                // Arka planda istatistikleri güncelle
                loadStats();
            } else {
                // Demo mode - simulate success
                setAppeals(prev => prev.filter(a => a.id !== appealId));
                setMessage({
                    type: 'success',
                    text: decision === 'approve'
                        ? '✅ İtiraz kabul edildi (Demo)'
                        : '❌ İtiraz reddedildi (Demo)'
                });
            }
        } catch (err) {
            // Demo mode
            setAppeals(prev => prev.filter(a => a.id !== appealId));
            setMessage({
                type: 'success',
                text: decision === 'approve'
                    ? '✅ İtiraz kabul edildi (Demo)'
                    : '❌ İtiraz reddedildi (Demo)'
            });
        }
        setLoading(false);
    };

    const StatCard = ({ title, value, icon, color }) => (
        <Card sx={{ height: '100%' }}>
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                            {title}
                        </Typography>
                        <Typography variant="h4" fontWeight="bold" color={color}>
                            {value}
                        </Typography>
                    </Box>
                    <Box sx={{ color: color, opacity: 0.7 }}>
                        {icon}
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );

    if (!account) {
        return (
            <Paper sx={{ p: 3 }}>
                <Alert severity="warning">
                    Yönetici paneline erişmek için cüzdanınızı bağlayın.
                </Alert>
            </Paper>
        );
    }

    return (
        <Box>
            {/* Başlık */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <DashboardIcon sx={{ fontSize: 40, color: 'error.main' }} />
                <Box>
                    <Typography variant="h5" fontWeight="bold">
                        🛡️ Yönetici Paneli
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        İstatistikler ve Fraud İtirazları
                    </Typography>
                </Box>
            </Box>

            {message && (
                <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
                    {message.text}
                </Alert>
            )}

            {/* İstatistik Kartları */}
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <BarChartIcon /> Sistem İstatistikleri
            </Typography>

            <Grid container spacing={2} sx={{ mb: 4 }}>
                <Grid item xs={6} md={2.4}>
                    <StatCard
                        title="Toplam Beyan"
                        value={stats.totalDeclarations}
                        icon={<DashboardIcon sx={{ fontSize: 40 }} />}
                        color="primary.main"
                    />
                </Grid>
                <Grid item xs={6} md={2.4}>
                    <StatCard
                        title="Onaylanan"
                        value={stats.approved}
                        icon={<CheckCircleIcon sx={{ fontSize: 40 }} />}
                        color="success.main"
                    />
                </Grid>
                <Grid item xs={6} md={2.4}>
                    <StatCard
                        title="Bekleyen"
                        value={stats.pending}
                        icon={<HourglassEmptyIcon sx={{ fontSize: 40 }} />}
                        color="warning.main"
                    />
                </Grid>
                <Grid item xs={6} md={2.4}>
                    <StatCard
                        title="Fraud"
                        value={stats.fraud}
                        icon={<WarningIcon sx={{ fontSize: 40 }} />}
                        color="error.main"
                    />
                </Grid>
                <Grid item xs={12} md={2.4}>
                    <StatCard
                        title="Toplam Ödül (BELT)"
                        value={stats.totalRewards}
                        icon={<span style={{ fontSize: 32 }}>🪙</span>}
                        color="secondary.main"
                    />
                </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            {/* İtiraz Listesi */}
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <GavelIcon /> Fraud İtirazları (Son Karar Makamı)
            </Typography>

            <Alert severity="info" sx={{ mb: 2 }}>
                Personel tarafından fraud işaretlenen beyanlar için vatandaşların itirazları burada görüntülenir.
                <strong> Yönetici olarak son kararı siz verirsiniz.</strong>
            </Alert>

            {appeals.length === 0 ? (
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                    <Typography color="text.secondary">
                        ✅ Bekleyen itiraz bulunmamaktadır.
                    </Typography>
                </Paper>
            ) : (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ bgcolor: '#1976d2' }}>
                                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Vatandaş</TableCell>
                                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Tür</TableCell>
                                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Fraud Sebebi</TableCell>
                                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>İtiraz Açıklaması</TableCell>
                                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Tarih</TableCell>
                                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Karar</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {appeals.map((appeal) => (
                                <TableRow key={appeal.id} hover>
                                    <TableCell>
                                        <Chip label={appeal.wallet} size="small" variant="outlined" />
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={appeal.type === 'recycling' ? '♻️ Geri Dönüşüm' : '💧 Su Sayacı'}
                                            size="small"
                                            color={appeal.type === 'recycling' ? 'success' : 'info'}
                                        />
                                    </TableCell>
                                    <TableCell sx={{ maxWidth: 200 }}>
                                        <Typography variant="body2" color="error">
                                            {appeal.reason}
                                        </Typography>
                                    </TableCell>
                                    <TableCell sx={{ maxWidth: 200 }}>
                                        <Typography variant="body2">
                                            {appeal.appeal_reason}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        {new Date(appeal.created_at).toLocaleDateString('tr-TR')}
                                    </TableCell>
                                    <TableCell align="center">
                                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                                            <Button
                                                variant="contained"
                                                color="success"
                                                size="small"
                                                startIcon={<CheckCircleIcon />}
                                                onClick={() => handleAppealDecision(appeal.id, 'approve')}
                                                disabled={loading}
                                            >
                                                Kabul
                                            </Button>
                                            <Button
                                                variant="contained"
                                                color="error"
                                                size="small"
                                                startIcon={<CancelIcon />}
                                                onClick={() => handleAppealDecision(appeal.id, 'reject')}
                                                disabled={loading}
                                            >
                                                Red
                                            </Button>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Yönetici Bilgileri */}
            <Paper sx={{ p: 2, mt: 3, bgcolor: 'grey.50' }}>
                <Typography variant="subtitle2" gutterBottom>
                    📋 Yönetici Yetkileri:
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    • <strong>İtiraz Kararı:</strong> Fraud kararına itiraz eden vatandaşlar için son kararı verir<br />
                    • <strong>İstatistik İzleme:</strong> Sistem genelindeki beyan, onay ve fraud sayılarını takip eder<br />
                    • <strong>Kabul:</strong> İtiraz kabul edilirse vatandaşın fraud kaydı silinir ve hakkı geri verilir<br />
                    • <strong>Red:</strong> İtiraz reddedilirse fraud kararı kesinleşir
                </Typography>
            </Paper>
        </Box>
    );
}
