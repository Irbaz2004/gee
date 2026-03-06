import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Grid,
    Container,
    Button,
    Avatar,
    alpha
} from '@mui/material';
import { 
    Business as BusinessIcon, 
    ArrowForward as ArrowIcon,
    Logout as LogoutIcon 
} from '@mui/icons-material';
import { useCompany } from '../context/CompanyContext';
import { useAuth } from '../Auth/authcontext';

const CompanySelection = () => {
    const { selectCompany, companies = [] } = useCompany();
    const { logout } = useAuth();
    const navigate = useNavigate();

    const handleSelect = (companyId) => {
        selectCompany(companyId);
        navigate('/');
    };

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                background: 'radial-gradient(circle at top right, #1e293b, #0f172a)',
                py: 6
            }}
        >
            <Container maxWidth="lg">
                {/* Header Section */}
                <Box textAlign="center" mb={8}>
                    <Typography 
                        variant="h3" 
                        component="h1" 
                        sx={{ 
                            color: 'white', 
                            fontWeight: 800, 
                            letterSpacing: '-0.02em',
                            mb: 1 
                        }}
                    >
                        Welcome Back
                    </Typography>
                    <Typography 
                        variant="h6" 
                        sx={{ 
                            color: 'white', 
                            opacity: 0.8,
                            fontWeight: 400 
                        }}
                    >
                        Please select a workspace to continue
                    </Typography>
                </Box>

                {/* Companies Grid */}
                <Grid container spacing={3} justifyContent="center">
                    {companies.map((company) => (
                        <Grid item xs={12} sm={6} md={4} key={company.id} sx={{ display: 'flex' }}>
                            <Card
                                onClick={() => handleSelect(company.id)}
                                sx={{
                                    flex: 1, // Ensures all cards in a row have equal height
                                    display: 'flex',
                                    flexDirection: 'column',
                                    borderRadius: 4,
                                    bgcolor: alpha('#ffffff', 0.05),
                                    backdropFilter: 'blur(10px)',
                                    border: `1px solid ${alpha('#ffffff', 0.1)}`,
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    cursor: 'pointer',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    minWidth:'440px',
                                    '&:hover': {
                                        transform: 'translateY(-10px)',
                                        bgcolor: alpha('#ffffff', 0.08),
                                        borderColor: '#3b82f6',
                                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
                                        '& .select-btn': {
                                            bgcolor: '#3b82f6',
                                            color: 'white'
                                        }
                                    }
                                }}
                            >
                                <CardContent sx={{ 
                                    p: 5, 
                                    textAlign: 'center', 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    alignItems: 'center',
                                    flexGrow: 1 
                                }}>
                                    <Avatar
                                        sx={{
                                            width: 64,
                                            height: 64,
                                            bgcolor: alpha('#3b82f6', 0.1),
                                            color: '#3b82f6',
                                            mb: 3,
                                            border: `1px solid ${alpha('#3b82f6', 0.2)}`
                                        }}
                                    >
                                        <BusinessIcon sx={{ fontSize: 32 }} />
                                    </Avatar>

                                    <Typography 
                                        variant="h5" 
                                        sx={{ 
                                            color: 'white', 
                                            fontWeight: 700, 
                                            mb: 1,
                                            lineHeight: 1.2
                                        }}
                                    >
                                        {company.name}
                                    </Typography>
                                    
                                    <Typography 
                                        variant="body2" 
                                        sx={{ color: 'white', mb: 4, opacity: 0.7 }}
                                    >
                                        Enterprise Workspace
                                    </Typography>

                                    <Box sx={{ mt: 'auto', width: '100%' }}>
                                        <Button
                                            className="select-btn"
                                            fullWidth
                                            endIcon={<ArrowIcon />}
                                            sx={{
                                                borderRadius: 2,
                                                py: 1.5,
                                                textTransform: 'none',
                                                fontWeight: 600,
                                                color: alpha('#ffffff', 0.7),
                                                border: `1px solid ${alpha('#ffffff', 0.2)}`,
                                                transition: '0.3s'
                                            }}
                                        >
                                            Enter Workspace
                                        </Button>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>

                {/* Footer Action */}
                <Box textAlign="center" mt={8}>
                    <Button
                        startIcon={<LogoutIcon />}
                        onClick={logout}
                        sx={{ 
                            color: 'white', 
                            opacity: 0.6,
                            textTransform: 'none',
                            '&:hover': { 
                                opacity: 1, 
                                bgcolor: 'transparent',
                                textDecoration: 'underline'
                            } 
                        }}
                    >
                        Sign in as a different user
                    </Button>
                </Box>
            </Container>
        </Box>
    );
};

export default CompanySelection;