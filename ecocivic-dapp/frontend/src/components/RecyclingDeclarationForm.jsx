import { useState } from 'react';
import {
    Box, Typography, TextField, Button, Grid, Paper,
    FormControl, InputLabel, InputAdornment, Alert,
    Divider, Chip, CircularProgress
} from '@mui/material';
import RecyclingIcon from '@mui/icons-material/Recycling';
import LocalDrinkIcon from '@mui/icons-material/LocalDrink';
import DescriptionIcon from '@mui/icons-material/Description';
import BuildIcon from '@mui/icons-material/Build';
import DevicesIcon from '@mui/icons-material/Devices';
import QrCodeIcon from '@mui/icons-material/QrCode';
import { useWallet } from '../context/WalletContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Atık türleri ve ödül oranları
const WASTE_TYPES = [
    { id: 'plastic', label: 'Plastik', icon: <RecyclingIcon />, unit: 'kg', rate: 10, color: '#2196f3' },
    { id: 'glass', label: 'Cam', icon: <LocalDrinkIcon />, unit: 'kg', rate: 12, color: '#4caf50' },
    { id: 'metal', label: 'Metal', icon: <BuildIcon />, unit: 'kg', rate: 15, color: '#ff9800' },
    { id: 'paper', label: 'Kağıt/Karton', icon: <DescriptionIcon />, unit: 'kg', rate: 8, color: '#9c27b0' },
    { id: 'electronic', label: 'Elektronik', icon: <DevicesIcon />, unit: 'adet', rate: 25, color: '#f44336' },
];

/**
 * RecyclingDeclarationForm - Tüm atık türlerini soran kapsamlı beyan formu
 * 
 * - Tüm atık türleri sorulur
 * - Sadece beyan edilen türler için QR oluşturulur
 * - 3 saatlik QR süresi
 */
