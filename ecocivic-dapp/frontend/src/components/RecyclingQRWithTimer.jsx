import { useState, useEffect } from 'react';
import { Box, Typography, Paper, Button, Alert, LinearProgress, Chip } from '@mui/material';
import { QRCodeSVG } from 'qrcode.react';
import TimerIcon from '@mui/icons-material/Timer';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RefreshIcon from '@mui/icons-material/Refresh';

/**
 * RecyclingQRWithTimer - 3 saat süreli QR kod bileşeni
 * 
 * - Countdown timer göstergesi
 * - "3 saat içinde okutmalısınız" bildirimi
 * - Süre dolunca otomatik iptal ve yeni QR oluştur butonu
 * - Birden fazla atık türü için tek QR (barkod bilgisi içeren)
 */
export default function RecyclingQRWithTimer({
    qrData,
    expiresAt,
    declaredTypes = [],
    totalReward = 0,
    onExpired,
    onCreateNew
}) {
    const [timeRemaining, setTimeRemaining] = useState(null);
    const [isExpired, setIsExpired] = useState(false);
    const [showWarning, setShowWarning] = useState(false);

    useEffect(() => {
        if (!expiresAt) return;

        const calculateTimeRemaining = () => {
            const now = new Date().getTime();
            // UTC tarih olarak parse et
            let expiryStr = expiresAt;
            if (!expiryStr.endsWith('Z') && !expiryStr.includes('+')) {
                expiryStr = expiryStr + 'Z'; // UTC olarak işle
            }
            const expiry = new Date(expiryStr).getTime();
            const diff = expiry - now;

            // Debug log
            console.log('[QR Timer] Now:', new Date(now).toISOString(), 'Expires:', expiryStr, 'Diff:', diff, 'ms');

            if (diff <= 0) {
                setIsExpired(true);
                setTimeRemaining(null);
                if (onExpired) onExpired();
                return;
            }

            // Son 30 dakika uyarısı
            if (diff <= 30 * 60 * 1000) {
                setShowWarning(true);
            }

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            setTimeRemaining({ hours, minutes, seconds, totalMs: diff });
        };

        calculateTimeRemaining();
        const interval = setInterval(calculateTimeRemaining, 1000);

        return () => clearInterval(interval);
    }, [expiresAt, onExpired]);

    const formatTime = () => {
        if (!timeRemaining) return '00:00:00';
        const { hours, minutes, seconds } = timeRemaining;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const getProgressValue = () => {
        if (!timeRemaining) return 0;
        const totalTime = 3 * 60 * 60 * 1000; // 3 saat in ms
        return (timeRemaining.totalMs / totalTime) * 100;
    };

    // QR için data hazırla
    const qrPayload = JSON.stringify({
        ...qrData,
        declaredTypes: declaredTypes.map(t => ({ type: t.id, amount: t.amount })),
        totalReward,
        expiresAt,
    });

    if (isExpired) {
        return (
            <Paper sx={{ p: 3, textAlign: 'center', bgcolor: '#ffebee' }}>
                <WarningIcon sx={{ fontSize: 60, color: 'error.main', mb: 2 }} />
                <Typography variant="h6" color="error" gutterBottom>
                    QR Kodu Süresi Doldu!
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    3 saatlik kullanım süresi dolmuştur. Yeni bir QR kodu oluşturmanız gerekmektedir.
                </Typography>
                <Alert severity="warning" sx={{ mb: 2 }}>
                    Süre dolan QR kodları geçersizdir ve geri dönüşüm merkezinde kullanılamaz.
                </Alert>
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<RefreshIcon />}
                    onClick={onCreateNew}
                >
                    Yeni QR Oluştur
                </Button>
            </Paper>
        );
    }

    return (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
            {/* Timer Header */}
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                mb: 2
            }}>
                <TimerIcon color={showWarning ? 'warning' : 'primary'} />
                <Typography
                    variant="h5"
                    fontWeight="bold"
                    color={showWarning ? 'warning.main' : 'primary.main'}
                >
                    {formatTime()}
                </Typography>
            </Box>

            {/* Progress Bar */}
            <LinearProgress
                variant="determinate"
                value={getProgressValue()}
                sx={{
                    mb: 2,
                    height: 8,
                    borderRadius: 4,
                    bgcolor: showWarning ? 'warning.light' : 'primary.light',
                    '& .MuiLinearProgress-bar': {
                        bgcolor: showWarning ? 'warning.main' : 'primary.main'
                    }
                }}
            />

            {/* Uyarı */}
            {showWarning && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    ⚠️ Son 30 dakika! Lütfen geri dönüşüm merkezine gidin.
                </Alert>
            )}

            {/* QR Code */}
            <Box sx={{
                display: 'flex',
                justifyContent: 'center',
                my: 3,
                p: 2,
                bgcolor: 'white',
                borderRadius: 2,
                boxShadow: 2
            }}>
                <QRCodeSVG
                    value={qrPayload}
                    size={220}
                    level="H"
                    includeMargin={true}
                />
            </Box>

            {/* Beyan Edilen Türler */}
            {declaredTypes.length > 0 && (
                <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                        📦 Beyan Edilen Atıklar:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                        {declaredTypes.map((type, index) => (
                            <Chip
                                key={index}
                                label={`${type.label}: ${type.amount} ${type.unit}`}
                                size="small"
                                color="primary"
                                variant="outlined"
                            />
                        ))}
                    </Box>
                </Box>
            )}

            {/* Toplam Ödül */}
            <Paper sx={{ p: 2, bgcolor: 'success.light', mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                    Beklenen Ödül:
                </Typography>
                <Typography variant="h5" color="success.dark" fontWeight="bold">
                    {totalReward} BELT
                </Typography>
            </Paper>

            {/* Blockchain Bilgisi */}
            <Alert severity="success" sx={{ mb: 2, textAlign: 'left' }}>
                <Typography variant="body2" fontWeight="bold" gutterBottom>
                    🔗 Blockchain Kaydı
                </Typography>
                <Typography variant="body2">
                    Bu QR kodunun hash'i blockchain'e kaydedilmiştir.
                    Tekrar kullanılamaz ve değiştirilemez.
                </Typography>
                {qrData?.hash && (
                    <Typography variant="caption" sx={{
                        display: 'block',
                        mt: 1,
                        fontFamily: 'monospace',
                        bgcolor: 'rgba(0,0,0,0.05)',
                        p: 0.5,
                        borderRadius: 1,
                        wordBreak: 'break-all'
                    }}>
                        Hash: {qrData.hash.substring(0, 20)}...
                    </Typography>
                )}
            </Alert>

            {/* Bildirim */}
            <Alert severity="info" icon={<CheckCircleIcon />}>
                <Typography variant="body2">
                    Bu QR kodunu geri dönüşüm merkezinde personele gösterin.
                    Onay sonrası BELT ödülünüz cüzdanınıza aktarılacaktır.
                </Typography>
            </Alert>
        </Paper>
    );
}
