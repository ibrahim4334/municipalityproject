import { Typography, Container, Box, Grid, Paper, Alert, AlertTitle } from '@mui/material';
import WaterMeterUpload from '../components/WaterMeterUpload';
import { useWallet } from '../context/WalletContext';

function Water() {
    const { account, isCorrectNetwork, error } = useWallet();

    return (
        <Container maxWidth="lg">
            <Box sx={{ py: 4 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    💧 Su Sayacı Okuma
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                    Su sayacınızın fotoğrafını yükleyin, AI ile doğrulama yapılsın ve faturanızı ödeyin.
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
                        Su sayacı işlemleri için lütfen cüzdanınızı bağlayın.
                    </Alert>
                )}

                {account && !isCorrectNetwork && (
                    <Alert severity="warning" sx={{ mb: 3 }}>
                        <AlertTitle>Yanlış Ağ</AlertTitle>
                        Lütfen Polygon Mumbai ağına geçin.
                    </Alert>
                )}

                <Grid container spacing={4}>
                    {/* Upload Section */}
                    <Grid item xs={12} md={7}>
                        <Paper sx={{ p: 3 }}>
                            <Typography variant="h6" gutterBottom>
                                Sayaç Fotoğrafı Yükle
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Su sayacınızın net bir fotoğrafını çekin. AI sistemimiz sayaç değerini otomatik okuyacaktır.
                            </Typography>
                            <WaterMeterUpload />
                        </Paper>
                    </Grid>

                    {/* Information Section */}
                    <Grid item xs={12} md={5}>
                        <Paper sx={{ p: 3, mb: 3 }}>
                            <Typography variant="h6" gutterBottom>
                                📸 Fotoğraf İpuçları
                            </Typography>
                            <Box component="ul" sx={{ pl: 2 }}>
                                <li>
                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                        Sayacı doğrudan karşıdan çekin
                                    </Typography>
                                </li>
                                <li>
                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                        Yeterli aydınlatma olduğundan emin olun
                                    </Typography>
                                </li>
                                <li>
                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                        Rakamların net görünür olmasına dikkat edin
                                    </Typography>
                                </li>
                                <li>
                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                        Cam yüzeyinde yansıma olmamasına özen gösterin
                                    </Typography>
                                </li>
                            </Box>
                        </Paper>

                        <Paper sx={{ p: 3, mb: 3 }}>
                            <Typography variant="h6" gutterBottom>
                                ⚙️ Nasıl Çalışır?
                            </Typography>
                            <Box component="ol" sx={{ pl: 2 }}>
                                <li>
                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                        Sayaç fotoğrafı yükleyin
                                    </Typography>
                                </li>
                                <li>
                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                        AI sistem OCR ile değeri okur
                                    </Typography>
                                </li>
                                <li>
                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                        Anomali kontrolü yapılır
                                    </Typography>
                                </li>
                                <li>
                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                        Blockchain'e kayıt edilir
                                    </Typography>
                                </li>
                                <li>
                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                        BELT ödülünüz hesaplanır
                                    </Typography>
                                </li>
                            </Box>
                        </Paper>

                        <Paper sx={{ p: 3, bgcolor: 'primary.light' }}>
                            <Typography variant="h6" gutterBottom>
                                🎁 Ödül Sistemi
                            </Typography>
                            <Typography variant="body2">
                                Düşük su tüketimi göstermeniz durumunda BELT token ödülü kazanırsınız.
                                Tüketim geçmişinize göre ödül miktarı hesaplanır.
                            </Typography>
                        </Paper>
                    </Grid>
                </Grid>
            </Box>
        </Container>
    );
}

export default Water;