export default function RecyclingDeclarationForm({ onQRGenerated }) {
    const { account } = useWallet();
    const [amounts, setAmounts] = useState({
        plastic: '',
        glass: '',
        metal: '',
        paper: '',
        electronic: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const handleAmountChange = (type, value) => {
        // Sadece pozitif sayılar
        const numValue = value === '' ? '' : Math.max(0, parseFloat(value) || 0);
        setAmounts(prev => ({
            ...prev,
            [type]: numValue
        }));
        setError(null);
    };

    const calculateTotalReward = () => {
        return WASTE_TYPES.reduce((total, type) => {
            const amount = parseFloat(amounts[type.id]) || 0;
            return total + (amount * type.rate);
        }, 0);
    };

    const getDeclaredTypes = () => {
        return WASTE_TYPES.filter(type => {
            const amount = parseFloat(amounts[type.id]) || 0;
            return amount > 0;
        });
    };

    const handleSubmit = async () => {
        const declaredTypes = getDeclaredTypes();

        if (declaredTypes.length === 0) {
            setError('En az bir atık türü için miktar girmelisiniz.');
            return;
        }

        if (!account) {
            setError('Lütfen cüzdanınızı bağlayın.');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            // Beyan verisini hazırla
            const declarationData = {
                wallet_address: account,
                plastic_kg: parseFloat(amounts.plastic) || 0,
                glass_kg: parseFloat(amounts.glass) || 0,
                metal_kg: parseFloat(amounts.metal) || 0,
                paper_kg: parseFloat(amounts.paper) || 0,
                electronic_count: parseInt(amounts.electronic) || 0,
            };

            const response = await fetch(`${API_URL}/api/recycling/declare`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Wallet-Address': account,
                },
                body: JSON.stringify(declarationData),
            });

            const result = await response.json();

            if (response.ok && result.success) {
                setSuccess({
                    message: 'Beyan başarıyla oluşturuldu! QR kodunuz 3 saat geçerlidir.',
                    qrData: result.qr_data,
                    expiresAt: result.expires_at,
                    totalReward: result.total_reward,
                });

                // Parent component'e QR bilgisini ilet
                if (onQRGenerated) {
                    onQRGenerated(result);
                }

                // Formu temizle
                setAmounts({
                    plastic: '',
                    glass: '',
                    metal: '',
                    paper: '',
                    electronic: '',
                });
            } else {
                setError(result.message || 'Beyan oluşturulurken bir hata oluştu.');
            }
        } catch (err) {
            console.error('Declaration error:', err);
            setError('Sunucu ile iletişim kurulamadı. Lütfen tekrar deneyin.');
        } finally {
            setLoading(false);
        }
    };

    const totalReward = calculateTotalReward();
    const declaredTypes = getDeclaredTypes();

    return (
        <Box>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <RecyclingIcon color="success" />
                Geri Dönüşüm Beyanı
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Getireceğiniz tüm atık türleri için miktar girin. Sadece beyan ettiğiniz türler için QR kodu oluşturulacak.
            </Typography>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {success && (
                <Alert severity="success" sx={{ mb: 2 }} icon={<QrCodeIcon />}>
                    <Typography variant="body2" fontWeight="bold">{success.message}</Typography>
                    <Typography variant="caption">
                        Toplam Ödül: {success.totalReward} BELT
                    </Typography>
                </Alert>
            )}

            {!account && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    Beyan oluşturmak için lütfen cüzdanınızı bağlayın.
                </Alert>
            )}

            <Grid container spacing={2}>
                {WASTE_TYPES.map((type) => (
                    <Grid item xs={12} sm={6} key={type.id}>
                        <Paper
                            sx={{
                                p: 2,
                                border: amounts[type.id] ? `2px solid ${type.color}` : '1px solid #ddd',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <Box sx={{ color: type.color }}>{type.icon}</Box>
                                <Typography variant="subtitle1" fontWeight="bold">
                                    {type.label}
                                </Typography>
                                <Chip
                                    label={`${type.rate} BELT/${type.unit}`}
                                    size="small"
                                    sx={{ ml: 'auto', bgcolor: type.color, color: 'white' }}
                                />
                            </Box>
                            <TextField
                                fullWidth
                                type="number"
                                size="small"
                                value={amounts[type.id]}
                                onChange={(e) => handleAmountChange(type.id, e.target.value)}
                                placeholder="0"
                                InputProps={{
                                    endAdornment: <InputAdornment position="end">{type.unit}</InputAdornment>,
                                    inputProps: { min: 0, step: type.unit === 'adet' ? 1 : 0.1 }
                                }}
                                disabled={!account || loading}
                            />
                            {amounts[type.id] > 0 && (
                                <Typography variant="caption" color="success.main" sx={{ mt: 0.5, display: 'block' }}>
                                    Kazanılacak: {(parseFloat(amounts[type.id]) * type.rate).toFixed(0)} BELT
                                </Typography>
                            )}
                        </Paper>
                    </Grid>
                ))}
            </Grid>

            <Divider sx={{ my: 3 }} />

            {/* Özet */}
            <Paper sx={{ p: 2, bgcolor: 'primary.light', mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                    📋 Beyan Özeti
                </Typography>
                {declaredTypes.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                        Henüz bir atık türü seçilmedi.
                    </Typography>
                ) : (
                    <>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                            {declaredTypes.map(type => (
                                <Chip
                                    key={type.id}
                                    icon={type.icon}
                                    label={`${amounts[type.id]} ${type.unit}`}
                                    size="small"
                                    sx={{ bgcolor: type.color, color: 'white' }}
                                />
                            ))}
                        </Box>
                        <Typography variant="h6" color="primary.dark">
                            Toplam Ödül: {totalReward.toFixed(0)} BELT
                        </Typography>
                    </>
                )}
            </Paper>

            {/* QR Oluştur Butonu */}
            <Button
                variant="contained"
                color="success"
                fullWidth
                size="large"
                onClick={handleSubmit}
                disabled={!account || loading || declaredTypes.length === 0}
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <QrCodeIcon />}
            >
                {loading ? 'QR Oluşturuluyor...' : 'QR Kod Oluştur (3 Saat Geçerli)'}
            </Button>

            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
                ⏰ QR kodu 3 saat içinde geri dönüşüm merkezinde okutulmalıdır.
            </Typography>
        </Box>
    );
}
