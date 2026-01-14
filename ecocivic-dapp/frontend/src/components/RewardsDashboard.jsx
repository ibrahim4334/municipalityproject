import { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    Grid,
    CircularProgress,
    Divider,
    Chip
} from '@mui/material';
import { ethers } from 'ethers';
import { useWallet } from '../context/WalletContext';
import { getBeltBalance } from '../services/contractService';

export default function RewardsDashboard() {
    const { account, signer } = useWallet();
    const [beltBalance, setBeltBalance] = useState('0');
    const [loading, setLoading] = useState(false);
    const [rewardHistory, setRewardHistory] = useState([]);

    useEffect(() => {
        if (account && signer) {
            loadRewards();
        }
    }, [account, signer]);

    const loadRewards = async () => {
        setLoading(true);
        try {
            const balance = await getBeltBalance(signer, account);
            setBeltBalance(balance);

            // Mock reward history - in production, this would come from backend/events
            setRewardHistory([
                { type: 'recycling', amount: '50', date: '2026-01-10', material: 'Metal' },
                { type: 'water', amount: '25', date: '2026-01-08', reading: '1234' },
                { type: 'recycling', amount: '15', date: '2026-01-05', material: 'Kağıt' },
            ]);
        } catch (err) {
            console.error('Error loading rewards:', err);
        } finally {
            setLoading(false);
        }
    };

    const getRewardIcon = (type) => {
        switch (type) {
            case 'recycling':
                return '♻️';
            case 'water':
                return '💧';
            default:
                return '🎁';
        }
    };

    const getRewardLabel = (type) => {
        switch (type) {
            case 'recycling':
                return 'Geri Dönüşüm';
            case 'water':
                return 'Su Tasarrufu';
            default:
                return 'Ödül';
        }
    };

    if (!account) {
        return (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
                <Typography color="text.secondary">
                    Ödüllerinizi görmek için cüzdanınızı bağlayın
                </Typography>
            </Paper>
        );
    }

    return (
        <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
                🏆 Ödül Panosu
            </Typography>

            <Divider sx={{ my: 2 }} />

            {/* Total Balance */}
            <Box sx={{
                textAlign: 'center',
                py: 3,
                bgcolor: 'primary.light',
                borderRadius: 2,
                mb: 3
            }}>
                <Typography variant="body2" color="text.secondary">
                    Toplam BELT Bakiyesi
                </Typography>
                {loading ? (
                    <CircularProgress size={30} sx={{ mt: 1 }} />
                ) : (
                    <Typography variant="h3" color="primary.dark">
                        {parseFloat(beltBalance).toFixed(2)}
                    </Typography>
                )}
                <Typography variant="body2" color="text.secondary">
                    BELT Token
                </Typography>
            </Box>

            {/* Stats Grid */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={4}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
                        <Typography variant="h6">♻️</Typography>
                        <Typography variant="body2">Geri Dönüşüm</Typography>
                        <Typography variant="h6" color="success.dark">65</Typography>
                        <Typography variant="caption">BELT</Typography>
                    </Box>
                </Grid>
                <Grid item xs={4}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
                        <Typography variant="h6">💧</Typography>
                        <Typography variant="body2">Su Tasarrufu</Typography>
                        <Typography variant="h6" color="info.dark">25</Typography>
                        <Typography variant="caption">BELT</Typography>
                    </Box>
                </Grid>
                <Grid item xs={4}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
                        <Typography variant="h6">🎯</Typography>
                        <Typography variant="body2">Bonus</Typography>
                        <Typography variant="h6" color="warning.dark">10</Typography>
                        <Typography variant="caption">BELT</Typography>
                    </Box>
                </Grid>
            </Grid>

            {/* Recent Rewards */}
            <Typography variant="subtitle2" gutterBottom>
                Son Ödüller
            </Typography>

            {rewardHistory.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    Henüz ödül kazanmadınız
                </Typography>
            ) : (
                <Box>
                    {rewardHistory.map((reward, index) => (
                        <Box
                            key={index}
                            sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                py: 1.5,
                                borderBottom: index < rewardHistory.length - 1 ? '1px solid #eee' : 'none'
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="h6">
                                    {getRewardIcon(reward.type)}
                                </Typography>
                                <Box>
                                    <Typography variant="body2">
                                        {getRewardLabel(reward.type)}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {reward.date}
                                    </Typography>
                                </Box>
                            </Box>
                            <Chip
                                label={`+${reward.amount} BELT`}
                                color="success"
                                size="small"
                            />
                        </Box>
                    ))}
                </Box>
            )}
        </Paper>
    );
}