import { Typography, Button, Grid, Paper, Box, Divider } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import ParkIcon from '@mui/icons-material/Park';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import LinkIcon from '@mui/icons-material/Link';
import VerifiedIcon from '@mui/icons-material/Verified';
import SecurityIcon from '@mui/icons-material/Security';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';

function Home() {
    const navigate = useNavigate();

    return (
        <Box>
            {/* Hero Section */}
            <Box sx={{ textAlign: 'center', mb: 8 }}>
                <Typography variant="h2" component="h1" gutterBottom sx={{ fontWeight: 'bold', background: 'linear-gradient(45deg, #4caf50 30%, #2196f3 90%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Belediyeniz İçin <br /> Geleceğin Çözümü
                </Typography>
                <Typography variant="h5" color="text.secondary" paragraph>
                    Geri dönüştürün, ödül kazanın. Su tüketiminizi blockchain ile güvence altına alın.
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 2, maxWidth: 600, mx: 'auto' }}>
                    🔗 <strong>Blockchain tabanlı</strong> şeffaf ve değiştirilemez kayıt sistemi
                </Typography>
                <Button variant="contained" size="large" onClick={() => navigate('/dashboard')} sx={{ mt: 2 }}>
                    Hemen Başla
                </Button>
            </Box>

            {/* Ana Özellikler */}
            <Grid container spacing={4} sx={{ mb: 6 }}>
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 4, height: '100%', textAlign: 'center', bgcolor: '#2e7d32', color: 'white' }} elevation={3}>
                        <ParkIcon sx={{ fontSize: 60, color: 'white', mb: 2 }} />
                        <Typography variant="h5" gutterBottom fontWeight="bold">
                            Geri Dönüşüm
                        </Typography>
                        <Typography sx={{ opacity: 0.9 }}>
                            Cam, kağıt ve metal atıklarınızı geri dönüştürerek BELT token kazanın.
                            Her işlem blockchain'e kaydedilir.
                        </Typography>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 4, height: '100%', textAlign: 'center', bgcolor: '#1565c0', color: 'white' }} elevation={3}>
                        <WaterDropIcon sx={{ fontSize: 60, color: 'white', mb: 2 }} />
                        <Typography variant="h5" gutterBottom fontWeight="bold">
                            Akıllı Su Yönetimi
                        </Typography>
                        <Typography sx={{ opacity: 0.9 }}>
                            Sayacınızın fotoğrafını çekin, OCR ile otomatik okutun ve faturanızı blockchain'e kaydedin.
                        </Typography>
                    </Paper>
                </Grid>
            </Grid>

            {/* Neden Blockchain Bölümü */}
            <Box sx={{ mb: 6 }}>
                <Divider sx={{ mb: 4 }} />
                <Typography variant="h4" align="center" gutterBottom sx={{ fontWeight: 'bold' }}>
                    🔗 Neden Blockchain?
                </Typography>
                <Typography variant="body1" align="center" color="text.secondary" sx={{ mb: 4, maxWidth: 700, mx: 'auto' }}>
                    EcoCivic, belediye hizmetlerinde şeffaflık ve güven sağlamak için blockchain teknolojisini kullanır.
                </Typography>

                <Grid container spacing={3}>
                    <Grid item xs={12} md={4}>
                        <Paper sx={{ p: 3, textAlign: 'center', height: '100%', bgcolor: '#1e88e5', color: 'white' }} elevation={3}>
                            <VerifiedIcon sx={{ fontSize: 40, color: 'white', mb: 1, opacity: 0.9 }} />
                            <Typography variant="h6" gutterBottom fontWeight="bold">Değiştirilemez Kayıt</Typography>
                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                                Tüm işlemler blockchain'e yazılır ve sonradan değiştirilemez.
                                Bu, fraud'u önler ve şeffaflık sağlar.
                            </Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Paper sx={{ p: 3, textAlign: 'center', height: '100%', bgcolor: '#43a047', color: 'white' }} elevation={3}>
                            <SecurityIcon sx={{ fontSize: 40, color: 'white', mb: 1, opacity: 0.9 }} />
                            <Typography variant="h6" gutterBottom fontWeight="bold">Adil Ceza Sistemi</Typography>
                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                                2 hak sistemi: Vatandaşa 2 itiraz hakkı tanınır.
                                Tüm kararlar blockchain üzerinde kalıcı olarak saklanır.
                            </Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Paper sx={{ p: 3, textAlign: 'center', height: '100%', bgcolor: '#fb8c00', color: 'white' }} elevation={3}>
                            <AccountBalanceIcon sx={{ fontSize: 40, color: 'white', mb: 1, opacity: 0.9 }} />
                            <Typography variant="h6" gutterBottom fontWeight="bold">Şeffaf Ödüller</Typography>
                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                                BELT token ödülleri blockchain üzerinde mint edilir.
                                Her ödül tx hash ile izlenebilir ve doğrulanabilir.
                            </Typography>
                        </Paper>
                    </Grid>
                </Grid>
            </Box>

            {/* Blockchain Olmadan vs Blockchain ile */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h5" align="center" gutterBottom sx={{ fontWeight: 'bold' }}>
                    Blockchain Olmadan vs. Blockchain ile
                </Typography>
                <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 3, bgcolor: '#ffebee', border: '2px solid #f44336' }} elevation={1}>
                            <Typography variant="h6" color="error" gutterBottom>❌ Blockchain Olmadan</Typography>
                            <Typography variant="body2" sx={{ color: 'black' }}>• Kayıtlar merkezi veritabanında - değiştirilebilir</Typography>
                            <Typography variant="body2" sx={{ color: 'black' }}>• İtiraz süreci şeffaf değil</Typography>
                            <Typography variant="body2" sx={{ color: 'black' }}>• Ödül dağıtımı kontrol edilemez</Typography>
                            <Typography variant="body2" sx={{ color: 'black' }}>• Fraud tespiti kanıtlanamaz</Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 3, bgcolor: '#e8f5e9', border: '2px solid #4caf50' }} elevation={1}>
                            <Typography variant="h6" color="success.main" gutterBottom>✅ Blockchain ile</Typography>
                            <Typography variant="body2" sx={{ color: 'black' }}>• Her işlem kalıcı ve değiştirilemez</Typography>
                            <Typography variant="body2" sx={{ color: 'black' }}>• Kararlar şeffaf, tx hash ile izlenebilir</Typography>
                            <Typography variant="body2" sx={{ color: 'black' }}>• Token ödülleri doğrulanabilir</Typography>
                            <Typography variant="body2" sx={{ color: 'black' }}>• Adil 2 hak sistemi - kurallar otomatik</Typography>
                        </Paper>
                    </Grid>
                </Grid>
            </Box>
        </Box>
    )
}

export default Home