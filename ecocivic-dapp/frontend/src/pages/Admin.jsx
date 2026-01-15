import { Container, Typography, Box, Alert } from '@mui/material';
import StaffDashboard from '../components/StaffDashboard';
import { useWallet } from '../context/WalletContext';

/**
 * Admin Page - Yonetici ve Personel Paneli
 * Fiziksel kontroller, geri donusum onaylari, fraud tespiti
 */
function Admin() {
    const { account } = useWallet();

    return (
        <Container maxWidth="lg">
            <Box sx={{ py: 2 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    Admin / Personel Paneli
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                    Fiziksel kontroller, geri donusum onaylari ve fraud yonetimi
                </Typography>

                {!account && (
                    <Alert severity="warning" sx={{ mb: 3 }}>
                        Lutfen cuzdaninizi baglayin.
                    </Alert>
                )}

                <StaffDashboard />
            </Box>
        </Container>
    );
}

export default Admin;
