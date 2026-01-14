import { Typography, Container, Box, Grid, Paper, Alert, AlertTitle } from '@mui/material';
import RecyclingQR from '../components/RecyclingQR';
import { useWallet } from '../context/WalletContext';

function Recycling() {
    const { account, isCorrectNetwork, error } = useWallet();

    return (
        <Container maxWidth="lg">
            <Box sx={{ py: 4 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    ♻️ Geri Dönüşüm
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                    Geri dönüşülebilir malzemelerinizi getirin, BELT token kazanın!
                </Typography>

                {error && (
                    <Alert severity="error" sx={{ mb: 3 }}>
                        <AlertTitle>Hata</AlertTitle>
                        {error}
                    </Alert>
                )}

                {!account && (
                    <Alert severity="warning" sx={{ mb: 3 }}>
                        <AlertTitle>Cüzdan Bağlı Değil</AlertTitle>
                        Geri dönüşüm işlemleri için lütfen cüzdanınızı bağlayın.
                    </Alert>
                )}

                {account && !isCorrectNetwork && (
                    <Alert severity="warning" sx={{ mb: 3 }}>
                        <AlertTitle>Yanlış Ağ</AlertTitle>
                        Lütfen Polygon Mumbai ağına geçin.
                    </Alert>
                )}

                <Grid container spacing={4}>
                    {/* QR Code Generation Section */}
                    <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 3, height: '100%' }}>
                            <Typography variant="h6" gutterBottom>
                                QR Kod Oluştur
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Geri dönüşüm merkezine gitmeden önce QR kodunuzu oluşturun.
                            </Typography>
                            <RecyclingQR />
                        </Paper>
                    </Grid>

                    {/* Information Section */}
                    <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 3, height: '100%' }}>
                            <Typography variant="h6" gutterBottom>
                                Nasıl Çalışır?
                            </Typography>
                            <Box component="ol" sx={{ pl: 2 }}>
                                <li>
                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                        Malzeme tipini ve miktarı girin
                                    </Typography>
                                </li>
                                <li>
                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                        QR kodu oluşturun (3 saat geçerli)
                                    </Typography>
                                </li>
                                <li>
                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                        Malzemelerinizi geri dönüşüm merkezine götürün
                                    </Typography>
                                </li>
                                <li>
                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                        Operatör QR kodunuzu tarayarak doğrulama yapar
                                    </Typography>
                                </li>
                                <li>
                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                        BELT tokenlarınız otomatik olarak cüzdanınıza gönderilir
                                    </Typography>
                                </li>
                            </Box>

                            <Typography variant="h6" sx={{ mt: 3 }} gutterBottom>
                                Ödül Oranları
                            </Typography>
                            <Box sx={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(3, 1fr)', 
                                gap: 2,
                                mt: 2 
                            }}>
                                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light' }}>
                                    <Typography variant="h6">🥛</Typography>
                                    <Typography variant="subtitle2">Cam</Typography>
                                    <Typography variant="body2">1x BELT/kg</Typography>
                                </Paper>
                                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'info.light' }}>
                                    <Typography variant="h6">📄</Typography>
                                    <Typography variant="subtitle2">Kağıt</Typography>
                                    <Typography variant="body2">1.5x BELT/kg</Typography>
                                </Paper>
                                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.light' }}>
                                    <Typography variant="h6">🔩</Typography>
                                    <Typography variant="subtitle2">Metal</Typography>
                                    <Typography variant="body2">2x BELT/kg</Typography>
                                </Paper>
                            </Box>
                        </Paper>
                    </Grid>
                </Grid>
            </Box>
        </Container>
    );
}

export default Recycling;