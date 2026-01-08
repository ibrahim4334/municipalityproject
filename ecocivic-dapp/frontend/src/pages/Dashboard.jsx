import { useState, useEffect } from 'react';
import { Typography, Grid, Paper, Card, CardContent, Button, Divider, Box, Dialog, DialogTitle, DialogContent, DialogActions, LinearProgress, Alert } from '@mui/material'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useWallet } from '../context/WalletContext';
import { validateWaterMeter } from '../services/apiService';
import { getBeltBalance } from '../services/contractService';

function Dashboard() {
    const { account, signer } = useWallet();
    const [beltBalance, setBeltBalance] = useState('0');
    const [openUpload, setOpenUpload] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (account && signer) {
            loadBalance();
        }
    }, [account, signer]);

    const loadBalance = async () => {
        const bal = await getBeltBalance(signer, account);
        setBeltBalance(bal);
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
            // Başarılı işlem sonrası token bakiyesini güncellemek anlamlı olur
            // Ancak backend'in mint yetkisi olması ve bunu yapması gerekir.
            // Şimdilik sadece simülasyon olarak kullanıcıya gösteriyoruz.
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

    return (
        <Grid container spacing={4}>
            <Grid item xs={12}>
                <Typography variant="h4" gutterBottom>
                    Kullanıcı Paneli
                </Typography>
            </Grid>

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
                            {!account ? "Lütfen cüzdan bağlayın" : "Güncel Bakiye"}
                        </Typography>
                        <Button variant="outlined" fullWidth sx={{ mt: 2 }} disabled={!account}>
                            Çekim Yap
                        </Button>
                    </CardContent>
                </Card>
            </Grid>

            {/* Actions Section */}
            <Grid item xs={12} md={8}>
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        Hızlı İşlemler
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <Button variant="contained" color="success" fullWidth sx={{ py: 2 }}>
                                Geri Dönüşüm QR Okut
                            </Button>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <Button
                                variant="contained"
                                color="info"
                                fullWidth
                                sx={{ py: 2 }}
                                onClick={() => setOpenUpload(true)}
                            >
                                Su Sayacı Yükle
                            </Button>
                        </Grid>
                    </Grid>
                </Paper>

                <Paper sx={{ p: 3, mt: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        Son Hareketler
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    {/* Mock List */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1, borderBottom: '1px solid #eee' }}>
                        <Typography>Cüzdan Bağlantısı</Typography>
                        <Typography color={account ? "success.main" : "text.secondary"}>
                            {account ? "Aktif" : "Bekleniyor"}
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