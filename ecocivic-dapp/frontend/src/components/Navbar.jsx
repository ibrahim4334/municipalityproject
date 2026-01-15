import { AppBar, Toolbar, Typography, Button, Box, Chip, Alert } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import RecyclingIcon from '@mui/icons-material/Recycling';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { useWallet } from '../context/WalletContext';

function Navbar() {
    const { account, connectWallet, balance, chainId, isConnecting, isSwitchingNetwork, error, switchNetwork, isCorrectNetwork } = useWallet();

    const handleConnect = async () => {
        await connectWallet();
    };

    const handleSwitchNetwork = async () => {
        await switchNetwork();
    };

    const formatAddress = (addr) => {
        return addr ? `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}` : '';
    };

    return (
        <>
            <AppBar position="static" color="default" elevation={1}>
                <Toolbar>
                    <RecyclingIcon sx={{ mr: 2, color: 'primary.main' }} />
                    <Typography variant="h6" component="div" sx={{ flexGrow: 0, fontWeight: 'bold', mr: 3 }}>
                        EcoCivic
                    </Typography>

                    {/* Navigation Links */}
                    <Box sx={{ display: 'flex', gap: 1, flexGrow: 1 }}>
                        <Button component={RouterLink} to="/" color="inherit" size="small">
                            Ana Sayfa
                        </Button>
                        <Button component={RouterLink} to="/dashboard" color="inherit" size="small">
                            Panel
                        </Button>
                        <Button component={RouterLink} to="/recycling" color="inherit" size="small">
                            ♻️ Geri Dönüşüm
                        </Button>
                        <Button component={RouterLink} to="/water" color="inherit" size="small">
                            💧 Su Sayacı
                        </Button>
                        <Button
                            component={RouterLink}
                            to="/admin"
                            color="inherit"
                            size="small"
                            startIcon={<AdminPanelSettingsIcon />}
                        >
                            Admin
                        </Button>
                    </Box>

                    {/* Wallet Section */}
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        {account ? (
                            <>
                                {!isCorrectNetwork && (
                                    <Button
                                        variant="outlined"
                                        color="warning"
                                        size="small"
                                        startIcon={<SwapHorizIcon />}
                                        onClick={handleSwitchNetwork}
                                        disabled={isSwitchingNetwork}
                                    >
                                        {isSwitchingNetwork ? 'Switching...' : 'Switch Network'}
                                    </Button>
                                )}
                                {isCorrectNetwork && (
                                    <>
                                        <Chip
                                            icon={<AccountBalanceWalletIcon />}
                                            label={`${parseFloat(balance).toFixed(4)} ETH`}
                                            variant="outlined"
                                            size="small"
                                        />
                                        <Chip
                                            label={formatAddress(account)}
                                            color="primary"
                                            variant="filled"
                                            size="small"
                                        />
                                    </>
                                )}
                            </>
                        ) : (
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={handleConnect}
                                disabled={isConnecting}
                            >
                                {isConnecting ? 'Connecting...' : 'Cüzdan Bağla'}
                            </Button>
                        )}
                    </Box>
                </Toolbar>
            </AppBar>
            {error && (
                <Alert severity="error" onClose={() => { }} sx={{ m: 1 }}>
                    {error}
                </Alert>
            )}
        </>
    )
}

export default Navbar
