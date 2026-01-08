import { Typography, Button, Grid, Paper, Box } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import ParkIcon from '@mui/icons-material/Park';
import WaterDropIcon from '@mui/icons-material/WaterDrop';

function Home() {
    const navigate = useNavigate();

    return (
        <Box>
            <Box sx={{ textAlign: 'center', mb: 8 }}>
                <Typography variant="h2" component="h1" gutterBottom sx={{ fontWeight: 'bold', background: 'linear-gradient(45deg, #4caf50 30%, #2196f3 90%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Belediyeniz İçin <br /> Geleceğin Çözümü
                </Typography>
                <Typography variant="h5" color="text.secondary" paragraph>
                    Geri dönüştürün, ödül kazanın. Su tüketiminizi yapay zeka ile takip edin.
                </Typography>
                <Button variant="contained" size="large" onClick={() => navigate('/dashboard')} sx={{ mt: 2 }}>
                    Hemen Başla
                </Button>
            </Box>

            <Grid container spacing={4}>
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 4, height: '100%', textAlign: 'center' }} elevation={3}>
                        <ParkIcon sx={{ fontSize: 60, color: '#4caf50', mb: 2 }} />
                        <Typography variant="h5" gutterBottom>
                            Geri Dönüşüm
                        </Typography>
                        <Typography>
                            Cam, kağıt ve metal atıklarınızı geri dönüştürerek BELT token kazanın.
                        </Typography>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 4, height: '100%', textAlign: 'center' }} elevation={3}>
                        <WaterDropIcon sx={{ fontSize: 60, color: '#2196f3', mb: 2 }} />
                        <Typography variant="h5" gutterBottom>
                            Akıllı Su Yönetimi
                        </Typography>
                        <Typography>
                            Sayacınızın fotoğrafını çekin, yapay zeka okusun ve ödülleri kapsın.
                        </Typography>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    )
}

export default Home