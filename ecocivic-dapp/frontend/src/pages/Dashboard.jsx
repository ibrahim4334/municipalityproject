import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Grid, Paper, Card, CardContent, Button, Divider, Box, Dialog, DialogTitle, DialogContent, DialogActions, LinearProgress, Alert, Chip } from '@mui/material'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import RecyclingIcon from '@mui/icons-material/Recycling';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import QrCodeIcon from '@mui/icons-material/QrCode';
import WarningIcon from '@mui/icons-material/Warning';
import { useWallet } from '../context/WalletContext';
import { validateWaterMeter } from '../services/api';
import { getBeltBalance } from '../services/contractService';
import UserRoleSwitcher from '../components/UserRoleSwitcher';
import StaffDashboard from '../components/StaffDashboard';
import AdminDashboard from '../components/AdminDashboard';
import NotificationBell from '../components/NotificationBell';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function Dashboard() {
    const navigate = useNavigate();
    const { account, signer } = useWallet();
    const [beltBalance, setBeltBalance] = useState('0');
    const [pendingRewards, setPendingRewards] = useState(0);
    const [claiming, setClaiming] = useState(false);
    const [openUpload, setOpenUpload] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState(null);
    const [error, setError] = useState(null);
    // Rol yönetimi
    const [currentRole, setCurrentRole] = useState('citizen');
    // Fraud uyarıları
    const [fraudWarnings, setFraudWarnings] = useState({ recycling: 2, water: 2 });
    const [hasPendingFraud, setHasPendingFraud] = useState(false);

    useEffect(() => {
        if (account && signer) {
            loadBalance();
            loadFraudStatus();
        }
    }, [account, signer]);

    const loadBalance = async () => {
        try {
            // Blockchain Balance
            const bal = await getBeltBalance(signer, account);
            setBeltBalance(bal);

            // Pending Rewards from Backend
            const res = await fetch(`${API_URL}/api/wallet/balance/${account}`);
            if (res.ok) {
                const data = await res.json();
                setPendingRewards(data.pending_rewards || 0);
            }
        } catch (err) {
            console.error('Balance load error:', err);
        }
    };

    const handleClaimRewards = async () => {
        if (!account) return;
        setClaiming(true);
        try {
            const res = await fetch(`${API_URL}/api/wallet/claim`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Wallet-Address': account
                },
                body: JSON.stringify({ wallet_address: account })
            });

            const data = await res.json();

            if (res.ok) {
                // Refresh balances
                await loadBalance();
                alert(`🚀 ${data.claimed_amount} BELT başarıyla cüzdanınıza transfer edildi!`);
            } else {
                alert(`Hata: ${data.message || 'Transfer başarısız'}`);
            }
        } catch (err) {
            console.error('Claim error:', err);
            alert('Transfer sırasında bir hata oluştu.');
        } finally {
            setClaiming(false);
        }
    };

    const loadFraudStatus = async () => {
        try {
            const response = await fetch(`${API_URL}/api/fraud/status/${account}`, {
                headers: { 'X-Wallet-Address': account }
            });
            if (response.ok) {
                const data = await response.json();
                setFraudWarnings({
                    recycling: data.recycling_warnings_remaining ?? 2,
                    water: data.water_warnings_remaining ?? 2
                });
                setHasPendingFraud(data.has_pending_fraud || false);
            }
        } catch (err) {
            console.error('Fraud status load error:', err);
        }
    };

    const handleFileChange = (event) => {
        setSelectedFile(event.target.files[0]);
        setError(null);
        setUploadResult(null);
    };

    const handleUpload = async () => {
        if (!selectedFile) return;

        setUploading(true);
        setError(null);

        try {
            const result = await validateWaterMeter(selectedFile);
            setUploadResult(result);
        } catch (err) {
            setError("Yükleme veya analiz sırasında bir hata oluştu.");
        } finally {
            setUploading(false);
        }
    };

    const handleClose = () => {
        setOpenUpload(false);
        setSelectedFile(null);
        setUploadResult(null);
        setError(null);
    };

    const handleRoleChange = (role) => {
        setCurrentRole(role);
    };

    // Admin için Yönetici Paneli
    if (currentRole === 'admin') {
        return (
            <Grid container spacing={4}>
                <Grid item xs={12}>
                    <UserRoleSwitcher onRoleChange={handleRoleChange} />
                </Grid>
                <Grid item xs={12}>
                    <AdminDashboard />
                </Grid>
            </Grid>
        );
    }

    // Personel için Personel Paneli
    if (currentRole === 'staff') {
        return (
            <Grid container spacing={4}>
                <Grid item xs={12}>
                    <UserRoleSwitcher onRoleChange={handleRoleChange} />
                </Grid>
                <Grid item xs={12}>
                    <StaffDashboard />
                </Grid>
            </Grid>
        );
    }

    // Vatandaş Paneli
    return (
        <Grid container spacing={4}>
            {/* Rol Switcher */}
            <Grid item xs={12}>
                <UserRoleSwitcher onRoleChange={handleRoleChange} />
            </Grid>

            <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="h4" gutterBottom>
                        🏠 Vatandaş Paneli
                    </Typography>
                    <NotificationBell />
                </Box>
            </Grid>

            {/* Anomaly Signal Uyarısı */}
            {hasPendingFraud && (
                <Grid item xs={12}>
                    <Alert severity="warning" icon={<WarningIcon />}>
                        <Typography variant="subtitle2" fontWeight="bold">
                            ⚠️ Bekleyen Anomali İncelemesi
                        </Typography>
                        <Typography variant="body2">
                            Hesabınızda inceleme bekleyen bir işlem bulunmaktadır. Sistem tarafından sinyal tespit edildi.
                        </Typography>
                    </Alert>
                </Grid>
            )}

            {/* Balance Section */}
            <Grid item xs={12} md={4}>
                <Card sx={{ height: '100%' }}>
                    <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <AccountBalanceWalletIcon color="primary" sx={{ mr: 1 }} />
                            <Typography variant="h6">Cüzdan Bakiyesi</Typography>
                        </Box>
                        <Typography variant="h3" color="primary.main" gutterBottom>
                            {beltBalance} BELT
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {!account ? "Lütfen cüzdan bağlayın" : "Cüzdan Bakiyesi"}
                        </Typography>

                        {/* Metamask'a Ekle Butonu */}
                        <Button
                            variant="outlined"
                            size="small"
                            fullWidth
                            sx={{ mt: 1, textTransform: 'none' }}
                            onClick={async () => {
                                try {
                                    await window.ethereum.request({
                                        method: 'wallet_watchAsset',
                                        params: {
                                            type: 'ERC20',
                                            options: {
                                                address: import.meta.env.VITE_CONTRACT_ADDRESS_BELT,
                                                symbol: 'BELT',
                                                decimals: 18,
                                                image: 'https://cdn-icons-png.flaticon.com/512/2091/2091665.png', // Örnek icon
                                            },
                                        },
                                    });
                                } catch (error) {
                                    console.error(error);
                                }
                            }}
                        >
                            🦊 Cüzdana Ekle
                        </Button>

                        {/* Pending Rewards Section */}
                        {pendingRewards > 0 && (
                            <Box sx={{ mt: 2, p: 2, bgcolor: '#e3f2fd', borderRadius: 2, border: '1px dashed #2196f3' }}>
                                <Typography variant="subtitle2" color="primary.dark">
                                    🎁 Birikmiş Ödüller
                                </Typography>
                                <Typography variant="h5" color="primary.main" fontWeight="bold">
                                    {pendingRewards} BELT
                                </Typography>
                                <Button
                                    variant="contained"
                                    size="small"
                                    fullWidth
                                    sx={{ mt: 1 }}
                                    onClick={handleClaimRewards}
                                    disabled={claiming}
                                >
                                    {claiming ? "Transfer Ediliyor..." : "Cüzdana Aktar"}
                                </Button>
                            </Box>
                        )}

                        {/* İtiraz Hakkı Göstergesi */}
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                            🛡️ 2 Hak Sistemi (Blockchain tarafından korunur)
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            <Chip
                                label={`♻️ Geri Dönüşüm Hakkı: ${fraudWarnings.recycling}/2`}
                                color={fraudWarnings.recycling < 2 ? 'warning' : 'success'}
                                size="small"
                            />
                            <Chip
                                label={`💧 Su Sayacı Hakkı: ${fraudWarnings.water}/2`}
                                color={fraudWarnings.water < 2 ? 'warning' : 'success'}
                                size="small"
                            />
                        </Box>

                        {/* Token Kullanım Seçenekleri - Her zaman göster */}
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle2" gutterBottom sx={{ color: 'text.secondary' }}>
                            💰 Tokenleri Kullan:
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <Button
                                size="small"
                                variant="outlined"
                                disabled
                                sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                            >
                                💧 Su Faturasından Düş
                            </Button>
                            <Button
                                size="small"
                                variant="outlined"
                                disabled
                                sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                            >
                                🚌 Yolcu Kartına Ekle
                            </Button>
                            <Button
                                size="small"
                                variant="outlined"
                                disabled
                                sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                            >
                                🛒 Belediye Marketinde Kullan
                            </Button>
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                            * Bu özellikler yakında aktif edilecektir
                        </Typography>
                    </CardContent>
                </Card>
            </Grid>

            {/* Actions Section */}
            <Grid item xs={12} md={8}>
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        🚀 Hızlı İşlemler
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Grid container spacing={2}>
                        {/* Su Sayacı Fotoğrafı Yükle */}
                        <Grid item xs={12} sm={6}>
                            <Button
                                variant="contained"
                                color="info"
                                fullWidth
                                sx={{ py: 2.5 }}
                                startIcon={<CameraAltIcon />}
                                onClick={() => navigate('/water')}
                            >
                                📸 Su Sayacı Fotoğrafı Yükle
                            </Button>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, textAlign: 'center' }}>
                                Fotoğraf hash'i blockchain'de saklanır
                            </Typography>
                        </Grid>

                        {/* Geri Dönüşüm Beyanı Ver */}
                        <Grid item xs={12} sm={6}>
                            <Button
                                variant="contained"
                                color="success"
                                fullWidth
                                sx={{ py: 2.5 }}
                                startIcon={<QrCodeIcon />}
                                onClick={() => navigate('/recycling')}
                            >
                                ♻️ Geri Dönüşüm Beyanı Ver
                            </Button>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, textAlign: 'center' }}>
                                3 saatlik QR kod oluştur
                            </Typography>
                        </Grid>
                    </Grid>
                </Paper>

                {/* Son Hareketler */}
                <Paper sx={{ p: 3, mt: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        📋 Durum
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1, borderBottom: '1px solid #eee' }}>
                        <Typography>Cüzdan Bağlantısı</Typography>
                        <Typography color={account ? "success.main" : "text.secondary"}>
                            {account ? "✅ Aktif" : "⏳ Bekleniyor"}
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1, borderBottom: '1px solid #eee' }}>
                        <Typography>Hesap Durumu</Typography>
                        <Typography color={hasPendingFraud ? "warning.main" : "success.main"}>
                            {hasPendingFraud ? "⚠️ İnceleme Bekliyor" : "✅ Normal"}
                        </Typography>
                    </Box>
                </Paper>
            </Grid>

            {/* Upload Dialog */}
            <Dialog open={openUpload} onClose={handleClose} maxWidth="sm" fullWidth>
                <DialogTitle>Su Sayacı Fotoğrafı Yükle</DialogTitle>
                <DialogContent>
                    <Box sx={{ mt: 2, textAlign: 'center' }}>
                        <input
                            accept="image/*"
                            style={{ display: 'none' }}
                            id="raised-button-file"
                            type="file"
                            onChange={handleFileChange}
                        />
                        <label htmlFor="raised-button-file">
                            <Button variant="outlined" component="span" startIcon={<CloudUploadIcon />}>
                                Fotoğraf Seç
                            </Button>
                        </label>
                        {selectedFile && <Typography sx={{ mt: 1 }}>{selectedFile.name}</Typography>}

                        {uploading && <LinearProgress sx={{ mt: 2 }} />}

                        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

                        {uploadResult && (
                            <Alert severity="success" sx={{ mt: 2 }}>
                                Analiz Tamamlandı!
                                <br />
                                Tespit Edilen Okuma: {JSON.stringify(uploadResult)}
                            </Alert>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose}>İptal</Button>
                    <Button onClick={handleUpload} variant="contained" disabled={!selectedFile || uploading}>
                        Yükle ve Analiz Et
                    </Button>
                </DialogActions>
            </Dialog>
        </Grid>
    )
}

export default Dashboard