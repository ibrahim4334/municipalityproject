import { useState, useEffect } from 'react';
import { Typography, Container, Box, Grid, Paper, Alert, AlertTitle, Divider, Chip } from '@mui/material';
import RecyclingDeclarationForm from '../components/RecyclingDeclarationForm';
import RecyclingQRWithTimer from '../components/RecyclingQRWithTimer';
import { useWallet } from '../context/WalletContext';

const QR_STORAGE_KEY = 'ecocivic_active_qr';

function Recycling() {
    const { account, isCorrectNetwork, error } = useWallet();

    // localStorage'dan QR verisini yükle
    const [qrResult, setQrResult] = useState(() => {
        try {
            const saved = localStorage.getItem(QR_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Süresi dolmuş mu kontrol et
                if (parsed.expires_at && new Date(parsed.expires_at) > new Date()) {
                    return parsed;
                } else {
                    localStorage.removeItem(QR_STORAGE_KEY);
                }
            }
        } catch (e) {
            console.error('Error loading QR from storage:', e);
        }
        return null;
    });

    const handleQRGenerated = (result) => {
        setQrResult(result);
        // localStorage'a kaydet
        try {
            localStorage.setItem(QR_STORAGE_KEY, JSON.stringify(result));
        } catch (e) {
            console.error('Error saving QR to storage:', e);
        }
    };

    const handleQRExpired = () => {
        setQrResult(null);
        localStorage.removeItem(QR_STORAGE_KEY);
    };

    const handleCreateNew = () => {
        setQrResult(null);
        localStorage.removeItem(QR_STORAGE_KEY);
    };

    // QR detaylarını hazırla
    const getDeclaredTypesForQR = () => {
        if (!qrResult?.declared_types) return [];
        return qrResult.declared_types;
    };

    return (
        <Container maxWidth="lg">
            <Box sx={{ py: 4 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    ♻️ Geri Dönüşüm Beyanı
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                    Tüm atık türlerinizi beyan edin, 3 saatlik QR kod alın ve BELT token kazanın!
                </Typography>

                {/* 3 Saat Uyarısı */}
                <Alert severity="info" sx={{ mb: 3 }}>
                    ⏰ <strong>Önemli:</strong> QR kodunuz oluşturulduktan sonra <strong>3 saat</strong> içinde geri dönüşüm merkezinde okutulmalıdır.
                    Süre dolduğunda QR geçersiz olur ve yeni beyan oluşturmanız gerekir.
                </Alert>

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
                        Lütfen doğru ağa geçin.
                    </Alert>
                )}

                <Grid container spacing={4}>
                    {/* Beyan Formu veya QR Gösterimi */}
                    <Grid item xs={12} md={7}>
                        <Paper sx={{ p: 3, height: '100%' }}>
                            {!qrResult ? (
                                <RecyclingDeclarationForm onQRGenerated={handleQRGenerated} />
                            ) : (
                                <RecyclingQRWithTimer
                                    qrData={qrResult.qr_data}
                                    expiresAt={qrResult.expires_at}
                                    declaredTypes={getDeclaredTypesForQR()}
                                    totalReward={qrResult.total_reward}
                                    onExpired={handleQRExpired}
                                    onCreateNew={handleCreateNew}
                                />
                            )}
                        </Paper>
                    </Grid>

                    {/* Bilgi Bölümü */}
                    <Grid item xs={12} md={5}>
                        <Paper sx={{ p: 3, height: '100%' }}>
                            <Typography variant="h6" gutterBottom>
                                📋 Nasıl Çalışır?
                            </Typography>
                            <Box component="ol" sx={{ pl: 2 }}>
                                <li>
                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                        <strong>Tüm atık türleri için</strong> miktar girin (beyan etmeyecekleriniz 0 kalabilir)
                                    </Typography>
                                </li>
                                <li>
                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                        QR kodu oluşturun (<strong>3 saat geçerli</strong>)
                                    </Typography>
                                </li>
                                <li>
                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                        Malzemelerinizi geri dönüşüm merkezine götürün
                                    </Typography>
                                </li>
                                <li>
                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                        Personel QR kodunuzu tarayarak <strong>onay veya fraud</strong> işaretler
                                    </Typography>
                                </li>
                                <li>
                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                        Onay sonrası BELT tokenlarınız cüzdanınıza gönderilir
                                    </Typography>
                                </li>
                            </Box>

                            <Divider sx={{ my: 2 }} />

                            <Typography variant="h6" gutterBottom>
                                💰 Ödül Oranları
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
                                <Chip label="🧴 Plastik: 10 BELT/kg" color="primary" />
                                <Chip label="🥛 Cam: 12 BELT/kg" color="success" />
                                <Chip label="🔩 Metal: 15 BELT/kg" color="warning" />
                                <Chip label="📄 Kağıt: 8 BELT/kg" color="secondary" />
                                <Chip label="📱 Elektronik: 25 BELT/adet" color="error" />
                            </Box>

                            <Divider sx={{ my: 2 }} />

                            <Typography variant="h6" gutterBottom>
                                ⚠️ Fraud Kuralları
                            </Typography>
                            <Alert severity="warning" variant="outlined">
                                <Typography variant="body2">
                                    • Yanlış beyan <strong>2 hak</strong> sistemine tabidir<br />
                                    • Her fraud tespitinde 1 hak düşer<br />
                                    • 0 hak = hesap kara listeye alınır
                                </Typography>
                            </Alert>
                        </Paper>
                    </Grid>
                </Grid>
            </Box>
        </Container>
    );
}

export default Recycling;