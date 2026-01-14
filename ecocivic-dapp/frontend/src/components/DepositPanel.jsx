import { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    TextField,
    Button,
    Alert,
    CircularProgress,
    Paper,
    Divider
} from '@mui/material';
import { ethers } from 'ethers';
import { useWallet } from '../context/WalletContext';
import { getContract, sendTransaction } from '../services/web3';
import EcoCivicDepositABI from '../abi/EcoCivicDeposit.json';

const DEPOSIT_CONTRACT_ADDRESS = import.meta.env.VITE_ECOCIVIC_DEPOSIT_ADDRESS || '';

export default function DepositPanel() {
    const { account, signer } = useWallet();
    const [depositAmount, setDepositAmount] = useState('');
    const [userDeposit, setUserDeposit] = useState('0');
    const [loading, setLoading] = useState(false);
    const [loadingDeposit, setLoadingDeposit] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    useEffect(() => {
        if (account && signer && DEPOSIT_CONTRACT_ADDRESS) {
            loadUserDeposit();
        }
    }, [account, signer]);

    const loadUserDeposit = async () => {
        if (!DEPOSIT_CONTRACT_ADDRESS || !signer || !account) return;

        setLoadingDeposit(true);
        try {
            const contract = getContract(
                DEPOSIT_CONTRACT_ADDRESS,
                EcoCivicDepositABI.abi || EcoCivicDepositABI
            );
            const deposit = await contract.getUserDeposit(account);
            setUserDeposit(ethers.formatUnits(deposit, 6)); // USDC has 6 decimals
        } catch (err) {
            console.error('Error loading user deposit:', err);
            setUserDeposit('0');
        } finally {
            setLoadingDeposit(false);
        }
    };

    const handleDeposit = async () => {
        if (!account || !signer) {
            setError('Lütfen önce cüzdanınızı bağlayın');
            return;
        }

        if (!DEPOSIT_CONTRACT_ADDRESS) {
            setError('Deposit kontrat adresi yapılandırılmamış');
            return;
        }

        const amount = parseFloat(depositAmount);
        if (!amount || amount <= 0) {
            setError('Geçerli bir miktar girin');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const contract = getContract(
                DEPOSIT_CONTRACT_ADDRESS,
                EcoCivicDepositABI.abi || EcoCivicDepositABI
            );

            // Convert to USDC decimals (6)
            const amountInWei = ethers.parseUnits(depositAmount, 6);

            // First approve the deposit contract to spend USDC
            // Note: In a real app, you'd need to get the USDC contract address and approve first

            const tx = await sendTransaction(
                contract.deposit,
                amountInWei
            );

            setSuccess('Transaction gönderildi, onay bekleniyor...');

            const receipt = await tx.wait();

            if (receipt.status === 1) {
                setSuccess(`${depositAmount} USDC başarıyla yatırıldı!`);
                setDepositAmount('');
                await loadUserDeposit();
            } else {
                throw new Error('Transaction başarısız oldu');
            }
        } catch (err) {
            console.error('Deposit error:', err);

            let errorMessage = 'Depozito yatırma sırasında bir hata oluştu';

            if (err.message) {
                if (err.message.includes('rejected')) {
                    errorMessage = 'İşlem kullanıcı tarafından reddedildi';
                } else if (err.message.includes('insufficient') || err.message.includes('balance')) {
                    errorMessage = 'Yetersiz bakiye';
                } else if (err.message.includes('allowance')) {
                    errorMessage = 'Önce USDC harcama izni vermeniz gerekiyor';
                } else {
                    errorMessage = err.message;
                }
            }

            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
                💰 Depozito Yönetimi
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Belediye hizmetlerinden yararlanmak için depozito yatırın.
            </Typography>

            <Divider sx={{ my: 2 }} />

            {!account && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    Lütfen önce cüzdanınızı bağlayın
                </Alert>
            )}

            {!DEPOSIT_CONTRACT_ADDRESS && (
                <Alert severity="info" sx={{ mb: 2 }}>
                    Deposit kontrat adresi henüz yapılandırılmamış
                </Alert>
            )}

            {/* Current Deposit Display */}
            <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">
                    Mevcut Depozito
                </Typography>
                <Typography variant="h5" color="primary">
                    {loadingDeposit ? (
                        <CircularProgress size={20} />
                    ) : (
                        `${userDeposit} USDC`
                    )}
                </Typography>
            </Box>

            {/* Deposit Form */}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                <TextField
                    label="Miktar (USDC)"
                    type="number"
                    value={depositAmount}
                    onChange={(e) => {
                        setDepositAmount(e.target.value);
                        setError(null);
                        setSuccess(null);
                    }}
                    size="small"
                    disabled={loading || !account || !DEPOSIT_CONTRACT_ADDRESS}
                    inputProps={{ min: 0, step: 0.01 }}
                    sx={{ flexGrow: 1 }}
                />
                <Button
                    variant="contained"
                    onClick={handleDeposit}
                    disabled={loading || !account || !DEPOSIT_CONTRACT_ADDRESS || !depositAmount}
                >
                    {loading ? <CircularProgress size={24} /> : 'Yatır'}
                </Button>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                    {error}
                </Alert>
            )}

            {success && (
                <Alert severity="success" sx={{ mt: 2 }}>
                    {success}
                </Alert>
            )}

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                * Depozitolar Aave protokolünde değerlendirilir ve faiz getirir.
            </Typography>
        </Paper>
    );
}