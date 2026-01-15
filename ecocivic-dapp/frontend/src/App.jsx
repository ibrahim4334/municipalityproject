import { Routes, Route } from 'react-router-dom'
import { Box, Container } from '@mui/material'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Recycling from './pages/Recycling'
import Water from './pages/Water'
import Admin from './pages/Admin'

function App() {
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Navbar />
            <Container component="main" sx={{ flexGrow: 1, py: 4 }} maxWidth="xl">
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/recycling" element={<Recycling />} />
                    <Route path="/water" element={<Water />} />
                    <Route path="/admin" element={<Admin />} />
                </Routes>
            </Container>
        </Box>
    )
}

export default App