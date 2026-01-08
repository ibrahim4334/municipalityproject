import { AppBar, Toolbar, Typography, Button, Box, Chip } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import RecyclingIcon from '@mui/icons-material/Recycling';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { useWallet } from '../context/WalletContext';

function Navbar() {
    const { account, connectWallet, balance } = useWallet();

    const handleConnect = async () => {
        await connectWallet();
    };

    const formatAddress = (addr) => {
        return addr ? `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}` : '';
    };

    return (
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
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Chip
                                icon={<AccountBalanceWalletIcon />}
                                label={`${parseFloat(balance).toFixed(4)} ETH`}
                                variant="outlined"
                            />
                            <Chip
                                label={formatAddress(account)}
                                color="primary"
                                variant="filled"
                            />
                        </Box>
                    ) : (
                        <Button variant="contained" color="primary" onClick={handleConnect}>
                            Connect Wallet
                        </Button>
                    )}
                </Box>
            </Toolbar>
        </AppBar>
    )
}

export default Navbar
