import { useState, useEffect } from 'react';
import { Box, ToggleButtonGroup, ToggleButton, Typography, Chip } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import BadgeIcon from '@mui/icons-material/Badge';

/**
 * UserRoleSwitcher - Demo için rol değiştirme bileşeni
 * 
 * - Vatandaş: Beyan verir, QR alır, ödül kazanır
 * - Personel: Fiziksel kontrol yapar, onay/fraud işaretler
 * - Admin: İstatistik görür, fraud itirazlarında son kararı verir
 */
export default function UserRoleSwitcher({ onRoleChange }) {
    const [currentRole, setCurrentRole] = useState(() => {
        // LocalStorage'dan kayıtlı rolü al
        const saved = localStorage.getItem('demo_user_role');
        return saved || 'citizen';
    });

    useEffect(() => {
        // Rol değiştiğinde localStorage'a kaydet ve parent'a bildir
        localStorage.setItem('demo_user_role', currentRole);
        if (onRoleChange) {
            onRoleChange(currentRole);
        }
    }, [currentRole, onRoleChange]);

    const handleRoleChange = (event, newRole) => {
        if (newRole !== null) {
            setCurrentRole(newRole);
        }
    };

    const getRoleLabel = (role) => {
        switch (role) {
            case 'citizen': return 'Vatandaş';
            case 'admin': return 'Yönetici';
            case 'staff': return 'Personel';
            default: return role;
        }
    };

    const getRoleColor = (role) => {
        switch (role) {
            case 'citizen': return 'primary';
            case 'admin': return 'error';
            case 'staff': return 'success';
            default: return 'default';
        }
    };

    return (
        <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            p: 2,
            bgcolor: 'background.paper',
            borderRadius: 2,
            boxShadow: 1,
            mb: 3
        }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                🎭 Demo Modu:
            </Typography>

            <ToggleButtonGroup
                value={currentRole}
                exclusive
                onChange={handleRoleChange}
                aria-label="user role"
                size="small"
            >
                <ToggleButton value="citizen" aria-label="vatandaş">
                    <PersonIcon sx={{ mr: 0.5 }} />
                    👤 Vatandaş
                </ToggleButton>
                <ToggleButton value="staff" aria-label="personel">
                    <BadgeIcon sx={{ mr: 0.5 }} />
                    👷 Personel
                </ToggleButton>
                <ToggleButton value="admin" aria-label="yönetici">
                    <AdminPanelSettingsIcon sx={{ mr: 0.5 }} />
                    🛡️ Yönetici
                </ToggleButton>
            </ToggleButtonGroup>

            <Chip
                label={`Aktif: ${getRoleLabel(currentRole)}`}
                color={getRoleColor(currentRole)}
                size="small"
                sx={{ ml: 'auto' }}
            />
        </Box>
    );
}
