import { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    Alert,
    AlertTitle,
    Chip,
    CircularProgress,
    Divider,
    List,
    ListItem,
    ListItemText,
    ListItemIcon
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useWallet } from '../context/WalletContext';

export default function PenaltyStatus() {
    const { account } = useWallet();
    const [loading, setLoading] = useState(false);
    const [penalties, setPenalties] = useState([]);
    const [totalPenalty, setTotalPenalty] = useState(0);

    useEffect(() => {
        if (account) {
            loadPenalties();
        }
    }, [account]);

    const loadPenalties = async () => {
        setLoading(true);
        try {
            // Mock data - in production, this would come from backend
            // Simulating no penalties for demo
            const mockPenalties = [];

            setPenalties(mockPenalties);
            setTotalPenalty(mockPenalties.reduce((sum, p) => sum + p.amount, 0));
        } catch (err) {
            console.error('Error loading penalties:', err);
        } finally {
            setLoading(false);
        }
    };

    if (!account) {
        return (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
                <Typography color="text.secondary">
                    Ceza durumunuzu görmek için cüzdanınızı bağlayın
                </Typography>
            </Paper>
        );
    }

    return (
        <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
                ⚖️ Ceza Durumu
            </Typography>

            <Divider sx={{ my: 2 }} />

            {loading ? (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                    <CircularProgress size={30} />
                </Box>
            ) : penalties.length === 0 ? (
                <Alert severity="success" icon={<CheckCircleIcon />}>
                    <AlertTitle>Temiz Kayıt</AlertTitle>
                    Herhangi bir cezanız bulunmamaktadır. Tebrikler! 🎉
                </Alert>
            ) : (
                <>
                    {/* Total Penalty */}
                    <Box sx={{
                        textAlign: 'center',
                        py: 2,
                        bgcolor: 'error.light',
                        borderRadius: 2,
                        mb: 3
                    }}>
                        <Typography variant="body2" color="text.secondary">
                            Toplam Ceza
                        </Typography>
                        <Typography variant="h4" color="error.dark">
                            {totalPenalty} BELT
                        </Typography>
                    </Box>

                    {/* Penalty List */}
                    <List>
                        {penalties.map((penalty, index) => (
                            <ListItem
                                key={index}
                                sx={{
                                    bgcolor: 'background.default',
                                    borderRadius: 1,
                                    mb: 1
                                }}
                            >
                                <ListItemIcon>
                                    <WarningIcon color="error" />
                                </ListItemIcon>
                                <ListItemText
                                    primary={penalty.type}
                                    secondary={`${penalty.date} - ${penalty.description}`}
                                />
                                <Chip
                                    label={`-${penalty.amount} BELT`}
                                    color="error"
                                    size="small"
                                />
                            </ListItem>
                        ))}
                    </List>

                    <Alert severity="info" sx={{ mt: 2 }}>
                        Cezalar depozito bakiyenizden kesilir. Yetersiz bakiye durumunda
                        ek depozito yatırmanız gerekebilir.
                    </Alert>
                </>
            )}

            {/* Information */}
            <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                    Ceza Türleri
                </Typography>
                <Typography variant="body2" color="text.secondary" component="div">
                    <ul style={{ paddingLeft: '20px', margin: 0 }}>
                        <li>Geç ödeme cezası</li>
                        <li>Yanlış sayaç beyanı</li>
                        <li>Çevre ihlali</li>
                        <li>Sözleşme ihlali</li>
                    </ul>
                </Typography>
            </Box>
        </Paper>
    );
}