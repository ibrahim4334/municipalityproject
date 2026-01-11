import { AppBar, Toolbar, Typography, Button, Box, Chip, Alert } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import RecyclingIcon from '@mui/icons-material/Recycling';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
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
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
                        EcoCivic
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <Button component={RouterLink} to="/" color="inherit">
                            Home
                        </Button>
                        <Button component={RouterLink} to="/dashboard" color="inherit">
                            Dashboard
                        </Button>

                        {account ? (
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
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
                                            label={`${parseFloat(balance).toFixed(4)} MATIC`}
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
                            </Box>
                        ) : (
                            <Button 
                                variant="contained" 
                                color="primary" 
                                onClick={handleConnect}
                                disabled={isConnecting}
                            >
                                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                            </Button>
                        )}
                    </Box>
                </Toolbar>
            </AppBar>
            {error && (
                <Alert severity="error" onClose={() => {}} sx={{ m: 1 }}>
                    {error}
                </Alert>
            )}
        </>
    )
}

export default Navbar
